/**
 * Role-Based Access Control (RBAC) System
 * ⚠️  CLIENT-SAFE ONLY — no server-only imports allowed here.
 *
 * This file is imported by client components (AdminSidebar, etc.).
 * It ONLY re-exports pure utility functions from rbac-permissions.ts.
 *
 * For server-only auth helpers (requirePermission, requireAdminSession, etc.)
 * import directly from '@/lib/auth-admin' in your API routes / Server Components.
 */

export {
  type AdminRole,
  type Permission,
  PERMISSIONS,
  hasPermission,
  hasMinimumRole,
  isAdmin,
  getRoleLabel,
  getRoleBadgeColor,
  canPerformAction,
  TRPC_PERMISSION_MAP,
  checkPermission,
  getAllowedNavItems,
} from './rbac-permissions';
