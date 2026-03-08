import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';

import { SESSION_CONFIGS } from '@/lib/session-security';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  // ✅ SECURITY FIX: Enforce password complexity
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
});

function getClientIP(req: Request): string {
  const headers = new Headers(req.headers);
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'
  );
}

export async function POST(req: Request) {
  try {
    // 1. Rate limit: 5 attempts per 15 min per IP
    const ip = getClientIP(req);
    const rl = await checkRateLimit(`admin-login:${ip}`, 5, 900);
    if (!rl.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'TOO_MANY_ATTEMPTS',
          message: 'Too many login attempts. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': String(rl.remaining),
          },
        }
      );
    }

    // 2. Parse & validate input
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message || 'Invalid input',
        },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // 3. Find admin (separate table from participants)
    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Generic error to prevent user enumeration
    const invalidResponse = () =>
      NextResponse.json(
        {
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
        { status: 401 }
      );

    if (!admin || !admin.isActive) {
      return invalidResponse();
    }

    // 4. Verify password
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return invalidResponse();
    }

    // 5. Create admin session
    const token = crypto.randomBytes(32).toString('hex');
    // ✅ SECURITY FIX: Use centralized SESSION_CONFIGS instead of hardcoded 8h
    const expiresAt = new Date(Date.now() + SESSION_CONFIGS.admin.maxAge * 1000);

    // ✅ SECURITY FIX: Store hashed token in DB; raw token goes only to the cookie
    const { hashSessionToken } = await import('@/lib/session-security');

    // ✅ SECURITY FIX: Limit concurrent admin sessions to 5
    // Delete expired sessions first, then enforce cap
    await prisma.adminSession.deleteMany({
      where: { adminId: admin.id, expiresAt: { lt: new Date() } },
    });
    const activeSessions = await prisma.adminSession.findMany({
      where: { adminId: admin.id },
      orderBy: { createdAt: 'asc' },
    });
    const MAX_ADMIN_SESSIONS = 5;
    if (activeSessions.length >= MAX_ADMIN_SESSIONS) {
      // Delete oldest sessions to make room
      const sessionsToDelete = activeSessions.slice(
        0,
        activeSessions.length - MAX_ADMIN_SESSIONS + 1
      );
      await prisma.adminSession.deleteMany({
        where: { id: { in: sessionsToDelete.map((s) => s.id) } },
      });
    }

    await prisma.adminSession.create({
      data: {
        adminId: admin.id,
        token: hashSessionToken(token),
        expiresAt,
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') || undefined,
      },
    });

    // 6. Update last login
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    // 7. Set cookie & respond
    const isProduction = process.env.NODE_ENV === 'production';
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      },
      { status: 200 }
    );

    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: isProduction,
      // ✅ SECURITY FIX: Use strict sameSite for admin cookie + centralized maxAge
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_CONFIGS.admin.maxAge,
    });

    return response;
  } catch (error) {
    const { handleGenericError } = await import('@/lib/error-handler');
    return handleGenericError(error, '/api/admin/login');
  }
}
