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
 * Query parameters schema (same as GET endpoint for filter respect)
 */
const QueryParamsSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  userId: z.string().optional(),
  fieldName: z.string().optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
  search: z.string().optional(),
});

/**
 * Sanitize team name for filename
 * Removes special characters and replaces spaces with underscores
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 50); // Limit length
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format timestamp for CSV
 */
function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Escape CSV special characters
 */
function escapeCSV(value: string | null): string {
  if (!value) return '';

  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/**
 * Convert audit logs to CSV format
 */
function convertToCSV(logs: any[]): string {
  const headers = [
    'Timestamp',
    'User',
    'Email',
    'Role',
    'Action',
    'Field',
    'Old Value',
    'New Value',
    'IP Address',
  ];

  const rows = logs.map((log) => [
    formatTimestamp(log.timestamp),
    escapeCSV(log.user.name),
    escapeCSV(log.user.email),
    log.user.role,
    log.action,
    escapeCSV(log.fieldName),
    escapeCSV(log.oldValue),
    escapeCSV(log.newValue),
    escapeCSV(log.ipAddress || 'N/A'),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * GET /api/admin/teams/[teamId]/audit/export
 *
 * Export audit logs to CSV format
 *
 * Query Parameters (same as GET endpoint - respects filters):
 * - fromDate: Start of date range (ISO date string)
 * - toDate: End of date range (ISO date string)
 * - userId: Filter by user
 * - fieldName: Filter by field
 * - action: Filter by action type (CREATE, UPDATE, DELETE)
 * - search: Keyword search in values
 *
 * Response: CSV file download
 */
export async function GET(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    // 1. Authenticate admin
    const admin = await verifyAdmin(req);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Admin access required' },
        { status: 401 }
      );
    }

    // 2. Get teamId from params
    const { teamId } = await params;

    // Check if admin has permission to view audit logs
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(admin.role)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 3. Fetch team for filename
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

    // 4. Parse and validate query parameters
    const { searchParams } = new URL(req.url);
    const queryParams = {
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

    const { fromDate, toDate, userId, fieldName, action, search } = validation.data;

    // 4. Build where clause from filters
    const where: Prisma.AuditLogWhereInput = {
      teamId,
    };

    // Date range filter
    if (fromDate || toDate) {
      where.timestamp = {};
      if (fromDate) {
        const fromDateObj = new Date(fromDate);
        if (isNaN(fromDateObj.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: 'INVALID_FILTER',
              message: 'Invalid date format. Expected ISO 8601 format (YYYY-MM-DD)',
            },
            { status: 400 }
          );
        }
        where.timestamp.gte = fromDateObj;
      }
      if (toDate) {
        const toDateObj = new Date(toDate);
        if (isNaN(toDateObj.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: 'INVALID_FILTER',
              message: 'Invalid date format. Expected ISO 8601 format (YYYY-MM-DD)',
            },
            { status: 400 }
          );
        }
        where.timestamp.lte = toDateObj;
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

    // 5. Fetch all matching audit logs (limit 10,000 for safety)
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
      orderBy: { timestamp: 'desc' },
      take: 10000, // Safety limit
    });

    // Check if export is too large
    if (logs.length === 10000) {
      return NextResponse.json(
        {
          success: false,
          error: 'EXPORT_TOO_LARGE',
          message: 'Export limited to 10,000 records. Please apply filters to reduce result set.',
        },
        { status: 413 }
      );
    }

    // 6. Format logs for CSV
    const formattedLogs = logs.map((log) => ({
      timestamp: log.timestamp,
      action: log.action,
      fieldName: log.fieldName,
      oldValue: log.oldValue,
      newValue: log.newValue,
      user: {
        name: log.user.name,
        email: log.user.email,
        role: log.user.teamMemberships[0]?.role || 'MEMBER',
      },
      ipAddress: log.ipAddress,
    }));

    // 7. Convert to CSV
    const csv = convertToCSV(formattedLogs);

    // 8. Generate filename: audit_[sanitizedTeamName]_[YYYY-MM-DD].csv
    const sanitizedTeamName = sanitizeFilename(team.name);
    const dateStr = formatDate(new Date());
    const filename = `audit_${sanitizedTeamName}_${dateStr}.csv`;

    // 9. Return CSV as downloadable file with correct headers
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Unable to export audit logs. Please try again later.',
      },
      { status: 503 }
    );
  }
}
