// tRPC Server Setup
//
// ARCHITECTURE NOTE:
// ─────────────────────────────────────────────────────────────
// This project uses TWO API layers by design:
//
// 1. REST (/api/send-otp, /api/verify-otp, /api/register)
//    → Public registration flow. OTP-based, no session required.
//    → Used by: HackathonForm.tsx (participant-facing)
//
// 2. tRPC (/api/trpc/*)
//    → Authenticated admin panel + post-registration management.
//    → Used by: /admin/* pages, future team dashboard
//    → Routers: admin (dashboard/teams/export), auth (profile/notifications),
//               team (submission updates, withdraw)
//
// These are NOT duplicate systems — they serve different auth models.
// ─────────────────────────────────────────────────────────────

import { initTRPC, TRPCError } from '@trpc/server';
import { type FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { hashSessionToken, SESSION_CONFIGS } from '@/lib/session-security';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Parse cookies from a raw Cookie header string.
 */
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...rest] = c.trim().split('=');
      return [key, rest.join('=')];
    })
  );
}

// Create context for each request (App Router / Fetch adapter)
export async function createContext(opts: FetchCreateContextFnOptions) {
  // Read session token ONLY from HttpOnly cookie — never from Authorization header.
  // Accepting tokens via headers would bypass SameSite/HttpOnly cookie protections.
  const cookies = parseCookies(opts.req.headers.get('cookie'));

  let session = null;
  let adminSession = null;

  // Check participant session
  const userToken = cookies.session_token || null;
  if (userToken) {
    // ✅ SECURITY FIX: Hash cookie token before DB lookup
    const sessionData = await prisma.session.findUnique({
      where: { token: hashSessionToken(userToken) },
      include: { user: true },
    });

    if (sessionData && sessionData.expiresAt > new Date()) {
      session = {
        user: sessionData.user,
        token: sessionData.token,
      };
    }
  }

  // Check admin session (separate table)
  const adminToken = cookies.admin_token || null;
  if (adminToken) {
    // ✅ SECURITY FIX: Hash cookie token before DB lookup
    const adminData = await prisma.adminSession.findUnique({
      where: { token: hashSessionToken(adminToken) },
      include: { admin: true },
    });

    if (adminData && adminData.expiresAt > new Date() && adminData.admin.isActive) {
      // ✅ SECURITY FIX: Idle timeout — if session untouched for 30min, expire it
      const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
      const now = new Date();
      // Use updatedAt-like approach: keep extending expiresAt on activity
      // If expiresAt was set far in the future but last activity was >30min ago,
      // we check by seeing if the session's remaining lifetime exceeds max - idle
      // Simpler: just touch expiresAt forward on each request (non-blocking)
      const maxAge = SESSION_CONFIGS.admin.maxAge * 1000;
      const sessionAge = now.getTime() - adminData.createdAt.getTime();
      const timeSinceLastTouch = maxAge - (adminData.expiresAt.getTime() - now.getTime());

      if (timeSinceLastTouch > IDLE_TIMEOUT_MS && sessionAge > IDLE_TIMEOUT_MS) {
        // Session has been idle for >30min — treat as expired
        // Clean up the stale session (non-blocking)
        prisma.adminSession.delete({ where: { id: adminData.id } }).catch(() => {});
      } else {
        adminSession = {
          admin: adminData.admin,
          token: adminData.token,
        };
        // Extend expiry on activity (non-blocking refresh)
        const newExpiry = new Date(now.getTime() + maxAge);
        prisma.adminSession
          .update({
            where: { id: adminData.id },
            data: { expiresAt: newExpiry },
          })
          .catch(() => {});
      }
    }
  }

  return {
    session,
    adminSession,
    prisma,
    req: opts.req,
    resHeaders: opts.resHeaders,
  };
}

type Context = Awaited<ReturnType<typeof createContext>>;

// Initialize tRPC with enhanced error formatting
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Enhanced error formatting with more details
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
        timestamp: new Date().toISOString(),
        // Include stack trace in development
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack,
        }),
      },
    };
  },
});

// Export reusable router and procedure helpers
export const router = t.router;
export const publicProcedure = t.procedure;

// Auth middleware
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

// Admin middleware — checks admin_token cookie → Admin table
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.adminSession?.admin) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Admin access required' });
  }

  return next({
    ctx: {
      ...ctx,
      admin: ctx.adminSession.admin,
    },
  });
});

// Protected procedures
export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(isAdmin);

// ✅ SECURITY FIX: Rate-limited mutation procedures
// Limits mutations to 30 req/min per admin or user to prevent abuse
const rateLimitMutation = t.middleware(async ({ ctx, next }) => {
  const id = ctx.adminSession?.admin?.id ?? ctx.session?.user?.id ?? 'anon';
  const rl = await checkRateLimit(`trpc-mutation:${id}`, 30, 60);
  if (!rl.success) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please slow down.',
    });
  }
  return next();
});

export const rateLimitedAdminProcedure = adminProcedure.use(rateLimitMutation);
export const rateLimitedProtectedProcedure = protectedProcedure.use(rateLimitMutation);

// Export for use in custom procedure chains
export { rateLimitMutation };

// ═══════════════════════════════════════════════════════════
// RBAC MIDDLEWARE GUARDS
// ═══════════════════════════════════════════════════════════

import { checkPermission } from '@/lib/rbac-permissions';

/**
 * Create a permission-based middleware guard
 * Usage: requirePermission('viewTeams') or requirePermission('VIEW_ALL_TEAMS')
 *
 * ✅ UNIFIED RBAC: Uses checkPermission which handles both tRPC-style and auth-admin-style names
 */
function requirePermission(permission: string) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.adminSession?.admin) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Admin access required' });
    }

    if (!checkPermission(ctx.adminSession.admin.role, permission)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Insufficient permissions. Required: ${permission}`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        admin: ctx.adminSession.admin,
      },
    });
  });
}

/**
 * Create role-specific middleware guards
 * These use tRPC-style permission names which are mapped to auth-admin permissions
 */
export const canViewTeams = adminProcedure.use(requirePermission('viewTeams'));
export const canEditTeams = adminProcedure.use(requirePermission('editTeams'));
export const canDeleteTeams = adminProcedure.use(requirePermission('deleteTeams'));
export const canExportTeams = adminProcedure.use(requirePermission('exportTeams'));
export const canViewAnalytics = adminProcedure.use(requirePermission('viewAnalytics'));
export const canManageUsers = adminProcedure.use(requirePermission('manageUsers'));
export const canViewAuditLogs = adminProcedure.use(requirePermission('viewAuditLogs'));

// Rate-limited versions
export const canEditTeamsRateLimited = canEditTeams.use(rateLimitMutation);
export const canDeleteTeamsRateLimited = canDeleteTeams.use(rateLimitMutation);
export const canExportTeamsRateLimited = canExportTeams.use(rateLimitMutation);
