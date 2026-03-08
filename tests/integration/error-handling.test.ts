/**
 * Integration Tests: Standardized Error Handling
 *
 * Verifies that handleGenericError, createErrorResponse, and
 * getStatusCode produce consistent error shapes across all routes.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createErrorResponse,
  getStatusCode,
  handleGenericError,
  handleZodError,
} from '@/lib/error-handler';
import { ZodError, z } from 'zod';

describe('handleGenericError', () => {
  it('should return 500 with standard shape for unknown errors', async () => {
    const res = handleGenericError(new Error('something broke'), '/api/test');
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/api/test');
  });

  it('should return 409 for Unique constraint errors', async () => {
    const res = handleGenericError(
      new Error('Unique constraint failed on the fields'),
      '/api/register'
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('CONFLICT');
  });

  it('should return 401 for Unauthorized errors', async () => {
    const res = handleGenericError(new Error('Unauthorized'), '/api/admin/login');
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('should handle ZodError instances via handleZodError', async () => {
    const schema = z.object({ email: z.string().email() });
    let error: ZodError | null = null;
    try {
      schema.parse({ email: 'not-an-email' });
    } catch (e) {
      error = e as ZodError;
    }

    // Use handleZodError directly (handleGenericError delegates to it)
    const res = handleZodError(error!, '/api/test');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.details).toBeDefined();
  });

  it('should handle non-Error objects gracefully', async () => {
    const res = handleGenericError('string error', '/api/test');
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe('INTERNAL_ERROR');
  });

  it('should not leak error details in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const res = handleGenericError(new Error('sensitive database details'), '/api/test');
    const body = await res.json();

    expect(body.message).not.toContain('sensitive database details');
    vi.unstubAllEnvs();
  });
});

describe('handleZodError', () => {
  it('should return 400 with validation details', async () => {
    const schema = z.object({
      email: z.string().email('Invalid email'),
      name: z.string().min(2, 'Name too short'),
    });

    let zodError: ZodError | null = null;
    try {
      schema.parse({ email: 'bad', name: '' });
    } catch (e) {
      zodError = e as ZodError;
    }

    const res = handleZodError(zodError!, '/api/register');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.details).toBeDefined();
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.path).toBe('/api/register');
  });
});

describe('createErrorResponse shape consistency', () => {
  const errorCodes = [
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMIT_EXCEEDED',
    'INTERNAL_ERROR',
    'BAD_REQUEST',
  ] as const;

  for (const code of errorCodes) {
    it(`should produce correct shape for ${code}`, () => {
      const response = createErrorResponse(code, `Test message for ${code}`);

      expect(response).toEqual(
        expect.objectContaining({
          success: false,
          error: code,
          message: `Test message for ${code}`,
          timestamp: expect.any(String),
        })
      );

      // Status code should be a valid HTTP status
      const status = getStatusCode(code);
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    });
  }
});
