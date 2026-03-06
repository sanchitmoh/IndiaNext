/**
 * Rate Limiting System — Sliding Window Counter
 *
 * Algorithm:
 *   estimatedCount = floor(prevWindowCount × (1 − elapsed/window)) + currentWindowCount
 *   This prevents the burst-at-boundary problem of fixed-window counters.
 *
 * Storage:
 *   Production → Redis (Upstash), atomic pipeline (INCR + GET + EXPIRE in 1 RTT)
 *   Development → In-memory Map (auto-cleaned every 5 min)
 *
 * Route configs are centralised in RATE_LIMITS so every limit lives in one place.
 */

import { Redis } from '@upstash/redis';

// ─── Redis (lazy singleton) ────────────────────────────────────────────────────

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (_redis) return _redis;
  const { UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN } = process.env;
  if (UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN) {
    _redis = new Redis({ url: UPSTASH_REDIS_URL, token: UPSTASH_REDIS_TOKEN });
  }
  return _redis;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms — start of next window
}

interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  window: number;
}

// ─── Centralised route configs ─────────────────────────────────────────────────
// Dev values are relaxed for testing; production values are tight.

const isDev = () => process.env.NODE_ENV === 'development';

export const RATE_LIMITS = {
  /** OTP sending — combined IP + email */
  'send-otp': {
    ip:    (): RateLimitConfig => ({ limit: isDev() ? 50 : 10, window: 60 }),
    email: (): RateLimitConfig => ({ limit: isDev() ? 20 :  3, window: 60 }),
  },
  /** OTP verification — combined IP + email (tight to block brute-force) */
  'verify-otp': {
    ip:    (): RateLimitConfig => ({ limit: isDev() ? 50 : 20, window: 60  }),
    email: (): RateLimitConfig => ({ limit: isDev() ? 20 :  5, window: 300 }),
  },
  /** Registration — IP only */
  'register': {
    ip:    (): RateLimitConfig => ({ limit: isDev() ? 50 :  5, window: 3600 }),
  },
  /** Problem statement fetch — IP only (generous, read-only) */
  'problem-statement': {
    ip:    (): RateLimitConfig => ({ limit: isDev() ? 100 : 30, window: 60 }),
  },
  /** Problem reservation — IP only (tighter, creates resources) */
  'reserve-problem': {
    ip:    (): RateLimitConfig => ({ limit: isDev() ? 50 : 10, window: 60 }),
  },
} as const;

// ─── In-memory store (sliding window) ──────────────────────────────────────────

interface WindowRecord { count: number; windowStart: number }

const memoryStore = new Map<string, WindowRecord[]>();

// ─── Sliding window — Redis ────────────────────────────────────────────────────

async function slidingWindowRedis(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const client = getRedis()!;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const currentStart = Math.floor(now / windowMs) * windowMs;

  const currentKey  = `rl:${identifier}:${currentStart}`;
  const previousKey = `rl:${identifier}:${currentStart - windowMs}`;

  // Single round-trip: INCR current, GET previous, EXPIRE current
  const pipe = client.pipeline();
  pipe.incr(currentKey);
  pipe.get(previousKey);
  pipe.expire(currentKey, windowSeconds * 2);

  const results = await pipe.exec();

  const currentCount  = (results[0] as number) ?? 0;
  const previousCount = Number(results[1]) || 0;

  // Weighted estimate
  const elapsed = now - currentStart;
  const weight  = Math.max(0, 1 - elapsed / windowMs);
  const estimated = Math.floor(previousCount * weight) + currentCount;

  return {
    success:   estimated <= limit,
    limit,
    remaining: Math.max(0, limit - estimated),
    reset:     currentStart + windowMs,
  };
}

// ─── Sliding window — Memory ───────────────────────────────────────────────────

