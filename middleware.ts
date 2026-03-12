import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  API_VERSION,
  getApiVersion,
  isVersionSupported,
  getVersionInfo,
} from '@/lib/api-versioning';

// ═══════════════════════════════════════════════════════════
// CSRF / Origin Validation Middleware
// ═══════════════════════════════════════════════════════════
// Validates that state-changing requests (POST, PUT, PATCH, DELETE)
// originate from our own domain, preventing cross-site request forgery.

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ═══════════════════════════════════════════════════════════
  // ADMIN ROUTE PROTECTION
  // ═══════════════════════════════════════════════════════════
  // ✅ SECURITY FIX: Enforce authentication on /admin/* routes at edge level
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminToken = request.cookies.get('admin_token')?.value;

    if (!adminToken) {
      // Redirect to admin login if no token
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Note: Full session validation happens in tRPC middleware
    // This is just a first-line defense to prevent unauthorized access
  }

  // Build allowed origins from env + Vercel system URLs
  const origins: string[] = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'https://indianext.vercel.app',
    'https://www.indianexthackthon.online',
    'https://india-next-one.vercel.app',
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

    // ✅ SECURITY FIX: CSRF validation enabled in production by default
    // In development, enable with ENABLE_CSRF=true for local testing
    const csrfEnabled = process.env.NODE_ENV === 'production' || process.env.ENABLE_CSRF === 'true';
    if (csrfEnabled) {
      // Block requests with NO origin header for state-changing methods.
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

  // ═══════════════════════════════════════════════════════════
  // API Versioning — reject unsupported versions, add version headers
  // ═══════════════════════════════════════════════════════════
  // pathname already declared at the top of the function
  if (pathname.startsWith('/api/')) {
    const requestedVersion = getApiVersion(pathname);
    if (requestedVersion && !isVersionSupported(requestedVersion)) {
      return NextResponse.json(
        {
          success: false,
          error: 'BAD_REQUEST',
          message: `API version "${requestedVersion}" is not supported. Supported versions: v1`,
        },
        { status: 400 }
      );
    }

    // Check for deprecated versions
    if (requestedVersion) {
      const versionInfo = getVersionInfo(requestedVersion);
      if (versionInfo?.deprecated) {
        const response = NextResponse.next();
        response.headers.set('Deprecation', 'true');
        if (versionInfo.sunsetDate) {
          response.headers.set('Sunset', versionInfo.sunsetDate);
        }
      }
    }
  }

  // Add security headers to all responses
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // API version header on API responses
  if (pathname.startsWith('/api/')) {
    response.headers.set('X-API-Version', API_VERSION);
  }

  // Content Security Policy — restrict resources to same origin + known CDNs
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );

    // ✅ SECURITY FIX: CSP with nonce support for Next.js inline scripts
    // Next.js generates inline scripts for hydration, so we need to allow them with nonces
    // Use Web Crypto API (available in Edge Runtime)
    const nonceArray = new Uint8Array(16);
    crypto.getRandomValues(nonceArray);
    const nonce = Buffer.from(nonceArray).toString('base64');

    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        // Allow self, nonce, and strict-dynamic for Next.js compatibility
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self' 'unsafe-inline'", // Tailwind/inline styles still need this
        "img-src 'self' res.cloudinary.com data: blob:", // Cloudinary images
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "worker-src 'self' blob:",
      ].join('; ')
    );

    // Store nonce in header for Next.js to use
    response.headers.set('X-Nonce', nonce);
  }

  return response;
}

// Only run middleware on API routes and pages (skip static assets)
export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)'],
};
