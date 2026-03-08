import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { hasPermission } from '@/lib/rbac-permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createErrorResponse, getStatusCode, handleGenericError } from '@/lib/error-handler';

const CriterionScoreSchema = z.object({
  criterionId: z.string(),
  points: z.number().min(0).max(10),
  comments: z.string().optional(),
});

const RubricScoreSchema = z.object({
  teamId: z.string(),
  scores: z.array(CriterionScoreSchema),
});

async function verifyAdmin(_req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    return null;
  }

  // ✅ SECURITY FIX: Hash cookie token before DB lookup
  const { hashSessionToken } = await import('@/lib/session-security');
  const session = await prisma.adminSession.findUnique({
    where: { token: hashSessionToken(token) },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.admin;
}

/**
 * POST /api/admin/teams/score-rubric
 * Submit criteria-based scores for a team
 *
 * CRITICAL: Judges can ONLY score APPROVED teams
 */
export async function POST(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      const err = createErrorResponse(
        'UNAUTHORIZED',
        'Authentication required',
        undefined,
        '/api/admin/teams/score-rubric'
      );
      return NextResponse.json(err, { status: getStatusCode('UNAUTHORIZED') });
    }

    // ✅ SECURITY FIX: Rate limit rubric scoring to 20 req/min per admin
    const rl = await checkRateLimit(`score-rubric:${admin.id}`, 20, 60);
    if (!rl.success) {
      const err = createErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many scoring requests. Please slow down.',
        undefined,
        '/api/admin/teams/score-rubric'
      );
      return NextResponse.json(err, {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
      });
    }

    // Check if admin has permission to score
    if (!hasPermission(admin.role, 'SCORE_TEAMS')) {
      const err = createErrorResponse(
        'FORBIDDEN',
        'Insufficient permissions to score submissions',
        undefined,
        '/api/admin/teams/score-rubric'
      );
      return NextResponse.json(err, { status: getStatusCode('FORBIDDEN') });
    }

    const body = await req.json();
    const validation = RubricScoreSchema.safeParse(body);

    if (!validation.success) {
      const err = createErrorResponse(
        'VALIDATION_ERROR',
        validation.error.errors[0].message,
        validation.error.errors,
        '/api/admin/teams/score-rubric'
      );
      return NextResponse.json(err, { status: 400 });
    }

    const { teamId, scores } = validation.data;

    // Get team with submission
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { submission: true },
    });

    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }

    // ⭐ CRITICAL: Judges can ONLY score APPROVED teams
    if (team.status !== 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          error: 'TEAM_NOT_APPROVED',
          message: `Cannot score team with status: ${team.status}. Only APPROVED teams can be scored.`,
        },
        { status: 403 }
      );
    }

    if (!team.submission) {
      const err = createErrorResponse(
        'NOT_FOUND',
        'Team has no submission',
        undefined,
        '/api/admin/teams/score-rubric'
      );
      return NextResponse.json(err, { status: getStatusCode('NOT_FOUND') });
    }

    const submissionId = team.submission.id;

    // Get criteria to validate and calculate weighted score
    const criteria = await prisma.scoringCriterion.findMany({
      where: {
        track: team.track,
        isActive: true,
      },
    });

    // Validate all criteria are scored
    const criteriaIds = new Set(criteria.map((c) => c.criterionId));
    const scoredIds = new Set(scores.map((s) => s.criterionId));

    const missingCriteria = Array.from(criteriaIds).filter((id) => !scoredIds.has(id));
    if (missingCriteria.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'INCOMPLETE_SCORING',
          message: `Missing scores for criteria: ${missingCriteria.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Calculate weighted total score and build criterion map
    let totalWeightedScore = 0;
    const criteriaMap = new Map(criteria.map((c) => [c.criterionId, c]));
    const criterionIdToDbId = new Map(criteria.map((c) => [c.criterionId, c.id]));

    for (const score of scores) {
      const criterion = criteriaMap.get(score.criterionId);
      if (!criterion) {
        return NextResponse.json(
          {
            success: false,
            error: 'INVALID_CRITERION',
            message: `Invalid criterion: ${score.criterionId}`,
          },
          { status: 400 }
        );
      }

      // Validate points don't exceed maxPoints
      if (score.points > criterion.maxPoints) {
        return NextResponse.json(
          {
            success: false,
            error: 'INVALID_POINTS',
            message: `Points for ${criterion.name} exceed maximum of ${criterion.maxPoints}`,
          },
          { status: 400 }
        );
      }

      // Calculate weighted score
      const normalizedScore = (score.points / criterion.maxPoints) * 100;
      const weightedScore = (normalizedScore * criterion.weight) / 100;
      totalWeightedScore += weightedScore;
    }

    // Round to 1 decimal place
    totalWeightedScore = Math.round(totalWeightedScore * 10) / 10;

    // Use transaction to save all scores atomically
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing scores from this judge for this submission
      await tx.criterionScore.deleteMany({
        where: {
          submissionId: submissionId,
          judgeId: admin.id,
        },
      });

      // Create new scores
      const createdScores = await Promise.all(
        scores.map((score) =>
          tx.criterionScore.create({
            data: {
              submissionId: submissionId,
              criterionId: criterionIdToDbId.get(score.criterionId) ?? score.criterionId, // Use database ID, validated above
              judgeId: admin.id,
              judgeName: admin.name,
              points: score.points,
              comments: score.comments || null,
            },
          })
        )
      );

      // ═══════════════════════════════════════════════════════════
      // MULTI-JUDGE: Recalculate average score across ALL judges
      // ═══════════════════════════════════════════════════════════
      const allScores = await tx.criterionScore.findMany({
        where: { submissionId: submissionId },
        include: { criterion: true },
      });

      // Group scores by judgeId to calculate per-judge weighted totals
      const judgeScores = new Map<string, { judgeName: string; weightedTotal: number }>();
      const judgeNames: string[] = [];

      for (const cs of allScores) {
        let entry = judgeScores.get(cs.judgeId);
        if (!entry) {
          entry = { judgeName: cs.judgeName, weightedTotal: 0 };
          judgeScores.set(cs.judgeId, entry);
          judgeNames.push(cs.judgeName);
        }
        const normalizedScore = (cs.points / cs.criterion.maxPoints) * 100;
        const weightedScore = (normalizedScore * cs.criterion.weight) / 100;
        entry.weightedTotal += weightedScore;
      }

      // Calculate average across all judges
      const judgeCount = judgeScores.size;
      const averageScore =
        judgeCount > 0
          ? Math.round(
              (Array.from(judgeScores.values()).reduce((sum, j) => sum + j.weightedTotal, 0) /
                judgeCount) *
                10
            ) / 10
          : totalWeightedScore;

      // Update submission with AVERAGED total score
      const updatedSubmission = await tx.submission.update({
        where: { id: submissionId },
        data: {
          judgeScore: averageScore,
          judgeComments:
            judgeCount > 1
              ? `Average of ${judgeCount} judges: ${judgeNames.join(', ')}`
              : `Scored using rubric by ${admin.name}`,
        },
      });

      return { createdScores, updatedSubmission, judgeCount, averageScore };
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: null,
        action: 'submission.scored_rubric',
        entity: 'Submission',
        entityId: team.submission.id,
        metadata: {
          teamId: team.id,
          teamName: team.name,
          totalScore: totalWeightedScore,
          criteriaCount: scores.length,
          judgeId: admin.id,
          judgeName: admin.name,
          judgeEmail: admin.email,
          scores: scores.map((s) => ({
            criterionId: s.criterionId,
            points: s.points,
            hasComments: !!s.comments,
          })),
        },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        submissionId: result.updatedSubmission.id,
        yourScore: totalWeightedScore,
        averageScore: result.averageScore,
        judgeCount: result.judgeCount,
        criteriaScored: result.createdScores.length,
      },
      message:
        result.judgeCount > 1
          ? `Score submitted. Average of ${result.judgeCount} judges: ${result.averageScore}`
          : 'Rubric scores submitted successfully',
    });
  } catch (error) {
    return handleGenericError(error, '/api/admin/teams/score-rubric');
  }
}

/**
 * GET /api/admin/teams/score-rubric?teamId={id}
 * Get rubric scores for a team with multi-judge support
 *
 * Returns:
 * - Your scores (current judge)
 * - All judges' scores (for admins/organizers)
 * - Average score across judges
 * - Score variance and conflict flags
 */
export async function GET(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      const err = createErrorResponse(
        'UNAUTHORIZED',
        'Authentication required',
        undefined,
        '/api/admin/teams/score-rubric'
      );
      return NextResponse.json(err, { status: getStatusCode('UNAUTHORIZED') });
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      const err = createErrorResponse(
        'BAD_REQUEST',
        'Missing teamId parameter',
        undefined,
        '/api/admin/teams/score-rubric'
      );
      return NextResponse.json(err, { status: getStatusCode('BAD_REQUEST') });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        submission: {
          include: {
            criterionScores: {
              include: {
                criterion: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      const err = createErrorResponse(
        'NOT_FOUND',
        'Team not found',
        undefined,
        '/api/admin/teams/score-rubric'
      );
      return NextResponse.json(err, { status: getStatusCode('NOT_FOUND') });
    }

    // Get criteria for this track
    const criteria = await prisma.scoringCriterion.findMany({
      where: {
        track: team.track,
        isActive: true,
      },
      orderBy: {
        order: 'asc',
      },
    });

    // Judges can only view scores for approved teams
    if (admin.role === 'JUDGE' && team.status !== 'APPROVED') {
      return NextResponse.json(
        { success: false, error: 'Cannot view scores for non-approved team' },
        { status: 403 }
      );
    }

    const allCriterionScores = team.submission?.criterionScores || [];

    // ═══════════════════════════════════════════════════════════
    // MULTI-JUDGE: Build per-judge breakdowns
    // ═══════════════════════════════════════════════════════════
    const judgeMap = new Map<
      string,
      {
        judgeId: string;
        judgeName: string;
        scores: { criterionId: string; points: number; comments: string | null }[];
        weightedTotal: number;
      }
    >();

    for (const cs of allCriterionScores) {
      if (!judgeMap.has(cs.judgeId)) {
        judgeMap.set(cs.judgeId, {
          judgeId: cs.judgeId,
          judgeName: cs.judgeName,
          scores: [],
          weightedTotal: 0,
        });
      }
      const judge = judgeMap.get(cs.judgeId)!;
      judge.scores.push({
        criterionId: cs.criterion.criterionId,
        points: cs.points,
        comments: cs.comments,
      });
      const normalizedScore = (cs.points / cs.criterion.maxPoints) * 100;
      const weightedScore = (normalizedScore * cs.criterion.weight) / 100;
      judge.weightedTotal += weightedScore;
    }

    // Round weighted totals
    for (const judge of judgeMap.values()) {
      judge.weightedTotal = Math.round(judge.weightedTotal * 10) / 10;
    }

    const judges = Array.from(judgeMap.values());
    const judgeCount = judges.length;

    // Calculate average + variance
    const averageScore =
      judgeCount > 0
        ? Math.round((judges.reduce((sum, j) => sum + j.weightedTotal, 0) / judgeCount) * 10) / 10
        : null;

    // Score variance (standard deviation)
    let variance = 0;
    let stdDev = 0;
    if (judgeCount > 1 && averageScore !== null) {
      variance =
        judges.reduce((sum, j) => sum + Math.pow(j.weightedTotal - averageScore, 2), 0) /
        judgeCount;
      stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
    }

    // Conflict detection: flag if any two judges differ by > 15 points
    const CONFLICT_THRESHOLD = 15;
    const conflicts: { judge1: string; judge2: string; diff: number }[] = [];
    for (let i = 0; i < judges.length; i++) {
      for (let j = i + 1; j < judges.length; j++) {
        const diff = Math.abs(judges[i].weightedTotal - judges[j].weightedTotal);
        if (diff > CONFLICT_THRESHOLD) {
          conflicts.push({
            judge1: judges[i].judgeName,
            judge2: judges[j].judgeName,
            diff: Math.round(diff * 10) / 10,
          });
        }
      }
    }

    // Per-criterion average scores
    const criterionAverages: Record<
      string,
      { average: number; min: number; max: number; count: number }
    > = {};
    for (const criterion of criteria) {
      const scoresForCriterion = allCriterionScores.filter(
        (cs) => cs.criterion.criterionId === criterion.criterionId
      );
      if (scoresForCriterion.length > 0) {
        const points = scoresForCriterion.map((cs) => cs.points);
        criterionAverages[criterion.criterionId] = {
          average: Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 10) / 10,
          min: Math.min(...points),
          max: Math.max(...points),
          count: points.length,
        };
      }
    }

    // Current judge's scores
    const myScores = allCriterionScores
      .filter((cs) => cs.judgeId === admin.id)
      .map((cs) => ({
        criterionId: cs.criterion.criterionId,
        points: cs.points,
        comments: cs.comments,
      }));

    // For admins, show all judges; for judges, only show their own + summary
    const isAdmin = admin.role !== 'JUDGE';

    return NextResponse.json({
      success: true,
      data: {
        teamId: team.id,
        teamName: team.name,
        track: team.track,
        status: team.status,
        canScore: team.status === 'APPROVED',
        criteria,
        // Current judge's scores
        scores: myScores,
        // Multi-judge data
        multiJudge: {
          judgeCount,
          averageScore,
          stdDev,
          hasConflicts: conflicts.length > 0,
          conflicts,
          criterionAverages,
          // Admins see all judges; judges see summary only
          judges: isAdmin
            ? judges
            : judges.map((j) => ({
                judgeId: j.judgeId,
                judgeName: j.judgeId === admin.id ? j.judgeName : 'Other Judge',
                weightedTotal: j.weightedTotal,
                isYou: j.judgeId === admin.id,
              })),
        },
        totalScore: team.submission?.judgeScore || null,
      },
    });
  } catch (error) {
    return handleGenericError(error, '/api/admin/teams/score-rubric');
  }
}
