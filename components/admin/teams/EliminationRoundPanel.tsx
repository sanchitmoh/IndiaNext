'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc-client';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Search,
  Filter,
  Loader2,
  Trophy,
  ArrowRight,
  RotateCcw,
  Zap,
  Shield,
  CheckSquare,
  Square,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useAdminRole } from '@/components/admin/AdminRoleContext';

type RoundStatus = 'PENDING' | 'QUALIFIED' | 'ELIMINATED';
type Round = '1' | '2';

type RoundTeam = {
  id: string;
  name: string;
  shortCode: string;
  track: string;
  college: string | null;
  score: number | null;
  round1Status: RoundStatus;
  round2Status: RoundStatus;
  round1ActionAt: Date | string | null;
  round2ActionAt: Date | string | null;
  round1ActionName?: string | null;
  round2ActionName?: string | null;
  attendance?: string | null;
  checkedIn?: boolean | null;
  members: {
    id: string;
    role: string;
    isPresent?: boolean | null;
    leftAt?: Date | string | null;
  }[];
};

// ── Confirm Bulk Elimination Modal ─────────────────────────────────────────
function ConfirmBulkModal({
  count,
  action,
  onConfirm,
  onCancel,
  isPending,
}: {
  count: number;
  action: RoundStatus;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const isElim = action === 'ELIMINATED';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className={`bg-[#0d0d0d] border rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl ${isElim ? 'border-red-500/30 shadow-red-900/20' : 'border-emerald-500/30 shadow-emerald-900/20'}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isElim ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}
          >
            {isElim ? (
              <XCircle className="h-5 w-5 text-red-400" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-mono font-bold text-white">
              BULK {isElim ? 'ELIMINATE' : 'QUALIFY'}
            </p>
            <p className="text-[10px] font-mono text-gray-500">{count} teams selected</p>
          </div>
        </div>
        <p className="text-[11px] font-mono text-gray-500 mb-5">
          {isElim
            ? `All ${count} selected teams will be marked ELIMINATED. You can undo by resetting to PENDING.`
            : `All ${count} selected teams will be marked QUALIFIED and eligible for the next round.`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-[11px] font-mono font-bold text-gray-400 bg-white/[0.03] border border-white/[0.08] rounded-lg hover:bg-white/[0.06] transition-all"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`flex-1 py-2 text-[11px] font-mono font-bold text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${isElim ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isElim ? (
              <XCircle className="h-3 w-3" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Team Round Card ──────────────────────────────────────────────────────────
function TeamRoundCard({
  team,
  round,
  onAction,
  isPending,
  selected,
  onToggleSelect,
}: {
  team: RoundTeam;
  round: Round;
  onAction: (teamId: string, status: RoundStatus) => void;
  isPending: boolean;
  selected: boolean;
  onToggleSelect: (teamId: string) => void;
}) {
  const currentStatus = round === '1' ? team.round1Status : team.round2Status;
  const actionAt = round === '1' ? team.round1ActionAt : team.round2ActionAt;
  const judgeName = round === '1' ? team.round1ActionName : team.round2ActionName;

  const statusConfig: Record<
    RoundStatus,
    { label: string; color: string; icon: typeof CheckCircle2 }
  > = {
    PENDING: {
      label: 'PENDING',
      color: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
      icon: Clock,
    },
    QUALIFIED: {
      label: 'QUALIFIED',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      icon: CheckCircle2,
    },
    ELIMINATED: {
      label: 'ELIMINATED',
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
      icon: XCircle,
    },
  };

  const cfg = statusConfig[currentStatus];
  const StatusIcon = cfg.icon;
  const scorePercent = team.score ? Math.min((team.score / 100) * 100, 100) : 0;

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        selected
          ? 'border-violet-500/40 bg-violet-500/5'
          : currentStatus === 'QUALIFIED'
            ? 'bg-emerald-500/5 border-emerald-500/15'
            : currentStatus === 'ELIMINATED'
              ? 'bg-red-500/5 border-red-500/10 opacity-70'
              : 'bg-[#0A0A0A] border-white/[0.06] hover:border-white/[0.10]'
      }`}
    >
      {/* Top: checkbox + name + badge */}
      <div className="flex items-start gap-2 mb-3">
        <button
          onClick={() => onToggleSelect(team.id)}
          className="mt-0.5 shrink-0 text-gray-500 hover:text-violet-400 transition-all"
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-violet-400" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-mono font-bold text-white truncate">{team.name}</p>
            <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              {team.shortCode}
            </span>
          </div>
          <p className="text-[10px] font-mono text-gray-500 mt-0.5 truncate">
            {team.college || 'Unknown'} •{' '}
            <span className={team.track === 'IDEA_SPRINT' ? 'text-cyan-400' : 'text-orange-400'}>
              {team.track === 'IDEA_SPRINT' ? 'Idea Sprint' : 'Build Storm'}
            </span>{' '}
            • {team.members.filter((m) => m.isPresent).length || team.members.length}/
            {team.members.length} <span className="text-emerald-500/70">present</span>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${cfg.color}`}
        >
          <StatusIcon className="h-2.5 w-2.5" />
          {cfg.label}
        </span>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-mono text-gray-600">SCORE</span>
          <span className="text-[10px] font-mono font-bold text-white">
            {team.score !== null ? team.score.toFixed(1) : '—'}
          </span>
        </div>
        <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      {/* Actioned by */}
      {judgeName && actionAt && (
        <p className="text-[9px] font-mono text-gray-600 mb-2">
          By <span className="text-gray-400 font-bold">{judgeName}</span> •{' '}
          {new Date(actionAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/teams/${team.id}`}
          className="p-1.5 text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all"
          title="View team"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        {currentStatus !== 'ELIMINATED' && (
          <button
            onClick={() => onAction(team.id, 'ELIMINATED')}
            disabled={isPending}
            className="flex-1 py-1.5 text-[10px] font-mono font-bold text-red-400 bg-red-500/5 hover:bg-red-500/15 border border-red-500/20 rounded transition-all disabled:opacity-40 flex items-center justify-center gap-1"
          >
            <XCircle className="h-3 w-3" /> ELIMINATE
          </button>
        )}
        {currentStatus !== 'QUALIFIED' && (
          <button
            onClick={() => onAction(team.id, 'QUALIFIED')}
            disabled={isPending}
            className="flex-1 py-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15 border border-emerald-500/20 rounded transition-all disabled:opacity-40 flex items-center justify-center gap-1"
          >
            <CheckCircle2 className="h-3 w-3" /> QUALIFY
          </button>
        )}
        {currentStatus !== 'PENDING' && (
          <button
            onClick={() => onAction(team.id, 'PENDING')}
            disabled={isPending}
            title="Reset to pending"
            className="p-1.5 text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-all disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export function EliminationRoundPanel() {
  const { isAdmin, isSuperAdmin } = useAdminRole();
  const canAdvance = isAdmin || isSuperAdmin;

  const [activeRound, setActiveRound] = useState<Round>('1');
  const [trackFilter, setTrackFilter] = useState<'all' | 'IDEA_SPRINT' | 'BUILD_STORM'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'QUALIFIED' | 'ELIMINATED'>(
    'all'
  );
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModal, setBulkModal] = useState<{ action: RoundStatus; ids: string[] } | null>(null);
  const [confirmElimId, setConfirmElimId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: teams, isLoading } = trpc.admin.getRoundTeams.useQuery(
    { round: activeRound, track: trackFilter, status: statusFilter },
    { refetchInterval: 15_000 }
  );

  const setStatus = trpc.admin.setTeamRoundStatus.useMutation({
    onSuccess: (t) => {
      toast.success(`${t.name} updated`);
      setSelectedIds(new Set());
      utils.admin.getRoundTeams.invalidate();
      utils.admin.getRoundAnalytics.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const advance = trpc.admin.advanceToRound2.useMutation({
    onSuccess: (d) => {
      toast.success(`Round 2 opened! ${d.qualifiedCount} teams advanced.`);
      setActiveRound('2');
      utils.admin.getRoundTeams.invalidate();
      utils.admin.getRoundAnalytics.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Filtered teams list ──────────────────────────────────────────────────
  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    if (!search) return teams as RoundTeam[];
    const q = search.toLowerCase();
    return (teams as RoundTeam[]).filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.shortCode.toLowerCase().includes(q) ||
        (t.college && t.college.toLowerCase().includes(q))
    );
  }, [teams, search]);

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!teams) return { total: 0, qualified: 0, eliminated: 0, pending: 0 };
    const key = activeRound === '1' ? 'round1Status' : 'round2Status';
    return {
      total: teams.length,
      qualified: teams.filter((t) => t[key] === 'QUALIFIED').length,
      eliminated: teams.filter((t) => t[key] === 'ELIMINATED').length,
      pending: teams.filter((t) => t[key] === 'PENDING').length,
    };
  }, [teams, activeRound]);

  // ── Selection helpers ────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectByTrack = (track: 'all' | 'IDEA_SPRINT' | 'BUILD_STORM') => {
    const ids = filteredTeams.filter((t) => track === 'all' || t.track === track).map((t) => t.id);
    setSelectedIds(new Set(ids));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleAction = (teamId: string, status: RoundStatus) => {
    if (status === 'ELIMINATED') {
      setConfirmElimId(teamId);
      return;
    }
    setStatus.mutate({ teamId, round: activeRound, status });
  };

  // Bulk action: fire mutations sequentially via Promise.all
  const executeBulk = async (ids: string[], status: RoundStatus) => {
    let success = 0;
    for (const teamId of ids) {
      try {
        await setStatus.mutateAsync({ teamId, round: activeRound, status });
        success++;
      } catch {
        // individual errors already toasted
      }
    }
    toast.success(`Bulk: ${success}/${ids.length} teams ${status.toLowerCase()}`);
    setSelectedIds(new Set());
    setBulkModal(null);
  };

  const numSelected = selectedIds.size;
  const confirmElimTeam = confirmElimId ? filteredTeams.find((t) => t.id === confirmElimId) : null;

  return (
    <div className="space-y-5">
      {/* ── Round Selector ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0A0A0A] border border-white/[0.06] rounded-xl p-4">
        <div>
          <p className="text-xs font-mono font-bold text-gray-400 tracking-widest mb-1">
            ELIMINATION ROUNDS
          </p>
          <p className="text-[10px] font-mono text-gray-600">
            Qualify or eliminate teams per round
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['1', '2'] as Round[]).map((r) => (
            <button
              key={r}
              onClick={() => {
                setActiveRound(r);
                setSelectedIds(new Set());
              }}
              className={`px-4 py-2 text-[11px] font-mono font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                activeRound === r
                  ? r === '1'
                    ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                    : 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                  : 'bg-white/[0.02] text-gray-500 border-white/[0.06] hover:text-gray-300'
              }`}
            >
              {r === '1' ? <Zap className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
              ROUND {r}
            </button>
          ))}
          {canAdvance && activeRound === '1' && (
            <button
              onClick={() => {
                if (confirm(`Advance ${stats.qualified} qualified teams to Round 2?`))
                  advance.mutate();
              }}
              disabled={advance.isPending || stats.qualified === 0}
              className="px-3 py-2 text-[10px] font-mono font-bold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg transition-all disabled:opacity-40 flex items-center gap-1.5"
            >
              {advance.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ArrowRight className="h-3 w-3" />
              )}
              ADVANCE TO R2
            </button>
          )}
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'TOTAL', value: stats.total, color: 'text-gray-300' },
          { label: 'PENDING', value: stats.pending, color: 'text-amber-400' },
          { label: 'QUALIFIED', value: stats.qualified, color: 'text-emerald-400' },
          { label: 'ELIMINATED', value: stats.eliminated, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-3 text-center"
          >
            <p className={`text-xl font-mono font-black ${color}`}>{value}</p>
            <p className="text-[8px] font-mono text-gray-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono text-gray-500">ROUND {activeRound} PROGRESS</span>
            <span className="text-[10px] font-mono font-bold text-gray-300">
              {Math.round(((stats.qualified + stats.eliminated) / stats.total) * 100)}% actioned
            </span>
          </div>
          <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(stats.qualified / stats.total) * 100}%` }}
            />
            <div
              className="h-full bg-red-500/80 transition-all duration-500"
              style={{ width: `${(stats.eliminated / stats.total) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="text-[8px] font-mono text-emerald-500">■ Qualified</span>
            <span className="text-[8px] font-mono text-red-500">■ Eliminated</span>
            <span className="text-[8px] font-mono text-gray-600">□ Pending</span>
          </div>
        </div>
      )}

      {/* ── Select-All + Filters ── */}
      <div className="flex flex-col gap-2">
        {/* Select-All row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-mono text-gray-600 uppercase tracking-wide">
            SELECT:
          </span>
          {[
            { label: 'ALL', track: 'all' as const, color: 'text-gray-300 border-white/[0.08]' },
            {
              label: '💡 IDEA SPRINT',
              track: 'IDEA_SPRINT' as const,
              color: 'text-cyan-400 border-cyan-500/20',
            },
            {
              label: '⚡ BUILD STORM',
              track: 'BUILD_STORM' as const,
              color: 'text-orange-400 border-orange-500/20',
            },
          ].map(({ label, track, color }) => (
            <button
              key={track}
              onClick={() => selectByTrack(track)}
              className={`px-2.5 py-1 text-[9px] font-mono font-bold border rounded transition-all hover:bg-white/[0.04] ${color}`}
            >
              <Users className="h-2.5 w-2.5 inline mr-1" />
              {label}
            </button>
          ))}
          {numSelected > 0 && (
            <button
              onClick={clearSelection}
              className="px-2 py-1 text-[9px] font-mono text-gray-600 hover:text-gray-400 border border-white/[0.06] rounded transition-all"
            >
              CLEAR ({numSelected})
            </button>
          )}
        </div>

        {/* Search + Track + Status filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
            <input
              type="text"
              placeholder="Search team, code, college..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-[#0A0A0A] border border-white/[0.06] rounded-lg text-gray-300 placeholder:text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 pointer-events-none" />
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value as typeof trackFilter)}
              className="pl-9 pr-3 py-2 text-[10px] font-mono bg-[#0A0A0A] border border-white/[0.06] rounded-lg text-gray-400 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">ALL TRACKS</option>
              <option value="IDEA_SPRINT">IDEA SPRINT</option>
              <option value="BUILD_STORM">BUILD STORM</option>
            </select>
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 text-[10px] font-mono bg-[#0A0A0A] border border-white/[0.06] rounded-lg text-gray-400 focus:outline-none appearance-none cursor-pointer"
            >
              <option value="all">ALL STATUS</option>
              <option value="PENDING">⏳ PENDING</option>
              <option value="QUALIFIED">✅ QUALIFIED</option>
              <option value="ELIMINATED">❌ ELIMINATED</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Bulk Action Bar (appears when teams selected) ── */}
      {numSelected > 0 && (
        <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/20 rounded-lg px-4 py-2.5">
          <span className="text-[10px] font-mono font-bold text-violet-300">
            {numSelected} team{numSelected > 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setBulkModal({ action: 'QUALIFIED', ids: Array.from(selectedIds) })}
            className="px-3 py-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded transition-all flex items-center gap-1"
          >
            <CheckCircle2 className="h-3 w-3" /> QUALIFY ALL
          </button>
          <button
            onClick={() => setBulkModal({ action: 'ELIMINATED', ids: Array.from(selectedIds) })}
            className="px-3 py-1.5 text-[10px] font-mono font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 rounded transition-all flex items-center gap-1"
          >
            <XCircle className="h-3 w-3" /> ELIMINATE ALL
          </button>
          <button
            onClick={clearSelection}
            className="p-1.5 text-gray-600 hover:text-gray-400 rounded transition-all"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Teams Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 bg-white/[0.02] border border-white/[0.04] rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/[0.06] rounded-xl">
          <Trophy className="h-8 w-8 text-gray-700 mx-auto mb-3" />
          <p className="text-xs font-mono text-gray-600">
            {activeRound === '2'
              ? 'No teams qualified from Round 1 yet'
              : 'No teams match the current filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <TeamRoundCard
              key={team.id}
              team={team}
              round={activeRound}
              onAction={handleAction}
              isPending={setStatus.isPending}
              selected={selectedIds.has(team.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Single confirm modal */}
      {confirmElimTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0d0d0d] border border-red-500/30 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl shadow-red-900/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-mono font-bold text-white">CONFIRM ELIMINATION</p>
                <p className="text-[10px] font-mono text-gray-500">Round {activeRound}</p>
              </div>
            </div>
            <p className="text-sm font-mono font-bold text-red-400 mb-1">
              {confirmElimTeam.name}{' '}
              <span className="text-[10px] text-gray-600">({confirmElimTeam.shortCode})</span>
            </p>
            <p className="text-[11px] font-mono text-gray-600 mb-5">
              This team will be eliminated from Round {activeRound}. You can undo via PENDING reset.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmElimId(null)}
                className="flex-1 py-2 text-[11px] font-mono font-bold text-gray-400 bg-white/[0.03] border border-white/[0.08] rounded-lg hover:bg-white/[0.06] transition-all"
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  setStatus.mutate({
                    teamId: confirmElimTeam.id,
                    round: activeRound,
                    status: 'ELIMINATED',
                  });
                  setConfirmElimId(null);
                }}
                disabled={setStatus.isPending}
                className="flex-1 py-2 text-[11px] font-mono font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {setStatus.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                ELIMINATE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk confirm modal */}
      {bulkModal && (
        <ConfirmBulkModal
          count={bulkModal.ids.length}
          action={bulkModal.action}
          onConfirm={() => executeBulk(bulkModal.ids, bulkModal.action)}
          onCancel={() => setBulkModal(null)}
          isPending={setStatus.isPending}
        />
      )}
    </div>
  );
}
