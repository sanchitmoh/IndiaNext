import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { hashSessionToken } from '@/lib/session-security';
import { Prisma } from '@prisma/client';

/**
 * Verify admin authentication
 */
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
 * Query parameters schema
 */
const QueryParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  userId: z.string().optional(),
  fieldName: z.string().optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
  search: z.string().optional(),
});

/**
 * Calculate summary statistics for audit logs
 */
async function calculateSummary(
  teamId: string,
  where: Prisma.AuditLogWhereInput
) {
  // Get all audit logs for summary calculation
  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        include: {
          teamMemberships: {
            where: { teamId },
            select: { role: true },
          },
        },
      },
    },
  });

  if (logs.length === 0) {
    return {
      totalEdits: 0,
      lastEditDate: null,
      mostActiveUser: null,
      topChangedFields: [],
    };
  }

  // Calculate total edits (distinct submissionIds)
  const submissionIds = new Set(logs.map((log) => log.submissionId));
  const totalEdits = submissionIds.size;

  // Find last edit date (max timestamp)
  const lastEditDate = logs.reduce((max, log) => {
    return log.timestamp > max ? log.timestamp : max;
  }, logs[0].timestamp);

  // Find most active user (user with most audit log entries)
  const userCounts = new Map<string, { user: any; count: number }>();
  for (const log of logs) {
    const existing = userCounts.get(log.userId);
    if (existing) {
      existing.count++;
    } else {
      userCounts.set(log.userId, { user: log.user, count: 1 });
    }
  }

  let mostActiveUser = null;
  let maxCount = 0;
  for (const [_userId, data] of userCounts) {
    if (data.count > maxCount) {
      maxCount = data.count;
      const role = data.user.teamMemberships[0]?.role || 'MEMBER';
      mostActiveUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        count: data.count,
        role,
      };
    }
  }

  // Find top changed fields (fields ordered by change frequency)
  const fieldCounts = new Map<string, number>();
  for (const log of logs) {
    const count = fieldCounts.get(log.fieldName) || 0;
    fieldCounts.set(log.fieldName, count + 1);
  }

  const topChangedFields = Array.from(fieldCounts.entries())
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 fields

  return {
    totalEdits,
    lastEditDate,
    mostActiveUser,
    topChangedFields,
  };
}

/**
 * GET /api/admin/teams/[teamId]/audit
 * 
 * Fetch paginated audit logs for a team with optional filtering
 * 
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Records per page (default: 20, max: 100)
 * - fromDate: Start of date range (ISO date string)
 * - toDate: End of date range (ISO date string)
 * - userId: Filter by user
 * - fieldName: Filter by field
 * - action: Filter by action type (CREATE, UPDATE, DELETE)
 * - search: Keyword search in values
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     logs: AuditLogEntry[],
 *     pagination: { page, limit, total, totalPages },
 *     summary: { totalEdits, lastEditDate, mostActiveUser, topChangedFields }
 *   }
 * }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    // 1. Authenticate admin
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Admin access required' },
        { status: 401 }
      );
    }

    // Check if admin has permission to view audit logs
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(admin.role)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 2. Verify team exists
    const { teamId } = await params;
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    });

    if (!team) {
      return NextResponse.json(
        {
          success: false,
          error: 'TEAM_NOT_FOUND',
          message: `Team with ID ${teamId} does not exist`,
        },
        { status: 404 }
      );
    }

    // 3. Parse and validate query parameters
    const { searchParams } = new URL(req.url);
    const queryParams = {
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      userId: searchParams.get('userId') || undefined,
      fieldName: searchParams.get('fieldName') || undefined,
      action: searchParams.get('action') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const validation = QueryParamsSchema.safeParse(queryParams);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_FILTER',
          message: 'Invalid filter parameters',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { page, limit, fromDate, toDate, userId, fieldName, action, search } =
      validation.data;

    // 4. Build Prisma where clause from filters
    const where: Prisma.AuditLogWhereInput = {
      teamId,
    };

    // Date range filter
    if (fromDate || toDate) {
      where.timestamp = {};
      if (fromDate) {
        try {
          where.timestamp.gte = new Date(fromDate);
        } catch (_error) {
          return NextResponse.json(
            {
              success: false,
              error: 'INVALID_FILTER',
              message: 'Invalid date format. Expected ISO 8601 format (YYYY-MM-DD)',
            },
            { status: 400 }
          );
        }
      }
      if (toDate) {
        try {
          where.timestamp.lte = new Date(toDate);
        } catch (_error) {
          return NextResponse.json(
            {
              success: false,
              error: 'INVALID_FILTER',
              message: 'Invalid date format. Expected ISO 8601 format (YYYY-MM-DD)',
            },
            { status: 400 }
          );
        }
      }
    }

    // User filter
    if (userId) {
      where.userId = userId;
    }

    // Field name filter
    if (fieldName) {
      where.fieldName = fieldName;
    }

    // Action filter
    if (action) {
      where.action = action;
    }

    // Search filter (case-insensitive search in oldValue, newValue, user name, user email, and fieldName)
    if (search) {
      where.OR = [
        { oldValue: { contains: search, mode: 'insensitive' } },
        { newValue: { contains: search, mode: 'insensitive' } },
        { fieldName: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // 5. Fetch audit logs with pagination and user relations
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            include: {
              teamMemberships: {
                where: { teamId },
                select: { role: true },
              },
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // 6. Calculate summary statistics
    const summary = await calculateSummary(teamId, where);

    // 7. Format response
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      submissionId: log.submissionId,
      timestamp: log.timestamp,
      action: log.action,
      fieldName: log.fieldName,
      oldValue: log.oldValue,
      newValue: log.newValue,
      user: {
        id: log.user.id,
        name: log.user.name,
        email: log.user.email,
        role: log.user.teamMemberships[0]?.role || 'MEMBER',
      },
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
    }));

    return NextResponse.json({
      success: true,
      data: {
        team: {
          id: team.id,
          name: team.name,
        },
        logs: formattedLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary,
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Unable to fetch audit logs. Please try again later.',
      },
      { status: 503 }
    );
  }
}
