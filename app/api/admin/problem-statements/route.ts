import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { hasPermission } from '@/lib/rbac-permissions';
import { sanitizeHtml } from '@/lib/input-sanitizer';
import { handleGenericError } from '@/lib/error-handler';
import { hashSessionToken } from '@/lib/session-security';

// Validation schema
const CreateProblemSchema = z.object({
  title: z.string().min(5).max(200),
  objective: z.string().min(10).max(500),
  description: z.string().optional(),
  maxSubmissions: z.number().int().min(1).max(100).default(30),
  isActive: z.boolean().default(true),
  order: z.number().int().min(1),
});

const UpdateProblemSchema = CreateProblemSchema.partial().extend({
  id: z.string(),
});

// Verify admin authentication
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
 * GET /api/admin/problem-statements
 * List all problem statements with stats
 */
export async function GET(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ SECURITY FIX (H-3): Check granular permission
    if (!hasPermission(admin.role, 'VIEW_ALL_TEAMS')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const problems = await prisma.problemStatement.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: {
            submissions: true,
            reservations: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: problems.map((p) => ({
        id: p.id,
        order: p.order,
        title: p.title,
        objective: p.objective,
        description: p.description,
        submissionCount: p.submissionCount,
        maxSubmissions: p.maxSubmissions,
        activeReservations: p._count.reservations,
        isActive: p.isActive,
        isCurrent: p.isCurrent,
        slotsRemaining: p.maxSubmissions - p.submissionCount,
        utilizationRate: ((p.submissionCount / p.maxSubmissions) * 100).toFixed(1),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    return handleGenericError(error, '/api/admin/problem-statements');
  }
}

/**
 * POST /api/admin/problem-statements
 * Create a new problem statement
 */
export async function POST(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ SECURITY FIX (H-3): Check granular permission
    if (!hasPermission(admin.role, 'EDIT_TEAMS')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = CreateProblemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check if order already exists
    const existing = await prisma.problemStatement.findFirst({
      where: { order: data.order },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Order already exists',
          message: `Problem statement with order ${data.order} already exists`,
        },
        { status: 409 }
      );
    }

    const problem = await prisma.problemStatement.create({
      data: {
        // ✅ SECURITY FIX (L-5): Sanitize HTML in user-supplied fields
        title: sanitizeHtml(data.title),
        objective: sanitizeHtml(data.objective),
        description: data.description ? sanitizeHtml(data.description) : undefined,
        maxSubmissions: data.maxSubmissions,
        isActive: data.isActive,
        order: data.order,
        isCurrent: false,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: null, // Admin actions don't have userId
        action: 'problem_statement.created',
        entity: 'ProblemStatement',
        entityId: problem.id,
        metadata: {
          title: problem.title,
          order: problem.order,
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
      message: 'Problem statement created successfully',
    });
  } catch (error) {
    return handleGenericError(error, '/api/admin/problem-statements');
  }
}

/**
 * PATCH /api/admin/problem-statements
 * Update an existing problem statement
 */
export async function PATCH(req: Request) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ SECURITY FIX (H-3): Check granular permission
    if (!hasPermission(admin.role, 'EDIT_TEAMS')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = UpdateProblemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { id, ...data } = validation.data;

    // ✅ SECURITY FIX (L-6): Verify resource exists before update
    const existing = await prisma.problemStatement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Problem statement not found' },
        { status: 404 }
      );
    }

    // ✅ SECURITY FIX (L-5): Sanitize HTML in updated fields
    const sanitizedData: Record<string, unknown> = { ...data };
    if (data.title) sanitizedData.title = sanitizeHtml(data.title);
    if (data.objective) sanitizedData.objective = sanitizeHtml(data.objective);
    if (data.description) sanitizedData.description = sanitizeHtml(data.description);

    const problem = await prisma.problemStatement.update({
      where: { id },
      data: sanitizedData,
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: null, // Admin actions don't have userId
        action: 'problem_statement.updated',
        entity: 'ProblemStatement',
        entityId: problem.id,
        metadata: {
          title: problem.title,
          changes: data,
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
      message: 'Problem statement updated successfully',
    });
  } catch (error) {
    return handleGenericError(error, '/api/admin/problem-statements');
  }
}

/**
 * DELETE /api/admin/problem-statements
 * Delete a problem statement (only if no submissions)
 */
export async function DELETE(req: NextRequest) {
  try {
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ SECURITY FIX (H-3): Check granular permission
    if (!hasPermission(admin.role, 'DELETE_TEAMS')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing problem ID' }, { status: 400 });
    }

    const problem = await prisma.problemStatement.findUnique({
      where: { id },
      include: { _count: { select: { submissions: true, reservations: true } } },
    });

    if (!problem) {
      return NextResponse.json({ success: false, error: 'Problem not found' }, { status: 404 });
    }

    if (problem._count.submissions > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete',
          message: 'Cannot delete problem statement with existing submissions',
        },
        { status: 409 }
      );
    }

    // Delete reservations first, then the problem statement
    await prisma.$transaction(async (tx) => {
      if (problem._count.reservations > 0) {
        await tx.problemReservation.deleteMany({ where: { problemStatementId: id } });
      }
      await tx.problemStatement.delete({ where: { id } });
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: null, // Admin actions don't have userId
        action: 'problem_statement.deleted',
        entity: 'ProblemStatement',
        entityId: id,
        metadata: {
          title: problem.title,
          adminId: admin.id,
          adminEmail: admin.email,
        },
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Problem statement deleted successfully',
    });
  } catch (error) {
    return handleGenericError(error, '/api/admin/problem-statements');
  }
}
