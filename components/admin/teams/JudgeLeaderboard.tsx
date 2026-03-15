'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import {
  Trophy,
  Medal,
  Crown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Users,
  BarChart3,
} from 'lucide-react';

type Track = 'IDEA_SPRINT' | 'BUILD_STORM';

const TRACK_CONFIG = {
  IDEA_SPRINT: {
    label: 'Idea Sprint',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    activeBorder: 'border-b-2 border-cyan-500',
    bar: 'bg-cyan-500',
  },
  BUILD_STORM: {
    label: 'Build Storm',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    activeBorder: 'border-b-2 border-orange-500',
    bar: 'bg-orange-500',
  },
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/30 shrink-0">
        <Trophy className="h-4 w-4 text-amber-400" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-400/20 border border-gray-400/30 shrink-0">
        <Medal className="h-4 w-4 text-gray-300" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/20 border border-amber-700/30 shrink-0">
        <Medal className="h-4 w-4 text-amber-600" />
      </div>
    );
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] shrink-0">
      <span className="text-[11px] font-mono font-bold text-gray-500">#{rank}</span>
    </div>
  );
}

export function JudgeLeaderboard() {
  const router = useRouter();
  const [track, setTrack] = useState<Track>('IDEA_SPRINT');
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.admin.getLeaderboard.useQuery(
    { track, page, pageSize: 25 },
    { refetchInterval: 60_000 }
  );

  const cfg = TRACK_CONFIG[track];
  const maxScore = data?.teams[0]?.calculatedScore || 100;

  return (
    <div className="space-y-4">
      {/* Track Tabs */}
      <div className="flex border-b border-white/[0.06] bg-[#0A0A0A] rounded-t-lg overflow-hidden">
        {(['IDEA_SPRINT', 'BUILD_STORM'] as Track[]).map((t) => {
          const c = TRACK_CONFIG[t];
          const isActive = track === t;
          return (
            <button
              key={t}
              onClick={() => { setTrack(t); setPage(1); }}
              className={`flex-1 py-3 text-[11px] font-mono font-bold tracking-wider transition-all flex items-center justify-center gap-2 ${
                isActive ? `${c.color} ${c.activeBorder} ${c.bg}` : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              {c.label.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between px-4">
        <div>
          <h3 className={`text-sm font-mono font-bold ${cfg.color}`}>
            {cfg.label.toUpperCase()}_LEADERBOARD
          </h3>
          <p className="text-[10px] font-mono text-gray-600 mt-0.5">
            {data ? `${data.totalCount} teams ranked` : 'Loading…'}
          </p>
        </div>
        <div className={`text-[9px] font-mono font-bold px-2 py-1 rounded border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
          RANKED_BY_SCORE
        </div>
      </div>

      {/* Leaderboard list */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          </div>
        ) : !data?.teams.length ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <BarChart3 className="h-8 w-8 text-gray-700 mb-2" />
            <p className="text-xs font-mono text-gray-600">NO TEAMS SCORED YET</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {data.teams.map((team) => {
              const leader = team.members?.find((m) => m.role === 'LEADER');
              const scorePercent = maxScore > 0 ? (team.calculatedScore / maxScore) * 100 : 0;
              const hasManualRank = team.rank !== null;

              return (
                <div
                  key={team.id}
                  className={`flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer group ${
                    team.finalRank <= 3 ? 'bg-gradient-to-r from-amber-500/[0.03] to-transparent' : ''
                  }`}
                  onClick={() => router.push(`/admin/teams/${team.id}`)}
                >
                  <RankBadge rank={team.finalRank} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">
                        {team.name}
                      </span>
                      {hasManualRank && (
                        <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 shrink-0">
                          🔒 MANUAL #{team.rank}
                        </span>
                      )}
                      {team.tieResolutionMethod && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-600 border border-white/[0.06] shrink-0">
                          Tie: {team.tieResolutionMethod.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    {leader && (
                      <div className="flex items-center gap-1 mb-1.5">
                        <Crown className="h-2.5 w-2.5 text-orange-500 shrink-0" />
                        <span className="text-[10px] font-mono text-gray-500 truncate">
                          {leader.user.name || 'Unknown'}
                        </span>
                      </div>
                    )}
                    {/* Score bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/[0.05] rounded-full h-1.5 max-w-[140px]">
                        <div
                          className={`h-1.5 rounded-full ${cfg.bar} transition-all`}
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-mono ${cfg.color}`}>
                        {team.calculatedScore.toFixed(1)}
                      </span>
                      <span className="text-[9px] font-mono text-gray-600">
                        {team.judgeCount}J
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-lg font-mono font-bold ${team.finalRank <= 3 ? 'text-amber-400' : cfg.color}`}>
                      {team.calculatedScore.toFixed(1)}
                    </div>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <Users className="h-3 w-3 text-gray-600" />
                      <span className="text-[9px] font-mono text-gray-600">{team.members?.length || 0}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-[10px] font-mono text-gray-600">
              {(page - 1) * 25 + 1}–{Math.min(page * 25, data.totalCount)} of {data.totalCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[10px] font-mono text-gray-500 px-1">
                {page} / {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unscored warning */}
      {data && data.totalCount === 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-[10px] font-mono text-amber-400">
            No teams have been scored yet in this track. Start scoring from a team&apos;s detail page.
          </p>
        </div>
      )}
    </div>
  );
}
