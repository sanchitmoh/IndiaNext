import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requirePermission, type AdminRole } from '@/lib/rbac';
import { checkRateLimit } from '@/lib/rate-limit';

const ToggleSchema = z.object({
  id: z.string(),
  isActive: z.boolean(),
});

async function verifyAdmin(_req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: { token },
    include: { admin: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.admin;
}

/**
 * POST /api/admin/problem-statements/toggle
 * Toggle problem statement active status
 */
export async function POST(req: Request) {
  try {
    // ✅ SECURITY FIX: Rate limit admin toggle endpoint
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`admin-toggle:${ip}`, 30, 60); // 30 per minute
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
    if (!requirePermission(admin.role as AdminRole, 'editProblems')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to toggle problem statements' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = ToggleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        details: validation.error.errors,
      }, { status: 400 });
    }

    const { id, isActive } = validation.data;

    const problem = await prisma.problemStatement.update({
      where: { id },
      data: { 
        isActive,
        // If deactivating the current problem, unmark it
        isCurrent: isActive ? undefined : false,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: null, // Admin actions don't have userId
        action: `problem_statement.${isActive ? 'activated' : 'deactivated'}`,
        entity: 'ProblemStatement',
        entityId: id,
        metadata: { 
          title: problem.title, 
          isActive,
          adminId: admin.id,
          adminEmail: admin.email,
        },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      data: problem,
      message: `Problem statement ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('[Admin] Error toggling problem:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
