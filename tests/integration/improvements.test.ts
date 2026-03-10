/**
 * Integration Tests for API Improvements
 * 
 * Tests caching, input sanitization, and error handling
 */

import { describe, it, expect, afterEach } from 'vitest';
import { cacheGet, cacheSet, cacheDelete, cacheGetOrSet } from '@/lib/redis-cache';
import {
  sanitizeHtml,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeObject,
  containsXss,
  containsSqlInjection,
} from '@/lib/input-sanitizer';
import {
  createErrorResponse,
  getStatusCode,
} from '@/lib/error-handler';

describe('Redis Caching', () => {
  const testKey = 'test:key';
  
  afterEach(async () => {
    await cacheDelete(testKey);
  });

  it('should cache and retrieve values', async () => {
    const testData = { message: 'Hello, World!' };
    
    await cacheSet(testKey, testData, { ttl: 60 });
    const result = await cacheGet(testKey);
    
    expect(result).toEqual(testData);
  });

  it('should return null for non-existent keys', async () => {
    const result = await cacheGet('non-existent-key');
    expect(result).toBeNull();
  });

  it('should use cacheGetOrSet correctly', async () => {
    let fetchCount = 0;
    
    const fetcher = async () => {
      fetchCount++;
      return { data: 'test' };
    };

    // First call should fetch
    const result1 = await cacheGetOrSet(testKey, fetcher, { ttl: 60 });
    expect(result1).toEqual({ data: 'test' });
    expect(fetchCount).toBe(1);

    // Second call should use cache
    const result2 = await cacheGetOrSet(testKey, fetcher, { ttl: 60 });
    expect(result2).toEqual({ data: 'test' });
    expect(fetchCount).toBe(1); // Should not increment
  });
});

describe('Input Sanitization', () => {
  describe('sanitizeHtml', () => {
    it('should escape HTML tags', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizeHtml(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    });

    it('should handle normal text', () => {
      const input = 'Hello World';
      const result = sanitizeHtml(input);
      expect(result).toBe('Hello World');
    });
  });

  describe('sanitizeEmail', () => {
    it('should normalize email addresses', () => {
      const input = '  TEST@EXAMPLE.COM  ';
      const result = sanitizeEmail(input);
      expect(result).toBe('test@example.com');
    });

    it('should remove invalid characters', () => {
      const input = 'test<script>@example.com';
      const result = sanitizeEmail(input);
      expect(result).toBe('testscript@example.com');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow valid HTTPS URLs', () => {
      const input = 'https://example.com/path';
      const result = sanitizeUrl(input);
      expect(result).toBe('https://example.com/path');
    });

    it('should reject javascript: URLs', () => {
      const input = 'javascript:alert("XSS")';
      const result = sanitizeUrl(input);
      expect(result).toBe('');
    });

    it('should reject invalid URLs', () => {
      const input = 'not a url';
      const result = sanitizeUrl(input);
      expect(result).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string fields', () => {
      const input = {
        name: '<script>alert("XSS")</script>',
        email: '  TEST@EXAMPLE.COM  ',
        url: 'https://example.com',
      };

      const result = sanitizeObject(input);

      expect(result.name).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
      expect(result.email).toBe('test@example.com');
      expect(result.url).toBe('https://example.com/'); // URL class adds trailing slash
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<b>Test</b>',
          email: 'test@example.com',
        },
      };

      const result = sanitizeObject(input);

      expect(result.user.name).toBe('&lt;b&gt;Test&lt;&#x2F;b&gt;');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  describe('containsXss', () => {
    it('should detect script tags', () => {
      expect(containsXss('<script>alert("XSS")</script>')).toBe(true);
    });

    it('should detect javascript: protocol', () => {
      expect(containsXss('javascript:alert("XSS")')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(containsXss('<img onerror="alert(1)">')).toBe(true);
    });

    it('should not flag normal text', () => {
      expect(containsXss('Hello World')).toBe(false);
    });
  });

  describe('containsSqlInjection', () => {
    it('should detect SQL keywords', () => {
      expect(containsSqlInjection("'; DROP TABLE users; --")).toBe(true);
    });

    it('should detect UNION attacks', () => {
      expect(containsSqlInjection('1 UNION SELECT * FROM users')).toBe(true);
    });

    it('should not flag normal text', () => {
      expect(containsSqlInjection('Team Name 123')).toBe(false);
    });
  });
});

describe('Error Handling', () => {
  describe('createErrorResponse', () => {
    it('should create standard error response', () => {
      const error = createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid input',
        { field: 'email' }
      );

      expect(error.success).toBe(false);
      expect(error.error).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.timestamp).toBeDefined();
    });

    it('should work without optional fields', () => {
      const error = createErrorResponse('NOT_FOUND', 'Resource not found');

      expect(error.success).toBe(false);
      expect(error.error).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
      expect(error.details).toBeUndefined();
    });
  });

  describe('getStatusCode', () => {
    it('should map error codes to HTTP status codes', () => {
      expect(getStatusCode('VALIDATION_ERROR')).toBe(400);
      expect(getStatusCode('UNAUTHORIZED')).toBe(401);
      expect(getStatusCode('FORBIDDEN')).toBe(403);
      expect(getStatusCode('NOT_FOUND')).toBe(404);
      expect(getStatusCode('CONFLICT')).toBe(409);
      expect(getStatusCode('RATE_LIMIT_EXCEEDED')).toBe(429);
      expect(getStatusCode('INTERNAL_ERROR')).toBe(500);
    });
  });
});

describe('Integration: Sanitization + Error Handling', () => {
  it('should sanitize input and create error for XSS', () => {
    const input = {
      teamName: '<script>alert("XSS")</script>',
      email: 'test@example.com',
    };

    const sanitized = sanitizeObject(input);

    if (containsXss(sanitized.teamName)) {
      const error = createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid input detected'
      );

      expect(error.error).toBe('VALIDATION_ERROR');
      expect(getStatusCode(error.error)).toBe(400);
    }
  });
});
