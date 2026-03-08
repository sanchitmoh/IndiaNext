/**
 * Health Check Endpoint
 *
 * Used by CI/CD and monitoring systems to verify application health
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/rate-limit';
import { rateLimitByIP, createRateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
    };
    redis: {
      status: 'up' | 'down';
      responseTime?: number;
    };
    api: {
      status: 'up';
      responseTime: number;
    };
  };
}

export async function GET(req: Request) {
  // Rate limit: 10 requests/min per IP to prevent DoS via health endpoint
  const rl = await rateLimitByIP(req, 10, 60);
  if (!rl.success) {
    return NextResponse.json(
      { status: 'rate_limited', message: 'Too many requests' },
      { status: 429, headers: createRateLimitHeaders(rl) }
    );
  }

  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    // ✅ SECURITY FIX (L-3): Removed version and uptime (info disclosure)
    checks: {
      database: { status: 'down' },
      redis: { status: 'down' },
      api: { status: 'up', responseTime: 0 },
    },
  };

  // Check Database
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = {
      status: 'up',
      responseTime: Date.now() - dbStart,
    };
  } catch {
    // ✅ SECURITY FIX (M-2): Don't expose error.message
    health.checks.database = {
      status: 'down',
    };
    health.status = 'degraded';
  }

  // Check Redis (using singleton)
  try {
    const redis = getRedis();

    if (redis) {
      const redisStart = Date.now();
      await redis.ping();
      health.checks.redis = {
        status: 'up',
        responseTime: Date.now() - redisStart,
      };
    } else {
      health.checks.redis = {
        status: 'down',
      };
    }
  } catch {
    // ✅ SECURITY FIX (M-2): Don't expose error.message
    health.checks.redis = {
      status: 'down',
    };
    health.status = 'degraded';
  }

  // Calculate API response time
  health.checks.api.responseTime = Date.now() - startTime;

  // Determine overall status
  if (health.checks.database.status === 'down') {
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
