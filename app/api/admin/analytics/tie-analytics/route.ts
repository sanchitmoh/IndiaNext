import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { handleGenericError } from '@/lib/error-handler';

async function verifyAdmin() {
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

/**
 * GET /api/admin/analytics/tie-analytics
 * Returns tie groups + resolution status for both tracks.
 */
export async function GET() {
  try {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const TIE_TOLERANCE = 0.5;

    async function analyzeTies(track: 'IDEA_SPRINT' | 'BUILD_STORM') {
      const teams = await prisma.team.findMany({
        where: { track, status: { in: ['APPROVED', 'SHORTLISTED'] }, deletedAt: null },
        include: { submission: { select: { judgeScore: true } } },
      });

      const scored = teams
        .filter((t) => t.submission?.judgeScore != null)
        .map((t) => ({ id: t.id, name: t.name, score: t.submission!.judgeScore!, manualRank: t.rank }));

      const groups: {
        score: number;
        teams: { id: string; name: string; manualRank: number | null }[];
        resolutionType: 'manual' | 'auto' | null;
      }[] = [];
      const visited = new Set<string>();

      for (const team of scored) {
        if (visited.has(team.id)) continue;
        const group = scored.filter((t) => Math.abs(t.score - team.score) <= TIE_TOLERANCE);
        if (group.length >= 2) {
          group.forEach((t) => visited.add(t.id));
          const hasManual = group.some((t) => t.manualRank !== null);
          groups.push({ score: team.score, teams: group, resolutionType: hasManual ? 'manual' : 'auto' });
        }
      }

      const totalTies = groups.reduce((s, g) => s + g.teams.length, 0);
      const manualResolved = groups.filter((g) => g.resolutionType === 'manual').reduce((s, g) => s + g.teams.length, 0);

      return {
        totalTies,
        tieGroups: groups.sort((a, b) => b.score - a.score),
        manualResolved,
        autoResolved: totalTies - manualResolved,
        totalTeams: teams.length,
        scoredTeams: scored.length,
      };
    }

    const [ideasprint, buildstorm] = await Promise.all([
      analyzeTies('IDEA_SPRINT'),
      analyzeTies('BUILD_STORM'),
    ]);

    return NextResponse.json({ success: true, data: { ideasprint, buildstorm } });
  } catch (error) {
    return handleGenericError(error, '/api/admin/analytics/tie-analytics');
  }
}
