// Admin Authentication & Authorization
// NOTE: prisma and next/headers are imported dynamically inside server-only
// functions so that client components importing this file for its pure utility
// exports (hasPermission, getRoleLabel, etc.) do NOT pull in pg or fs.
import type { UserRole } from '@prisma/client';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AdminSession {
  user: AdminUser;
  expiresAt: Date;
}

// ═══════════════════════════════════════════════════════════
// ROLE PERMISSIONS
// ═══════════════════════════════════════════════════════════

const ROLE_HIERARCHY: Record<UserRole, number> = {
  PARTICIPANT: 0,
  ORGANIZER: 1,
  JUDGE: 2,
  LOGISTICS: 2, // Same level as JUDGE — event-day role
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export const PERMISSIONS = {
  // View permissions
  VIEW_OWN_TEAM: ['PARTICIPANT', 'ORGANIZER', 'JUDGE', 'LOGISTICS', 'ADMIN', 'SUPER_ADMIN'],
  VIEW_ALL_TEAMS: ['ORGANIZER', 'JUDGE', 'LOGISTICS', 'ADMIN', 'SUPER_ADMIN'],
  VIEW_SUBMISSIONS: ['ORGANIZER', 'JUDGE', 'ADMIN', 'SUPER_ADMIN'],
  VIEW_ANALYTICS: ['ORGANIZER', 'JUDGE', 'ADMIN', 'SUPER_ADMIN'],
  VIEW_AUDIT_LOGS: ['ADMIN', 'SUPER_ADMIN'],

  // Team management
  APPROVE_TEAMS: ['ADMIN', 'SUPER_ADMIN'],
  REJECT_TEAMS: ['ADMIN', 'SUPER_ADMIN'],
  EDIT_TEAMS: ['ADMIN', 'SUPER_ADMIN'],
  DELETE_TEAMS: ['SUPER_ADMIN'],

  // Communication
  SEND_EMAILS: ['ORGANIZER', 'ADMIN', 'SUPER_ADMIN'],
  CREATE_CAMPAIGNS: ['ORGANIZER', 'ADMIN', 'SUPER_ADMIN'],

  // Comments & Scoring
  ADD_COMMENTS: ['ORGANIZER', 'JUDGE', 'ADMIN', 'SUPER_ADMIN'],
  SCORE_TEAMS: ['JUDGE', 'ADMIN', 'SUPER_ADMIN'],

  // Data export
  EXPORT_DATA: ['ORGANIZER', 'JUDGE', 'ADMIN', 'SUPER_ADMIN'],

  // User management
  MANAGE_USERS: ['SUPER_ADMIN'],
  ASSIGN_ROLES: ['SUPER_ADMIN'],

  // Logistics (event-day)
  EDIT_TEAM_MEMBERS: ['LOGISTICS', 'ADMIN', 'SUPER_ADMIN'],
  SWAP_TEAM_MEMBERS: ['LOGISTICS', 'ADMIN', 'SUPER_ADMIN'],
  MARK_ATTENDANCE: ['LOGISTICS', 'ADMIN', 'SUPER_ADMIN'],
  VIEW_ATTENDANCE: ['LOGISTICS', 'ADMIN', 'SUPER_ADMIN', 'ORGANIZER'],
  EXPORT_ATTENDANCE: ['LOGISTICS', 'ADMIN', 'SUPER_ADMIN'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ═══════════════════════════════════════════════════════════
// PERMISSION CHECKS
// ═══════════════════════════════════════════════════════════

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  return (allowedRoles as readonly string[]).includes(userRole);
}

export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

export function isAdmin(userRole: UserRole): boolean {
  // LOGISTICS is an admin-level role for event-day access
  return hasMinimumRole(userRole, 'ORGANIZER') || userRole === 'LOGISTICS';
}

// ═══════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════

export async function getAdminSessionFull(): Promise<AdminSession | null> {
  try {
    // Dynamic imports — keep prisma (pg/fs) and next/headers server-only.
    // Client components importing this file for pure utilities won't bundle these.
    const { cookies } = await import('next/headers');
    const { prisma } = await import('./prisma');
    const { hashSessionToken } = await import('@/lib/session-security');

    const cookieStore = await cookies();
    // ✅ SECURITY FIX (C-2): Read 'admin_token' cookie (matches what admin login sets)
    const sessionToken = cookieStore.get('admin_token')?.value;

    if (!sessionToken) {
      return null;
    }

    // ✅ SECURITY FIX (C-2): Query AdminSession table (not Session)
    const session = await prisma.adminSession.findUnique({
      where: { token: hashSessionToken(sessionToken) },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      // Clean up expired session
      if (session) {
        await prisma.adminSession.delete({ where: { id: session.id } });
      }
      return null;
    }

    // Check if admin is active and has admin access
    if (!session.admin.isActive || !isAdmin(session.admin.role)) {
      return null;
    }

    return {
      user: {
        id: session.admin.id,
        email: session.admin.email,
        name: session.admin.name,
        role: session.admin.role,
      },
      expiresAt: session.expiresAt,
    };
  } catch (error) {
    console.error('[Admin Auth] Failed to get session:', error);
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSessionFull();

  if (!session) {
    throw new Error('Unauthorized: Admin session required');
  }

  return session;
}

export async function requirePermission(permission: Permission): Promise<AdminSession> {
  const session = await requireAdminSession();

  if (!hasPermission(session.user.role, permission)) {
    throw new Error(`Forbidden: ${permission} permission required`);
  }

  return session;
}

export async function requireRole(minimumRole: UserRole): Promise<AdminSession> {
  const session = await requireAdminSession();

  if (!hasMinimumRole(session.user.role, minimumRole)) {
    throw new Error(`Forbidden: ${minimumRole} role or higher required`);
  }

  return session;
}

// ═══════════════════════════════════════════════════════════
// AUDIT LOGGING
// ═══════════════════════════════════════════════════════════

export async function logAdminAction(params: {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const { prisma } = await import('./prisma');
    await prisma.activityLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: params.metadata,
        ipAddress: params.ipAddress || 'unknown',
        userAgent: params.userAgent || 'unknown',
      },
    });
  } catch (error) {
    console.error('[Admin Auth] Failed to log action:', error);
    // Don't throw - logging failure shouldn't break the action
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    PARTICIPANT: 'Participant',
    ORGANIZER: 'Organizer',
    JUDGE: 'Judge',
    LOGISTICS: 'Logistics',
    ADMIN: 'Admin',
    SUPER_ADMIN: 'Super Admin',
  };
  return labels[role];
}

export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    PARTICIPANT: 'gray',
    ORGANIZER: 'blue',
    JUDGE: 'purple',
    LOGISTICS: 'green',
    ADMIN: 'orange',
    SUPER_ADMIN: 'red',
  };
  return colors[role];
}

export function canPerformAction(
  userRole: UserRole,
  action: 'view' | 'edit' | 'delete' | 'approve',
  targetRole?: UserRole
): boolean {
  // Super admin can do anything
  if (userRole === 'SUPER_ADMIN') return true;

  // Can't perform actions on users with equal or higher role
  if (targetRole && ROLE_HIERARCHY[userRole] <= ROLE_HIERARCHY[targetRole]) {
    return false;
  }

  // Role-specific permissions
  switch (action) {
    case 'view':
      return isAdmin(userRole);
    case 'edit':
      return hasMinimumRole(userRole, 'ADMIN');
    case 'delete':
      return false; // SUPER_ADMIN already handled above
    case 'approve':
      return hasMinimumRole(userRole, 'ADMIN');
    default:
      return false;
  }
}
