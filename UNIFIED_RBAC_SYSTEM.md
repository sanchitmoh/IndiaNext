# Unified RBAC System - Implementation Guide

## Problem Solved

Previously, there were two separate, conflicting RBAC permission systems:

1. `lib/rbac.ts` - Used by tRPC middleware
2. `lib/auth-admin.ts` - Used by REST API routes

This created maintenance issues where updating permissions in one file wouldn't update the other, leading to inconsistent access control.

## Solution

**Single Source of Truth:** `lib/auth-admin.ts` now contains all permission definitions, role hierarchy, and permission check logic.

**Unified Interface:** `lib/rbac.ts` now imports and re-exports everything from `auth-admin.ts`, providing backward compatibility while ensuring consistency.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    lib/auth-admin.ts                        │
│                 (Single Source of Truth)                    │
│                                                             │
│  • PERMISSIONS (uppercase snake_case)                      │
│  • ROLE_HIERARCHY                                          │
│  • hasPermission()                                         │
│  • requirePermission()                                     │
│  • Session management                                      │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ imports & re-exports
                            │
┌─────────────────────────────────────────────────────────────┐
│                      lib/rbac.ts                            │
│              (Compatibility Layer)                          │
│                                                             │
│  • Re-exports all auth-admin functions                     │
│  • TRPC_PERMISSION_MAP (camelCase → UPPER_SNAKE_CASE)     │
│  • checkPermission() (handles both naming styles)          │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ used by
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────────────────┐              ┌────────────────────┐
│   server/trpc.ts  │              │  REST API Routes   │
│  (tRPC Middleware)│              │  (Direct imports)  │
└───────────────────┘              └────────────────────┘
```

---

## Permission Naming Conventions

### auth-admin.ts (Source of Truth)

Uses **UPPER_SNAKE_CASE** for consistency with database conventions:

```typescript
export const PERMISSIONS = {
  VIEW_ALL_TEAMS: ['ORGANIZER', 'JUDGE', 'LOGISTICS', 'ADMIN', 'SUPER_ADMIN'],
  EDIT_TEAMS: ['ADMIN', 'SUPER_ADMIN'],
  DELETE_TEAMS: ['SUPER_ADMIN'],
  EXPORT_DATA: ['ORGANIZER', 'JUDGE', 'ADMIN', 'SUPER_ADMIN'],
  // ... more permissions
} as const;
```

### tRPC Middleware (Backward Compatible)

Uses **camelCase** for JavaScript convention:

```typescript
export const canViewTeams = adminProcedure.use(requirePermission('viewTeams'));
export const canEditTeams = adminProcedure.use(requirePermission('editTeams'));
```

### Permission Mapping

`lib/rbac.ts` provides automatic mapping:

```typescript
export const TRPC_PERMISSION_MAP: Record<string, AuthPermission> = {
  viewTeams: 'VIEW_ALL_TEAMS',
  editTeams: 'EDIT_TEAMS',
  deleteTeams: 'DELETE_TEAMS',
  exportTeams: 'EXPORT_DATA',
  // ... more mappings
};
```

---

## Usage Examples

### 1. tRPC Procedures (Recommended)

Use the pre-built middleware guards:

```typescript
import { canEditTeams, canDeleteTeams } from '../trpc';

export const adminRouter = router({
  updateTeam: canEditTeams
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Permission already checked by middleware
      // ctx.admin is guaranteed to exist
    }),

  deleteTeam: canDeleteTeams
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Only SUPER_ADMIN can reach here
    }),
});
```

### 2. REST API Routes

Use `requirePermission` from `auth-admin.ts`:

```typescript
import { requirePermission } from '@/lib/auth-admin';

export async function POST(req: Request) {
  // Check permission and get session in one call
  const session = await requirePermission('EDIT_TEAMS');

  // session.user.role is guaranteed to have EDIT_TEAMS permission
  const { teamId } = await req.json();

  // ... update team
}
```

### 3. Direct Permission Checks

Use `hasPermission` for conditional logic:

```typescript
import { hasPermission } from '@/lib/rbac';

function TeamActions({ userRole }: { userRole: UserRole }) {
  const canEdit = hasPermission(userRole, 'EDIT_TEAMS');
  const canDelete = hasPermission(userRole, 'DELETE_TEAMS');

  return (
    <>
      {canEdit && <EditButton />}
      {canDelete && <DeleteButton />}
    </>
  );
}
```

### 4. Role Hierarchy Checks

Use `hasMinimumRole` for role-based checks:

```typescript
import { hasMinimumRole } from '@/lib/rbac';

