/**
 * RBAC Permissions - Client & Server Safe
 *
 * This file contains only permission checking logic and can be imported
 * by both client and server components. It does NOT import next/headers.
 *
 * For session management functions, use lib/auth-admin.ts (server-only).
 */

import type { UserRole } from '@prisma/client';

// Re-export type for backward compatibility
export type AdminRole = UserRole;

// ═══════════════════════════════════════════════════════════
// ROLE HIERARCHY
// ═══════════════════════════════════════════════════════════

const ROLE_HIERARCHY: Record<UserRole, number> = {
  PARTICIPANT: 0,
  ORGANIZER: 1,
  JUDGE: 2,
  LOGISTICS: 2, // Same level as JUDGE — event-day role
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

// ═══════════════════════════════════════════════════════════
// PERMISSIONS MATRIX (from auth-admin.ts)
// ═══════════════════════════════════════════════════════════

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
// PERMISSION CHECKS (Client & Server Safe)
// ═══════════════════════════════════════════════════════════

/**
 * Check if a role has a specific permission
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  return (allowedRoles as readonly string[]).includes(userRole);
}

/**
 * Check if a role meets minimum role requirement
 */
export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Check if user has admin-level access
 */
export function isAdmin(userRole: UserRole): boolean {
  // LOGISTICS is an admin-level role for event-day access
  return hasMinimumRole(userRole, 'ORGANIZER') || userRole === 'LOGISTICS';
}

/**
 * Get human-readable role label
 */
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

/**
 * Get role badge color for UI
 */
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

/**
 * Check if user can perform action on target
 */
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

// ═══════════════════════════════════════════════════════════
// PERMISSION MAPPING (for tRPC middleware)
// ═══════════════════════════════════════════════════════════

/**
 * Map tRPC-style permission names to auth-admin permission names
 */
export const TRPC_PERMISSION_MAP: Record<string, Permission> = {
  // Analytics
  viewAnalytics: 'VIEW_ANALYTICS',

  // Teams
  viewTeams: 'VIEW_ALL_TEAMS',
  editTeams: 'EDIT_TEAMS',
  deleteTeams: 'DELETE_TEAMS',
  exportTeams: 'EXPORT_DATA',

  // Submissions
  viewSubmissions: 'VIEW_SUBMISSIONS',
  scoreSubmissions: 'SCORE_TEAMS',
  commentOnSubmissions: 'ADD_COMMENTS',

  // User Management
  manageUsers: 'MANAGE_USERS',
  assignRoles: 'ASSIGN_ROLES',

  // Audit Logs
  viewAuditLogs: 'VIEW_AUDIT_LOGS',

  // Logistics
  editTeamMembers: 'EDIT_TEAM_MEMBERS',
  swapTeamMembers: 'SWAP_TEAM_MEMBERS',
  markAttendance: 'MARK_ATTENDANCE',
  viewAttendance: 'VIEW_ATTENDANCE',
} as const;

/**
 * Check permission using either tRPC-style or auth-admin-style permission name
 */
export function checkPermission(userRole: UserRole, permission: string): boolean {
  // Try direct match first
  if (permission in PERMISSIONS) {
    return hasPermission(userRole, permission as Permission);
  }

  // Try mapped permission
  const mappedPermission = TRPC_PERMISSION_MAP[permission];
  if (mappedPermission) {
    return hasPermission(userRole, mappedPermission);
  }

  console.warn(`[RBAC] Unknown permission: ${permission}`);
  return false;
}

// ═══════════════════════════════════════════════════════════
// NAVIGATION ITEMS (client-safe, role-filtered)
// ═══════════════════════════════════════════════════════════

interface NavItem {
  label: string;
  href: string;
  code: string;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'DASHBOARD', href: '/admin', code: '01' },
  { label: 'TEAMS', href: '/admin/teams', code: '02' },
  { label: 'PROBLEMS', href: '/admin/problem-statements', code: '03' },
  { label: 'ANALYTICS', href: '/admin/analytics', code: '04' },
  { label: 'LOGISTICS', href: '/admin/logistics', code: '05' },
  { label: 'EMAILS', href: '/admin/emails', code: '06' },
];

/** Returns the subset of nav items the given role is allowed to see. */
export function getAllowedNavItems(role: AdminRole): NavItem[] {
  return ALL_NAV_ITEMS.filter((item) => {
    switch (item.label) {
      case 'DASHBOARD':
        return hasPermission(role as UserRole, 'VIEW_ALL_TEAMS');
      case 'TEAMS':
        return hasPermission(role as UserRole, 'VIEW_ALL_TEAMS');
      case 'PROBLEMS':
        return hasPermission(role as UserRole, 'VIEW_ALL_TEAMS');
      case 'ANALYTICS':
        return hasPermission(role as UserRole, 'VIEW_ANALYTICS');
      case 'LOGISTICS':
        return hasPermission(role as UserRole, 'VIEW_ATTENDANCE');
      case 'EMAILS':
        return hasPermission(role as UserRole, 'SEND_EMAILS');
      default:
        return false;
    }
  });
}
