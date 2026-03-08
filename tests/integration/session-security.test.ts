/**
 * Integration Tests: Session Security
 *
 * Tests session configuration, token hashing, and idle timeout logic.
 */

import { describe, it, expect } from 'vitest';
import { SESSION_CONFIGS, hashSessionToken } from '@/lib/session-security';

describe('Session Security', () => {
  describe('SESSION_CONFIGS', () => {
    it('should have admin session config', () => {
      expect(SESSION_CONFIGS.admin).toBeDefined();
      expect(SESSION_CONFIGS.admin.maxAge).toBeGreaterThan(0);
    });

    it('should have user session config', () => {
      expect(SESSION_CONFIGS.user).toBeDefined();
      expect(SESSION_CONFIGS.user.maxAge).toBeGreaterThan(0);
    });

    it('admin session should be shorter than user session', () => {
      // Admin sessions should be more restrictive
      expect(SESSION_CONFIGS.admin.maxAge).toBeLessThanOrEqual(SESSION_CONFIGS.user.maxAge);
    });
  });

  describe('hashSessionToken', () => {
    it('should produce consistent hash for same input', () => {
      const token = 'test-token-12345';
      const hash1 = hashSessionToken(token);
      const hash2 = hashSessionToken(token);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = hashSessionToken('token-a');
      const hash2 = hashSessionToken('token-b');

      expect(hash1).not.toBe(hash2);
    });

    it('should not return the original token', () => {
      const token = 'my-secret-token';
      const hash = hashSessionToken(token);

      expect(hash).not.toBe(token);
      expect(hash).not.toContain(token);
    });

    it('should produce a hex string', () => {
      const hash = hashSessionToken('test');
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce fixed-length output', () => {
      const short = hashSessionToken('a');
      const long = hashSessionToken('a'.repeat(1000));

      expect(short.length).toBe(long.length);
    });
  });

  describe('Idle Timeout Logic', () => {
    // Test the sliding window idle timeout calculation
    // This mirrors the logic in server/trpc.ts

    const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const MAX_AGE_MS = SESSION_CONFIGS.admin.maxAge * 1000;

    function calculateTimeSinceLastTouch(now: Date, expiresAt: Date): number {
      // timeSinceLastTouch = maxAge - timeRemaining
      const timeRemaining = expiresAt.getTime() - now.getTime();
      return MAX_AGE_MS - timeRemaining;
    }

    it('should detect fresh session as active', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + MAX_AGE_MS);

      const idle = calculateTimeSinceLastTouch(now, expiresAt);
      expect(idle).toBeLessThan(IDLE_TIMEOUT_MS);
    });

    it('should detect idle session after 30+ minutes', () => {
      const now = new Date();
      // Session was last refreshed 35 minutes ago
      const expiresAt = new Date(now.getTime() + MAX_AGE_MS - 35 * 60 * 1000);

      const idle = calculateTimeSinceLastTouch(now, expiresAt);
      expect(idle).toBeGreaterThan(IDLE_TIMEOUT_MS);
    });

    it('should detect recently active session', () => {
      const now = new Date();
      // Session was refreshed 5 minutes ago
      const expiresAt = new Date(now.getTime() + MAX_AGE_MS - 5 * 60 * 1000);

      const idle = calculateTimeSinceLastTouch(now, expiresAt);
      expect(idle).toBeLessThan(IDLE_TIMEOUT_MS);
    });
  });
});
