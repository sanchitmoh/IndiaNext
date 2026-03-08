// ═══════════════════════════════════════════════════════════
// Email Queue Processing Cron Job
// ═══════════════════════════════════════════════════════════
// Automatically processes queued emails that failed due to quota limits
// Triggered by Vercel Cron (every hour) or manual admin action
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { processEmailQueue, getEmailQueueStats } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting email queue processing...');

    // Get queue stats before processing
    const statsBefore = await getEmailQueueStats();
    console.log('[Cron] Queue stats before:', statsBefore);

    // Process the queue
    const result = await processEmailQueue({
      batchSize: 50, // Process up to 50 emails per run
      maxAge: 48, // Don't retry emails older than 48 hours
    });

    // Get queue stats after processing
    const statsAfter = await getEmailQueueStats();

    console.log('[Cron] Email queue processing complete:', result);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
      stats: {
        before: statsBefore,
        after: statsAfter,
      },
    });
  } catch (error) {
    console.error('[Cron] Error processing email queue:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering from admin panel
export async function POST(request: NextRequest) {
  return GET(request);
}
