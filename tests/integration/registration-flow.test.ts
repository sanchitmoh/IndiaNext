/**
 * Integration Tests: Registration Flow Validation
 *
 * Tests OTP schema validation, registration schema validation,
 * and the input sanitization pipeline.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { sanitizeObject, containsXss, containsSqlInjection } from '@/lib/input-sanitizer';

// Mirrors the schema in app/api/verify-otp/route.ts
const VerifyOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only numbers'),
  purpose: z
    .enum(['REGISTRATION', 'LOGIN', 'PASSWORD_RESET', 'EMAIL_VERIFICATION'])
    .default('REGISTRATION'),
});

// Mirrors the schema in app/api/send-otp/route.ts
const SendOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  purpose: z
    .enum(['REGISTRATION', 'LOGIN', 'PASSWORD_RESET', 'EMAIL_VERIFICATION'])
    .default('REGISTRATION'),
  track: z.enum(['IDEA_SPRINT', 'BUILD_STORM']).optional(),
});

describe('Registration Flow Validation', () => {
  describe('SendOTP Schema', () => {
    it('should accept valid email', () => {
      const result = SendOtpSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = SendOtpSchema.safeParse({
        email: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('should default purpose to REGISTRATION', () => {
      const result = SendOtpSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.purpose).toBe('REGISTRATION');
      }
    });

    it('should accept valid track', () => {
      const result = SendOtpSchema.safeParse({
        email: 'test@example.com',
        track: 'IDEA_SPRINT',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid track', () => {
      const result = SendOtpSchema.safeParse({
        email: 'test@example.com',
        track: 'INVALID',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('VerifyOTP Schema', () => {
    it('should accept valid OTP', () => {
      const result = VerifyOtpSchema.safeParse({
        email: 'test@example.com',
        otp: '123456',
      });
      expect(result.success).toBe(true);
    });

    it('should reject OTP shorter than 6 digits', () => {
      const result = VerifyOtpSchema.safeParse({
        email: 'test@example.com',
        otp: '12345',
      });
      expect(result.success).toBe(false);
    });

    it('should reject OTP with non-numeric characters', () => {
      const result = VerifyOtpSchema.safeParse({
        email: 'test@example.com',
        otp: '12345a',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty OTP', () => {
      const result = VerifyOtpSchema.safeParse({
        email: 'test@example.com',
        otp: '',
      });
      expect(result.success).toBe(false);
    });

    it('should accept all valid purposes', () => {
      const purposes = ['REGISTRATION', 'LOGIN', 'PASSWORD_RESET', 'EMAIL_VERIFICATION'];

      for (const purpose of purposes) {
        const result = VerifyOtpSchema.safeParse({
          email: 'test@example.com',
          otp: '123456',
          purpose,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Input Sanitization Pipeline', () => {
    it('should sanitize registration data before processing', () => {
      const rawInput = {
        teamName: 'Team <script>alert(1)</script>',
        leaderName: 'John Doe',
        leaderEmail: '  JOHN@EXAMPLE.COM  ',
      };

      const sanitized = sanitizeObject(rawInput, {
        sanitizeHtml: true,
      });

      // HTML should be escaped
      expect(sanitized.teamName).not.toContain('<script>');
      // Email should be normalized
      expect(sanitized.leaderEmail).toBe('john@example.com');
      // Normal text should be unchanged
      expect(sanitized.leaderName).toBe('John Doe');
    });

    it('should detect XSS in team names', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img onerror="alert(1)" src="x">',
        'javascript:alert(document.cookie)',
        '<svg onload="alert(1)">',
      ];

      for (const payload of xssPayloads) {
        expect(containsXss(payload)).toBe(true);
      }
    });

    it('should detect SQL injection attempts', () => {
      const sqlPayloads = [
        "'; DROP TABLE teams; --",
        '1 UNION SELECT * FROM users',
        "1' OR '1'='1",
      ];

      for (const payload of sqlPayloads) {
        expect(containsSqlInjection(payload)).toBe(true);
      }
    });

    it('should not flag legitimate team names', () => {
      const legitimateNames = [
        'Team Innovation',
        'Code Warriors 2024',
        'The Bug Fixers',
        "O'Brien's Team",
        'Team #42',
      ];

      for (const name of legitimateNames) {
        expect(containsXss(name)).toBe(false);
        expect(containsSqlInjection(name)).toBe(false);
      }
    });
  });
});
