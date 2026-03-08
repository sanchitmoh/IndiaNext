import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet, cacheDelete } from '@/lib/redis-cache';

const CACHE_KEY = 'problem_statement:distribution';
const CACHE_TTL = 10; // 10 seconds

/**
 * GET /api/problem-statement
 *
 * Returns distribution statistics for all active problem statements.
 *
 * Round-robin distribution:
 * - Shows all available problems
 * - Each user gets assigned to the problem with least load
 * - Ensures even distribution across all problems
 *
 * Caching: Results are cached in Redis for 10 seconds to reduce DB load
 */
export async function GET() {
  try {
    // Try to get from cache first
    const cached = await cacheGet<string>(CACHE_KEY);
    if (cached) {
      console.log('[ProblemStatement] Cache hit');
      return NextResponse.json(typeof cached === 'string' ? JSON.parse(cached) : cached);
    }

    console.log('[ProblemStatement] Cache miss, fetching from DB');

    // Get all active problems with their load
    const problems = await prisma.problemStatement.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    if (problems.length === 0) {
      const response = {
        success: true,
        data: null,
        message: 'No active problem statements available.',
        allFilled: true,
      };

      await cacheSet(CACHE_KEY, JSON.stringify(response), { ttl: CACHE_TTL });
      return NextResponse.json(response);
    }

    // Calculate load for each problem
    const problemsWithLoad = await Promise.all(
      problems.map(async (problem) => {
        const activeReservations = await prisma.problemReservation.count({
          where: { problemStatementId: problem.id },
        });

        const totalCommitted = problem.submissionCount + activeReservations;
        const slotsRemaining = problem.maxSubmissions - totalCommitted;
        const utilizationRate = ((totalCommitted / problem.maxSubmissions) * 100).toFixed(1);

        return {
          id: problem.id,
          order: problem.order,
          title: problem.title,
          objective: problem.objective,
          description: problem.description,
          // Internal fields (kept for server-side logic, stripped from response below)
          _slotsRemaining: slotsRemaining,
          _totalCommitted: totalCommitted,
          _maxSubmissions: problem.maxSubmissions,
          _utilizationRate: utilizationRate,
          // ✅ SECURITY FIX: Only expose whether slots are available, not exact capacity
          hasAvailableSlots: slotsRemaining > 0,
          isCurrent: problem.isCurrent,
        };
      })
    );

    // Check if all problems are full
    const allFull = problemsWithLoad.every((p) => p._slotsRemaining <= 0);

    if (allFull) {
      const response = {
        success: true,
        data: null,
        message:
          'All problem statements have been filled. Registration for BuildStorm is currently closed.',
        allFilled: true,
      };

      await cacheSet(CACHE_KEY, JSON.stringify(response), { ttl: CACHE_TTL });
      await notifyAdminsAllFilled();

      return NextResponse.json(response);
    }

    // Find the problem with least load (for display purposes)
    const leastLoadedProblem = problemsWithLoad
      .filter((p) => p._slotsRemaining > 0)
      .reduce((min, current) => (current._totalCommitted < min._totalCommitted ? current : min));

    const response = {
      success: true,
      data: {
        distributionStrategy: 'round-robin',
        // ✅ SECURITY FIX: Strip internal capacity data from public response
        problems: problemsWithLoad.map((p) => ({
          id: p.id,
          order: p.order,
          title: p.title,
          objective: p.objective,
          hasAvailableSlots: p.hasAvailableSlots,
          isCurrent: p.isCurrent,
        })),
        nextAssignment: {
          id: leastLoadedProblem.id,
          order: leastLoadedProblem.order,
          title: leastLoadedProblem.title,
          objective: leastLoadedProblem.objective,
        },
      },
      allFilled: false,
    };

    // Cache the response for 10 seconds
    await cacheSet(CACHE_KEY, JSON.stringify(response), { ttl: CACHE_TTL });

    // Check if any problem is almost full and notify admins
    for (const problem of problemsWithLoad) {
      const utilization = parseFloat(problem._utilizationRate);
      if (utilization >= 90 && problem._slotsRemaining > 0) {
        await notifyAdminsAlmostFull(
          {
            id: problem.id,
            title: problem.title,
            submissionCount: problem._totalCommitted,
            maxSubmissions: problem._maxSubmissions,
            order: problem.order,
          },
          utilization
        );
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ProblemStatement] Error fetching distribution:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch problem statements.',
      },
      { status: 500 }
    );
  }
}

/**
 * Notify admins when all problem slots are exhausted
 */
async function notifyAdminsAllFilled() {
  try {
    const admins = await prisma.admin.findMany({
      where: { isActive: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'SYSTEM',
          title: '🚨 All Problem Statements Filled',
          message:
            'All problem statement slots have been exhausted. BuildStorm registration is now closed.',
          link: '/admin/problem-statements',
        },
      });
    }

    console.log(`[ProblemStatement] Notified ${admins.length} admins that all slots are filled`);
  } catch (error) {
    console.error('[ProblemStatement] Failed to notify admins about all filled:', error);
  }
}

/**
 * Notify admins when a problem is almost full (90%+)
 */
async function notifyAdminsAlmostFull(
  problem: {
    id: string;
    title: string;
    submissionCount: number;
    maxSubmissions: number;
    order: number;
  },
  utilizationRate: number
) {
  try {
    // Check if we already notified for this problem at 90%
    const recentNotification = await prisma.notification.findFirst({
      where: {
        title: '⚠️ Problem Statement Almost Full',
        message: {
          contains: problem.title,
        },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Within last hour
        },
      },
    });

    if (recentNotification) {
      return; // Already notified recently
    }

    const admins = await prisma.admin.findMany({
      where: { isActive: true },
    });

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: 'SYSTEM',
          title: '⚠️ Problem Statement Almost Full',
          message: `Problem #${problem.order} "${problem.title}" is ${utilizationRate.toFixed(1)}% full (${problem.submissionCount}/${problem.maxSubmissions} slots used)`,
          link: '/admin/problem-statements',
        },
      });
    }

    console.log(
      `[ProblemStatement] Notified ${admins.length} admins that Problem #${problem.order} is ${utilizationRate.toFixed(1)}% full`
    );
  } catch (error) {
    console.error('[ProblemStatement] Failed to notify admins about almost full:', error);
  }
}

/**
 * Helper function to invalidate cache (call this when problems are updated)
 */
async function _invalidateCache() {
  try {
    await cacheDelete(CACHE_KEY);
    console.log('[ProblemStatement] Cache invalidated');
  } catch (error) {
    console.error('[ProblemStatement] Failed to invalidate cache:', error);
  }
}
