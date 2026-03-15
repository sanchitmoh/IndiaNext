import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { getPusherMetrics, checkPusherQuota } from '@/lib/pusher-monitor';
import { handleGenericError } from '@/lib/error-handler';

/**
 * GET /api/admin/pusher-metrics
 * 
 * Retrieve Pusher usage metrics and quota information.
 * Requires ADMIN or SUPER_ADMIN role.
 * 
 * Requirements: 2.19
 */

export async function GET(_req: Request) {
  try {
    // 1. Validate admin session
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', message: 'Admin session required' },
        { status: 401 }
      );
    }

    const admin = session.admin;

    // 2. Validate admin role (ADMIN or SUPER_ADMIN only)
    if (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          message: 'ADMIN or SUPER_ADMIN role required to view Pusher metrics',
        },
        { status: 403 }
      );
    }

    // 3. Fetch metrics and quota status
    const metrics = await getPusherMetrics();
    const quota = await checkPusherQuota();

    // 4. Return JSON response
    return NextResponse.json({
      success: true,
      data: {
        // Daily metrics
        date: metrics.date,
        totalEvents: metrics.totalEvents,
        eventsByType: metrics.eventsByType,
        lastReset: metrics.lastReset,
        
        // Quota information
        quota: {
          limit: quota.limit,
          usage: quota.usage,
          remaining: quota.remaining,
          percentUsed: quota.percentUsed,
          warningLevel: quota.warningLevel,
          ok: quota.ok,
        },
      },
    });
    
  } catch (error) {
    return handleGenericError(error, '/api/admin/pusher-metrics');
  }
}
