import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requirePermission, type AdminRole } from '@/lib/rbac';
import { checkRateLimit } from '@/lib/rate-limit';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { token },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.admin;
}

/**
 * GET /api/admin/analytics/scoring
 * 
 * Comprehensive scoring analytics endpoint:
 * - Overall scoring stats (teams scored, avg scores, distributions)
 * - Criterion-wise comparison across tracks
 * - Judge consistency metrics (ICC-inspired, per-judge bias)
 * - Conflict summary
 * - Score distribution histogram
 * 
 * Query params:
 * - track: "IDEA_SPRINT" | "BUILD_STORM" (optional filter)
 */
export async function GET(req: Request) {
  try {
    // ✅ SECURITY FIX: Rate limit scoring analytics endpoint
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`admin-scoring-analytics:${ip}`, 30, 60);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      );
    }

    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!requirePermission(admin.role as AdminRole, 'viewAnalytics')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const trackFilter = searchParams.get('track');

    // ═══════════════════════════════════════════════════════════
    // 1. OVERALL SCORING STATS
    // ═══════════════════════════════════════════════════════════
    
    const approvedTeamFilter: Record<string, unknown> = {
      deletedAt: null,
      status: 'APPROVED',
    };
    if (trackFilter) approvedTeamFilter.track = trackFilter;

    const [totalApproved, teamsWithScores] = await Promise.all([
      prisma.team.count({ where: approvedTeamFilter }),
      prisma.team.findMany({
        where: {
          ...approvedTeamFilter,
          submission: {
            criterionScores: { some: {} },
          },
        },
        include: {
          submission: {
            select: {
              id: true,
              judgeScore: true,
              criterionScores: {
                include: { criterion: true },
              },
            },
          },
        },
      }),
    ]);

    const scoredTeams = teamsWithScores.length;
    const unscoredTeams = totalApproved - scoredTeams;

    // Score value aggregation
    const teamScores = teamsWithScores
      .map((t) => t.submission?.judgeScore)
      .filter((s): s is number => s !== null && s !== undefined);

    const avgTeamScore = teamScores.length > 0
      ? Math.round((teamScores.reduce((a, b) => a + b, 0) / teamScores.length) * 10) / 10
      : 0;
    const minScore = teamScores.length > 0 ? Math.min(...teamScores) : 0;
    const maxScore = teamScores.length > 0 ? Math.max(...teamScores) : 0;
    const medianScore = teamScores.length > 0
      ? (() => {
          const sorted = [...teamScores].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0
            ? sorted[mid]
            : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
        })()
      : 0;

    // Score distribution histogram (0-10, 10-20, ..., 90-100)
    const scoreDistribution = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${(i + 1) * 10}`,
      count: teamScores.filter((s) => s >= i * 10 && s < (i + 1) * 10 + (i === 9 ? 1 : 0)).length,
    }));

    // ═══════════════════════════════════════════════════════════
    // 2. CRITERION-WISE COMPARISON
    // ═══════════════════════════════════════════════════════════
    
    const tracks = trackFilter ? [trackFilter] : ['IDEA_SPRINT', 'BUILD_STORM'];
    const criteria = await prisma.scoringCriterion.findMany({
      where: { track: { in: tracks as any }, isActive: true },
      orderBy: { order: 'asc' },
    });

    // Aggregate all criterion scores
    const allCriterionScores = await prisma.criterionScore.findMany({
      where: {
        submission: {
          team: {
            deletedAt: null,
            status: 'APPROVED',
            ...(trackFilter ? { track: trackFilter as any } : {}),
          },
        },
      },
      include: { criterion: true },
    });

    // Per-criterion stats
    const criterionStats: {
      criterionId: string;
      name: string;
      track: string;
      weight: number;
      avgPoints: number;
      minPoints: number;
      maxPoints: number;
      maxPossible: number;
      scoreCount: number;
      stdDev: number;
    }[] = [];

    for (const criterion of criteria) {
      const scores = allCriterionScores
        .filter((cs) => cs.criterionId === criterion.id)
        .map((cs) => cs.points);

      if (scores.length === 0) {
        criterionStats.push({
          criterionId: criterion.criterionId,
          name: criterion.name,
          track: criterion.track,
          weight: criterion.weight,
          avgPoints: 0,
          minPoints: 0,
          maxPoints: 0,
          maxPossible: criterion.maxPoints,
          scoreCount: 0,
          stdDev: 0,
        });
        continue;
      }

      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;

      criterionStats.push({
        criterionId: criterion.criterionId,
        name: criterion.name,
        track: criterion.track,
        weight: criterion.weight,
        avgPoints: Math.round(avg * 10) / 10,
        minPoints: Math.min(...scores),
        maxPoints: Math.max(...scores),
        maxPossible: criterion.maxPoints,
        scoreCount: scores.length,
        stdDev: Math.round(Math.sqrt(variance) * 10) / 10,
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 3. JUDGE CONSISTENCY METRICS
    // ═══════════════════════════════════════════════════════════
    
    // Group all criterion scores by judge
    const judgeStatsMap = new Map<string, {
      judgeId: string;
      judgeName: string;
      teamsScored: Set<string>;
      allWeightedScores: number[];
      criterionScores: number[];
    }>();

    // Group scores by submission+judge to calculate per-team weighted totals
    const submissionJudgeMap = new Map<string, Map<string, { judgeName: string; weighted: number }>>();

    for (const cs of allCriterionScores) {
      const key = cs.submissionId;
      if (!submissionJudgeMap.has(key)) {
        submissionJudgeMap.set(key, new Map());
      }
      const judgeMap = submissionJudgeMap.get(key)!;
      if (!judgeMap.has(cs.judgeId)) {
        judgeMap.set(cs.judgeId, { judgeName: cs.judgeName, weighted: 0 });
      }
      const normalizedScore = (cs.points / cs.criterion.maxPoints) * 100;
      const weightedScore = (normalizedScore * cs.criterion.weight) / 100;
      judgeMap.get(cs.judgeId)!.weighted += weightedScore;

      // Track per-judge stats
      if (!judgeStatsMap.has(cs.judgeId)) {
        judgeStatsMap.set(cs.judgeId, {
          judgeId: cs.judgeId,
          judgeName: cs.judgeName,
          teamsScored: new Set(),
          allWeightedScores: [],
          criterionScores: [],
        });
      }
      const jStats = judgeStatsMap.get(cs.judgeId)!;
      jStats.teamsScored.add(cs.submissionId);
      jStats.criterionScores.push(cs.points);
    }

    // Calculate per-judge weighted totals per team
    for (const [, judgeMap] of submissionJudgeMap) {
      for (const [judgeId, data] of judgeMap) {
        const jStats = judgeStatsMap.get(judgeId);
        if (jStats) {
          jStats.allWeightedScores.push(data.weighted);
        }
      }
    }

    // Grand mean of all weighted scores
    const allWeightedScoresFlat = Array.from(judgeStatsMap.values()).flatMap((j) => j.allWeightedScores);
    const grandMean = allWeightedScoresFlat.length > 0
      ? allWeightedScoresFlat.reduce((a, b) => a + b, 0) / allWeightedScoresFlat.length
      : 0;

    const judgeConsistency = Array.from(judgeStatsMap.values()).map((j) => {
      const teamsScored = j.teamsScored.size;
      const avgScore = j.allWeightedScores.length > 0
        ? Math.round(
            (j.allWeightedScores.reduce((a, b) => a + b, 0) / j.allWeightedScores.length) * 10
          ) / 10
        : 0;

      // Bias: how far this judge's average is from the grand mean
      const bias = Math.round((avgScore - grandMean) * 10) / 10;

      // Internal consistency: std dev of this judge's scores
      let internalStdDev = 0;
      if (j.allWeightedScores.length > 1) {
        const variance = j.allWeightedScores.reduce(
          (sum, s) => sum + Math.pow(s - avgScore, 2),
          0
        ) / j.allWeightedScores.length;
        internalStdDev = Math.round(Math.sqrt(variance) * 10) / 10;
      }

      // Leniency indicator
      let leniency: 'lenient' | 'strict' | 'neutral' = 'neutral';
      if (bias > 5) leniency = 'lenient';
      else if (bias < -5) leniency = 'strict';

      return {
        judgeId: j.judgeId,
        judgeName: j.judgeName,
        teamsScored,
        avgScore,
        bias,
        leniency,
        internalStdDev,
        scoreRange: {
          min: j.allWeightedScores.length > 0 ? Math.round(Math.min(...j.allWeightedScores) * 10) / 10 : 0,
          max: j.allWeightedScores.length > 0 ? Math.round(Math.max(...j.allWeightedScores) * 10) / 10 : 0,
        },
      };
    });

    // ═══════════════════════════════════════════════════════════
    // 4. CONFLICT SUMMARY
    // ═══════════════════════════════════════════════════════════
    
    const CONFLICT_THRESHOLD = 15;
    let totalConflicts = 0;
    const conflictTeams: { teamName: string; teamId: string; maxDiff: number }[] = [];

    for (const team of teamsWithScores) {
      if (!team.submission) continue;

      const judges = new Map<string, { name: string; weighted: number }>();
      for (const cs of team.submission.criterionScores) {
        if (!judges.has(cs.judgeId)) {
          judges.set(cs.judgeId, { name: cs.judgeName, weighted: 0 });
        }
        const normalizedScore = (cs.points / cs.criterion.maxPoints) * 100;
        const weightedScore = (normalizedScore * cs.criterion.weight) / 100;
        judges.get(cs.judgeId)!.weighted += weightedScore;
      }

      const judgeList = Array.from(judges.values());
      let maxDiff = 0;
      for (let i = 0; i < judgeList.length; i++) {
        for (let j = i + 1; j < judgeList.length; j++) {
          const diff = Math.abs(judgeList[i].weighted - judgeList[j].weighted);
          maxDiff = Math.max(maxDiff, diff);
        }
      }

      if (maxDiff > CONFLICT_THRESHOLD) {
        totalConflicts++;
        conflictTeams.push({
          teamName: team.name,
          teamId: team.id,
          maxDiff: Math.round(maxDiff * 10) / 10,
        });
      }
    }

    // Sort conflicts by severity
    conflictTeams.sort((a, b) => b.maxDiff - a.maxDiff);

    // ═══════════════════════════════════════════════════════════
    // 5. TOP/BOTTOM TEAMS LEADERBOARD
    // ═══════════════════════════════════════════════════════════
    
    const rankedTeams = teamsWithScores
      .filter((t) => t.submission?.judgeScore != null)
      .sort((a, b) => (b.submission?.judgeScore ?? 0) - (a.submission?.judgeScore ?? 0))
      .map((t, i) => ({
        rank: i + 1,
        teamId: t.id,
        teamName: t.name,
        track: t.track,
        score: t.submission?.judgeScore ?? 0,
        judgeCount: new Set(t.submission?.criterionScores.map((cs) => cs.judgeId) ?? []).size,
      }));

    return NextResponse.json({
      success: true,
      data: {
        // Overall stats
        overview: {
          totalApproved,
          scoredTeams,
          unscoredTeams,
          scoringProgress: totalApproved > 0
            ? Math.round((scoredTeams / totalApproved) * 100)
            : 0,
          avgScore: avgTeamScore,
          medianScore,
          minScore,
          maxScore,
          totalJudges: judgeStatsMap.size,
        },

        // Score distribution
        scoreDistribution,

        // Criterion breakdown
        criterionStats,

        // Judge consistency
        judgeConsistency,
        grandMean: Math.round(grandMean * 10) / 10,

        // Conflicts
        conflicts: {
          total: totalConflicts,
          threshold: CONFLICT_THRESHOLD,
          teams: conflictTeams.slice(0, 20),
        },

        // Leaderboard (top 10 + bottom 5)
        leaderboard: {
          top: rankedTeams.slice(0, 10),
          bottom: rankedTeams.slice(-5).reverse(),
          total: rankedTeams.length,
        },
      },
    });
  } catch (error) {
    console.error('[Admin] Error fetching scoring analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