function slidingWindowMemory(
  identifier: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const currentStart  = Math.floor(now / windowMs) * windowMs;
  const previousStart = currentStart - windowMs;

  const key     = `rl:${identifier}`;
  const records = memoryStore.get(key) ?? [];

  let currentRec  = records.find(r => r.windowStart === currentStart);
  const previousRec = records.find(r => r.windowStart === previousStart);

  if (!currentRec) {
    currentRec = { count: 1, windowStart: currentStart };
    const kept = [currentRec];
    if (previousRec) kept.push(previousRec);
    memoryStore.set(key, kept);
  } else {
    currentRec.count++;
  }

  const elapsed  = now - currentStart;
  const weight   = Math.max(0, 1 - elapsed / windowMs);
  const estimated = Math.floor((previousRec?.count ?? 0) * weight) + currentRec.count;

  return {
    success:   estimated <= limit,
    limit,
    remaining: Math.max(0, limit - estimated),
    reset:     currentStart + windowMs,
  };
}

// ─── Core check ────────────────────────────────────────────────────────────────

export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const client = getRedis();

  if (client) {
    try {
      return await slidingWindowRedis(identifier, limit, windowSeconds);
    } catch (err) {
      console.error('[RateLimit] Redis error, falling back to memory:', err);
    }
  } else {
    console.warn('[RateLimit] No Redis — using in-memory store. Configure Upstash for production!');
  }

  return slidingWindowMemory(identifier, limit, windowSeconds);
}

// ─── Convenience helpers ───────────────────────────────────────────────────────

export async function rateLimitByIP(
  req: Request,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  return checkRateLimit(`ip:${getClientIP(req)}`, limit, windowSeconds);
}

export async function rateLimitByEmail(
  email: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  return checkRateLimit(`email:${email.toLowerCase().trim()}`, limit, windowSeconds);
}

/**
 * Combined IP + email rate limit (both must pass).
 * Kept for backward-compat — prefer `rateLimitRoute()` for new code.
 */
export async function rateLimitCombined(
  req: Request,
  email: string,
  ipLimit: number,
  emailLimit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const [ipRes, emailRes] = await Promise.all([
    rateLimitByIP(req, ipLimit, windowSeconds),
    rateLimitByEmail(email, emailLimit, windowSeconds),
  ]);

  if (!ipRes.success)    return ipRes;
  if (!emailRes.success) return emailRes;

  return {
    success:   true,
    limit:     Math.min(ipRes.limit,     emailRes.limit),
    remaining: Math.min(ipRes.remaining, emailRes.remaining),
    reset:     Math.max(ipRes.reset,     emailRes.reset),
  };
}

// ─── Route-level helpers (use centralised configs) ─────────────────────────────

/**
 * Rate limit a route that uses both IP + email limits (send-otp, verify-otp).
 * Each leg uses its own window size from RATE_LIMITS.
 */
export async function rateLimitRoute(
  route: 'send-otp' | 'verify-otp',
  req: Request,
  email: string,
): Promise<RateLimitResult> {
  const cfg = RATE_LIMITS[route];
  const ipCfg    = cfg.ip();
  const emailCfg = cfg.email();

  const [ipRes, emailRes] = await Promise.all([
    rateLimitByIP(req, ipCfg.limit, ipCfg.window),
    rateLimitByEmail(email, emailCfg.limit, emailCfg.window),
  ]);

  if (!ipRes.success)    return ipRes;
  if (!emailRes.success) return emailRes;

  return {
    success:   true,
    limit:     Math.min(ipRes.limit,     emailRes.limit),
    remaining: Math.min(ipRes.remaining, emailRes.remaining),
    reset:     Math.max(ipRes.reset,     emailRes.reset),
  };
}

/** Rate limit the register endpoint (IP-only, uses centralised config). */
export async function rateLimitRegister(req: Request): Promise<RateLimitResult> {
  const { limit, window } = RATE_LIMITS.register.ip();
  return rateLimitByIP(req, limit, window);
}

// ─── Header helper ─────────────────────────────────────────────────────────────

export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;

  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;

  return 'unknown';
}

export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit':     result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset':     new Date(result.reset).toISOString(),
  };
}

// ─── Memory store cleanup ──────────────────────────────────────────────────────

export function cleanupMemoryStore(): void {
  const now = Date.now();
  const MAX_AGE = 2 * 3600 * 1000; // 2 hours
  for (const [key, records] of memoryStore.entries()) {
    const valid = records.filter(r => now - r.windowStart < MAX_AGE);
    if (valid.length === 0) memoryStore.delete(key);
    else memoryStore.set(key, valid);
  }
}

if (typeof setInterval !== 'undefined') {
  setInterval(cleanupMemoryStore, 5 * 60 * 1000);
}
