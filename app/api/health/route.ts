/**
 * Health Check Endpoint
 * 
 * Used by CI/CD and monitoring systems to verify application health
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Redis } from '@upstash/redis';

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

export async function GET() {
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

  // Check Redis
  try {
    const { UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN } = process.env;
    
    if (UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN) {
      const redis = new Redis({
        url: UPSTASH_REDIS_URL,
        token: UPSTASH_REDIS_TOKEN,
      });

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
