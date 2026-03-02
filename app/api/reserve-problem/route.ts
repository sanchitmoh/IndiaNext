import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet } from '@/lib/redis-cache';
import { rateLimitByIP, createRateLimitHeaders } from '@/lib/rate-limit';

const MAX_EXTENSIONS = 3; // Maximum number of times a reservation can be extended
const RESERVATION_DURATION = 15 * 60 * 1000; // 15 minutes
const LAST_ASSIGNED_KEY = 'problem:last_assigned_order'; // Redis key for rotating tiebreaker

// Anonymous ID validation: must match `anon_<timestamp>_<random>` and be ≤ 60 chars
const ANON_ID_REGEX = /^anon_\d{13,}_[a-z0-9]{5,12}$/;
const ANON_ID_MAX_LENGTH = 60;

// Tighter rate limit for anonymous (unauthenticated) reservations
const ANON_RATE_LIMIT = { limit: 5, window: 60 }; // 5 per minute per IP

/**
 * POST /api/reserve-problem
 * 
 * True round-robin problem assignment with rotating tiebreaker:
 * - Each user gets a DIFFERENT problem
 * - Distributes teams evenly across all problems
 * - When problems have equal load, rotates the starting point
 *   so consecutive users get different problems
 * - Cycles back to Problem #1 after Problem #10
 *
 * SessionId is read from the session_token cookie (set by verify-otp).
 * Falls back to sessionId in request body for backward compatibility.
 */
