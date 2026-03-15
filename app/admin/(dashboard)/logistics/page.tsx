// Logistics Dashboard — Event-Day Operations
// Shows APPROVED teams only with attendance tracking, QR check-in, member management
'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc-client';
import { useAdminRole } from '@/components/admin/AdminRoleContext';
import {
  Search,
  RefreshCw,
  QrCode,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Download,
  Filter,
  Wifi,
  WifiOff,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { QRScannerModal } from '@/components/admin/logistics/QRScannerModal';
import { AttendanceStats } from '@/components/admin/logistics/AttendanceStats';
import { QRScanNotification } from '@/components/admin/logistics/QRScanNotification';
import type { ScanEvent } from '@/lib/scan-emitter';

const POLL_INTERVAL = 30_000; // 30s real-time sync

const attendanceBadge: Record<string, { label: string; style: string; icon: typeof CheckCircle2 }> =
  {
    NOT_MARKED: {
      label: 'NOT MARKED',
      style: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      icon: Clock,
    },
    PRESENT: {
      label: 'PRESENT',
      style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      icon: CheckCircle2,
    },
    ABSENT: {
      label: 'ABSENT',
      style: 'bg-red-500/10 text-red-400 border-red-500/20',
      icon: XCircle,
    },
    PARTIAL: {
      label: 'PARTIAL',
      style: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      icon: AlertTriangle,
    },
  };

const trackLabels: Record<string, string> = {
  IDEA_SPRINT: 'Idea Sprint',
  BUILD_STORM: 'Build Storm',
};

const trackStyles: Record<string, string> = {
  IDEA_SPRINT: 'bg-cyan-500/10 text-cyan-400',
  BUILD_STORM: 'bg-orange-500/10 text-orange-400',
};

export default function LogisticsPage() {
  const [search, setSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState('all');
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  // Stacked real-time scan notifications pushed from mobile via SSE
  const [scanNotifications, setScanNotifications] = useState<
    Array<ScanEvent & { notifId: string }>
  >([]);

  // Detect admin role for attendance lock override
  // ✅ SECURITY FIX: Use React Context instead of DOM attribute
  const { isAdmin, isSuperAdmin } = useAdminRole();
  const canOverrideAttendance = isAdmin || isSuperAdmin;

  // Monitor online status for offline support awareness
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/logistics-sw.js')
        .catch(() => console.warn('Logistics SW registration failed'));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Server-Sent Events: receive real-time QR scan notifications ─────────
  useEffect(() => {
    const es = new EventSource('/api/logistics/scan-events');

    es.onmessage = (e) => {
      try {
        const event: ScanEvent = JSON.parse(e.data);
        setScanNotifications((prev) => [
          // Newest on top; cap at 5 so notifications don't crowd the screen
          { ...event, notifId: `${event.shortCode}-${Date.now()}` },
          ...prev.slice(0, 4),
        ]);
        // Also refresh the team list in the background so data stays fresh
        refetch();
        refetchStats();
      } catch { /* malformed event — ignore */ }
    };

    es.onerror = () => {
      // Browser auto-reconnects SSE on error — no manual handling needed
    };

    return () => es.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, refetch } = trpc.logistics.getApprovedTeams.useQuery(
    {
      search: search || undefined,
      track: trackFilter,
      attendance: attendanceFilter,
      page,
      pageSize: 50,
    },
    {
      refetchInterval: POLL_INTERVAL, // Real-time sync
    }
  );

  const { data: stats, refetch: refetchStats } = trpc.logistics.getAttendanceStats.useQuery(
    undefined,
    {
      refetchInterval: POLL_INTERVAL,
    }
  );

  const markAttendance = trpc.logistics.markTeamAttendance.useMutation();
  const exportAttendance = trpc.logistics.exportAttendance.useMutation();

  const handleQuickCheckIn = useCallback(
    async (teamId: string, attendance: 'PRESENT' | 'ABSENT') => {
      try {
        await markAttendance.mutateAsync({ teamId, attendance });
        toast.success(attendance === 'PRESENT' ? 'Team checked in!' : 'Team marked absent');
        refetch();
        refetchStats();
      } catch {
        toast.error('Failed to update attendance');
      }
    },
    [markAttendance, refetch, refetchStats]
  );

  const handleExport = async () => {
    try {
      const result = await exportAttendance.mutateAsync({
        track: trackFilter,
        attendance: attendanceFilter,
      });

      const headers = [
        'Team Code',
        'Team Name',
        'Track',
        'College',
        'Attendance',
        'Checked In At',
        'Notes',
        'Member Name',
        'Member Email',
        'Member Phone',
        'Member Role',
        'Member Present',
        'Member Check-In',
      ];

      const rows: string[][] = [];
      for (const t of result.teams) {
        for (const m of t.members) {
          rows.push([
            t.shortCode,
            t.name,
            t.track,
            t.college || '',
            t.attendance,
            t.checkedInAt ? new Date(t.checkedInAt).toLocaleString() : '',
            t.attendanceNotes || '',
            m.name,
            m.email,
            m.phone || '',
            m.role,
            m.isPresent ? 'YES' : 'NO',
            m.checkedInAt ? new Date(m.checkedInAt).toLocaleString() : '',
          ]);
        }
      }

      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast.success(`Exported ${result.count} teams`);
    } catch {
      toast.error('Failed to export attendance');
    }
  };

  const handleQRResult = useCallback((teamId: string) => {
    setShowQRScanner(false);
    // Navigate to team detail
    window.location.href = `/admin/logistics/${teamId}`;
  }, []);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-mono font-bold text-white tracking-wider">
            EVENT_DAY_LOGISTICS
          </h1>
          <p className="text-[11px] font-mono text-gray-500 mt-1">
            {stats?.totalApproved || 0} approved teams •{' '}
            <span className="text-emerald-400">{stats?.present || 0} present</span> •{' '}
            <span className="text-red-400">{stats?.absent || 0} absent</span> •{' '}
            <span className="text-amber-400">{stats?.notMarked || 0} unmarked</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Online/Offline indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono font-bold tracking-wider border ${
              isOnline
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </div>

          <button
            onClick={() => setShowQRScanner(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 transition-all"
          >
            <QrCode className="h-3.5 w-3.5" />
            QR CHECK-IN
          </button>

          <button
            onClick={() => {
              refetch();
              refetchStats();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            REFRESH
          </button>

          <button
            onClick={handleExport}
            disabled={exportAttendance.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            EXPORT
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && <AttendanceStats stats={stats} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by team name, code, college, or member..."
            className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white/[0.02] border border-white/[0.06] rounded-md text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30"
          />
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-600" />
            <select
              value={trackFilter}
              onChange={(e) => {
                setTrackFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by track"
              className="pl-7 pr-6 py-2 text-[10px] font-mono font-bold bg-white/[0.02] border border-white/[0.06] rounded-md text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 appearance-none"
            >
              <option value="all">ALL TRACKS</option>
              <option value="IDEA_SPRINT">IDEA SPRINT</option>
              <option value="BUILD_STORM">BUILD STORM</option>
            </select>
          </div>

          <select
            value={attendanceFilter}
            onChange={(e) => {
              setAttendanceFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by attendance status"
            className="px-3 py-2 text-[10px] font-mono font-bold bg-white/[0.02] border border-white/[0.06] rounded-md text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 appearance-none"
          >
            <option value="all">ALL STATUS</option>
            <option value="NOT_MARKED">NOT MARKED</option>
            <option value="PRESENT">PRESENT</option>
            <option value="ABSENT">ABSENT</option>
            <option value="PARTIAL">PARTIAL</option>
          </select>
        </div>
      </div>

      {/* Teams List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-500" />
          </div>
        ) : data?.teams.length === 0 ? (
          <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-12 text-center">
            <Users className="h-10 w-10 text-gray-700 mx-auto mb-3" />
            <p className="text-xs font-mono text-gray-600 tracking-widest">NO TEAMS FOUND</p>
          </div>
        ) : (
          data?.teams.map((team) => {
            const badge = attendanceBadge[team.attendance] || attendanceBadge.NOT_MARKED;
            const BadgeIcon = badge.icon;
            const leader = team.members.find((m) => m.role === 'LEADER');
            const presentCount = team.members.filter((m) => m.isPresent).length;

            return (
              <div
                key={team.id}
                className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 hover:border-white/[0.1] transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Team info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Short code */}
                    <div className="shrink-0 w-20 text-center">
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                        {team.shortCode}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/admin/logistics/${team.id}`}
                          className="text-sm font-medium text-gray-200 hover:text-emerald-400 truncate transition-colors"
                        >
                          {team.name}
                        </Link>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            trackStyles[team.track] || ''
                          }`}
                        >
                          {trackLabels[team.track] || team.track}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-gray-500">
                        {leader && (
                          <span>
                            Lead:{' '}
                            <span className="text-gray-400">
                              {leader.user.name || leader.user.email}
                            </span>
                          </span>
                        )}
                        {team.college && <span>• {team.college}</span>}
                        <span>
                          • {presentCount}/{team.members.length} present
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Attendance + Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Attendance badge */}
                    <span
                      className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-1 rounded border ${badge.style}`}
                    >
                      <BadgeIcon className="h-3 w-3" />
                      {badge.label}
                    </span>

                    {/* Quick actions */}
                    {(() => {
                      const locked = team.attendance !== 'NOT_MARKED' && !canOverrideAttendance;
                      if (locked) {
                        return (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-mono font-bold text-gray-500 bg-white/[0.02] border border-white/[0.04] rounded"
                            title="Attendance locked — only Admin can change"
                          >
                            <Lock className="h-3 w-3" />
                            LOCKED
                          </span>
                        );
                      }
                      return (
                        <>
                          {team.attendance !== 'PRESENT' && (
                            <button
                              onClick={() => handleQuickCheckIn(team.id, 'PRESENT')}
                              disabled={markAttendance.isPending}
                              className="px-2 py-1 text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-all disabled:opacity-40"
                              title="Mark as Present"
                            >
                              CHECK IN
                            </button>
                          )}
                          {team.attendance !== 'ABSENT' && (
                            <button
                              onClick={() => handleQuickCheckIn(team.id, 'ABSENT')}
                              disabled={markAttendance.isPending}
                              className="px-2 py-1 text-[9px] font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded hover:bg-red-500/20 transition-all disabled:opacity-40"
                              title="Mark as Absent"
                            >
                              ABSENT
                            </button>
                          )}
                        </>
                      );
                    })()}

                    <Link
                      href={`/admin/logistics/${team.id}`}
                      className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-white/[0.03] rounded transition-all"
                      title="View details"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-[10px] font-mono font-bold text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md disabled:opacity-30 hover:text-emerald-400 transition-all"
          >
            PREV
          </button>
          <span className="text-[10px] font-mono text-gray-500">
            {page} / {data.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(data.totalPages, page + 1))}
            disabled={page === data.totalPages}
            className="px-3 py-1.5 text-[10px] font-mono font-bold text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md disabled:opacity-30 hover:text-emerald-400 transition-all"
          >
            NEXT
          </button>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal onClose={() => setShowQRScanner(false)} onResult={handleQRResult} />
      )}

      {/* ── Real-time QR scan notification stack (bottom-right) ───────── */}
      {scanNotifications.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-h-[calc(100vh-2rem)] overflow-hidden">
          {scanNotifications.map((notif) => (
            <QRScanNotification
              key={notif.notifId}
              event={notif}
              onDismiss={() =>
                setScanNotifications((prev) =>
                  prev.filter((n) => n.notifId !== notif.notifId)
                )
              }
              onCheckedIn={() => {
                setScanNotifications((prev) =>
                  prev.filter((n) => n.notifId !== notif.notifId)
                );
                refetch();
                refetchStats();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
