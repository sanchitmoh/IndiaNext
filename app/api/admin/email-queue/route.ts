// ═══════════════════════════════════════════════════════════
// Admin Email Queue Management API
// ═══════════════════════════════════════════════════════════
// Allows admins to:
// - View queue statistics
// - Manually trigger queue processing
// - Clean up old queued emails
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getEmailQueueStats, processEmailQueue, cleanupOldQueuedEmails } from '@/lib/email';
import { verifyAdminAuth } from '@/lib/auth-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - View queue statistics
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.authenticated || !authResult.admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getEmailQueueStats();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Error fetching email queue stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST - Manually trigger queue processing or cleanup
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.authenticated || !authResult.admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action as 'process' | 'cleanup';

    if (action === 'process') {
      // Process the queue
      const result = await processEmailQueue({
        batchSize: body.batchSize || 50,
        maxAge: body.maxAge || 48,
      });

      return NextResponse.json({
        success: true,
        action: 'process',
        result,
        timestamp: new Date().toISOString(),
      });
    } else if (action === 'cleanup') {
      // Clean up old queued emails
      const deletedCount = await cleanupOldQueuedEmails(body.olderThanHours || 72);

      return NextResponse.json({
        success: true,
        action: 'cleanup',
        deletedCount,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Use "process" or "cleanup"',
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Admin] Error processing email queue action:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
