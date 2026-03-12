'use client';

import { createContext, useContext } from 'react';
import type { UserRole } from '@prisma/client';

interface AdminRoleContextValue {
  role: UserRole;
  desk?: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isJudge: boolean;
  isOrganizer: boolean;
  isLogistics: boolean;
}

const AdminRoleContext = createContext<AdminRoleContextValue | null>(null);

export function AdminRoleProvider({
  role,
  desk,
  children,
}: {
  role: UserRole;
  desk?: string | null;
  children: React.ReactNode;
}) {
  const value: AdminRoleContextValue = {
    role,
    desk,
    isAdmin: role === 'ADMIN',
    isSuperAdmin: role === 'SUPER_ADMIN',
    isJudge: role === 'JUDGE',
    isOrganizer: role === 'ORGANIZER',
    isLogistics: role === 'LOGISTICS',
  };

  return <AdminRoleContext.Provider value={value}>{children}</AdminRoleContext.Provider>;
}

export function useAdminRole() {
  const context = useContext(AdminRoleContext);

  if (!context) {
    throw new Error('useAdminRole must be used within AdminRoleProvider');
  }

  return context;
}