if (hasMinimumRole(userRole, 'ADMIN')) {
  // User is ADMIN or SUPER_ADMIN
}
```

---

## Complete Permission Matrix

| Permission        | PARTICIPANT | ORGANIZER | JUDGE | LOGISTICS | ADMIN | SUPER_ADMIN |
| ----------------- | ----------- | --------- | ----- | --------- | ----- | ----------- |
| VIEW_OWN_TEAM     | ✅          | ✅        | ✅    | ✅        | ✅    | ✅          |
| VIEW_ALL_TEAMS    | ❌          | ✅        | ✅    | ✅        | ✅    | ✅          |
| VIEW_SUBMISSIONS  | ❌          | ✅        | ✅    | ❌        | ✅    | ✅          |
| VIEW_ANALYTICS    | ❌          | ✅        | ✅    | ❌        | ✅    | ✅          |
| VIEW_AUDIT_LOGS   | ❌          | ❌        | ❌    | ❌        | ✅    | ✅          |
| APPROVE_TEAMS     | ❌          | ❌        | ❌    | ❌        | ✅    | ✅          |
| REJECT_TEAMS      | ❌          | ❌        | ❌    | ❌        | ✅    | ✅          |
| EDIT_TEAMS        | ❌          | ❌        | ❌    | ❌        | ✅    | ✅          |
| DELETE_TEAMS      | ❌          | ❌        | ❌    | ❌        | ❌    | ✅          |
| SEND_EMAILS       | ❌          | ✅        | ❌    | ❌        | ✅    | ✅          |
| ADD_COMMENTS      | ❌          | ✅        | ✅    | ❌        | ✅    | ✅          |
| SCORE_TEAMS       | ❌          | ❌        | ✅    | ❌        | ✅    | ✅          |
| EXPORT_DATA       | ❌          | ✅        | ✅    | ❌        | ✅    | ✅          |
| MANAGE_USERS      | ❌          | ❌        | ❌    | ❌        | ❌    | ✅          |
| ASSIGN_ROLES      | ❌          | ❌        | ❌    | ❌        | ❌    | ✅          |
| EDIT_TEAM_MEMBERS | ❌          | ❌        | ❌    | ✅        | ✅    | ✅          |
| SWAP_TEAM_MEMBERS | ❌          | ❌        | ❌    | ✅        | ✅    | ✅          |
| MARK_ATTENDANCE   | ❌          | ❌        | ❌    | ✅        | ✅    | ✅          |
| VIEW_ATTENDANCE   | ❌          | ✅        | ❌    | ✅        | ✅    | ✅          |
| EXPORT_ATTENDANCE | ❌          | ❌        | ❌    | ✅        | ✅    | ✅          |

---

## Role Hierarchy

```
SUPER_ADMIN (4)  ← Highest authority
    ↑
  ADMIN (3)
    ↑
JUDGE (2) / LOGISTICS (2)  ← Same level
    ↑
ORGANIZER (1)
    ↑
PARTICIPANT (0)  ← Lowest authority
```

**Note:** LOGISTICS and JUDGE are at the same level but have different permissions. LOGISTICS is an event-day role focused on attendance and member management.

---

## Adding New Permissions

### Step 1: Add to auth-admin.ts

```typescript
// lib/auth-admin.ts
export const PERMISSIONS = {
  // ... existing permissions

  // New permission
  MANAGE_SPONSORS: ['ORGANIZER', 'ADMIN', 'SUPER_ADMIN'],
} as const;
```

### Step 2: Add mapping to rbac.ts (if using tRPC)

```typescript
// lib/rbac.ts
export const TRPC_PERMISSION_MAP: Record<string, AuthPermission> = {
  // ... existing mappings

  manageSponsors: 'MANAGE_SPONSORS',
};
```

### Step 3: Create tRPC middleware guard (optional)

```typescript
// server/trpc.ts
export const canManageSponsors = adminProcedure.use(requirePermission('manageSponsors'));
```

### Step 4: Use in procedures

```typescript
// server/routers/admin.ts
export const adminRouter = router({
  addSponsor: canManageSponsors
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),
});
```

---

## Migration Guide

### Before (Conflicting Systems)

```typescript
// lib/rbac.ts
export const PERMISSIONS = {
  editTeams: ['ADMIN', 'SUPER_ADMIN'],
};

