"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  LogOut,
  ChevronRight,
  Terminal,
  X,
  FileQuestion,
  ClipboardCheck,
  Mail,
} from "lucide-react";
import { useState, useEffect } from "react";
import { getAllowedNavItems, type AdminRole } from "@/lib/rbac";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function AdminSidebar({
  user,
  isOpen,
  onClose,
}: {
  user: AdminUser;
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by deferring active-state rendering to client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const isActive = (href: string, exact?: boolean) => {
    if (!mounted) return false; // SSR-safe: no active state until hydrated
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin/login");
    } catch {
      setLoggingOut(false);
    }
  };

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "bg-red-500/15 text-red-400 border-red-500/20",
    ADMIN: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    ORGANIZER: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
    JUDGE: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    LOGISTICS: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  };

  // Get navigation items based on role
  const allowedNavItems = getAllowedNavItems(user.role as AdminRole);
  
  // Icon mapping
  const iconMap: Record<string, typeof LayoutDashboard> = {
    DASHBOARD: LayoutDashboard,
    TEAMS: Users,
    PROBLEMS: FileQuestion,
    ANALYTICS: BarChart3,
    LOGISTICS: ClipboardCheck,
    EMAILS: Mail,
  };

  const navItems = allowedNavItems.map(item => ({
    ...item,
    icon: iconMap[item.label] || Users,
    exact: item.href === "/admin",
  }));

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-[#080808] border-r border-white/[0.06] text-white flex flex-col shrink-0
          transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:z-20
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 via-cyan-400 to-green-500 rounded-lg opacity-30 blur-md group-hover:opacity-60 transition-opacity" />
              <div className="relative w-full h-full border border-white/20 bg-black/60 rounded-lg flex items-center justify-center backdrop-blur-sm overflow-hidden p-1">
                <Image src="/logo-new.png" alt="IndiaNext Logo" width={28} height={28} className="object-contain" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-black text-base tracking-tighter leading-none">
                INDIA<span className="text-orange-500">NEXT</span>
              </span>
              <span className="text-[0.5rem] text-gray-500 tracking-[0.35em] font-mono font-bold">
                ADMIN_CONSOLE
              </span>
            </div>
          </Link>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white rounded-md hover:bg-white/[0.05] md:hidden transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* System Status */}
        <div className="px-5 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono text-gray-500 tracking-[0.3em] font-bold uppercase">
              SYSTEM ONLINE
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          <div className="px-3 mb-3">
            <span className="text-[9px] font-mono text-gray-600 tracking-[0.4em] font-bold uppercase">
              NAVIGATION
            </span>
          </div>
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-mono font-bold tracking-widest transition-all relative group ${
                  active
                    ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-orange-500 rounded-r shadow-[0_0_8px_rgba(255,102,0,0.6)]" />
                )}
                <span className={`text-[10px] ${active ? "text-orange-500/60" : "text-gray-700"}`}>
                  {item.code}
                </span>
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-60" />}
              </a>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="mb-3 px-1">
            <div className="flex items-center gap-2 mb-1">
              <Terminal className="h-3 w-3 text-gray-600" />
              <span className="text-[9px] font-mono text-gray-600 tracking-[0.3em] uppercase font-bold">OPERATOR</span>
            </div>
            <div className="text-sm font-medium text-gray-300 truncate">{user.name}</div>
            <div className="text-[11px] text-gray-500 font-mono truncate">{user.email}</div>
            <span
              className={`inline-block mt-1.5 text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border ${
                roleColors[user.role] || "bg-white/5 text-gray-400 border-white/10"
              }`}
            >
              {user.role.replace("_", " ")}
            </span>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-mono tracking-wider text-gray-500 hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 rounded-md transition-all disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{loggingOut ? "DISCONNECTING..." : "LOGOUT"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
