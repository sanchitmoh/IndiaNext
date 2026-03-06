import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requirePermission, type AdminRole } from '@/lib/rbac';
import { checkRateLimit } from '@/lib/rate-limit';
import { hashSessionToken } from '@/lib/session-security';

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
 * GET /api/admin/analytics/problem-statements
 * Get analytics for problem statement reservations and conversions
 */
export async function GET(req: Request) {
  try {
    // ✅ SECURITY FIX: Rate limit admin analytics endpoint
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = await checkRateLimit(`admin-analytics:${ip}`, 30, 60); // 30 per minute
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

    // ✅ SECURITY FIX: Check RBAC permission for viewing analytics
    if (!requirePermission(admin.role as AdminRole, 'viewAnalytics')) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to view analytics' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get reservation metrics
    const reservationMetrics = await prisma.metric.findMany({
      where: {
        name: 'reservation_created',
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Get conversion metrics
    const conversionMetrics = await prisma.metric.findMany({
      where: {
        name: 'reservation_to_registration_conversion',
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Get registration metrics
    const registrationMetrics = await prisma.metric.findMany({
      where: {
        name: 'registration_completed',
        timestamp: { gte: startDate },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Calculate conversion rate
    const totalReservations = reservationMetrics.length;
    const totalConversions = conversionMetrics.length;
    const conversionRate = totalReservations > 0 
      ? ((totalConversions / totalReservations) * 100).toFixed(2)
      : '0.00';

    // Group by problem statement
    const problemStats: Record<string, any> = {};

    for (const metric of reservationMetrics) {
      const meta = metric.metadata as Record<string, any> | null;
      const problemId = meta?.problemStatementId as string;
      if (!problemId) continue;

      if (!problemStats[problemId]) {
        problemStats[problemId] = {
          problemId,
          problemTitle: meta?.problemTitle || 'Unknown',
          reservations: 0,
          conversions: 0,
          conversionRate: '0.00',
        };
      }
      problemStats[problemId].reservations++;
    }

    for (const metric of conversionMetrics) {
      const meta = metric.metadata as Record<string, any> | null;
      const problemId = meta?.problemStatementId as string;
      if (!problemId || !problemStats[problemId]) continue;

      problemStats[problemId].conversions++;
    }

    // Calculate conversion rates per problem
    Object.values(problemStats).forEach((stat: any) => {
      if (stat.reservations > 0) {
        stat.conversionRate = ((stat.conversions / stat.reservations) * 100).toFixed(2);
      }
    });

    // Get current problem statement stats
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

    const problemSummary = problems.map(p => ({
      id: p.id,
      title: p.title,
      order: p.order,
      submissions: p.submissionCount,
      maxSubmissions: p.maxSubmissions,
      activeReservations: p._count.reservations,
      utilizationRate: ((p.submissionCount / p.maxSubmissions) * 100).toFixed(1),
      isActive: p.isActive,
      isCurrent: p.isCurrent,
    }));

    // Time series data for charts
    const dailyStats: Record<string, { date: string; reservations: number; conversions: number; registrations: number }> = {};

    const addToDaily = (timestamp: Date, type: 'reservations' | 'conversions' | 'registrations') => {
      const dateKey = timestamp.toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { date: dateKey, reservations: 0, conversions: 0, registrations: 0 };
      }
      dailyStats[dateKey][type]++;
    };

    reservationMetrics.forEach(m => addToDaily(m.timestamp, 'reservations'));
    conversionMetrics.forEach(m => addToDaily(m.timestamp, 'conversions'));
    registrationMetrics.filter(m => (m.metadata as Record<string, any> | null)?.track === 'BUILD_STORM').forEach(m => addToDaily(m.timestamp, 'registrations'));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalReservations,
          totalConversions,
          conversionRate: `${conversionRate}%`,
          averageExtensions: await getAverageExtensions(),
        },
        problemStats: Object.values(problemStats),
        problemSummary,
        timeSeries: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
      },
    });
  } catch (error) {
    const { handleGenericError } = await import('@/lib/error-handler');
    return handleGenericError(error, '/api/admin/analytics/problem-statements');
  }
}

async function getAverageExtensions(): Promise<string> {
  try {
    const reservations = await prisma.problemReservation.findMany({
      select: { extensionCount: true },
    });

    if (reservations.length === 0) return '0.00';

    const total = reservations.reduce((sum, r) => sum + r.extensionCount, 0);
    return (total / reservations.length).toFixed(2);
  } catch (_error) {
    return '0.00';
  }
}
