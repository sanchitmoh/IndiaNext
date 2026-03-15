'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import {
  X,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  GripVertical,
  Lock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface TiebreakerPanelProps {
  onClose: () => void;
}

const RESOLUTION_LABELS: Record<string, string> = {
  top_criterion: '1. Top Criterion Score',
  judge_count: '2. Judge Consensus',
  submission_time: '3. Earlier Submission',
  alphabetical: '4. Alphabetical',
  manual: 'Admin Override',
};

const RESOLUTION_COLORS: Record<string, string> = {
  top_criterion: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  judge_count: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  submission_time: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  alphabetical: 'text-gray-400 bg-white/[0.05] border-white/[0.08]',
  manual: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
};

export function TiebreakerPanel({ onClose }: TiebreakerPanelProps) {
  const [activeTrack, setActiveTrack] = useState<'ideasprint' | 'buildstorm'>('ideasprint');
  const [editingRanks, setEditingRanks] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.admin.getTieAnalytics.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const setManualRank = trpc.admin.setManualRank.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Manual rank saved');
    },
    onError: (e) => toast.error(e.message),
  });

  const trackData = data?.[activeTrack];

  const handleSaveRank = async (teamId: string) => {
    const val = editingRanks[teamId];
    if (!val) return;
    const rank = parseInt(val);
    if (isNaN(rank) || rank < 1) return toast.error('Enter a valid rank (≥ 1)');
    setSavingId(teamId);
    await setManualRank.mutateAsync({ teamId, rank, reason: 'Tiebreaker panel override' });
    setSavingId(null);
    setEditingRanks((prev) => { const n = { ...prev }; delete n[teamId]; return n; });
  };

  const handleClearRank = async (teamId: string) => {
    setSavingId(teamId);
    await setManualRank.mutateAsync({ teamId, rank: null, reason: 'Tiebreaker override cleared' });
    setSavingId(null);
  };

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0A0A0A] border-l border-white/[0.08] z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-orange-500/10 border border-orange-500/20">
            <Wand2 className="h-4 w-4 text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-bold text-white">TIEBREAKER</h2>
            <p className="text-[9px] font-mono text-gray-500 tracking-widest">MANAGE_RANK_OVERRIDES</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/[0.05] transition-all"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/[0.05] transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Track tabs */}
      <div className="flex border-b border-white/[0.06]">
        {(['ideasprint', 'buildstorm'] as const).map((t) => {
          const tData = data?.[t];
          const isActive = activeTrack === t;
          return (
            <button
              key={t}
              onClick={() => setActiveTrack(t)}
              className={`flex-1 py-2.5 text-[10px] font-mono font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                isActive
                  ? t === 'ideasprint'
                    ? 'text-cyan-400 border-b-2 border-cyan-500 bg-cyan-500/5'
                    : 'text-orange-400 border-b-2 border-orange-500 bg-orange-500/5'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {t === 'ideasprint' ? 'IDEA SPRINT' : 'BUILD STORM'}
              {tData && tData.totalTies > 0 && (
                <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                  tData.totalTies > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/[0.05] text-gray-500'
                }`}>
                  {tData.totalTies}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Summary bar */}
      {trackData && (
        <div className="flex items-center gap-4 px-5 py-3 bg-white/[0.02] border-b border-white/[0.04]">
          <div className="text-center">
            <div className="text-base font-mono font-bold text-amber-400">{trackData.totalTies}</div>
            <div className="text-[8px] font-mono text-gray-600">TIED</div>
          </div>
          <div className="h-6 w-px bg-white/[0.06]" />
          <div className="text-center">
            <div className="text-base font-mono font-bold text-emerald-400">{trackData.autoResolved}</div>
            <div className="text-[8px] font-mono text-gray-600">AUTO</div>
          </div>
          <div className="h-6 w-px bg-white/[0.06]" />
          <div className="text-center">
            <div className="text-base font-mono font-bold text-orange-400">{trackData.manualResolved}</div>
            <div className="text-[8px] font-mono text-gray-600">MANUAL</div>
          </div>
          <div className="h-6 w-px bg-white/[0.06]" />
          <div className="text-center flex-1 text-right">
            <div className="text-[9px] font-mono text-gray-500">
              {trackData.scoredTeams}/{trackData.totalTeams} scored
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          </div>
        ) : !trackData || trackData.tieGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-3" />
            <p className="text-xs font-mono text-emerald-400">NO TIES DETECTED</p>
            <p className="text-[10px] font-mono text-gray-600 mt-1">
              All teams have distinct scores in this track
            </p>
          </div>
        ) : (
          trackData.tieGroups.map((group: { score: number; teams: { id: string; name: string; score: number; manualRank: number | null }[]; resolved: boolean; resolutionType: 'manual' | 'auto' | null }, gi: number) => (
            <div
              key={gi}
              className="bg-white/[0.02] border border-white/[0.05] rounded-lg overflow-hidden"
            >
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[10px] font-mono text-amber-400 font-bold">
                    {group.teams.length} TEAMS TIED @ {group.score.toFixed(1)}
                  </span>
                </div>
                <span
                  className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    RESOLUTION_COLORS[group.resolutionType ?? 'auto'] ?? ''
                  }`}
                >
                  {group.resolutionType === 'manual' ? '🔒 MANUAL' : '⚡ AUTO'}
                </span>
              </div>

              {/* Teams in tie group */}
              <div className="divide-y divide-white/[0.03]">
                {group.teams.map((team: { id: string; name: string; score: number; manualRank: number | null }, ti: number) => {
                  const isEditing = editingRanks[team.id] !== undefined;
                  const isSaving = savingId === team.id;
                  const hasManual = team.manualRank !== null;

                  return (
                    <div key={team.id} className="flex items-center gap-3 px-4 py-2.5">
                      <GripVertical className="h-3.5 w-3.5 text-gray-700 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-gray-500">
                            #{ti + 1} (auto)
                          </span>
                          {hasManual && (
                            <span className="text-[8px] font-mono font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1 py-0.5 rounded flex items-center gap-0.5">
                              <Lock className="h-2.5 w-2.5" />#{team.manualRank}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-gray-200 truncate block">{team.name}</span>
                      </div>

                      {/* Manual rank input */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isEditing ? (
                          <>
                            <input
                              type="number"
                              min={1}
                              value={editingRanks[team.id]}
                              onChange={(e) => setEditingRanks((prev) => ({ ...prev, [team.id]: e.target.value }))}
                              className="w-12 px-1.5 py-0.5 text-[10px] font-mono bg-white/[0.05] border border-orange-500/40 rounded text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50"
                              placeholder="#"
                            />
                            <button
                              onClick={() => handleSaveRank(team.id)}
                              disabled={isSaving}
                              className="text-[9px] font-mono font-bold px-2 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded hover:bg-orange-500/30 transition-all disabled:opacity-50"
                            >
                              {isSaving ? '...' : 'SET'}
                            </button>
                            <button
                              onClick={() => setEditingRanks((prev) => { const n = { ...prev }; delete n[team.id]; return n; })}
                              className="text-gray-600 hover:text-gray-400"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingRanks((prev) => ({ ...prev, [team.id]: String(team.manualRank ?? '') }))}
                              className="text-[9px] font-mono font-bold px-2 py-0.5 bg-white/[0.03] text-gray-400 border border-white/[0.06] rounded hover:bg-white/[0.06] hover:text-white transition-all"
                            >
                              {hasManual ? 'EDIT' : 'SET'}
                            </button>
                            {hasManual && (
                              <button
                                onClick={() => handleClearRank(team.id)}
                                disabled={isSaving}
                                className="text-[9px] font-mono text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50"
                                title="Remove manual rank"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resolution method legend */}
              <div className="px-4 py-2 border-t border-white/[0.04] bg-white/[0.01]">
                <p className="text-[9px] font-mono text-gray-600">
                  Auto resolved by:{' '}
                  <span className="text-gray-500">
                    {RESOLUTION_LABELS[group.resolutionType === 'auto' ? 'top_criterion' : (group.resolutionType ?? 'auto')]}
                  </span>
                </p>
              </div>
            </div>
          ))
        )}

        {/* Legend */}
        {trackData && trackData.tieGroups.length > 0 && (
          <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg">
            <p className="text-[9px] font-mono text-gray-500 font-bold mb-2">AUTO CASCADE ORDER</p>
            <div className="space-y-1">
              {Object.entries(RESOLUTION_LABELS).filter(([k]) => k !== 'manual').map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${RESOLUTION_COLORS[key]}`}>
                    {key === 'top_criterion' ? 'TOP‑CRIT' : key === 'judge_count' ? 'CONSENSUS' : key === 'submission_time' ? 'EARLIEST' : 'A–Z'}
                  </span>
                  <span className="text-[9px] font-mono text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-amber-400" />
          <p className="text-[9px] font-mono text-gray-500">
            Manual ranks override auto-cascade within the same score band
          </p>
        </div>
      </div>
    </div>
  );
}
