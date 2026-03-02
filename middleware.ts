import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════
// CSRF / Origin Validation Middleware
// ═══════════════════════════════════════════════════════════
// Validates that state-changing requests (POST, PUT, PATCH, DELETE)
// originate from our own domain, preventing cross-site request forgery.

export function middleware(request: NextRequest) {
  // Build allowed origins from env + Vercel system URLs
  const origins: string[] = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'https://india-next-one.vercel.app'
  ].filter(Boolean) as string[];

  // Vercel sets VERCEL_URL (e.g. my-app-abc123.vercel.app) for every deployment
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  // Vercel also sets VERCEL_PROJECT_PRODUCTION_URL for the production domain
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  const ALLOWED_ORIGINS = new Set(origins);

  // Only validate state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const origin = request.headers.get('origin');

    // In production, strictly validate origin
    if (process.env.NODE_ENV === 'production') {
      // Block requests with NO origin header in production for state-changing methods.
      // Same-origin browser requests always include Origin; its absence means
      // server-to-server or curl — which should use API keys, not cookies.
      if (!origin) {
        console.warn('[CSRF] Blocked request with no Origin header');
        return NextResponse.json(
          {
            success: false,
            error: 'CSRF_VALIDATION_FAILED',
            message: 'Origin header required for state-changing requests.',
          },
          { status: 403 }
        );
      }

      if (!ALLOWED_ORIGINS.has(origin)) {
        console.warn(`[CSRF] Blocked request from origin: ${origin}`);
        return NextResponse.json(
          {
            success: false,
            error: 'CSRF_VALIDATION_FAILED',
            message: 'Request origin not allowed.',
          },
          { status: 403 }
        );
      }
    }
  }

  // Add security headers to all responses
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Content Security Policy — restrict resources to same origin + known CDNs
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        // ✅ SECURITY FIX (M-9): Removed 'unsafe-eval'; kept 'unsafe-inline' for Next.js hydration
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",                   // Tailwind/inline styles
        "img-src 'self' res.cloudinary.com data: blob:",       // Cloudinary images
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
  }

  return response;
}

// Only run middleware on API routes and pages (skip static assets)
export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
