/**
 * Example API Route with All Improvements
 *
 * This demonstrates how to use:
 * - API versioning
 * - Error handling
 * - Input validation & sanitization
 * - Caching
 * - Rate limiting
 * - Session security
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, createErrorResponse } from '@/lib/error-handler';
import { sanitizeObject, containsXss } from '@/lib/input-sanitizer';
import { cacheGetOrSet } from '@/lib/redis-cache';
import { rateLimitByIP, createRateLimitHeaders } from '@/lib/rate-limit';
import { getSessionToken, SESSION_CONFIGS } from '@/lib/session-security';
import { prisma } from '@/lib/prisma';

// Input validation schema
const ExampleSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(1000),
});

export const POST = withErrorHandler(async (req: Request) => {
  // 1. Rate Limiting
  const rateLimit = await rateLimitByIP(req, 10, 60); // 10 requests per minute

  if (!rateLimit.success) {
    return NextResponse.json(
      createErrorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.', {
        retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: createRateLimitHeaders(rateLimit),
      }
    );
  }

  // 2. Session Validation (if required)
  const sessionToken = await getSessionToken(SESSION_CONFIGS.user.name);

  if (!sessionToken) {
    return NextResponse.json(createErrorResponse('UNAUTHORIZED', 'Authentication required'), {
      status: 401,
    });
  }

  // 3. Input Validation
  const body = await req.json();
  const validation = ExampleSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      createErrorResponse(
        'VALIDATION_ERROR',
        validation.error.errors[0].message,
        validation.error.errors
      ),
      { status: 400 }
    );
  }

  // 4. Input Sanitization
  const sanitizedData = sanitizeObject(validation.data);

  // 5. XSS Detection
  if (containsXss(sanitizedData.message)) {
    return NextResponse.json(createErrorResponse('VALIDATION_ERROR', 'Invalid input detected'), {
      status: 400,
    });
  }

  // 6. Business Logic with Caching
  const result = await cacheGetOrSet(
    `example:${sanitizedData.email}`,
    async () => {
      // Your database operations
      const data = await prisma.user.findUnique({
        where: { email: sanitizedData.email },
        select: { id: true, name: true, email: true },
      });

      return data;
    },
    { ttl: 300 } // Cache for 5 minutes
  );

  // 7. Success Response
  return NextResponse.json(
    {
      success: true,
      message: 'Operation successful',
      data: result,
    },
    {
      headers: createRateLimitHeaders(rateLimit),
    }
  );
});

// GET example with caching
export const GET = withErrorHandler(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(createErrorResponse('BAD_REQUEST', 'ID parameter required'), {
      status: 400,
    });
  }

  // Use caching for GET requests
  const data = await cacheGetOrSet(
    `example:detail:${id}`,
    async () => {
      return await prisma.team.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          track: true,
          status: true,
        },
      });
    },
    { ttl: 600 } // Cache for 10 minutes
  );

  if (!data) {
    return NextResponse.json(createErrorResponse('NOT_FOUND', 'Resource not found'), {
      status: 404,
    });
  }

  return NextResponse.json({
    success: true,
    data,
  });
});
