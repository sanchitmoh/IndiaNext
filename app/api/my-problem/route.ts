import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { hashSessionToken } from '@/lib/session-security';

/**
 * GET /api/my-problem
 *
 * Returns the user's currently assigned problem statement, if any.
 * Checks (in order):
 *   1. Active ProblemReservation by session_token cookie
 *   2. Active ProblemReservation by anonymousId query param
 *   3. Completed Submission (already registered team) by session user
 *
 * This is a READ-ONLY endpoint — it never creates or modifies reservations.
 * Industry standard: returning users should see their existing assignment
 * without re-triggering the round-robin allocator.
 */
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    const { searchParams } = new URL(req.url);
    const anonymousId = searchParams.get('anonymousId');

    // Must have at least one identifier
    if (!sessionToken && !anonymousId) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'No session identifier provided.',
      });
    }

    // 1. Check by session_token (authenticated user)
    if (sessionToken) {
      // ✅ SECURITY FIX: Hash session token for ProblemReservation lookup
      const reservation = await prisma.problemReservation.findUnique({
        where: { sessionId: hashSessionToken(sessionToken) },
        include: { problemStatement: true },
      });

      if (reservation) {
        const isExpired = reservation.expiresAt < new Date();
        return NextResponse.json({
          success: true,
          data: {
            id: reservation.problemStatement.id,
            title: reservation.problemStatement.title,
            objective: reservation.problemStatement.objective,
            description: reservation.problemStatement.description,
            isExpired,
            source: 'reservation',
          },
        });
      }

      // 2. Check if user already has a completed registration with a problem
      const session = await prisma.session.findUnique({
        where: { token: hashSessionToken(sessionToken) },
      });

      if (session) {
        // Find team via User → TeamMember → Team → Submission
        const teamMember = await prisma.teamMember.findUnique({
          where: { userId: session.userId },
          include: {
            team: {
              include: {
                submission: {
                  include: {
                    assignedProblemStatement: true,
                  },
                },
              },
            },
          },
        });

        if (teamMember?.team?.submission?.assignedProblemStatement) {
          const ps = teamMember.team.submission.assignedProblemStatement;
          return NextResponse.json({
            success: true,
            data: {
              id: ps.id,
              title: ps.title,
              objective: ps.objective,
              description: ps.description,
              isExpired: false,
              source: 'registered',
            },
          });
        }
      }
    }

    // 3. Check by anonymousId (unauthenticated user)
    if (anonymousId) {
      const ANON_ID_REGEX = /^anon_\d{13,}_[a-z0-9]{5,12}$/;
      if (anonymousId.length > 60 || !ANON_ID_REGEX.test(anonymousId)) {
        return NextResponse.json({
          success: true,
          data: null,
          message: 'Invalid anonymous identifier.',
        });
      }

      const reservation = await prisma.problemReservation.findUnique({
        where: { sessionId: anonymousId },
        include: { problemStatement: true },
      });

      if (reservation) {
        const isExpired = reservation.expiresAt < new Date();
        return NextResponse.json({
          success: true,
          data: {
            id: reservation.problemStatement.id,
            title: reservation.problemStatement.title,
            objective: reservation.problemStatement.objective,
            description: reservation.problemStatement.description,
            isExpired,
            source: 'reservation',
          },
        });
      }
    }

    // No assignment found
    return NextResponse.json({
      success: true,
      data: null,
      message: 'No problem statement currently assigned.',
    });
  } catch (error) {
    console.error('[MyProblem] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to check problem assignment.' },
      { status: 500 }
    );
  }
}
