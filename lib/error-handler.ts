/**
 * Global Error Handler for API Routes and TRPC
 *
 * Standardizes error responses across the application.
 */

import { NextResponse } from 'next/server';
import { TRPCError } from '@trpc/server';
import { ZodError } from 'zod';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'SERVICE_UNAVAILABLE'
  | 'CSRF_VALIDATION_FAILED'
  | 'SESSION_EXPIRED'
  | 'DUPLICATE_EMAIL'
  | 'EMAIL_NOT_VERIFIED'
  | 'ALREADY_REGISTERED';

export interface ApiError {
  success: false;
  error: ErrorCode;
  message: string;
  details?: unknown;
  timestamp?: string;
  path?: string;
}

/**
 * Standard error response structure
 */
export function createErrorResponse(
  error: ErrorCode,
  message: string,
  details?: unknown,
  path?: string
): ApiError {
  const response: ApiError = {
    success: false,
    error,
    message,
    timestamp: new Date().toISOString(),
  };

  if (details !== undefined) {
    response.details = details;
  }

  if (path) {
    response.path = path;
  }

  return response;
}

/**
 * Map error codes to HTTP status codes
 */
export function getStatusCode(errorCode: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    VALIDATION_ERROR: 400,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    SESSION_EXPIRED: 401,
    FORBIDDEN: 403,
    EMAIL_NOT_VERIFIED: 403,
    CSRF_VALIDATION_FAILED: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    DUPLICATE_EMAIL: 409,
    ALREADY_REGISTERED: 409,
    RATE_LIMIT_EXCEEDED: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
  };

  return statusMap[errorCode] || 500;
}

/**
 * Handle Zod validation errors
 */
export function handleZodError(error: ZodError, path?: string): NextResponse {
  const firstError = error.errors[0];
  const errorResponse = createErrorResponse(
    'VALIDATION_ERROR',
    firstError.message,
    error.errors,
    path
  );

  return NextResponse.json(errorResponse, { status: 400 });
}

/**
 * Handle TRPC errors
 */
export function handleTRPCError(error: TRPCError): ApiError {
  const errorCodeMap: Record<string, ErrorCode> = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    BAD_REQUEST: 'BAD_REQUEST',
    INTERNAL_SERVER_ERROR: 'INTERNAL_ERROR',
  };

  const errorCode = errorCodeMap[error.code] || 'INTERNAL_ERROR';

  return createErrorResponse(errorCode, error.message);
}

/**
 * Handle generic errors
 */
export function handleGenericError(error: unknown, path?: string): NextResponse {
  console.error('[Error Handler]', error);

  // Zod validation error
  if (error instanceof ZodError) {
    return handleZodError(error, path);
  }

  // TRPC error
  if (error instanceof TRPCError) {
    const apiError = handleTRPCError(error);
    return NextResponse.json(apiError, {
      status: getStatusCode(apiError.error),
    });
  }

  // Known error types
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('Unique constraint')) {
      // ✅ SECURITY FIX (L-9): Use generic conflict message; the constraint may not be email
      const errorResponse = createErrorResponse(
        'CONFLICT',
        'A record with this data already exists.',
        undefined,
        path
      );
      return NextResponse.json(errorResponse, { status: 409 });
    }

    if (error.message.includes('Unauthorized')) {
      const errorResponse = createErrorResponse('UNAUTHORIZED', error.message, undefined, path);
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Generic error
    const errorResponse = createErrorResponse(
      'INTERNAL_ERROR',
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'An unexpected error occurred. Please try again.',
      process.env.NODE_ENV === 'development' ? error.stack : undefined,
      path
    );
    return NextResponse.json(errorResponse, { status: 500 });
  }

  // Unknown error
  const errorResponse = createErrorResponse(
    'INTERNAL_ERROR',
    'An unexpected error occurred. Please try again.',
    undefined,
    path
  );
  return NextResponse.json(errorResponse, { status: 500 });
}

/**
 * Async error wrapper for API routes
 */
export function withErrorHandler(handler: (req: Request) => Promise<NextResponse>) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      return handleGenericError(error, new URL(req.url).pathname);
    }
  };
}
