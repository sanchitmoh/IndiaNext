import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requirePermission, type AdminRole } from '@/lib/rbac';

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
 * GET /api/admin/teams/export-scores?format=csv&track=BUILD_STORM
 * 
 * Export detailed scorecards for all scored teams as CSV.
 * Includes per-judge, per-criterion breakdown, averages, and variance.
 * 
 * Query params:
 * - format: "csv" (default) or "json"
 * - track: "IDEA_SPRINT" | "BUILD_STORM" (optional filter)
 */
export async function GET(req: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins/organizers can export — not judges
    if (!requirePermission(admin.role as AdminRole, 'exportTeams')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to export scores' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv';
    const trackFilter = searchParams.get('track');

    // Build query filter
    const where: Record<string, unknown> = {
      deletedAt: null,
      status: 'APPROVED',
      submission: { isNot: null },
    };
    if (trackFilter && (trackFilter === 'IDEA_SPRINT' || trackFilter === 'BUILD_STORM')) {
      where.track = trackFilter;
    }

    // Fetch all approved teams with submissions and criterion scores
    const teams = await prisma.team.findMany({
      where,
      include: {
        submission: {
          include: {
            criterionScores: {
              include: { criterion: true },
              orderBy: { criterion: { order: 'asc' } },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Fetch all criteria for the relevant tracks
    const tracks = trackFilter ? [trackFilter] : ['IDEA_SPRINT', 'BUILD_STORM'];
    const criteria = await prisma.scoringCriterion.findMany({
      where: {
        track: { in: tracks as any },
        isActive: true,
      },
      orderBy: { order: 'asc' },
    });

    // Build export data
    const exportRows: Record<string, string | number>[] = [];

    for (const team of teams) {
      if (!team.submission) continue;

      const teamCriteria = criteria.filter((c) => c.track === team.track);
      const allScores = team.submission.criterionScores;

      // Group by judge
      const judgeMap = new Map<string, {
        judgeName: string;
        scores: Map<string, number>;
        weightedTotal: number;
      }>();

      for (const cs of allScores) {
        if (!judgeMap.has(cs.judgeId)) {
          judgeMap.set(cs.judgeId, {
            judgeName: cs.judgeName,
            scores: new Map(),
            weightedTotal: 0,
          });
        }
        const judge = judgeMap.get(cs.judgeId)!;
        judge.scores.set(cs.criterion.criterionId, cs.points);
        const normalizedScore = (cs.points / cs.criterion.maxPoints) * 100;
        const weightedScore = (normalizedScore * cs.criterion.weight) / 100;
        judge.weightedTotal += weightedScore;
      }

      const judges = Array.from(judgeMap.values());
      const judgeCount = judges.length;

      // Average score
      const averageScore = judgeCount > 0
        ? Math.round(
            (judges.reduce((sum, j) => sum + j.weightedTotal, 0) / judgeCount) * 10
          ) / 10
        : null;

      // Std dev
      let stdDev = 0;
      if (judgeCount > 1 && averageScore !== null) {
        const variance = judges.reduce(
          (sum, j) => sum + Math.pow(j.weightedTotal - averageScore, 2),
          0
        ) / judgeCount;
        stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
      }

      // Per-criterion averages
      const criterionAvgs: Record<string, number> = {};
      for (const criterion of teamCriteria) {
        const scoresForC = allScores
          .filter((cs) => cs.criterion.criterionId === criterion.criterionId)
          .map((cs) => cs.points);
        if (scoresForC.length > 0) {
          criterionAvgs[criterion.criterionId] =
            Math.round((scoresForC.reduce((a, b) => a + b, 0) / scoresForC.length) * 10) / 10;
        }
      }

      if (format === 'json') {
        exportRows.push({
          teamName: team.name,
          track: team.track,
          status: team.status,
          judgeCount,
          averageScore: averageScore ?? 0,
          stdDev,
          hasConflict: stdDev > 10 ? 1 : 0,
          ...Object.fromEntries(
            teamCriteria.map((c) => [`avg_${c.criterionId}`, criterionAvgs[c.criterionId] ?? ''])
          ),
          ...Object.fromEntries(
            judges.flatMap((j, i) => [
              [`judge${i + 1}_name`, j.judgeName],
              [`judge${i + 1}_total`, Math.round(j.weightedTotal * 10) / 10],
              ...teamCriteria.map((c) => [
                `judge${i + 1}_${c.criterionId}`,
                j.scores.get(c.criterionId) ?? '',
              ]),
            ])
          ),
        });
      } else {
        // CSV: one row per team, flat structure
        const row: Record<string, string | number> = {
          'Team Name': team.name,
          'Track': team.track === 'IDEA_SPRINT' ? 'Idea Sprint' : 'Build Storm',
          'Status': team.status,
          'Judge Count': judgeCount,
          'Average Score': averageScore ?? '',
          'Std Dev': stdDev,
          'Conflict (>10pt)': stdDev > 10 ? 'YES' : 'NO',
        };

        // Per-criterion averages
        for (const criterion of teamCriteria) {
          row[`Avg: ${criterion.name}`] = criterionAvgs[criterion.criterionId] ?? '';
        }

        // Per-judge scores
        judges.forEach((judge, i) => {
          row[`Judge ${i + 1}`] = judge.judgeName;
          row[`Judge ${i + 1} Total`] = Math.round(judge.weightedTotal * 10) / 10;
          for (const criterion of teamCriteria) {
            row[`Judge ${i + 1}: ${criterion.name}`] = judge.scores.get(criterion.criterionId) ?? '';
          }
        });

        exportRows.push(row);
      }
    }

    // Return JSON format
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: {
          exportedAt: new Date().toISOString(),
          teamCount: exportRows.length,
          rows: exportRows,
        },
      });
    }

    // Build CSV
    if (exportRows.length === 0) {
      return new Response('No scored teams found', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Collect all unique column headers across all rows
    const allHeaders = new Set<string>();
    for (const row of exportRows) {
      for (const key of Object.keys(row)) {
        allHeaders.add(key);
      }
    }
    const headers = Array.from(allHeaders);

    const csvLines: string[] = [];
    csvLines.push(headers.map((h) => `"${h}"`).join(','));

    for (const row of exportRows) {
      const values = headers.map((h) => {
        const val = row[h] ?? '';
        let strVal = String(val).replace(/"/g, '""');
        // ✅ SECURITY FIX (M-5): Prevent CSV injection — prefix dangerous chars with tab
        if (/^[=+\-@\t\r]/.test(strVal)) {
          strVal = `\t${strVal}`;
        }
        return `"${strVal}"`;
      });
      csvLines.push(values.join(','));
    }

    const csv = csvLines.join('\n');
    const timestamp = new Date().toISOString().split('T')[0];

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="scores_${trackFilter || 'all'}_${timestamp}.csv"`,
      },
    });
  } catch (error) {
    console.error('[Admin] Error exporting scores:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
