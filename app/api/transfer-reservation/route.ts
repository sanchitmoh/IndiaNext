import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashSessionToken } from '@/lib/session-security';
import { rateLimitByIP, createRateLimitHeaders } from '@/lib/rate-limit';

const RESERVATION_DURATION_AUTH = 24 * 60 * 60 * 1000; // 24 hours for authenticated users

/**
 * POST /api/transfer-reservation
 * 
 * Transfers an anonymous reservation to an authenticated session.
 * Called after email verification to link the problem reservation
 * to the user's authenticated session.
 */
export async function POST(req: Request) {
  try {
    // Rate limit: 10 requests/min per IP
    const rl = await rateLimitByIP(req, 10, 60);
    if (!rl.success) {
      return NextResponse.json(
        { success: false, message: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rl) },
      );
    }

    // ✅ SECURITY FIX (H-2): Authenticate via HttpOnly cookie, not body
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: 'Authentication required.' },
        { status: 401 }
      );
    }

    // Verify the session is valid
    const session = await prisma.session.findUnique({
      where: { token: hashSessionToken(sessionToken) },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired session.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { anonymousId } = body;
    // Use the authenticated sessionId from cookie, ignore any body.sessionId
    // ✅ SECURITY FIX: Hash session token before storing in ProblemReservation
    const sessionId = hashSessionToken(sessionToken);

    if (!anonymousId) {
      return NextResponse.json(
        { success: false, message: 'anonymousId is required.' },
        { status: 400 }
      );
    }

    // Validate anonymousId format (must match client-generated format)
    const ANON_ID_REGEX = /^anon_\d{13,}_[a-z0-9]{5,12}$/;
    if (anonymousId.length > 60 || !ANON_ID_REGEX.test(anonymousId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid anonymous identifier format.' },
        { status: 400 },
      );
    }

    // Find the anonymous reservation
    const anonymousReservation = await prisma.problemReservation.findUnique({
      where: { sessionId: anonymousId },
    });

    if (!anonymousReservation) {
      // Anonymous reservation likely expired (race condition).
      // Check if the authenticated session already has a reservation.
      const existingAuth = await prisma.problemReservation.findUnique({
        where: { sessionId },
      });

      return NextResponse.json({
        success: true,
        message: 'No anonymous reservation to transfer.',
        // Tell client to re-reserve if neither anonymous nor auth reservation exists
        needsReReservation: !existingAuth,
      });
    }

    // Check if authenticated session already has a reservation
    const existingReservation = await prisma.problemReservation.findUnique({
      where: { sessionId },
    });

    if (existingReservation) {
      // User already has a reservation, delete the anonymous one
      await prisma.problemReservation.delete({
        where: { sessionId: anonymousId },
      });

      return NextResponse.json({
        success: true,
        message: 'Authenticated session already has a reservation.',
      });
    }

    // Transfer the reservation by updating the sessionId and extending TTL to 24h
    await prisma.problemReservation.update({
      where: { sessionId: anonymousId },
      data: {
        sessionId,
        expiresAt: new Date(Date.now() + RESERVATION_DURATION_AUTH),
        extensionCount: 0, // Reset extension count for authenticated user
      },
    });

    console.log(`[TransferReservation] Transferred reservation from ${anonymousId} to ${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'Reservation transferred successfully.',
    });
  } catch (error) {
    console.error('[TransferReservation] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to transfer reservation.' },
      { status: 500 }
    );
  }
}
