import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendOtpEmail, OTP_EXPIRY_MINUTES } from '@/lib/email';
import { rateLimitRoute, createRateLimitHeaders } from '@/lib/rate-limit';
import crypto from 'crypto';
import { z } from 'zod';
// Define OtpPurpose type as a union of string literals matching your schema
type OtpPurpose = 'REGISTRATION' | 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION';

// Input validation schema
const SendOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  purpose: z
    .enum(['REGISTRATION', 'LOGIN', 'PASSWORD_RESET', 'EMAIL_VERIFICATION'])
    .default('REGISTRATION'),
  track: z.enum(['IDEA_SPRINT', 'BUILD_STORM']).optional(),
});

export async function POST(req: Request) {
  try {
    // Parse and validate input
    const body = await req.json();
    const validation = SendOtpSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: validation.error.errors[0].message,
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { email: rawEmail, purpose, track } = validation.data;

    // Normalize email to lowercase and trim
    const email = rawEmail.toLowerCase().trim();

    // ✅ Sliding-window rate limiting (IP + Email)
    // Limits centralised in lib/rate-limit.ts → RATE_LIMITS['send-otp']
    const rateLimit = await rateLimitRoute('send-otp', req, email);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many OTP requests. Please wait before trying again.',
          retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimit),
        }
      );
    }

    // ✅ Check if email is already registered + generate OTP in parallel
    // These are independent operations — run concurrently to save time
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    if (purpose === 'REGISTRATION') {
      // ✅ REGISTRATION CLOSED - Block registration OTPs
      return NextResponse.json(
        {
          success: false,
          error: 'REGISTRATION_CLOSED',
          message: 'Registration for IndiaNext 2026 has been closed. Thank you for your interest.',
        },
        { status: 403, headers: createRateLimitHeaders(rateLimit) }
      );

      const existingMembership = await prisma.teamMember.findFirst({
        where: {
          user: { email },
          team: { deletedAt: null },
        },
        include: {
          team: { select: { name: true, track: true } },
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          {
            success: false,
            error: 'ALREADY_REGISTERED',
            message:
              'This email is already associated with a team. Each person can only be in one team.',
          },
          { status: 409, headers: createRateLimitHeaders(rateLimit) }
        );
      }

      // ✅ CHECK 1: Check if user exists and email is already verified
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { emailVerified: true },
      });

      if (existingUser?.emailVerified) {
        return NextResponse.json(
          {
            success: false,
            error: 'ALREADY_VERIFIED',
            message: 'This email has already been verified. Please proceed with registration.',
          },
          { status: 409, headers: createRateLimitHeaders(rateLimit) }
        );
      }

      // ✅ CHECK 2: Check if there's a verified OTP record
      const existingOtp = await prisma.otp.findUnique({
        where: {
          email_purpose: {
            email,
            purpose: purpose as OtpPurpose,
          },
        },
      });

      if (existingOtp?.verified) {
        return NextResponse.json(
          {
            success: false,
            error: 'ALREADY_VERIFIED',
            message: 'This email has already been verified. Please proceed with registration.',
          },
          { status: 409, headers: createRateLimitHeaders(rateLimit) }
        );
      }
    }

    // Upsert OTP record with hashed value
    await prisma.otp.upsert({
      where: {
        email_purpose: {
          email,
          purpose: purpose as OtpPurpose,
        },
      },
      update: {
        otp: otpHash,
        expiresAt,
        verified: false,
        attempts: 0,
      },
      create: {
        email,
        otp: otpHash,
        purpose: purpose as OtpPurpose,
        expiresAt,
        verified: false,
        attempts: 0,
      },
    });

    console.log(`[OTP] Generated for ${email}: hash=${otpHash.substring(0, 8)}... (${purpose})`);

    // Log plain OTP in development so testing is easy without checking emails
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV OTP] The OTP for ${email} is: ${otp}`);
    }

    // Send email using Resend
    try {
      await sendOtpEmail(email, otp, track);

      return NextResponse.json(
        {
          success: true,
          message: 'OTP sent successfully',
          expiresIn: 600, // seconds
        },
        {
          headers: createRateLimitHeaders(rateLimit),
        }
      );
    } catch (emailError) {
      console.error('[OTP] Failed to send email:', emailError);

      // In development with explicit opt-in, return OTP for testing
      if (process.env.NODE_ENV === 'development' && process.env.EXPOSE_DEBUG_OTP === 'true') {
        return NextResponse.json(
          {
            success: true,
            message: 'OTP generated (email service unavailable)',
            debugOtp: otp,
            expiresIn: 600,
          },
          {
            headers: createRateLimitHeaders(rateLimit),
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: 'EMAIL_SEND_FAILED',
          message: 'Failed to send OTP email. Please try again.',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const { handleGenericError } = await import('@/lib/error-handler');
    return handleGenericError(error, '/api/send-otp');
  }
}