export async function POST(req: Request) {
  try {
    // Read session_token from HttpOnly cookie (matches register route cleanup)
    const cookieStore = await cookies();
    const sessionTokenFromCookie = cookieStore.get('session_token')?.value;

    // Fallback: also accept sessionId from request body
    let bodySessionId: string | undefined;
    let anonymousId: string | undefined;
    try {
      const body = await req.json();
      bodySessionId = body.sessionId;
      anonymousId = body.anonymousId; // For unauthenticated users
    } catch {
      // Body may be empty if only using cookie
    }

    const sessionId = sessionTokenFromCookie || bodySessionId;

    // Validate anonymousId format if provided
    if (anonymousId) {
      if (anonymousId.length > ANON_ID_MAX_LENGTH || !ANON_ID_REGEX.test(anonymousId)) {
        return NextResponse.json({
          success: false,
          message: 'Invalid anonymous identifier format.',
        }, { status: 400 });
      }
    }

    const reservationId = sessionId || anonymousId; // Use anonymous ID if no session
    const isAnonymous = !sessionId && !!anonymousId;

    // Enhanced logging for debugging
    console.log('[ReserveProblem] Auth check:', {
      hasCookie: !!sessionTokenFromCookie,
      hasBodySession: !!bodySessionId,
      hasAnonymousId: !!anonymousId,
      finalReservationId: !!reservationId,
      isAuthenticated: !!sessionId,
      isAnonymous,
    });

    if (!reservationId) {
      return NextResponse.json({ 
        success: false, 
        message: 'Session identifier required. Please provide sessionId or anonymousId.' 
      }, { status: 400 });
    }

    // Tighter rate limiting for anonymous (unauthenticated) reservations
    if (isAnonymous) {
      const rl = await rateLimitByIP(req, ANON_RATE_LIMIT.limit, ANON_RATE_LIMIT.window);
      if (!rl.success) {
        return NextResponse.json(
          { success: false, message: 'Too many reservation attempts. Please try again later.' },
          { status: 429, headers: createRateLimitHeaders(rl) },
        );
      }
    }

    // 1. Cleanup expired reservations globally to free up slots
    const deletedCount = await prisma.problemReservation.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    if (deletedCount.count > 0) {
      console.log(`[ReserveProblem] Cleaned up ${deletedCount.count} expired reservations`);
    }

    // 2. Check if this session already has an ACTIVE reservation (outside tx for speed)
    const existingReservation = await prisma.problemReservation.findUnique({
      where: { sessionId: reservationId },
      include: { problemStatement: true },
    });

    if (existingReservation) {
      // Check if extension limit reached
      if (existingReservation.extensionCount >= MAX_EXTENSIONS) {
        return NextResponse.json({
          success: false,
          error: 'EXTENSION_LIMIT_REACHED',
          message: `You have reached the maximum number of extensions (${MAX_EXTENSIONS}). Please complete your registration.`,
        }, { status: 429 });
      }

      // Extend the expiry by 15 minutes since they are still active
      await prisma.problemReservation.update({
        where: { id: existingReservation.id },
        data: {
          expiresAt: new Date(Date.now() + RESERVATION_DURATION),
          extensionCount: existingReservation.extensionCount + 1,
        },
      });

      console.log(`[ReserveProblem] Extended reservation for session ${reservationId} (extension #${existingReservation.extensionCount + 1})`);

      return NextResponse.json({
        success: true,
        data: {
          id: existingReservation.problemStatement.id,
          title: existingReservation.problemStatement.title,
          objective: existingReservation.problemStatement.objective,
          description: existingReservation.problemStatement.description,
          extensionsRemaining: MAX_EXTENSIONS - (existingReservation.extensionCount + 1),
        },
        extended: true,
      });
    }

    // 3. ROUND-ROBIN ASSIGNMENT: Find the problem with the LEAST assignments
    const availableProblems = await prisma.problemStatement.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    if (availableProblems.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No active problem statements available.',
        allFilled: true,
      });
    }

    // Get all reservation counts in a SINGLE grouped query instead of N separate counts
    const reservationCounts = await prisma.problemReservation.groupBy({
      by: ['problemStatementId'],
      _count: { id: true },
    });
    const reservationCountMap = new Map(
      reservationCounts.map(r => [r.problemStatementId, r._count.id])
    );

    const problemsWithLoad = availableProblems.map((problem) => {
      const activeReservations = reservationCountMap.get(problem.id) || 0;
      const totalCommitted = problem.submissionCount + activeReservations;
      return {
        ...problem,
        activeReservations,
        totalCommitted,
        hasCapacity: totalCommitted < problem.maxSubmissions,
      };
    });

    // Filter problems that still have capacity
    let availableWithCapacity = problemsWithLoad.filter(p => p.hasCapacity);

    if (availableWithCapacity.length === 0) {
      // Check if we can expand capacity from 30 to 50 slots per problem
      const canExpand = availableProblems.some(p => p.maxSubmissions < 50);

      if (canExpand) {
        // Expand maxSubmissions for all active problems to 50
        await prisma.problemStatement.updateMany({
          where: { isActive: true },
          data: { maxSubmissions: 50 },
        });
        console.log('[ReserveProblem] Expanded capacity to 50 slots per problem');

        // Recalculate with expanded capacity
        availableWithCapacity = problemsWithLoad.map(p => ({
          ...p,
          hasCapacity: p.totalCommitted < 50,
        })).filter(p => p.hasCapacity);
      }

      if (availableWithCapacity.length === 0) {
        return NextResponse.json({
          success: true,
          data: null,
          message: 'All problem statements have been fully reserved or filled.',
          allFilled: true,
        });
      }
    }

    // 4. TRUE ROUND-ROBIN: Select problem with least load + rotating tiebreaker
    // Redis call is outside the DB transaction — this is safe since it's just a hint
    const selectedProblem = await selectWithRotatingTiebreaker(availableWithCapacity);

    // 5. Create the reservation inside a SHORT transaction (only the critical write)
    const newReservation = await prisma.$transaction(async (tx) => {
      return tx.problemReservation.create({
        data: {
          sessionId: reservationId,
          problemStatementId: selectedProblem.id,
          expiresAt: new Date(Date.now() + RESERVATION_DURATION),
          extensionCount: 0,
        },
        include: { problemStatement: true },
      });
    }, {
      timeout: 15000,
    });

    console.log(`[ReserveProblem] Round-robin assignment - Session ${reservationId} → Problem #${selectedProblem.order}: "${selectedProblem.title}" (Load: ${selectedProblem.totalCommitted + 1}/${selectedProblem.maxSubmissions})`);

    // Fire-and-forget: update isCurrent flag and track analytics (non-critical)
    if (!selectedProblem.isCurrent) {
      prisma.problemStatement.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } })
        .then(() => prisma.problemStatement.update({ where: { id: selectedProblem.id }, data: { isCurrent: true } }))
        .catch(err => console.error('[ReserveProblem] isCurrent update failed:', err));
    }

    trackReservationAnalytics(prisma, 'reservation_created', {
      sessionId: reservationId,
      problemStatementId: selectedProblem.id,
      problemTitle: selectedProblem.title,
      problemOrder: selectedProblem.order,
      loadAfterReservation: selectedProblem.totalCommitted + 1,
      distributionStrategy: 'round-robin',
      isAuthenticated: !!sessionId,
    }).catch(err => console.error('[ReserveProblem] Analytics tracking failed:', err));

    return NextResponse.json({
      success: true,
      data: {
        id: newReservation.problemStatement.id,
        title: newReservation.problemStatement.title,
        objective: newReservation.problemStatement.objective,
        description: newReservation.problemStatement.description,
        extensionsRemaining: MAX_EXTENSIONS,
      },
      allFilled: false,
      extended: false,
    });

  } catch (error) {
    console.error('[ReserveProblem] Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to reserve problem slot.' }, { status: 500 });
  }
}

