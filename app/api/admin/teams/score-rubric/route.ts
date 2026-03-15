import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { hasPermission } from '@/lib/rbac-permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createErrorResponse, getStatusCode, handleGenericError } from '@/lib/error-handler';

// ── Constants ─────────────────────────────────────────────────
const LOW_SCORE_THRESHOLD = 5; // Mandatory comment required if points < this value

const CriterionScoreSchema = z.object({
  criterionId: z.string(),
  points: z.number().min(0).max(10),
  comments: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(), // 0–100 judge confidence in this score
});

const RubricScoreSchema = z.object({
  teamId: z.string(),
  scores: z.array(CriterionScoreSchema),
});

async function verifyAdmin(_req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token) return null;

  const { hashSessionToken } = await import('@/lib/session-security');
  const session = await prisma.adminSession.findUnique({
    where: { token: hashSessionToken(token) },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.admin;
}

// ── Z-score normalization helpers ─────────────────────────────

/**
 * Compute each judge's historical mean and std dev across all their criterion scores.
 * Used so a lenient judge's 8 and a strict judge's 8 are normalised to the same value.
 */
async function getJudgeNormStats(judgeId: string): Promise<{ mean: number; stdDev: number }> {
  const allScores = await prisma.criterionScore.findMany({
    where: { judgeId },
    select: { points: true, criterion: { select: { maxPoints: true, weight: true } } },
  });

  if (allScores.length < 2) return { mean: 0, stdDev: 1 }; // Not enough data to normalise

  // Convert each raw score to a 0-100 weighted value for fair comparison
  const normalised = allScores.map((s) => {
    const norm = (s.points / s.criterion.maxPoints) * 100;
    return (norm * s.criterion.weight) / 100;
  });

  const mean = normalised.reduce((a, b) => a + b, 0) / normalised.length;
  const variance =
    normalised.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / normalised.length;
  const stdDev = Math.sqrt(variance) || 1;

  return { mean, stdDev };
}

/**
 * POST /api/admin/teams/score-rubric
 *
 * Submit criteria-based scores for a team.
 * Advanced features:
 *  - Confidence-weighted multi-judge average
 *  - Z-score normalization (eliminates per-judge leniency bias)
 *  - Mandatory comment when points < LOW_SCORE_THRESHOLD
 *  - Full audit trail written to ScoreAuditLog before overwrite
 */
export async function POST(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json(
        createErrorResponse('UNAUTHORIZED', 'Authentication required', undefined, '/api/admin/teams/score-rubric'),
        { status: getStatusCode('UNAUTHORIZED') }
      );
    }

    const rl = await checkRateLimit(`score-rubric:${admin.id}`, 20, 60);
    if (!rl.success) {
      return NextResponse.json(
        createErrorResponse('RATE_LIMIT_EXCEEDED', 'Too many scoring requests. Please slow down.', undefined, '/api/admin/teams/score-rubric'),
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      );
    }

    if (!hasPermission(admin.role, 'SCORE_TEAMS')) {
      return NextResponse.json(
        createErrorResponse('FORBIDDEN', 'Insufficient permissions to score submissions', undefined, '/api/admin/teams/score-rubric'),
        { status: getStatusCode('FORBIDDEN') }
      );
    }

    const body = await req.json();
    const validation = RubricScoreSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', validation.error.errors[0].message, validation.error.errors, '/api/admin/teams/score-rubric'),
        { status: 400 }
      );
    }

    const { teamId, scores } = validation.data;

    // ── Rubric-enforced Justification: mandatory comment for low scores ────
    const lowScoresWithoutComment = scores.filter(
      (s) => s.points < LOW_SCORE_THRESHOLD && !s.comments?.trim()
    );
    if (lowScoresWithoutComment.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'COMMENT_REQUIRED',
          message: `Scores below ${LOW_SCORE_THRESHOLD}/10 require a justification comment. Please add comments for: ${lowScoresWithoutComment.map((s) => s.criterionId).join(', ')}`,
          fields: lowScoresWithoutComment.map((s) => s.criterionId),
        },
        { status: 400 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { submission: true },
    });

    if (!team) return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });

    if (team.status !== 'APPROVED' && team.status !== 'SHORTLISTED') {
      return NextResponse.json(
        { success: false, error: 'TEAM_NOT_ELIGIBLE', message: `Cannot score team with status: ${team.status}.` },
        { status: 403 }
      );
    }

    if (!team.submission) {
      return NextResponse.json(
        createErrorResponse('NOT_FOUND', 'Team has no submission', undefined, '/api/admin/teams/score-rubric'),
        { status: getStatusCode('NOT_FOUND') }
      );
    }

    const submissionId = team.submission.id;

    const criteria = await prisma.scoringCriterion.findMany({
      where: { track: team.track, isActive: true },
    });

    const criteriaIds = new Set(criteria.map((c) => c.criterionId));
    const scoredIds = new Set(scores.map((s) => s.criterionId));
    const missingCriteria = Array.from(criteriaIds).filter((id) => !scoredIds.has(id));
    if (missingCriteria.length > 0) {
      return NextResponse.json(
        { success: false, error: 'INCOMPLETE_SCORING', message: `Missing scores for criteria: ${missingCriteria.join(', ')}` },
        { status: 400 }
      );
    }

    let totalWeightedScore = 0;
    const criteriaMap = new Map(criteria.map((c) => [c.criterionId, c]));
    const criterionIdToDbId = new Map(criteria.map((c) => [c.criterionId, c.id]));

    for (const score of scores) {
      const criterion = criteriaMap.get(score.criterionId);
      if (!criterion) {
        return NextResponse.json({ success: false, error: 'INVALID_CRITERION', message: `Invalid criterion: ${score.criterionId}` }, { status: 400 });
      }
      if (score.points > criterion.maxPoints) {
        return NextResponse.json({ success: false, error: 'INVALID_POINTS', message: `Points for ${criterion.name} exceed maximum of ${criterion.maxPoints}` }, { status: 400 });
      }
      const normalizedScore = (score.points / criterion.maxPoints) * 100;
      totalWeightedScore += (normalizedScore * criterion.weight) / 100;
    }
    totalWeightedScore = Math.round(totalWeightedScore * 10) / 10;

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    // ── Fetch existing scores to build audit snapshots ────────────────────
    const existingScores = await prisma.criterionScore.findMany({
      where: { submissionId, judgeId: admin.id },
    });
    const existingMap = new Map(existingScores.map((s) => [s.criterionId, s]));

    const result = await prisma.$transaction(async (tx) => {
      // ── Audit Trail: snapshot old values → ScoreAuditLog ─────────────
      if (existingScores.length > 0) {
        await tx.scoreAuditLog.createMany({
          data: existingScores.map((old) => {
            const incoming = scores.find(
              (s) => (criterionIdToDbId.get(s.criterionId) ?? s.criterionId) === old.criterionId
            );
            return {
              submissionId,
              criterionId: old.criterionId,
              judgeId: admin.id,
              judgeName: admin.name,
              oldPoints: old.points,
              newPoints: incoming?.points ?? old.points,
              oldComments: old.comments,
              newComments: incoming?.comments ?? old.comments ?? null,
              confidence: incoming?.confidence ?? old.confidence ?? null,
              ipAddress,
            };
          }),
        });
      }

      // Delete and recreate (upsert pattern)
      await tx.criterionScore.deleteMany({ where: { submissionId, judgeId: admin.id } });

      const createdScores = await Promise.all(
        scores.map((score) =>
          tx.criterionScore.create({
            data: {
              submissionId,
              criterionId: criterionIdToDbId.get(score.criterionId) ?? score.criterionId,
              judgeId: admin.id,
              judgeName: admin.name,
              points: score.points,
              comments: score.comments || null,
              confidence: score.confidence ?? null,
              previousPoints: existingMap.get(criterionIdToDbId.get(score.criterionId) ?? score.criterionId)?.points ?? null,
            },
          })
        )
      );

      // ── Multi-judge: fetch ALL scores, compute confidence-weighted avg ─
      const allScores = await tx.criterionScore.findMany({
        where: { submissionId },
        include: { criterion: true },
      });

      // Group by judge → weighted total
      const judgeMap = new Map<string, { judgeName: string; weightedTotal: number; confidence: number | null }>();
      for (const cs of allScores) {
        let entry = judgeMap.get(cs.judgeId);
        if (!entry) {
          entry = { judgeName: cs.judgeName, weightedTotal: 0, confidence: cs.confidence };
          judgeMap.set(cs.judgeId, entry);
        }
        const norm = (cs.points / cs.criterion.maxPoints) * 100;
        entry.weightedTotal += (norm * cs.criterion.weight) / 100;
        // Combine confidences: use the min if multiple criterion confidences differ
        if (cs.confidence !== null && (entry.confidence === null || cs.confidence < entry.confidence)) {
          entry.confidence = cs.confidence;
        }
      }

      const judges = Array.from(judgeMap.values());
      const judgeCount = judges.length;

      // ── Confidence-weighted average ───────────────────────────────────
      let averageScore: number;
      const totalConfidence = judges.reduce((s, j) => s + (j.confidence ?? 50), 0); // default confidence 50

      if (judgeCount === 0) {
        averageScore = totalWeightedScore;
      } else if (judges.every((j) => j.confidence === null)) {
        // No confidence provided — fall back to simple mean
        averageScore = judges.reduce((sum, j) => sum + j.weightedTotal, 0) / judgeCount;
      } else {
        averageScore =
          judges.reduce((sum, j) => sum + j.weightedTotal * (j.confidence ?? 50), 0) /
          (totalConfidence || 1);
      }

      // ── Z-score normalization (inter-judge calibration) ───────────────
      // For each judge, normalise their weighted total using their historical bias.
      // Then take the mean of normalised values.
      let normalizedAverage = averageScore;
      if (judgeCount >= 2) {
        const normalizedTotals: number[] = await Promise.all(
          Array.from(judgeMap.entries()).map(async ([judgeId, data]) => {
            const { mean, stdDev } = await getJudgeNormStats(judgeId);
            if (stdDev === 0 || mean === 0) return data.weightedTotal;
            // Global reference: 50 mean, 15 std dev (hackathon calibration baseline)
            const z = (data.weightedTotal - mean) / stdDev;
            return Math.max(0, Math.min(100, 50 + z * 15));
          })
        );
        normalizedAverage =
          normalizedTotals.reduce((a, b) => a + b, 0) / normalizedTotals.length;
      }

      normalizedAverage = Math.round(normalizedAverage * 10) / 10;
      averageScore = Math.round(averageScore * 10) / 10;

      const judgeNames = judges.map((j) => j.judgeName);

      const updatedSubmission = await tx.submission.update({
        where: { id: submissionId },
        data: {
          judgeScore: normalizedAverage,
          judgeComments:
            judgeCount > 1
              ? `Normalised avg of ${judgeCount} judges (${judgeNames.join(', ')}). Raw avg: ${averageScore}`
              : `Scored by ${admin.name}${scores[0]?.confidence ? ` (confidence: ${scores[0].confidence}%)` : ''}`,
        },
      });

      return { createdScores, updatedSubmission, judgeCount, averageScore, normalizedAverage };
    });

    // Activity log
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
          normalizedScore: result.normalizedAverage,
          criteriaCount: scores.length,
          judgeId: admin.id,
          judgeName: admin.name,
          scores: scores.map((s) => ({
            criterionId: s.criterionId,
            points: s.points,
            confidence: s.confidence ?? null,
            hasComments: !!s.comments,
          })),
        },
        ipAddress,
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        submissionId: result.updatedSubmission.id,
        yourScore: totalWeightedScore,
        averageScore: result.averageScore,
        normalizedScore: result.normalizedAverage,
        judgeCount: result.judgeCount,
        criteriaScored: result.createdScores.length,
      },
      message:
        result.judgeCount > 1
          ? `Score submitted. Normalised average of ${result.judgeCount} judges: ${result.normalizedAverage}`
          : 'Rubric scores submitted successfully',
    });
  } catch (error) {
    return handleGenericError(error, '/api/admin/teams/score-rubric');
  }
}

