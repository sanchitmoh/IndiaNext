import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requirePermission, type AdminRole } from '@/lib/rbac';
import { sanitizeText } from '@/lib/input-sanitizer';
import { checkRateLimit } from '@/lib/rate-limit';
import { hashSessionToken } from '@/lib/session-security';

const CommentSchema = z.object({
  teamId: z.string(),
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

async function verifyAdmin(_req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    return null;
  }

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
 * POST /api/admin/teams/comment
 * Add comment to a team
 * 
 * CRITICAL: Judges can ONLY comment on APPROVED teams
 */
export async function POST(req: Request) {
  try {
    // ✅ SECURITY FIX: Rate limit admin comment endpoint
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`admin-comment:${ip}`, 20, 60); // 20 per minute
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      );
    }

    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin has permission to comment
    if (!requirePermission(admin.role as AdminRole, 'commentOnSubmissions')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to comment' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = CommentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: validation.error.errors,
      }, { status: 400 });
    }

    const { teamId, content, isInternal } = validation.data;

    // ✅ SECURITY FIX: Sanitize comment content to prevent XSS
    const sanitizedContent = sanitizeText(content);

    // Get team
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // ⭐ CRITICAL: Judges can ONLY comment on APPROVED teams
    if (admin.role === 'JUDGE' && team.status !== 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          error: 'TEAM_NOT_APPROVED',
          message: `Cannot comment on team with status: ${team.status}. Only APPROVED teams can be commented on.`,
        },
        { status: 403 }
      );
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        teamId,
        authorId: admin.id,
        content: sanitizedContent, // ✅ SECURITY FIX: Use sanitized content
        isInternal,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: null,
        action: 'team.commented',
        entity: 'Comment',
        entityId: comment.id,
        metadata: {
          teamId: team.id,
          teamName: team.name,
          isInternal,
          authorId: admin.id,
          authorName: admin.name,
          authorEmail: admin.email,
          authorRole: admin.role,
        },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        commentId: comment.id,
        teamId: comment.teamId,
        content: comment.content,
        isInternal: comment.isInternal,
        createdAt: comment.createdAt,
      },
      message: 'Comment added successfully',
    });
  } catch (error) {
    const { handleGenericError } = await import('@/lib/error-handler');
    return handleGenericError(error, '/api/admin/teams/comment');
  }
}

/**
 * GET /api/admin/teams/comment?teamId={id}
 * Get all comments for a team
 */
export async function GET(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
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
    });

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    // Judges can only view comments for approved teams
    if (admin.role === 'JUDGE' && team.status !== 'APPROVED') {
      return NextResponse.json(
        { success: false, error: 'Cannot view comments for non-approved team' },
        { status: 403 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        teamId: team.id,
        teamName: team.name,
        status: team.status,
        canComment: team.status === 'APPROVED' || admin.role !== 'JUDGE',
        comments: comments.map(c => ({
          id: c.id,
          content: c.content,
          isInternal: c.isInternal,
          authorId: c.authorId,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      },
    });
  } catch (error) {
    const { handleGenericError } = await import('@/lib/error-handler');
    return handleGenericError(error, '/api/admin/teams/comment');
  }
}
