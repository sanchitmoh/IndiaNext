/**
 * Session Security Utilities
 * 
 * Provides secure session management with httpOnly cookies,
 * session rotation, and security best practices.
 */

import { cookies } from 'next/headers';
import crypto from 'crypto';

export interface SessionConfig {
  name: string;
  maxAge: number; // in seconds
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
}

// Default session configurations
export const SESSION_CONFIGS = {
  user: {
    name: 'session_token',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
  },
  admin: {
    name: 'admin_token',
    maxAge: 24 * 60 * 60, // 24 hours (shorter for admin)
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const, // Stricter for admin
    path: '/',
  },
} as const;

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Set a secure session cookie
 */
export async function setSessionCookie(
  token: string,
  config: SessionConfig = SESSION_CONFIGS.user
): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set(config.name, token, {
    maxAge: config.maxAge,
    secure: config.secure ?? process.env.NODE_ENV === 'production',
    httpOnly: config.httpOnly ?? true,
    sameSite: config.sameSite ?? 'lax',
    path: config.path ?? '/',
  });
}

/**
 * Delete a session cookie
 */
export async function deleteSessionCookie(
  cookieName: string = SESSION_CONFIGS.user.name
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

/**
 * Get session token from cookie
 */
export async function getSessionToken(
  cookieName: string = SESSION_CONFIGS.user.name
): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(cookieName)?.value || null;
}

/**
 * Rotate session token (for security after sensitive operations)
 */
export async function rotateSessionToken(
  oldToken: string,
  updateSession: (oldToken: string, newToken: string) => Promise<void>,
  config: SessionConfig = SESSION_CONFIGS.user
): Promise<string> {
  const newToken = generateSessionToken();
  
  // Update session in database
  await updateSession(oldToken, newToken);
  
  // Set new cookie
  await setSessionCookie(newToken, config);
  
  return newToken;
}

/**
 * Validate session token format
 */
export function isValidSessionToken(token: string): boolean {
  // Base64url tokens should be 43 characters (32 bytes)
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/**
 * Check if session should be rotated (based on age)
 */
export function shouldRotateSession(
  createdAt: Date,
  rotationThreshold: number = 24 * 60 * 60 * 1000 // 24 hours
): boolean {
  const age = Date.now() - createdAt.getTime();
  return age > rotationThreshold;
}

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(token: string, expected: string): boolean {
  if (!token || !expected) return false;
  
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  
  // timingSafeEqual throws RangeError on different-length buffers
  if (tokenBuf.length !== expectedBuf.length) return false;
  
  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}

/**
 * Hash session token for storage using HMAC-SHA256
 * ✅ SECURITY FIX: Use HMAC-SHA256 with secret instead of plain SHA-256
 */
export function hashSessionToken(token: string): string {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production';
  
  if (secret === 'fallback-secret-change-in-production' && process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] SESSION_SECRET not set in production! Using fallback.');
  }
  
  return crypto
    .createHmac('sha256', secret)
    .update(token)
    .digest('hex');
}

/**
 * Session fingerprint (for additional security)
 * Combines user agent and IP to detect session hijacking
 */
export function generateSessionFingerprint(
  userAgent: string,
  ipAddress: string
): string {
  const data = `${userAgent}:${ipAddress}`;
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Verify session fingerprint
 */
export function verifySessionFingerprint(
  stored: string,
  userAgent: string,
  ipAddress: string
): boolean {
  const current = generateSessionFingerprint(userAgent, ipAddress);
  // ✅ SECURITY FIX: Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(stored, 'hex'),
      Buffer.from(current, 'hex')
    );
  } catch {
    // If buffers have different lengths, they're not equal
    return false;
  }
}

/**
 * Get client IP from request
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  
  return 'unknown';
}

/**
 * Get user agent from request
 */
export function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') || 'unknown';
}