/**
 * GET /api/admin/teams/score-rubric?teamId={id}
 * Get rubric scores for a team with multi-judge support including audit trail link.
 */
export async function GET(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json(
        createErrorResponse('UNAUTHORIZED', 'Authentication required', undefined, '/api/admin/teams/score-rubric'),
        { status: getStatusCode('UNAUTHORIZED') }
      );
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');
    if (!teamId) {
      return NextResponse.json(
        createErrorResponse('BAD_REQUEST', 'Missing teamId parameter', undefined, '/api/admin/teams/score-rubric'),
        { status: getStatusCode('BAD_REQUEST') }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        submission: {
          include: {
            criterionScores: { include: { criterion: true } },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        createErrorResponse('NOT_FOUND', 'Team not found', undefined, '/api/admin/teams/score-rubric'),
        { status: getStatusCode('NOT_FOUND') }
      );
    }

    const criteria = await prisma.scoringCriterion.findMany({
      where: { track: team.track, isActive: true },
      orderBy: { order: 'asc' },
    });

    if (admin.role === 'JUDGE' && team.status !== 'APPROVED' && team.status !== 'SHORTLISTED') {
      return NextResponse.json(
        { success: false, error: 'Cannot view scores for teams not approved or shortlisted' },
        { status: 403 }
      );
    }

    const allCriterionScores = team.submission?.criterionScores || [];
    const judgeMap = new Map<
      string,
      {
        judgeId: string;
        judgeName: string;
        scores: { criterionId: string; points: number; comments: string | null; confidence: number | null }[];
        weightedTotal: number;
        avgConfidence: number | null;
      }
    >();

    for (const cs of allCriterionScores) {
      if (!judgeMap.has(cs.judgeId)) {
        judgeMap.set(cs.judgeId, { judgeId: cs.judgeId, judgeName: cs.judgeName, scores: [], weightedTotal: 0, avgConfidence: null });
      }
      const judge = judgeMap.get(cs.judgeId)!;
      judge.scores.push({ criterionId: cs.criterion.criterionId, points: cs.points, comments: cs.comments, confidence: cs.confidence ?? null });
      const norm = (cs.points / cs.criterion.maxPoints) * 100;
      judge.weightedTotal += (norm * cs.criterion.weight) / 100;
      if (cs.confidence !== null) {
        judge.avgConfidence = cs.confidence;
      }
    }

    for (const j of judgeMap.values()) {
      j.weightedTotal = Math.round(j.weightedTotal * 10) / 10;
    }

    const judges = Array.from(judgeMap.values());
    const judgeCount = judges.length;
    const averageScore =
      judgeCount > 0
        ? Math.round((judges.reduce((s, j) => s + j.weightedTotal, 0) / judgeCount) * 10) / 10
        : null;

    let stdDev = 0;
    if (judgeCount > 1 && averageScore !== null) {
      const variance = judges.reduce((s, j) => s + Math.pow(j.weightedTotal - averageScore, 2), 0) / judgeCount;
      stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
    }

    const CONFLICT_THRESHOLD = 15;
    const conflicts: { judge1: string; judge2: string; diff: number }[] = [];
    for (let i = 0; i < judges.length; i++) {
      for (let j = i + 1; j < judges.length; j++) {
        const diff = Math.abs(judges[i].weightedTotal - judges[j].weightedTotal);
        if (diff > CONFLICT_THRESHOLD) {
          conflicts.push({ judge1: judges[i].judgeName, judge2: judges[j].judgeName, diff: Math.round(diff * 10) / 10 });
        }
      }
    }

    const criterionAverages: Record<string, { average: number; min: number; max: number; count: number }> = {};
    for (const criterion of criteria) {
      const scoresForCriterion = allCriterionScores.filter((cs) => cs.criterion.criterionId === criterion.criterionId);
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

    const myScores = allCriterionScores
      .filter((cs) => cs.judgeId === admin.id)
      .map((cs) => ({
        criterionId: cs.criterion.criterionId,
        points: cs.points,
        comments: cs.comments,
        confidence: cs.confidence ?? null,
      }));

    const isAdmin = admin.role !== 'JUDGE';

    // Audit log count for admins
    const auditCount = isAdmin
      ? await prisma.scoreAuditLog.count({ where: { submissionId: team.submission?.id } })
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        teamId: team.id,
        teamName: team.name,
        track: team.track,
        status: team.status,
        canScore: team.status === 'APPROVED',
        lowScoreThreshold: LOW_SCORE_THRESHOLD,
        criteria,
        scores: myScores,
        multiJudge: {
          judgeCount,
          averageScore,
          stdDev,
          hasConflicts: conflicts.length > 0,
          conflicts,
          criterionAverages,
          auditCount,
          judges: isAdmin
            ? judges
            : judges.map((j) => ({
                judgeId: j.judgeId,
                judgeName: j.judgeId === admin.id ? j.judgeName : 'Other Judge',
                weightedTotal: j.weightedTotal,
                avgConfidence: j.avgConfidence,
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
