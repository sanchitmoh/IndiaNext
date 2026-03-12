'use client';

import { useState, useCallback } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  desk?: string | null;
}

export function AdminShell({ user, children }: { user: AdminUser; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <>
      <AdminSidebar user={user} isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <AdminHeader user={user} onMenuToggle={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </>
  );
}
