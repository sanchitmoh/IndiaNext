'use client';

import { Bell, Activity, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface AdminUser {
  name: string;
  email: string;
  role: string;
}

const pageTitles: Record<string, { title: string; code: string }> = {
  '/admin': { title: 'DASHBOARD', code: 'SYS://OVERVIEW' },
  '/admin/teams': { title: 'TEAMS', code: 'SYS://TEAM_MGMT' },
  '/admin/analytics': { title: 'ANALYTICS', code: 'SYS://DATA_VIZ' },
  '/admin/logistics': { title: 'LOGISTICS', code: 'SYS://EVENT_DAY' },
  '/admin/emails': { title: 'EMAIL_CAMPAIGNS', code: 'SYS://EMAIL_SEND' },
};

export function AdminHeader({
  user,
  onMenuToggle,
}: {
  user: AdminUser;
  onMenuToggle?: () => void;
}) {
  const pathname = usePathname();

  const pageInfo = Object.entries(pageTitles).find(
    ([path]) => pathname === path || (path !== '/admin' && pathname.startsWith(path))
  )?.[1] || { title: 'ADMIN PANEL', code: 'SYS://UNKNOWN' };

  return (
    <header className="bg-[#080808]/80 backdrop-blur-md border-b border-white/[0.06] px-4 md:px-6 py-3 shrink-0 relative z-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Mobile hamburger */}
          <button
            onClick={onMenuToggle}
            className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-white/[0.03] rounded-md md:hidden transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-sm font-mono font-black tracking-[0.2em] text-white uppercase">
              {pageInfo.title}
            </h1>
            <span className="text-[9px] font-mono text-gray-600 tracking-[0.3em] hidden sm:inline">
              {pageInfo.code}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {/* Status Indicator — hidden on very small screens */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-md">
            <Activity className="h-3 w-3 text-emerald-400" />
            <span className="text-[9px] font-mono text-gray-500 tracking-widest font-bold">
              LIVE
            </span>
          </div>

          <button
            className="relative p-2 text-gray-500 hover:text-orange-400 rounded-md hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06] transition-all"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>

          <div className="h-5 w-px bg-white/[0.06] hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-700 rounded-md flex items-center justify-center text-white text-xs font-mono font-bold shadow-[0_0_10px_rgba(255,102,0,0.2)]">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-medium text-gray-300">{user.name}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
