import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { hasPermission } from '@/lib/rbac-permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createErrorResponse, getStatusCode, handleGenericError } from '@/lib/error-handler';

const ScoreSchema = z.object({
  teamId: z.string(),
  score: z.number().min(0).max(100),
  comments: z.string().optional(),
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
 * POST /api/admin/teams/score
 * Add score and comments to a team submission
 * 
 * CRITICAL: Judges can ONLY score APPROVED teams
 */
export async function POST(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      const err = createErrorResponse('UNAUTHORIZED', 'Authentication required', undefined, '/api/admin/teams/score');
      return NextResponse.json(err, { status: getStatusCode('UNAUTHORIZED') });
    }

    // ✅ SECURITY FIX: Rate limit scoring to 20 req/min per admin
    const rl = await checkRateLimit(`score:${admin.id}`, 20, 60);
    if (!rl.success) {
      const err = createErrorResponse('RATE_LIMIT_EXCEEDED', 'Too many scoring requests. Please slow down.', undefined, '/api/admin/teams/score');
      return NextResponse.json(err, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } });
    }

    // Check if admin has permission to score
    if (!hasPermission(admin.role, 'SCORE_TEAMS')) {
      const err = createErrorResponse('FORBIDDEN', 'Insufficient permissions to score submissions', undefined, '/api/admin/teams/score');
      return NextResponse.json(err, { status: getStatusCode('FORBIDDEN') });
    }

    const body = await req.json();
    const validation = ScoreSchema.safeParse(body);

    if (!validation.success) {
      const err = createErrorResponse('VALIDATION_ERROR', validation.error.errors[0].message, validation.error.errors, '/api/admin/teams/score');
      return NextResponse.json(err, { status: 400 });
    }

    const { teamId, score, comments } = validation.data;

    // Get team with submission
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { submission: true },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
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
      return NextResponse.json(
        { success: false, error: 'Team has no submission' },
        { status: 404 }
      );
    }

    // Update submission with score and comments
    const updatedSubmission = await prisma.submission.update({
      where: { id: team.submission.id },
      data: {
        judgeScore: score,
        judgeComments: comments || team.submission.judgeComments,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: null,
        action: 'submission.scored',
        entity: 'Submission',
        entityId: updatedSubmission.id,
        metadata: {
          teamId: team.id,
          teamName: team.name,
          score,
          hasComments: !!comments,
          judgeId: admin.id,
          judgeName: admin.name,
          judgeEmail: admin.email,
        },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        submissionId: updatedSubmission.id,
        score: updatedSubmission.judgeScore,
        comments: updatedSubmission.judgeComments,
      },
      message: 'Score submitted successfully',
    });
  } catch (error) {
    return handleGenericError(error, '/api/admin/teams/score');
  }
}

/**
 * GET /api/admin/teams/score?teamId={id}
 * Get current score for a team
 */
export async function GET(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      const err = createErrorResponse('UNAUTHORIZED', 'Authentication required', undefined, '/api/admin/teams/score');
      return NextResponse.json(err, { status: getStatusCode('UNAUTHORIZED') });
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'Missing teamId parameter' },
        { status: 400 }
      );
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { submission: true },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Judges can only view scores for approved teams
    if (admin.role === 'JUDGE' && team.status !== 'APPROVED') {
      return NextResponse.json(
        { success: false, error: 'Cannot view score for non-approved team' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        teamId: team.id,
        teamName: team.name,
        status: team.status,
        canScore: team.status === 'APPROVED',
        score: team.submission?.judgeScore || null,
        comments: team.submission?.judgeComments || null,
      },
    });
  } catch (error) {
    return handleGenericError(error, '/api/admin/teams/score');
  }
}