/**
 * True round-robin selector with rotating tiebreaker.
 *
 * 1. Find the minimum totalCommitted across all candidates.
 * 2. Among candidates with that minimum load, pick the one whose `order`
 *    comes immediately AFTER the last assigned order (wrapping around).
 * 3. Store the selected order in Redis so the next call rotates.
 *
 * This ensures that when problems 1-10 all have load=3, consecutive
 * reservations go to #1, #2, #3, ... #10, #1, ... instead of always #1.
 */
async function selectWithRotatingTiebreaker<
  T extends { order: number; totalCommitted: number }
>(candidates: T[]): Promise<T> {
  // Step 1: Find minimum load
  const minLoad = Math.min(...candidates.map(p => p.totalCommitted));
  const tied = candidates.filter(p => p.totalCommitted === minLoad);

  // If only one candidate at minimum load, no tiebreaker needed
  if (tied.length === 1) {
    await cacheSet(LAST_ASSIGNED_KEY, String(tied[0].order), { ttl: 3600 });
    return tied[0];
  }

  // Step 2: Get last assigned order from Redis
  let lastOrder = 0;
  try {
    const cached = await cacheGet<string>(LAST_ASSIGNED_KEY);
    if (cached) lastOrder = parseInt(cached as string, 10) || 0;
  } catch {
    // Fallback: no tiebreaker state, pick first
  }

  // Step 3: Sort tied candidates by order, then pick the first one
  // whose order is strictly greater than lastOrder (wrap around)
  const sorted = tied.sort((a, b) => a.order - b.order);
  const next = sorted.find(p => p.order > lastOrder) || sorted[0];

  // Step 4: Store new last-assigned order (TTL 1 hour, auto-cleanup)
  try {
    await cacheSet(LAST_ASSIGNED_KEY, String(next.order), { ttl: 3600 });
  } catch {
    // Non-critical, continue
  }

  return next;
}

/**
 * Track analytics for reservation events
 */
async function trackReservationAnalytics(
  db: typeof prisma,
  eventType: string,
  metadata: Record<string, any>
) {
  try {
    await db.metric.create({
      data: {
        name: eventType,
        value: 1,
        metadata,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('[ReserveProblem] Failed to track analytics:', error);
  }
}
