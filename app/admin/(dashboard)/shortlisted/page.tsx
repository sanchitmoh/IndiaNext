'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { toast } from 'sonner';
import { assignDesk, DESKS } from '@/lib/logistics-utils';
import {
  Star,
  Mail,
  MailCheck,
  Send,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  CheckCircle,
  MonitorPlay,
  Zap,
  Hash,
  Building2,
  UserCheck,
} from 'lucide-react';

const deskColors: Record<string, string> = {
  A: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
  B: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
  D: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  C: 'text-purple-400 bg-purple-500/10 border-purple-500/25',
};

const trackColors: Record<string, string> = {
  IDEA_SPRINT: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  BUILD_STORM: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
};
const trackLabels: Record<string, string> = {
  IDEA_SPRINT: '💡 IdeaSprint',
  BUILD_STORM: '⚡ BuildStorm',
};

export default function ShortlistedTeamsPage() {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkNote, setBulkNote] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [filterTrack, setFilterTrack] = useState('all');

  const {
    data: allTeams,
    isLoading,
    refetch,
  } = trpc.admin.getShortlistedTeams.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const displayTeams = (allTeams || [])
    .map((team, idx) => ({ ...team, globalIdx: idx }))
    .filter((team) => filterTrack === 'all' || team.track === filterTrack);

  const sendSingle = trpc.admin.sendShortlistConfirmationEmail.useMutation({
    onSuccess: () => {
      toast.success('Confirmation email sent!');
      setSendingId(null);
    },
    onError: (e) => {
      toast.error(e.message);
      setSendingId(null);
    },
  });

  const sendBulk = trpc.admin.sendBulkShortlistConfirmationEmails.useMutation({
    onSuccess: (data: { sent: number; failed: number }) => {
      toast.success(`Emails sent: ${data.sent} ✓  Failed: ${data.failed}`);
      setSelectedIds(new Set());
      setBulkNote('');
    },
    onError: (e) => toast.error(e.message),
  });

  const total = displayTeams.length;
  const allSelected = total > 0 && selectedIds.size === total;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayTeams.map((t) => t.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-5 w-5 text-orange-400" />
            <h1 className="text-lg font-mono font-black tracking-widest text-white uppercase">
              Shortlisted Teams
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/25">
              {total} teams
            </span>
          </div>
          <p className="text-xs font-mono text-gray-500">
            Teams marked as <span className="text-orange-400">SHORTLISTED</span> — desk assignment
            uses round-robin order: A → B → D → C
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterTrack}
            onChange={(e) => {
              setFilterTrack(e.target.value);
              setSelectedIds(new Set());
            }}
            className="px-3 py-2 text-[10px] font-mono bg-white/[0.03] border border-white/10 rounded-md text-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-500/50 cursor-pointer hover:bg-white/[0.05] transition-all"
          >
            <option value="all">ALL TRACKS</option>
            <option value="IDEA_SPRINT">IDEA SPRINT</option>
            <option value="BUILD_STORM">BUILD STORM</option>
          </select>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono font-bold text-gray-400 border border-white/10 rounded-md hover:bg-white/[0.04] hover:text-white transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            REFRESH
          </button>
        </div>
      </div>

      {/* ── Bulk Email Bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-orange-500/5 border border-orange-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-orange-400 shrink-0">
            <MailCheck className="h-4 w-4" />
            <span className="text-xs font-mono font-bold">
              {selectedIds.size} team{selectedIds.size > 1 ? 's' : ''} selected
            </span>
          </div>
          <input
            value={bulkNote}
            onChange={(e) => setBulkNote(e.target.value)}
            placeholder="Optional note from organiser..."
            className="flex-1 min-w-0 px-3 py-1.5 text-xs font-mono bg-white/[0.03] border border-white/[0.08] rounded-md text-gray-300 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-500/40"
          />
          <button
            onClick={() =>
              sendBulk.mutate({
                teamIds: Array.from(selectedIds),
                notes: bulkNote || undefined,
              })
            }
            disabled={sendBulk.isPending}
            className="flex items-center gap-2 px-4 py-2 text-[11px] font-mono font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-md hover:bg-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {sendBulk.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            SEND CONFIRMATION EMAILS
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && total === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-white/[0.06] rounded-lg">
          <Star className="h-12 w-12 text-gray-700 mb-4" />
          <p className="text-sm font-mono text-gray-500">No shortlisted teams yet</p>
          <p className="text-xs font-mono text-gray-600 mt-1">
            Set team status to <span className="text-orange-400 font-bold">SHORTLISTED</span> from
            the Teams page.
          </p>
        </div>
      )}

      {/* ── Teams Table ── */}
      {!isLoading && total > 0 && (
        <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Table Head */}
          <div className="grid grid-cols-[28px_48px_1fr_100px_120px_80px_120px] gap-3 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06] text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.3em] items-center">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-3.5 h-3.5 accent-orange-500 cursor-pointer"
            />
            <span className="text-center">DESK</span>
            <span>TEAM</span>
            <span>TRACK</span>
            <span>COLLEGE</span>
            <span className="text-center">
              <Users className="h-3 w-3 inline" />
            </span>
            <span className="text-right">ACTION</span>
          </div>

          {/* Rows */}
          {displayTeams.map((team) => {
            const desk = assignDesk(team.globalIdx);
            const leader = team.members.find((m) => m.role === 'LEADER');
            const isExpanded = expandedTeam === team.id;
            const isSelected = selectedIds.has(team.id);

            return (
              <div key={team.id} className="border-b border-white/[0.04] last:border-none">
                {/* Main row */}
                <div
                  className={`grid grid-cols-[28px_48px_1fr_100px_120px_80px_120px] gap-3 px-4 py-3 items-center cursor-pointer hover:bg-white/[0.02] transition-colors ${
                    isSelected ? 'bg-orange-500/[0.04]' : ''
                  }`}
                  onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                >
                  {/* Checkbox */}
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(team.id)}
                      className="w-3.5 h-3.5 accent-orange-500 cursor-pointer"
                    />
                  </div>

                  {/* Desk badge */}
                  <div className="flex justify-center">
                    <span
                      className={`text-sm font-mono font-black px-2 py-0.5 rounded border ${deskColors[desk]}`}
                    >
                      {desk}
                    </span>
                  </div>

                  {/* Team name + shortcode */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-white truncate">
                        {team.name}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-gray-600 shrink-0" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-gray-600 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-gray-600 tracking-widest">
                      {team.shortCode}
                    </span>
                  </div>

                  {/* Track */}
                  <div className="min-w-0">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border truncate block text-center ${trackColors[team.track]}`}
                    >
                      {team.track === 'IDEA_SPRINT' ? 'IdeaSprint' : 'BuildStorm'}
                    </span>
                  </div>

                  {/* College */}
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono text-gray-400 truncate block">
                      {team.college || '—'}
                    </span>
                  </div>

                  {/* Member count */}
                  <div className="flex justify-center">
                    <span className="text-xs font-mono text-gray-400">{team.members.length}</span>
                  </div>

                  {/* Send email */}
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setSendingId(team.id);
                        sendSingle.mutate({ teamId: team.id });
                      }}
                      disabled={sendingId === team.id || sendSingle.isPending}
                      title="Send confirmation email to team leader"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {sendingId === team.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Mail className="h-3 w-3" />
                      )}
                      EMAIL
                    </button>
                  </div>
                </div>

                {/* Expanded member details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 bg-white/[0.01] border-t border-white/[0.04]">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      {/* Slot info */}
                      <div className="bg-[#111] border border-white/[0.06] rounded-lg p-3 flex flex-col gap-2">
                        <span className="text-[9px] font-mono text-gray-500 tracking-[0.3em] font-bold">
                          SLOT INFO
                        </span>
                        <div className="flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-gray-600" />
                          <span className="font-mono font-black text-orange-400 tracking-wider">
                            {team.shortCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MonitorPlay className="h-3.5 w-3.5 text-gray-600" />
                          <span
                            className={`text-xs font-mono font-bold ${deskColors[desk].split(' ')[0]}`}
                          >
                            Desk {desk}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5 text-gray-600" />
                          <span
                            className={`text-xs font-mono font-bold ${trackColors[team.track].split(' ')[0]}`}
                          >
                            {trackLabels[team.track]}
                          </span>
                        </div>
                      </div>

                      {/* Leader info */}
                      <div className="bg-[#111] border border-white/[0.06] rounded-lg p-3 flex flex-col gap-2">
                        <span className="text-[9px] font-mono text-gray-500 tracking-[0.3em] font-bold">
                          TEAM LEADER
                        </span>
                        {leader ? (
                          <>
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-3.5 w-3.5 text-orange-400" />
                              <span className="text-xs font-mono text-gray-200 font-medium">
                                {leader.user.name || '—'}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-gray-500 truncate">
                              {leader.user.email}
                            </span>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span className="text-xs font-mono">No leader found</span>
                          </div>
                        )}
                      </div>

                      {/* College */}
                      <div className="bg-[#111] border border-white/[0.06] rounded-lg p-3 flex flex-col gap-2">
                        <span className="text-[9px] font-mono text-gray-500 tracking-[0.3em] font-bold">
                          COLLEGE
                        </span>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-gray-600" />
                          <span className="text-xs font-mono text-gray-300">
                            {team.college || 'Not specified'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* All members */}
                    <div className="bg-[#111] border border-white/[0.06] rounded-lg overflow-hidden">
                      <div className="px-3 py-2 border-b border-white/[0.04] bg-white/[0.02]">
                        <span className="text-[9px] font-mono text-gray-500 tracking-[0.3em] font-bold">
                          ALL MEMBERS ({team.members.length})
                        </span>
                      </div>
                      <div className="divide-y divide-white/[0.03]">
                        {team.members.map((m) => (
                          <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                m.role === 'LEADER' ? 'bg-orange-400' : 'bg-gray-700'
                              }`}
                            />
                            <span className="text-xs font-mono text-gray-200 min-w-[140px]">
                              {m.user.name || '—'}
                            </span>
                            <span className="text-[11px] font-mono text-gray-500 flex-1 truncate">
                              {m.user.email}
                            </span>
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                m.role === 'LEADER'
                                  ? 'text-orange-400 bg-orange-500/10 border-orange-500/20'
                                  : 'text-gray-500 bg-white/[0.03] border-white/[0.06]'
                              }`}
                            >
                              {m.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick send for this team */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[10px] font-mono text-gray-500">
                          Send full confirmation email (with event schedule, rules, QR pass & Desk{' '}
                          {desk} assignment)
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setSendingId(team.id);
                          sendSingle.mutate({ teamId: team.id });
                        }}
                        disabled={sendingId === team.id || sendSingle.isPending}
                        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold text-white bg-orange-500/20 border border-orange-500/30 rounded-md hover:bg-orange-500/30 disabled:opacity-50 transition-all"
                      >
                        {sendingId === team.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        SEND CONFIRMATION
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Summary Stats ── */}
      {!isLoading && total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['A', 'B', 'D', 'C'] as const).map((desk, _i) => {
            const count = displayTeams.filter((t) => assignDesk(t.globalIdx) === desk).length;
            return (
              <div
                key={desk}
                className={`flex items-center gap-3 p-4 rounded-lg border ${deskColors[desk].replace('text-', 'border-').replace('bg-', 'bg-').split(' ').slice(1).join(' ')} bg-[#0A0A0A]`}
              >
                <div
                  className={`text-3xl font-black font-mono leading-none ${deskColors[desk].split(' ')[0]}`}
                >
                  {desk}
                </div>
                <div>
                  <div className="text-[9px] font-mono text-gray-500 tracking-[0.3em] uppercase">
                    Desk {desk}
                  </div>
                  <div className="text-xl font-mono font-black text-white">{count}</div>
                  <div className="text-[9px] font-mono text-gray-600">teams</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
