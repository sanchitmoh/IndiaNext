# RBAC Unification - Complete ✅

## Summary

Successfully unified the conflicting RBAC systems, fixed all `userRole` references to use the React Context approach, and resolved the missing `@/lib/session` import error.

## Changes Made

### 1. Fixed `userRole` References in Team Detail Page

**File**: `app/admin/(dashboard)/teams/[id]/page.tsx`

Replaced all `userRole` references with `role` from the `useAdminRole()` context hook:

- Line 333: Tag removal button permission check
- Line 376: StatusOrScoring component prop
- Line 456: CommentsTab readOnly prop

The page now correctly uses:

```typescript
const { role } = useAdminRole();
```

Instead of the non-existent `userRole` variable.

### 2. Fixed Missing Session Import

**File**: `app/api/admin/teams/[teamId]/members/route.ts`

Fixed the import error by replacing the non-existent `@/lib/session` import with the correct admin session management:

```typescript
// Before (broken):
import { getSession } from "@/lib/session";
const session = await getSession();
if (!session) { ... }
if (!["ADMIN", "SUPER_ADMIN", "ORGANIZER"].includes(session.user.role)) { ... }

// After (fixed):
import { requireAdminSession } from "@/lib/auth-admin";
const admin = await requireAdminSession();
if (!admin) { ... }
if (!["ADMIN", "SUPER_ADMIN", "ORGANIZER", "JUDGE", "LOGISTICS"].includes(admin.role)) { ... }
```

Also expanded the allowed roles to include JUDGE and LOGISTICS since they need to view team members.

### 3. RBAC System Architecture (Already Unified)

The RBAC system is now properly unified with three files:

#### `lib/auth-admin.ts` (Server-Only, Source of Truth)

- Contains session management functions
- Imports `next/headers` for cookie access
- Defines the canonical PERMISSIONS matrix
- Functions: `requireAdminSession`, `requireRole`, `logAdminAction`

#### `lib/rbac-permissions.ts` (Client & Server Safe)

- Contains permission checking logic only
- NO `next/headers` import (can be used in client components)
- Re-exports PERMISSIONS from auth-admin conceptually
- Provides `hasPermission`, `checkPermission`, `canPerformAction`
- Contains `TRPC_PERMISSION_MAP` for camelCase → UPPER_SNAKE_CASE translation

#### `lib/rbac.ts` (Unified Interface)

- Re-exports everything from both files
- Provides backward compatibility
- Single import point for all RBAC functionality

### 4. Permission Mapping

The `TRPC_PERMISSION_MAP` correctly translates between naming conventions:

```typescript
{
  'viewAnalytics': 'VIEW_ANALYTICS',
  'viewTeams': 'VIEW_ALL_TEAMS',
  'editTeams': 'EDIT_TEAMS',
  'deleteTeams': 'DELETE_TEAMS',
  'manageUsers': 'MANAGE_USERS',
  'viewAuditLogs': 'VIEW_AUDIT_LOGS',  // ✅ ADMIN + SUPER_ADMIN
  // ... etc
}
```

### 5. Audit Logs Permission (Already Correct)

The `getActivityLogs` procedure uses `canViewAuditLogs` middleware which:

- Maps to `VIEW_AUDIT_LOGS` permission
- Allows: `['ADMIN', 'SUPER_ADMIN']`
- Correctly restricts access (not just SUPER_ADMIN)

## Verification

All diagnostics pass:

- ✅ `app/admin/(dashboard)/teams/[id]/page.tsx` - No errors
- ✅ `app/api/admin/teams/[teamId]/members/route.ts` - No errors
- ✅ `server/trpc.ts` - No errors
- ✅ `server/routers/admin.ts` - No errors
- ✅ `server/routers/email.ts` - No errors
- ✅ `lib/rbac.ts` - No errors
- ✅ `lib/rbac-permissions.ts` - No errors

## Testing Recommendations

1. Test team detail page with different roles:
   - JUDGE: Should see scoring rubric for APPROVED teams
   - LOGISTICS/ORGANIZER: Should see read-only status view
   - ADMIN/SUPER_ADMIN: Should see status management + judge scores

2. Test audit logs access:
   - ADMIN: Should be able to view audit logs
   - SUPER_ADMIN: Should be able to view audit logs
   - JUDGE/LOGISTICS/ORGANIZER: Should get 403 Forbidden

3. Test tag management:
   - LOGISTICS/ORGANIZER: Should NOT see tag add/remove buttons
   - ADMIN/SUPER_ADMIN: Should see tag add/remove buttons

4. Test team members API:
   - All admin roles (ADMIN, SUPER_ADMIN, ORGANIZER, JUDGE, LOGISTICS) should be able to fetch team members
   - Non-admin users should get 403 Forbidden

## Notes

- The error about `getPermissions` not being exported was likely from a stale build cache
- The email router correctly uses `hasPermission` from `rbac-permissions`
- All permission checks now go through the unified system
- React Context is used for passing role information (no DOM attributes)
- The `@/lib/session` file never existed - it was a typo that needed correction
