// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Registration closed, unreachable code below early returns
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { rateLimitRegister, createRateLimitHeaders } from '@/lib/rate-limit';
import { sendRegistrationBatchEmails } from '@/lib/email';
import { sanitizeObject, containsXss } from '@/lib/input-sanitizer';
import { generateShortCodeTx } from '@/lib/short-code';
import { hashSessionToken } from '@/lib/session-security';
import { z } from 'zod';
import type { Prisma } from '@prisma/client/edge';

// Idempotency response type
interface IdempotencyResponse {
  success: boolean;
  message: string;
  data: {
    teamId: string;
    submissionId: string;
    teamName: string;
    track: 'IDEA_SPRINT' | 'BUILD_STORM';
  };
}

// Comprehensive input validation schema
const RegisterSchema = z
  .object({
    // Idempotency key
    idempotencyKey: z.string().max(100).optional(),

    // Team Info
    track: z.enum([
      'Track 1: BuildStorm - Solve Problem Statement in 24 Hours',
      'Track 2: IdeaSprint - Build MVP in 24 Hours',
      'IdeaSprint: Build MVP in 24 Hours',
      'BuildStorm: Solve Problem Statement in 24 Hours',
      'IDEA_SPRINT',
      'BUILD_STORM',
    ]),
    teamName: z.string().min(2, 'Team name must be at least 2 characters').max(100),
    teamSize: z.string(),

    // Leader Info
    leaderName: z.string().min(2, 'Name must be at least 2 characters').max(100),
    leaderGender: z.string().optional(),
    leaderEmail: z.string().email('Invalid email format'),
    leaderMobile: z.string().regex(/^[0-9]{10}$/, 'Mobile number must be 10 digits'),
    leaderCollege: z.string().min(2).max(200),
    leaderDegree: z.string().min(2).max(100),

    // Members (optional)
    member2Name: z.string().optional(),
    member2Gender: z.string().optional(),
    member2Email: z.string().email().optional().or(z.literal('')),
    member2College: z.string().optional(),
    member2Degree: z.string().optional(),

    member3Name: z.string().optional(),
    member3Gender: z.string().optional(),
    member3Email: z.string().email().optional().or(z.literal('')),
    member3College: z.string().optional(),
    member3Degree: z.string().optional(),

    member4Name: z.string().optional(),
    member4Gender: z.string().optional(),
    member4Email: z.string().email().optional().or(z.literal('')),
    member4College: z.string().optional(),
    member4Degree: z.string().optional(),

    // IdeaSprint Fields
    ideaTitle: z.string().optional(),
    problemStatement: z.string().optional(),
    proposedSolution: z.string().optional(),
    targetUsers: z.string().optional(),
    expectedImpact: z.string().optional(),
    techStack: z.string().optional(),
    docLink: z.string().url().optional().or(z.literal('')),

    // BuildStorm Fields
    problemDesc: z.string().optional(),
    githubLink: z.string().url().optional().or(z.literal('')),
    githubLinkIdea: z.string().url().optional().or(z.literal('')),
    assignedProblemStatementId: z.string().optional(),

    // Meta
    hearAbout: z.string().optional(),
    additionalNotes: z.string().optional(),

    // Session fallback for mobile browsers that strip cookies
    sessionId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Collect all non-empty emails
    const emails: string[] = [data.leaderEmail];
    if (data.member2Email) emails.push(data.member2Email);
    if (data.member3Email) emails.push(data.member3Email);
    if (data.member4Email) emails.push(data.member4Email);

    // Normalize to lowercase and check for duplicates
    const normalized = emails.map((e) => e.toLowerCase().trim());
    const seen = new Set<string>();
    for (let i = 0; i < normalized.length; i++) {
      if (seen.has(normalized[i])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate email: ${emails[i]} — each team member must have a unique email`,
          path: i === 0 ? ['leaderEmail'] : [`member${i + 1}Email`],
        });
      }
      seen.add(normalized[i]);
    }
  });

// Idempotency using database (serverless-safe)
async function checkIdempotency(key: string): Promise<IdempotencyResponse | null> {
  try {
    const record = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (!record) return null;

    // Check if expired
    if (record.expiresAt < new Date()) {
      // Clean up expired record
      await prisma.idempotencyKey.delete({ where: { key } });
      return null;
    }

    return record.response as unknown as IdempotencyResponse;
  } catch (error) {
    console.error('[Idempotency] Check failed:', error);
    return null;
  }
}

async function storeIdempotency(key: string, response: IdempotencyResponse) {
  try {
    await prisma.idempotencyKey.create({
      data: {
        key,
        response: response as any,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
  } catch (error) {
    // Ignore duplicate key errors (race condition)
    if (!(error instanceof Error && error.message.includes('Unique constraint'))) {
      console.error('[Idempotency] Store failed:', error);
    }
  }
}

export async function POST(req: Request) {
  try {
    // ✅ REGISTRATION CLOSED - Return early with closed message
    return NextResponse.json(
      {
        success: false,
        error: 'REGISTRATION_CLOSED',
        message: 'Registration for IndiaNext 2026 has been closed. Thank you for your interest.',
      },
      { status: 403 }
    );

    // ✅ Sliding-window rate limiting (IP only)
    // Limits centralised in lib/rate-limit.ts → RATE_LIMITS['register']
    const rateLimit = await rateLimitRegister(req);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many registration attempts. Please wait before trying again.',
          retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimit),
        }
      );
    }

    // Parse and validate input
    const body = await req.json();
    const validation = RegisterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: validation.error.errors[0]?.message ?? 'Validation failed',
          details: validation.error.errors,
        },
        {
          status: 400,
          headers: createRateLimitHeaders(rateLimit),
        }
      );
    }

    const data = validation.data;

    // ✅ SANITIZE INPUT to prevent XSS and injection attacks
    const sanitizedData: typeof data = sanitizeObject(data, {
      sanitizeHtml: true,
      sanitizeUrls: true,
    }) as typeof data;

    // ✅ SECURITY FIX (L-1): Expanded XSS check to cover all user-supplied string fields
    const criticalFields = [
      sanitizedData.teamName,
      sanitizedData.leaderName,
      sanitizedData.leaderEmail,
      sanitizedData.leaderMobile,
      sanitizedData.leaderCollege,
      sanitizedData.leaderDegree,
      sanitizedData.ideaTitle,
      sanitizedData.problemStatement,
      sanitizedData.proposedSolution,
      sanitizedData.targetUsers,
      sanitizedData.expectedImpact,
      sanitizedData.techStack,
      sanitizedData.problemDesc,
      sanitizedData.additionalNotes,
      sanitizedData.hearAbout,
      // Member fields
      sanitizedData.member2Name,
      sanitizedData.member2Email,
      sanitizedData.member2College,
      sanitizedData.member2Degree,
      sanitizedData.member3Name,
      sanitizedData.member3Email,
      sanitizedData.member3College,
      sanitizedData.member3Degree,
      sanitizedData.member4Name,
      sanitizedData.member4Email,
      sanitizedData.member4College,
      sanitizedData.member4Degree,
    ].filter(Boolean);

    for (const field of criticalFields) {
      if (typeof field === 'string' && containsXss(field)) {
        return NextResponse.json(
          {
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid input detected. Please remove any HTML or script tags.',
          },
          { status: 400, headers: createRateLimitHeaders(rateLimit) }
        );
      }
    }

    // NOTE: SQL injection check removed — Prisma uses parameterized queries,
    // and the regex pattern rejected legitimate inputs like "Creative Select" or "Update Systems"

    // Check idempotency
    if (sanitizedData.idempotencyKey) {
      const cachedResponse = await checkIdempotency(sanitizedData.idempotencyKey);
      if (cachedResponse) {
        console.log(
          `[Register] Returning cached response for idempotency key: ${sanitizedData.idempotencyKey}`
        );
        return NextResponse.json(cachedResponse);
      }
    }

    // Verify OTP was verified AND validate session token
    // ✅ SECURITY FIX (M-13): Only accept session token from HttpOnly cookie, not from body
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Session token required. Please verify your email first.',
        },
        { status: 401 }
      );
    }

    // Validate session token
    const session = await prisma.session.findUnique({
      where: { token: hashSessionToken(sessionToken) },
      include: { user: true },
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: 'SESSION_NOT_FOUND',
          message: 'Session not found. Please verify your email again.',
        },
        { status: 401 }
      );
    }

    if (session.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: 'SESSION_EXPIRED',
          message: 'Session expired. Please verify your email again.',
        },
        { status: 401 }
      );
    }

    // Verify session user matches the leader email (case-insensitive comparison)
    const sessionEmail = session.user.email.toLowerCase().trim();
    const leaderEmail = sanitizedData.leaderEmail.toLowerCase().trim();

    if (sessionEmail !== leaderEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'EMAIL_MISMATCH',
          // ✅ SECURITY FIX (M-3): Don't expose email addresses in error
          message:
            'Leader email does not match the email used during OTP verification. Please use the same email.',
        },
        { status: 403 }
      );
    }

    // Verify OTP was verified for this email (use normalized email)
    const normalizedLeaderEmail = sanitizedData.leaderEmail.toLowerCase().trim();

    const otpRecord = await prisma.otp.findUnique({
      where: {
        email_purpose: {
          email: normalizedLeaderEmail,
          purpose: 'REGISTRATION',
        },
      },
    });

    if (!otpRecord) {
      return NextResponse.json(
        {
          success: false,
          error: 'EMAIL_NOT_VERIFIED',
          message: 'Email not verified. Please verify OTP first.',
        },
        { status: 403 }
      );
    }

    if (!otpRecord.verified) {
      return NextResponse.json(
        {
          success: false,
          error: 'EMAIL_NOT_VERIFIED',
          // ✅ SECURITY FIX (M-4): Don't expose email in debug info
          message: 'Email not verified. Please verify OTP first.',
        },
        { status: 403 }
      );
    }

    // Map track names to enum values
    const trackMap: Record<string, 'IDEA_SPRINT' | 'BUILD_STORM'> = {
      'Track 1: BuildStorm - Solve Problem Statement in 24 Hours': 'BUILD_STORM',
      'Track 2: IdeaSprint - Build MVP in 24 Hours': 'IDEA_SPRINT',
      'IdeaSprint: Build MVP in 24 Hours': 'IDEA_SPRINT',
      'BuildStorm: Solve Problem Statement in 24 Hours': 'BUILD_STORM',
      IDEA_SPRINT: 'IDEA_SPRINT',
      BUILD_STORM: 'BUILD_STORM',
    };

    const trackEnum = trackMap[sanitizedData.track];
    if (!trackEnum) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_TRACK',
          message: 'Invalid track selection',
        },
        { status: 400 }
      );
    }

    // Collect all members
    const members: Array<{
      email: string;
      name: string;
      gender: string;
      college: string;
      degree: string;
      phone: string;
      role: 'LEADER' | 'MEMBER';
    }> = [
      {
        email: sanitizedData.leaderEmail,
        name: sanitizedData.leaderName,
        gender: sanitizedData.leaderGender || '',
        college: sanitizedData.leaderCollege,
        degree: sanitizedData.leaderDegree,
        phone: sanitizedData.leaderMobile,
        role: 'LEADER' as const,
      },
    ];

    if (sanitizedData.member2Email && sanitizedData.member2Name) {
      members.push({
        email: sanitizedData.member2Email,
        name: sanitizedData.member2Name,
        gender: sanitizedData.member2Gender || '',
        college: sanitizedData.member2College || sanitizedData.leaderCollege,
        degree: sanitizedData.member2Degree || '',
        phone: '',
        role: 'MEMBER' as const,
      });
    }
    if (sanitizedData.member3Email && sanitizedData.member3Name) {
      members.push({
        email: sanitizedData.member3Email,
        name: sanitizedData.member3Name,
        gender: sanitizedData.member3Gender || '',
        college: sanitizedData.member3College || sanitizedData.leaderCollege,
        degree: sanitizedData.member3Degree || '',
        phone: '',
        role: 'MEMBER' as const,
      });
    }
    if (sanitizedData.member4Email && sanitizedData.member4Name) {
      members.push({
        email: sanitizedData.member4Email,
        name: sanitizedData.member4Name,
        gender: sanitizedData.member4Gender || '',
        college: sanitizedData.member4College || sanitizedData.leaderCollege,
        degree: sanitizedData.member4Degree || '',
        phone: '',
        role: 'MEMBER' as const,
      });
    }

    // ✅ GLOBAL DUPLICATE CHECK: No email can appear in ANY team (leader or member)
    const allEmails = members.map((m) => m.email.toLowerCase().trim());

    const existingMembers = await prisma.teamMember.findMany({
      where: {
        user: { email: { in: allEmails } },
        team: { deletedAt: null }, // Only count active (non-deleted) teams
      },
      include: {
        user: { select: { email: true } },
        team: { select: { name: true, track: true } },
      },
    });

    if (existingMembers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'DUPLICATE_EMAIL',
          message: 'One or more email addresses are already registered in another team.',
        },
        { status: 409, headers: createRateLimitHeaders(rateLimit) }
      );
    }

    // Create team with all related data in a transaction
    // Increase timeout to 15 seconds for complex operations
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // 1. Create or find users for all members
        const userIds: { userId: string; role: 'LEADER' | 'MEMBER' }[] = [];

        for (const member of members) {
          // Find existing user first
          const existingUser = await tx.user.findUnique({
            where: { email: member.email },
          });

          let user;
          if (existingUser) {
            // Update existing user
            user = await tx.user.update({
              where: { email: member.email },
              data: {
                name: member.name || existingUser.name,
                gender: member.gender || existingUser.gender,
                college: member.college || existingUser.college,
                degree: member.degree || existingUser.degree,
                phone: member.phone || existingUser.phone,
              },
            });
          } else {
            // Create new user
            user = await tx.user.create({
              data: {
                email: member.email,
                name: member.name || '',
                gender: member.gender,
                college: member.college,
                degree: member.degree,
                phone: member.phone,
                emailVerified: member.email === data.leaderEmail, // Leader is verified
                role: 'PARTICIPANT',
              },
            });
          }

          userIds.push({ userId: user.id, role: member.role });
        }

        // 2. Generate human-friendly short code (e.g. IS-7K3X, BS-A9M2)
        const shortCode = await generateShortCodeTx(tx, trackEnum);

        // 3. Create team
        const team = await tx.team.create({
          data: {
            name: sanitizedData.teamName,
            shortCode,
            track: trackEnum,
            status: 'PENDING',
            size: members.length,
            college: sanitizedData.leaderCollege,
            hearAbout: sanitizedData.hearAbout,
            additionalNotes: sanitizedData.additionalNotes,
            createdBy: userIds[0].userId, // Leader's user ID
          },
        });

        // 4. Create team members
        for (const { userId, role } of userIds) {
          await tx.teamMember.create({
            data: {
              userId,
              teamId: team.id,
              role,
            },
          });
        }

        // 5. Create submission
        const submission = await tx.submission.create({
          data: {
            teamId: team.id,
            // IdeaSprint fields
            ideaTitle: trackEnum === 'IDEA_SPRINT' ? sanitizedData.ideaTitle : null,
            problemStatement: trackEnum === 'IDEA_SPRINT' ? sanitizedData.problemStatement : null,
            proposedSolution: trackEnum === 'IDEA_SPRINT' ? sanitizedData.proposedSolution : null,
            targetUsers: trackEnum === 'IDEA_SPRINT' ? sanitizedData.targetUsers : null,
            expectedImpact: trackEnum === 'IDEA_SPRINT' ? sanitizedData.expectedImpact : null,
            techStack: trackEnum === 'IDEA_SPRINT' ? sanitizedData.techStack : null,
            docLink: trackEnum === 'IDEA_SPRINT' ? sanitizedData.docLink : null,
            githubLink: sanitizedData.githubLink || sanitizedData.githubLinkIdea || null,
            problemDesc: trackEnum === 'BUILD_STORM' ? sanitizedData.problemDesc : null,
            assignedProblemStatementId:
              trackEnum === 'BUILD_STORM' ? sanitizedData.assignedProblemStatementId : null,
          },
        });

        // 6. Create activity log
        await tx.activityLog.create({
          data: {
            userId: userIds[0].userId,
            action: 'team.created',
            entity: 'Team',
            entityId: team.id,
            metadata: {
              teamName: sanitizedData.teamName,
              track: trackEnum,
              memberCount: members.length,
            },
            ipAddress:
              req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
            userAgent: req.headers.get('user-agent') || 'unknown',
          },
        });

        // 6b. ✅ BuildStorm: Increment submissionCount and clean up reservation
        if (trackEnum === 'BUILD_STORM' && sanitizedData.assignedProblemStatementId) {
          await tx.problemStatement.update({
            where: { id: sanitizedData.assignedProblemStatementId },
            data: { submissionCount: { increment: 1 } },
          });

          // ✅ SECURITY FIX: Use outer sessionToken (avoid re-reading cookies inside tx)
          // Hash session token to match ProblemReservation storage
          if (sessionToken) {
            await tx.problemReservation.deleteMany({
              where: {
                problemStatementId: sanitizedData.assignedProblemStatementId,
                sessionId: hashSessionToken(sessionToken),
              },
            });
          }
        }

        // 7. ✅ SECURITY FIX: Delete OTP record after successful registration
        await tx.otp
          .delete({
            where: {
              email_purpose: {
                email: sanitizedData.leaderEmail,
                purpose: 'REGISTRATION',
              },
            },
          })
          .catch(() => {
            // Ignore if already deleted
          });

        // 8. Track analytics: successful registration
        await tx.metric.create({
          data: {
            name: 'registration_completed',
            value: 1,
            metadata: {
              track: trackEnum,
              teamSize: members.length,
              college: sanitizedData.leaderCollege,
              hasReservation: !!sanitizedData.assignedProblemStatementId,
              problemStatementId: sanitizedData.assignedProblemStatementId,
            },
            timestamp: new Date(),
          },
        });

        // 9. If BuildStorm with reservation, track conversion rate
        if (trackEnum === 'BUILD_STORM' && sanitizedData.assignedProblemStatementId) {
          await tx.metric.create({
            data: {
              name: 'reservation_to_registration_conversion',
              value: 1,
              metadata: {
                problemStatementId: sanitizedData.assignedProblemStatementId,
              },
              timestamp: new Date(),
            },
          });
        }

        return { team, submission };
      },
      {
        timeout: 15000, // 15 seconds timeout for complex registration
      }
    );

    const response = {
      success: true,
      message: 'Registration successful!',
      data: {
        teamId: result.team.shortCode,
        submissionId: result.submission.id,
        teamName: result.team.name,
        track: result.team.track,
      },
    };

    // Store idempotency response
    if (sanitizedData.idempotencyKey) {
      await storeIdempotency(sanitizedData.idempotencyKey, response);
    }

    // ✅ BATCH API: Send ALL registration emails in 1 Resend API call
    // Uses next/server `after()` so Vercel keeps the function alive after the
    // response is sent, instead of fire-and-forget which gets killed on serverless.
    const trackLabel =
      trackEnum === 'IDEA_SPRINT'
        ? 'IdeaSprint: Build MVP in 24 Hours'
        : 'BuildStorm: Solve Problem Statement in 24 Hours';

    after(async () => {
      try {
        const results = await sendRegistrationBatchEmails({
          leaderEmail: sanitizedData.leaderEmail,
          teamId: result.team.shortCode,
          teamName: result.team.name,
          track: trackLabel,
          members: members.map((m) => ({
            name: m.name,
            email: m.email,
            role: m.role,
            college: m.college,
            degree: m.degree,
            phone: m.phone,
          })),
          leaderName: sanitizedData.leaderName,
          leaderMobile: sanitizedData.leaderMobile,
          leaderCollege: sanitizedData.leaderCollege,
          leaderDegree: sanitizedData.leaderDegree,
          // IdeaSprint submission
          ideaTitle: sanitizedData.ideaTitle,
          problemStatement: sanitizedData.problemStatement,
          proposedSolution: sanitizedData.proposedSolution,
          targetUsers: sanitizedData.targetUsers,
          expectedImpact: sanitizedData.expectedImpact,
          techStack: sanitizedData.techStack,
          docLink: sanitizedData.docLink,
          // BuildStorm submission
          problemDesc: sanitizedData.problemDesc,
          githubLink: sanitizedData.githubLink,
          // Meta
          hearAbout: sanitizedData.hearAbout,
          additionalNotes: sanitizedData.additionalNotes,
        });
        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          console.error(`[Register] ${failed.length}/${results.length} email(s) failed in batch`);
        } else {
          console.log(
            `[Register] ✅ All ${results.length} registration email(s) sent via batch API`
          );
        }
      } catch (err) {
        console.error('[Register] Batch email send error:', err);
      }
    });

    return NextResponse.json(response, {
      headers: createRateLimitHeaders(rateLimit),
    });
  } catch (error) {
    console.error('[Register] Error:', error);

    // Handle specific errors before falling through to generic handler
    if (error instanceof Error) {
      if (error.message.startsWith('DUPLICATE_REGISTRATION:')) {
        const message = error.message.split(':')[1];
        const { createErrorResponse, getStatusCode } = await import('@/lib/error-handler');
        const err = createErrorResponse('ALREADY_REGISTERED', message, undefined, '/api/register');
        return NextResponse.json(err, { status: getStatusCode('ALREADY_REGISTERED') });
      }
    }

    const { handleGenericError } = await import('@/lib/error-handler');
    return handleGenericError(error, '/api/register');
  }
}

/**
 * Helper function to fetch current registration data for diff comparison
 * Transforms database structure to flat RegistrationData format
 */
async function fetchCurrentRegistration(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: { user: true },
        orderBy: { joinedAt: 'asc' },
      },
      submission: true,
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  // Get members excluding leader (first member is leader)
  const members = team.members.slice(1); // Skip leader

  // Build flat registration data object
  const registrationData: Record<string, any> = {
    teamName: team.name,
    hearAbout: team.hearAbout || '',
    additionalNotes: team.additionalNotes || '',
    track: team.track,
  };

  // Add member data (member2, member3, member4)
  members.forEach((member, index) => {
    const memberNum = index + 2; // member2, member3, member4
    registrationData[`member${memberNum}Email`] = member.user.email || '';
    registrationData[`member${memberNum}Name`] = member.user.name || '';
    registrationData[`member${memberNum}College`] = member.user.college || '';
    registrationData[`member${memberNum}Degree`] = member.user.degree || '';
    registrationData[`member${memberNum}Gender`] = member.user.gender || '';
  });

  // Add submission fields if exists
  if (team.submission) {
    registrationData.ideaTitle = team.submission.ideaTitle || '';
    registrationData.problemStatement = team.submission.problemStatement || '';
    registrationData.proposedSolution = team.submission.proposedSolution || '';
    registrationData.targetUsers = team.submission.targetUsers || '';
    registrationData.expectedImpact = team.submission.expectedImpact || '';
    registrationData.techStack = team.submission.techStack || '';
    registrationData.docLink = team.submission.docLink || '';
    registrationData.problemDesc = team.submission.problemDesc || '';
    registrationData.githubLink = team.submission.githubLink || '';
  }

  return registrationData;
}

export async function PUT(req: Request) {
  try {
    // ✅ REGISTRATION CLOSED - Return early with closed message
    return NextResponse.json(
      {
        success: false,
        error: 'REGISTRATION_CLOSED',
        message: 'Registration updates are no longer allowed. Registration has been closed.',
      },
      { status: 403 }
    );

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token: hashSessionToken(sessionToken) },
      include: {
        user: {
          include: {
            teamMemberships: {
              include: { team: true },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: 'SESSION_NOT_FOUND' }, { status: 401 });
    }

    if (session.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'SESSION_EXPIRED' }, { status: 401 });
    }

    const body = await req.json();
    const validation = RegisterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: validation.error.errors[0]?.message ?? 'Validation failed' },
        { status: 400 }
      );
    }

    const sanitizedData = sanitizeObject(validation.data, {
      sanitizeHtml: true,
      sanitizeUrls: true,
    }) as typeof validation.data;

    const trackMap: Record<string, 'IDEA_SPRINT' | 'BUILD_STORM'> = {
      'Track 1: BuildStorm - Solve Problem Statement in 24 Hours': 'BUILD_STORM',
      'Track 2: IdeaSprint - Build MVP in 24 Hours': 'IDEA_SPRINT',
      'IdeaSprint: Build MVP in 24 Hours': 'IDEA_SPRINT',
      'BuildStorm: Solve Problem Statement in 24 Hours': 'BUILD_STORM',
      IDEA_SPRINT: 'IDEA_SPRINT',
      BUILD_STORM: 'BUILD_STORM',
    };
    const trackEnum = trackMap[sanitizedData.track] || 'IDEA_SPRINT';

    const user = session.user;
    if (!user.teamMemberships || user.teamMemberships.length === 0) {
      return NextResponse.json({ success: false, error: 'NO_TEAM_FOUND' }, { status: 404 });
    }

    // Find the membership for the requested track
    const targetMembership = user.teamMemberships?.find((m) => m.team.track === trackEnum);
    if (!targetMembership) {
      return NextResponse.json(
        {
          success: false,
          error: 'TEAM_NOT_FOUND_FOR_TRACK',
          message: `No registration found for track: ${trackEnum}`,
        },
        { status: 404 }
      );
    }

    const teamId = targetMembership.teamId;

    // 🚩 LIMIT EDITS: Check if this team has already been updated once
    const existingUpdateLog = await prisma.activityLog.findFirst({
      where: {
        entityId: teamId,
        action: 'team.updated',
      },
    });

    if (existingUpdateLog) {
      return NextResponse.json(
        {
          success: false,
          error: 'ALREADY_EDITED',
          message: 'Registration details are locked. You have already edited your form once.',
        },
        { status: 403 }
      );
    }

    // Fetch current registration data before update for audit trail
    const oldData = await fetchCurrentRegistration(teamId);

    // Build new data object from sanitized input
    const newData: Record<string, any> = {
      teamName: sanitizedData.teamName,
      hearAbout: sanitizedData.hearAbout || '',
      additionalNotes: sanitizedData.additionalNotes || '',
      track: trackEnum,
    };

    const membersToUpdate: Array<{
      email: string;
      name: string;
      gender: string;
      college: string;
      degree: string;
      phone: string;
    }> = [];
    if (sanitizedData.member2Email && sanitizedData.member2Name) {
      membersToUpdate.push({
        email: sanitizedData.member2Email.toLowerCase().trim(),
        name: sanitizedData.member2Name,
        gender: sanitizedData.member2Gender || '',
        college: sanitizedData.member2College || sanitizedData.leaderCollege,
        degree: sanitizedData.member2Degree || '',
        phone: '',
      });
      newData.member2Email = sanitizedData.member2Email.toLowerCase().trim();
      newData.member2Name = sanitizedData.member2Name;
      newData.member2College = sanitizedData.member2College || sanitizedData.leaderCollege;
      newData.member2Degree = sanitizedData.member2Degree || '';
      newData.member2Gender = sanitizedData.member2Gender || '';
    }
    if (sanitizedData.member3Email && sanitizedData.member3Name) {
      membersToUpdate.push({
        email: sanitizedData.member3Email.toLowerCase().trim(),
        name: sanitizedData.member3Name,
        gender: sanitizedData.member3Gender || '',
        college: sanitizedData.member3College || sanitizedData.leaderCollege,
        degree: sanitizedData.member3Degree || '',
        phone: '',
      });
      newData.member3Email = sanitizedData.member3Email.toLowerCase().trim();
      newData.member3Name = sanitizedData.member3Name;
      newData.member3College = sanitizedData.member3College || sanitizedData.leaderCollege;
      newData.member3Degree = sanitizedData.member3Degree || '';
      newData.member3Gender = sanitizedData.member3Gender || '';
    }
    if (sanitizedData.member4Email && sanitizedData.member4Name) {
      membersToUpdate.push({
        email: sanitizedData.member4Email.toLowerCase().trim(),
        name: sanitizedData.member4Name,
        gender: sanitizedData.member4Gender || '',
        college: sanitizedData.member4College || sanitizedData.leaderCollege,
        degree: sanitizedData.member4Degree || '',
        phone: '',
      });
      newData.member4Email = sanitizedData.member4Email.toLowerCase().trim();
      newData.member4Name = sanitizedData.member4Name;
      newData.member4College = sanitizedData.member4College || sanitizedData.leaderCollege;
      newData.member4Degree = sanitizedData.member4Degree || '';
      newData.member4Gender = sanitizedData.member4Gender || '';
    }

    // Add submission fields to newData
    if (trackEnum === 'IDEA_SPRINT') {
      newData.ideaTitle = sanitizedData.ideaTitle || '';
      newData.problemStatement = sanitizedData.problemStatement || '';
      newData.proposedSolution = sanitizedData.proposedSolution || '';
      newData.targetUsers = sanitizedData.targetUsers || '';
      newData.expectedImpact = sanitizedData.expectedImpact || '';
      newData.techStack = sanitizedData.techStack || '';
      newData.docLink = sanitizedData.docLink || '';
    } else {
      newData.problemDesc = sanitizedData.problemDesc || '';
    }
    newData.githubLink = sanitizedData.githubLink || sanitizedData.githubLinkIdea || '';

    const allEmails = membersToUpdate.map((m) => m.email);
    if (allEmails.length > 0) {
      const existingMembers = await prisma.teamMember.findMany({
        where: {
          user: { email: { in: allEmails } },
          team: { deletedAt: null, id: { not: teamId } },
        },
      });
      if (existingMembers.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'DUPLICATE_EMAIL',
            message: 'One or more member email addresses are already registered in another team.',
          },
          { status: 409 }
        );
      }
    }

    await prisma.$transaction(
      async (tx) => {
        // 🚩 LOCK CHECK: Ensure no update has been logged yet for this team
        const existingUpdateLog = await tx.activityLog.findFirst({
          where: {
            entityId: teamId,
            action: 'team.updated',
          },
        });

        if (existingUpdateLog) {
          throw new Error('ALREADY_EDITED');
        }

        // Capture changes for audit trail using AuditService
        // Note: We call auditService.captureChanges which will create audit logs
        // This must be done within the transaction to ensure atomicity
        const ipAddress =
          req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        // Create audit logs manually within transaction (since auditService uses prisma directly)
        // We need to use the transaction client (tx) instead
        const { diffEngine } = await import('@/lib/diff-engine');
        const { randomUUID } = await import('crypto');

        const submissionId = randomUUID();
        const changes = diffEngine.diff(oldData, newData);

        // Create audit log entries for each change
        for (const change of changes) {
          await tx.auditLog.create({
            data: {
              teamId,
              userId: user.id,
              sessionId: session.id,
              submissionId,
              action: change.action,
              fieldName: change.fieldName,
              oldValue:
                change.oldValue === null || change.oldValue === undefined
                  ? null
                  : typeof change.oldValue === 'string'
                    ? change.oldValue
                    : JSON.stringify(change.oldValue),
              newValue:
                change.newValue === null || change.newValue === undefined
                  ? null
                  : typeof change.newValue === 'string'
                    ? change.newValue
                    : JSON.stringify(change.newValue),
              ipAddress,
              userAgent,
            },
          });
        }

        // Update team data
        await tx.team.update({
          where: { id: teamId },
          data: {
            name: sanitizedData.teamName,
            college: sanitizedData.leaderCollege,
            hearAbout: sanitizedData.hearAbout,
            additionalNotes: sanitizedData.additionalNotes,
            size: membersToUpdate.length + 1, // +1 for leader
          },
        });

        // Update submission data
        await tx.submission.update({
          where: { teamId: teamId },
          data: {
            ideaTitle: trackEnum === 'IDEA_SPRINT' ? sanitizedData.ideaTitle : null,
            problemStatement: trackEnum === 'IDEA_SPRINT' ? sanitizedData.problemStatement : null,
            proposedSolution: trackEnum === 'IDEA_SPRINT' ? sanitizedData.proposedSolution : null,
            targetUsers: trackEnum === 'IDEA_SPRINT' ? sanitizedData.targetUsers : null,
            expectedImpact: trackEnum === 'IDEA_SPRINT' ? sanitizedData.expectedImpact : null,
            techStack: trackEnum === 'IDEA_SPRINT' ? sanitizedData.techStack : null,
            docLink: trackEnum === 'IDEA_SPRINT' ? sanitizedData.docLink : null,
            githubLink: sanitizedData.githubLink || sanitizedData.githubLinkIdea || null,
            problemDesc: trackEnum === 'BUILD_STORM' ? sanitizedData.problemDesc : null,
          },
        });

        // Completely replace MEMBER level TeamMembers
        await tx.teamMember.deleteMany({
          where: { teamId: teamId, role: 'MEMBER' },
        });

        for (const member of membersToUpdate) {
          let memberUser = await tx.user.findUnique({ where: { email: member.email } });
          if (memberUser) {
            memberUser = await tx.user.update({
              where: { email: member.email },
              data: {
                name: member.name,
                gender: member.gender,
                college: member.college,
                degree: member.degree,
              },
            });
          } else {
            memberUser = await tx.user.create({
              data: {
                email: member.email,
                name: member.name,
                gender: member.gender,
                college: member.college,
                degree: member.degree,
                role: 'PARTICIPANT',
              },
            });
          }
          await tx.teamMember.create({
            data: { userId: memberUser.id, teamId: teamId, role: 'MEMBER' },
          });
        }

        // 📝 LOG CHANGE: Record the edit in activity logs (keep for backward compatibility)
        await tx.activityLog.create({
          data: {
            userId: user.id,
            action: 'team.updated',
            entity: 'Team',
            entityId: teamId,
            metadata: {
              updatedAt: new Date().toISOString(),
              teamName: sanitizedData.teamName,
              track: trackEnum,
              memberCount: membersToUpdate.length + 1,
              userAgent: req.headers.get('user-agent') || 'unknown',
              registrationUpdate: true,
              submissionId, // Link to audit trail submission
              changeCount: changes.length,
            },
            ipAddress,
            userAgent,
          },
        });
      },
      {
        timeout: 15000, // 15 seconds timeout for edit operations with audit logging
      }
    );

    return NextResponse.json({ success: true, message: 'Registration updated successfully!' });
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_EDITED') {
      return NextResponse.json(
        {
          success: false,
          error: 'ALREADY_EDITED',
          message: 'Registration details are locked. You have already edited your form once.',
        },
        { status: 403 }
      );
    }
    console.error('[Register Update] Error:', error);
    return NextResponse.json({ success: false, error: 'UPDATE_FAILED' }, { status: 500 });
  }
}
