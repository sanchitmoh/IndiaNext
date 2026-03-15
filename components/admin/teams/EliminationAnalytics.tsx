'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc-client';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  BarChart3,
  TrendingUp,
  Users,
  User,
} from 'lucide-react';

type TrackStats = { total: number; qualified: number; eliminated: number; pending: number };
type RoundStats = { all: TrackStats; ideaSprint: TrackStats; buildStorm: TrackStats };

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: number; icon: typeof CheckCircle2; color: string; sub?: string }) {
  return (
    <div className={`bg-[#0A0A0A] border rounded-lg p-4 ${
      color.includes('emerald') ? 'border-emerald-500/15' : color.includes('red') ? 'border-red-500/15' : color.includes('amber') ? 'border-amber-500/15' : 'border-white/[0.06]'
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-2xl font-mono font-black ${color}`}>{value}</p>
          <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">{label}</p>
          {sub && <p className="text-[9px] font-mono text-gray-700 mt-1">{sub}</p>}
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          color.includes('emerald') ? 'bg-emerald-500/10' : color.includes('red') ? 'bg-red-500/10' : color.includes('amber') ? 'bg-amber-500/10' : 'bg-white/[0.03]'
        }`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function RoundBlock({ label, data }: { label: string; data: RoundStats }) {
  const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-mono font-bold text-gray-400 tracking-widest">{label}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="TOTAL" value={data.all.total} icon={Users} color="text-gray-300" />
        <StatCard label="PENDING" value={data.all.pending} icon={Clock} color="text-amber-400" sub={`${pct(data.all.pending, data.all.total)}% unactioned`} />
        <StatCard label="QUALIFIED" value={data.all.qualified} icon={CheckCircle2} color="text-emerald-400" sub={`${pct(data.all.qualified, data.all.total)}% advance`} />
        <StatCard label="ELIMINATED" value={data.all.eliminated} icon={XCircle} color="text-red-400" sub={`${pct(data.all.eliminated, data.all.total)}% out`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: '💡 IDEA SPRINT', stats: data.ideaSprint, color: 'text-cyan-400' },
          { label: '⚡ BUILD STORM', stats: data.buildStorm, color: 'text-orange-400' },
        ].map(({ label: tLabel, stats, color }) => (
          <div key={tLabel} className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg p-4">
            <p className={`text-[10px] font-mono font-bold ${color} mb-3`}>{tLabel}</p>
            <div className="space-y-2">
              {[{ l: 'Qualified', v: stats.qualified, c: 'bg-emerald-500' }, { l: 'Eliminated', v: stats.eliminated, c: 'bg-red-500' }, { l: 'Pending', v: stats.pending, c: 'bg-amber-500/50' }].map(({ l, v, c }) => (
                <div key={l} className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-gray-500 w-20 shrink-0">{l}</span>
                  <div className="flex-1 h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                    <div className={`h-full ${c} rounded-full transition-all duration-500`} style={{ width: `${pct(v, stats.total)}%` }} />
                  </div>
                  <span className="text-[9px] font-mono font-bold text-gray-400 w-6 text-right">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-[8px] font-mono text-gray-700 mt-2">Total: {stats.total} teams</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Per-team attribution table — shows which judge actioned each team
function AttributionTable({ round }: { round: '1' | '2' }) {
  const [search, setSearch] = useState('');
  const { data: teams, isLoading } = trpc.admin.getRoundTeams.useQuery(
    { round, track: 'all', status: 'all' },
    { refetchInterval: 20_000 }
  );

  const filtered = useMemo(() => {
    if (!teams) return [];
    const q = search.toLowerCase();
    return teams.filter(t =>
      !q || t.name.toLowerCase().includes(q) || t.shortCode.toLowerCase().includes(q)
    );
  }, [teams, search]);

  const statusBadge = (status: string) => {
    if (status === 'QUALIFIED') return <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">✅ QUALIFIED</span>;
    if (status === 'ELIMINATED') return <span className="text-[9px] font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">❌ ELIMINATED</span>;
    return <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">⏳ PENDING</span>;
  };

  const roundKey = round === '1' ? 'round1Status' : 'round2Status';
  const nameKey = round === '1' ? 'round1ActionName' : 'round2ActionName';
  const atKey = round === '1' ? 'round1ActionAt' : 'round2ActionAt';

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin text-emerald-500 mx-auto" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono font-bold text-gray-400 tracking-widest flex items-center gap-2">
          <User className="h-3.5 w-3.5" />
          ROUND {round} — TEAM ATTRIBUTION
        </p>
        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
          className="px-2.5 py-1 text-[10px] font-mono bg-[#0A0A0A] border border-white/[0.06] rounded-lg text-gray-300 placeholder:text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 w-40" />
      </div>
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="text-left py-2 px-3 text-gray-500 font-normal">TEAM</th>
              <th className="text-left py-2 px-3 text-gray-500 font-normal">TRACK</th>
              <th className="text-left py-2 px-3 text-gray-500 font-normal">STATUS</th>
              <th className="text-left py-2 px-3 text-gray-500 font-normal">JUDGE</th>
              <th className="text-left py-2 px-3 text-gray-500 font-normal">TIME</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => {
              const status = (t as any)[roundKey] as string;
              const judgeName = (t as any)[nameKey] as string | null;
              const actionAt = (t as any)[atKey] as Date | string | null;
              return (
                <tr key={t.id} className={`border-b border-white/[0.03] ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.01]'} hover:bg-white/[0.03]`}>
                  <td className="py-2 px-3">
                    <span className="text-white font-bold">{t.name}</span>
                    <span className="text-gray-600 ml-1.5">({t.shortCode})</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={t.track === 'IDEA_SPRINT' ? 'text-cyan-400' : 'text-orange-400'}>
                      {t.track === 'IDEA_SPRINT' ? 'Idea Sprint' : 'Build Storm'}
                    </span>
                  </td>
                  <td className="py-2 px-3">{statusBadge(status)}</td>
                  <td className="py-2 px-3">
                    {judgeName
                      ? <span className="text-emerald-400 font-bold">{judgeName}</span>
                      : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="py-2 px-3 text-gray-600">
                    {actionAt ? new Date(actionAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-gray-700">No teams found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EliminationAnalytics() {
  const [attrRound, setAttrRound] = useState<'1' | '2'>('1');

  const { data, isLoading } = trpc.admin.getRoundAnalytics.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
    </div>
  );
  if (!data) return null;

  const totalProgress = data.round1.all.total > 0
    ? Math.round(((data.round1.all.qualified + data.round1.all.eliminated) / data.round1.all.total) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-4 w-4 text-violet-400" />
        <h2 className="text-xs font-mono font-bold text-gray-400 tracking-widest">ELIMINATION ANALYTICS</h2>
        <span className="text-[9px] font-mono text-gray-600 ml-auto">Round 1 completion: {totalProgress}%</span>
      </div>

      {/* Overall progress bar */}
      <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[10px] font-mono font-bold text-gray-300">OVERALL ELIMINATION PROGRESS</span>
        </div>
        <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden flex mb-2">
          <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${data.round1.all.total > 0 ? (data.round1.all.qualified / data.round1.all.total) * 100 : 0}%` }} />
          <div className="h-full bg-red-500/80 transition-all duration-700" style={{ width: `${data.round1.all.total > 0 ? (data.round1.all.eliminated / data.round1.all.total) * 100 : 0}%` }} />
          <div className="h-full bg-amber-500/40 transition-all duration-700" style={{ width: `${data.round1.all.total > 0 ? (data.round1.all.pending / data.round1.all.total) * 100 : 0}%` }} />
        </div>
        <div className="flex items-center gap-5">
          <span className="text-[9px] font-mono text-emerald-500 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />Qualified: {data.round1.all.qualified}</span>
          <span className="text-[9px] font-mono text-red-500 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Eliminated: {data.round1.all.eliminated}</span>
          <span className="text-[9px] font-mono text-amber-500 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/40 inline-block" />Pending: {data.round1.all.pending}</span>
        </div>
      </div>

      {/* Round breakdowns */}
      <RoundBlock label="ROUND 1 — INITIAL ELIMINATION" data={data.round1} />
      <RoundBlock label="ROUND 2 — FINAL ELIMINATION" data={data.round2} />

      {/* Per-team attribution table */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-mono font-bold text-gray-400 tracking-widest">TEAM-WISE JUDGE ATTRIBUTION</h3>
          <div className="flex items-center gap-1 ml-auto">
            {(['1', '2'] as const).map(r => (
              <button key={r} onClick={() => setAttrRound(r)}
                className={`px-2.5 py-1 text-[9px] font-mono font-bold rounded border transition-all ${attrRound === r ? 'bg-violet-500/20 text-violet-300 border-violet-500/30' : 'text-gray-600 border-white/[0.08] hover:text-gray-300'}`}>
                ROUND {r}
              </button>
            ))}
          </div>
        </div>
        <AttributionTable round={attrRound} />
      </div>
    </div>
  );
}
