import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { hasPermission } from '@/lib/rbac-permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { hashSessionToken } from '@/lib/session-security';

const ReorderSchema = z.object({
  problemIds: z.array(z.string()).min(1),
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
 * POST /api/admin/problem-statements/reorder
 * Reorder problem statements
 */
export async function POST(req: Request) {
  try {
    // ✅ SECURITY FIX: Rate limit admin reorder endpoint
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`admin-reorder:${ip}`, 30, 60); // 30 per minute
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

    // ✅ SECURITY FIX: Check RBAC permission for editing problem statements
    if (!hasPermission(admin.role, 'EDIT_TEAMS')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to reorder problem statements' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = ReorderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: validation.error.errors,
      }, { status: 400 });
    }

    const { problemIds } = validation.data;

    // Update order for each problem in a transaction
    await prisma.$transaction(
      problemIds.map((id, index) =>
        prisma.problemStatement.update({
          where: { id },
          data: { order: index + 1 },
        })
      )
    );

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: null, // Admin actions don't have userId
        action: 'problem_statement.reordered',
        entity: 'ProblemStatement',
        entityId: 'bulk',
        metadata: { 
          problemIds, 
          newOrder: problemIds.map((id, i) => ({ id, order: i + 1 })),
          adminId: admin.id,
          adminEmail: admin.email,
        },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Problem statements reordered successfully',
    });
  } catch (error) {
    const { handleGenericError } = await import('@/lib/error-handler');
    return handleGenericError(error, '/api/admin/problem-statements/reorder');
  }
}