// lib/auth-admin.ts
export const PERMISSIONS = {
  EDIT_TEAMS: ['ADMIN', 'SUPER_ADMIN'],
};

// ❌ Two separate definitions that could diverge
```

### After (Unified System)

```typescript
// lib/auth-admin.ts (source of truth)
export const PERMISSIONS = {
  EDIT_TEAMS: ['ADMIN', 'SUPER_ADMIN'],
};

// lib/rbac.ts (re-exports)
import { PERMISSIONS as AUTH_PERMISSIONS } from './auth-admin';
export const PERMISSIONS = AUTH_PERMISSIONS;

// ✅ Single source of truth, automatic consistency
```

---

## Testing

### Unit Tests

```typescript
import { hasPermission, checkPermission } from '@/lib/rbac';

describe('Unified RBAC', () => {
  it('should check permissions using UPPER_SNAKE_CASE', () => {
    expect(hasPermission('ADMIN', 'EDIT_TEAMS')).toBe(true);
    expect(hasPermission('JUDGE', 'EDIT_TEAMS')).toBe(false);
  });

  it('should check permissions using camelCase (mapped)', () => {
    expect(checkPermission('ADMIN', 'editTeams')).toBe(true);
    expect(checkPermission('JUDGE', 'editTeams')).toBe(false);
  });

  it('should handle both naming conventions', () => {
    const role = 'ADMIN';
    expect(checkPermission(role, 'EDIT_TEAMS')).toBe(true);
    expect(checkPermission(role, 'editTeams')).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('tRPC Middleware', () => {
  it('should block unauthorized access', async () => {
    const caller = createCaller({ admin: { role: 'JUDGE' } });

    await expect(caller.deleteTeam({ teamId: '123' })).rejects.toThrow('Insufficient permissions');
  });

  it('should allow authorized access', async () => {
    const caller = createCaller({ admin: { role: 'SUPER_ADMIN' } });

    await expect(caller.deleteTeam({ teamId: '123' })).resolves.toBeDefined();
  });
});
```

---

## Benefits

1. **Single Source of Truth** - All permissions defined in one place
2. **Automatic Consistency** - Changes propagate everywhere automatically
3. **Backward Compatible** - Existing code continues to work
4. **Type Safe** - TypeScript ensures correct permission names
5. **Flexible** - Supports both naming conventions
6. **Maintainable** - Easy to add/modify permissions
7. **Auditable** - Clear permission matrix for security reviews

---

## Files Modified

1. `lib/auth-admin.ts` - **No changes** (source of truth)
2. `lib/rbac.ts` - Now imports and re-exports from auth-admin.ts
3. `server/trpc.ts` - Uses `checkPermission` for flexible naming

---

## Troubleshooting

### Permission Not Found Error

```
[RBAC] Unknown permission: myNewPermission
```

**Solution:** Add the permission to `auth-admin.ts` and the mapping to `rbac.ts`.

### Type Error: Permission Not Assignable

```typescript
// ❌ Error
const perm: Permission = 'editTeams';
```

**Solution:** Use the mapped permission or import the correct type:

```typescript
// ✅ Correct
import { checkPermission } from '@/lib/rbac';
checkPermission(role, 'editTeams'); // Works with both styles
```

### Inconsistent Permissions

If you see different behavior between tRPC and REST routes:

1. Check `TRPC_PERMISSION_MAP` in `lib/rbac.ts`
2. Ensure the mapping points to the correct auth-admin permission
3. Verify the permission exists in `auth-admin.ts`

---

## Future Improvements

1. **Auto-generate mappings** - Script to generate TRPC_PERMISSION_MAP from PERMISSIONS
2. **Permission groups** - Group related permissions for easier management
3. **Dynamic permissions** - Load permissions from database for runtime changes
4. **Permission inheritance** - Allow permissions to inherit from others
5. **Audit logging** - Automatic logging of all permission checks

---

## Conclusion

The unified RBAC system provides a single source of truth for all permission checks while maintaining backward compatibility. All future permission changes should be made in `lib/auth-admin.ts`, and they will automatically propagate to all parts of the application.

**Status: PRODUCTION READY ✅**
