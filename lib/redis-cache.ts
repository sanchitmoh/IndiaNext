/**
 * Redis Caching Layer
 * 
 * Provides caching utilities for frequent queries like stats, leaderboards, etc.
 * Uses Upstash Redis with automatic fallback to in-memory cache.
 */

import { Redis } from '@upstash/redis';

// ─── Redis Client (Singleton) ──────────────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  
  const { UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN } = process.env;
  
  if (UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN) {
    _redis = new Redis({
      url: UPSTASH_REDIS_URL,
      token: UPSTASH_REDIS_TOKEN,
    });
    console.log('[Cache] Redis client initialized');
  } else {
    console.warn('[Cache] Redis not configured, using in-memory fallback');
  }
  
  return _redis;
}

// ─── In-Memory Fallback ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

// ✅ SECURITY FIX (M-7): Cap in-memory cache to prevent unbounded growth
const MAX_MEMORY_CACHE_SIZE = 500;

function evictIfNeeded() {
  if (memoryCache.size <= MAX_MEMORY_CACHE_SIZE) return;
  // Evict oldest entries (Map preserves insertion order)
  const entriesToRemove = memoryCache.size - MAX_MEMORY_CACHE_SIZE;
  let removed = 0;
  for (const key of memoryCache.keys()) {
    if (removed >= entriesToRemove) break;
    memoryCache.delete(key);
    removed++;
  }
}

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expiresAt < now) {
        memoryCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ─── Cache Operations ──────────────────────────────────────────────────────────

export interface CacheOptions {
  /** Time-to-live in seconds */
  ttl?: number;
  /** Namespace prefix for the key */
  namespace?: string;
}

/**
 * Get value from cache
 */
export async function cacheGet<T>(
  key: string,
  options: CacheOptions = {}
): Promise<T | null> {
  const { namespace = 'cache' } = options;
  const fullKey = `${namespace}:${key}`;
  
  const redis = getRedis();
  
  if (redis) {
    try {
      const value = await redis.get<T>(fullKey);
      if (value !== null) {
        console.log(`[Cache] HIT: ${fullKey}`);
      }
      return value;
    } catch (error) {
      console.error('[Cache] Redis GET error:', error);
    }
  }
  
  // Fallback to memory
  const entry = memoryCache.get(fullKey) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > Date.now()) {
    console.log(`[Cache] Memory HIT: ${fullKey}`);
    return entry.value;
  }
  
  console.log(`[Cache] MISS: ${fullKey}`);
  return null;
}

/**
 * Set value in cache
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const { ttl = 300, namespace = 'cache' } = options; // Default 5 minutes
  const fullKey = `${namespace}:${key}`;
  
  const redis = getRedis();
  
  if (redis) {
    try {
      await redis.set(fullKey, value, { ex: ttl });
      console.log(`[Cache] SET: ${fullKey} (TTL: ${ttl}s)`);
      return;
    } catch (error) {
      console.error('[Cache] Redis SET error:', error);
    }
  }
  
  // Fallback to memory
  memoryCache.set(fullKey, {
    value,
    expiresAt: Date.now() + ttl * 1000,
  });
  evictIfNeeded();
  console.log(`[Cache] Memory SET: ${fullKey} (TTL: ${ttl}s)`);
}

/**
 * Delete value from cache
 */
export async function cacheDelete(
  key: string,
  options: CacheOptions = {}
): Promise<void> {
  const { namespace = 'cache' } = options;
  const fullKey = `${namespace}:${key}`;
  
  const redis = getRedis();
  
  if (redis) {
    try {
      await redis.del(fullKey);
      console.log(`[Cache] DELETE: ${fullKey}`);
      return;
    } catch (error) {
      console.error('[Cache] Redis DELETE error:', error);
    }
  }
  
  // Fallback to memory
  memoryCache.delete(fullKey);
  console.log(`[Cache] Memory DELETE: ${fullKey}`);
}

/**
 * Delete all keys matching a pattern
 */
export async function cacheDeletePattern(
  pattern: string,
  options: CacheOptions = {}
): Promise<void> {
  const { namespace = 'cache' } = options;
  const fullPattern = `${namespace}:${pattern}`;
  
  const redis = getRedis();
  
  if (redis) {
    try {
      // ✅ SECURITY FIX (M-6): Use SCAN instead of KEYS to avoid blocking Redis
      const keysToDelete: string[] = [];
      let cursor = '0';
      do {
        const result: [string, string[]] = await redis.scan(Number(cursor), { match: fullPattern, count: 100 });
        cursor = String(result[0]);
        keysToDelete.push(...result[1]);
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
        console.log(`[Cache] DELETE PATTERN: ${fullPattern} (${keysToDelete.length} keys)`);
      }
      return;
    } catch (error) {
      console.error('[Cache] Redis DELETE PATTERN error:', error);
    }
  }
  
  // Fallback to memory
  const regex = new RegExp(fullPattern.replace('*', '.*'));
  let count = 0;
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key);
      count++;
    }
  }
  console.log(`[Cache] Memory DELETE PATTERN: ${fullPattern} (${count} keys)`);
}

/**
 * Get or set cache (fetch if not exists)
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache
  const cached = await cacheGet<T>(key, options);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch and cache
  const value = await fetcher();
  await cacheSet(key, value, options);
  
  return value;
}

// ─── Predefined Cache Keys ─────────────────────────────────────────────────────

export const CacheKeys = {
  // Dashboard stats
  dashboardStats: () => 'dashboard:stats',
  registrationChart: (period: string) => `dashboard:chart:${period}`,
  trackDistribution: () => 'dashboard:track-distribution',
  topColleges: () => 'dashboard:top-colleges',
  recentActivity: () => 'dashboard:recent-activity',
  
  // Teams
  teamsList: (filters: string) => `teams:list:${filters}`,
  teamDetail: (id: string) => `team:${id}`,
  
  // Analytics
  analyticsOverview: () => 'analytics:overview',
  analyticsTimeline: (range: string) => `analytics:timeline:${range}`,
} as const;

// ─── Cache Invalidation Helpers ────────────────────────────────────────────────

/**
 * Invalidate dashboard caches
 */
export async function invalidateDashboardCache(): Promise<void> {
  await Promise.all([
    cacheDelete(CacheKeys.dashboardStats()),
    cacheDeletePattern('dashboard:chart:*'),
    cacheDelete(CacheKeys.trackDistribution()),
    cacheDelete(CacheKeys.topColleges()),
    cacheDelete(CacheKeys.recentActivity()),
  ]);
}

/**
 * Invalidate team caches
 */
export async function invalidateTeamCache(teamId?: string): Promise<void> {
  if (teamId) {
    await cacheDelete(CacheKeys.teamDetail(teamId));
  }
  await cacheDeletePattern('teams:list:*');
}

/**
 * Invalidate analytics caches
 */
export async function invalidateAnalyticsCache(): Promise<void> {
  await Promise.all([
    cacheDelete(CacheKeys.analyticsOverview()),
    cacheDeletePattern('analytics:timeline:*'),
  ]);
}
