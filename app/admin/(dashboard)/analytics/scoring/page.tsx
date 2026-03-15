// Scoring Analytics Dashboard — Multi-judge scores, criterion comparison, judge consistency
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import {
  Loader2,
  Award,
  Users,
  AlertTriangle,
  Download,
  TrendingUp,
  ArrowLeft,
  BarChart3,
  Target,
  Scale,
} from 'lucide-react';

interface ScoringAnalytics {
  overview: {
    totalApproved: number;
    scoredTeams: number;
    unscoredTeams: number;
    scoringProgress: number;
    avgScore: number;
    medianScore: number;
    minScore: number;
    maxScore: number;
    totalJudges: number;
  };
  scoreDistribution: { range: string; count: number }[];
  criterionStats: {
    criterionId: string;
    name: string;
    track: string;
    weight: number;
    avgPoints: number;
    minPoints: number;
    maxPoints: number;
    maxPossible: number;
    scoreCount: number;
    stdDev: number;
  }[];
  judgeConsistency: {
    judgeId: string;
    judgeName: string;
    teamsScored: number;
    avgScore: number;
    bias: number;
    leniency: 'lenient' | 'strict' | 'neutral';
    internalStdDev: number;
    scoreRange: { min: number; max: number };
  }[];
  grandMean: number;
  conflicts: {
    total: number;
    threshold: number;
    teams: { teamName: string; teamId: string; maxDiff: number }[];
  };
  leaderboard: {
    top: {
      rank: number;
      teamId: string;
      teamName: string;
      track: string;
      score: number;
      judgeCount: number;
    }[];
    bottom: {
      rank: number;
      teamId: string;
      teamName: string;
      track: string;
      score: number;
      judgeCount: number;
    }[];
    total: number;
  };
}

const _TRACK_COLORS = {
  IDEA_SPRINT: '#00CCFF',
  BUILD_STORM: '#FF6600',
};

const LENIENCY_COLORS = {
  lenient: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  strict: 'text-red-400 bg-red-500/10 border-red-500/20',
  neutral: 'text-gray-400 bg-white/[0.05] border-white/[0.08]',
};

export default function ScoringAnalyticsPage() {
  const [data, setData] = useState<ScoringAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackFilter, setTrackFilter] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = trackFilter ? `?track=${trackFilter}` : '';
      const res = await fetch(`/api/admin/analytics/scoring${params}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error);
      }
    } catch {
      setError('Failed to load scoring analytics');
    } finally {
      setLoading(false);
    }
  }, [trackFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (trackFilter) params.set('track', trackFilter);
      const res = await fetch(`/api/admin/teams/export-scores?${params}`);

      if (format === 'csv') {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scores_${trackFilter || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scores_${trackFilter || 'all'}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // silently fail
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-xs font-mono">
        {error || 'No data available'}
      </div>
    );
  }

  const { overview, scoreDistribution, criterionStats, judgeConsistency, conflicts, leaderboard } =
    data;

  // Prepare radar data for criterion comparison
  const ideaCriteria = criterionStats.filter((c) => c.track === 'IDEA_SPRINT');
  const buildCriteria = criterionStats.filter((c) => c.track === 'BUILD_STORM');
  const radarData = (trackFilter === 'BUILD_STORM' ? buildCriteria : ideaCriteria).map((c) => ({
    criterion: c.name.replace(/&/g, '\n&'),
    average: c.avgPoints,
    max: c.maxPossible,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/analytics"
            className="p-1.5 text-gray-500 hover:text-white rounded-md hover:bg-white/[0.05] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-lg font-mono font-bold text-white">SCORING_ANALYTICS</h2>
            <p className="text-[10px] font-mono text-gray-500 tracking-[0.2em]">
              MULTI-JUDGE ANALYSIS // CRITERION COMPARISON
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Track Filter */}
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            title="Filter by track"
            className="px-3 py-1.5 text-[10px] font-mono bg-white/[0.03] border border-white/[0.08] rounded-md text-gray-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          >
            <option value="">All Tracks</option>
            <option value="IDEA_SPRINT">Idea Sprint</option>
            <option value="BUILD_STORM">Build Storm</option>
          </select>
          {/* Export */}
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md hover:bg-amber-500/20 transition-all disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            {exporting ? 'EXPORTING...' : 'EXPORT CSV'}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider bg-white/[0.03] text-gray-400 border border-white/[0.08] rounded-md hover:bg-white/[0.06] transition-all disabled:opacity-50"
          >
            <Download className="h-3 w-3" />
            JSON
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          label="SCORED"
          value={`${overview.scoredTeams}/${overview.totalApproved}`}
          sub={`${overview.scoringProgress}% complete`}
          icon={<Award className="h-4 w-4" />}
          color="text-amber-400 bg-amber-500/10 border-amber-500/20"
        />
        <MetricCard
          label="AVG_SCORE"
          value={overview.avgScore}
          sub={`median: ${overview.medianScore}`}
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
        />
        <MetricCard
          label="SCORE_RANGE"
          value={`${overview.minScore} - ${overview.maxScore}`}
          sub="min / max"
          icon={<BarChart3 className="h-4 w-4" />}
          color="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        />
        <MetricCard
          label="JUDGES"
          value={overview.totalJudges}
          sub={`${overview.unscoredTeams} unscored`}
          icon={<Users className="h-4 w-4" />}
          color="text-purple-400 bg-purple-500/10 border-purple-500/20"
        />
        <MetricCard
          label="CONFLICTS"
          value={conflicts.total}
          sub={`>${conflicts.threshold}pt diff`}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={
            conflicts.total > 0
              ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : 'text-gray-400 bg-white/[0.05] border-white/[0.08]'
          }
        />
      </div>

      {/* Score Distribution + Criterion Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Distribution Histogram */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
          <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4">
            SCORE_DISTRIBUTION
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#6b7280' }}
                stroke="rgba(255,255,255,0.06)"
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }}
                stroke="rgba(255,255,255,0.06)"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  backgroundColor: '#0D0D0D',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#d1d5db',
                }}
              />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Teams" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Criterion Radar */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
          <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4">
            CRITERION_RADAR // {trackFilter || 'IDEA_SPRINT'}
          </h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis
                  dataKey="criterion"
                  tick={{ fontSize: 8, fontFamily: 'monospace', fill: '#9ca3af' }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 10]}
                  tick={{ fontSize: 8, fontFamily: 'monospace', fill: '#6b7280' }}
                />
                <Radar
                  name="Average"
                  dataKey="average"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.2}
                />
                <Radar
                  name="Max Possible"
                  dataKey="max"
                  stroke="rgba(255,255,255,0.1)"
                  fill="transparent"
                />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-600 text-xs font-mono">
              NO DATA
            </div>
          )}
        </div>
      </div>

      {/* Criterion-Wise Comparison Table */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
        <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-amber-400" />
          CRITERION_COMPARISON
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left py-2 px-3 text-gray-500 font-bold">Criterion</th>
                <th className="text-center py-2 px-3 text-gray-500 font-bold">Track</th>
                <th className="text-center py-2 px-3 text-gray-500 font-bold">Weight</th>
                <th className="text-center py-2 px-3 text-gray-500 font-bold">Avg</th>
                <th className="text-center py-2 px-3 text-gray-500 font-bold">Min</th>
                <th className="text-center py-2 px-3 text-gray-500 font-bold">Max</th>
                <th className="text-center py-2 px-3 text-gray-500 font-bold">σ</th>
                <th className="text-center py-2 px-3 text-gray-500 font-bold">Scores</th>
                <th className="text-right py-2 px-3 text-gray-500 font-bold">Strength</th>
              </tr>
            </thead>
            <tbody>
              {criterionStats.map((c) => {
                const strength = c.maxPossible > 0 ? (c.avgPoints / c.maxPossible) * 100 : 0;
                const trackColor = c.track === 'IDEA_SPRINT' ? 'text-cyan-400' : 'text-orange-400';
                return (
                  <tr
                    key={`${c.track}-${c.criterionId}`}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    <td className="py-2.5 px-3 text-gray-300">{c.name}</td>
                    <td className={`py-2.5 px-3 text-center text-[10px] ${trackColor}`}>
                      {c.track === 'IDEA_SPRINT' ? 'IS' : 'BS'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-400">{c.weight}%</td>
                    <td className="py-2.5 px-3 text-center text-white font-bold">{c.avgPoints}</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">{c.minPoints}</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">{c.maxPoints}</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">{c.stdDev}</td>
                    <td className="py-2.5 px-3 text-center text-gray-500">{c.scoreCount}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-16 bg-white/[0.05] rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-amber-400"
                            style={{ width: `${strength}%` }}
                          />
                        </div>
                        <span className="text-gray-400 w-8 text-right">
                          {Math.round(strength)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Judge Consistency + Conflicts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Judge Consistency */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
          <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
            <Scale className="h-3.5 w-3.5 text-purple-400" />
            JUDGE_CONSISTENCY
          </h3>
          {judgeConsistency.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-600 text-xs font-mono">
              NO JUDGES HAVE SCORED YET
            </div>
          ) : (
            <div className="space-y-3">
              {/* Grand Mean Indicator */}
              <div className="flex items-center gap-2 pb-2 border-b border-white/[0.04]">
                <span className="text-[10px] font-mono text-gray-500">Grand Mean:</span>
                <span className="text-sm font-mono font-bold text-amber-400">{data.grandMean}</span>
              </div>
              {judgeConsistency.map((judge) => (
                <div
                  key={judge.judgeId}
                  className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-mono font-bold text-gray-200">
                        {judge.judgeName}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500 ml-2">
                        ({judge.teamsScored} teams)
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${LENIENCY_COLORS[judge.leniency]}`}
                    >
                      {judge.leniency.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                    <div>
                      <span className="text-gray-500">Avg:</span>{' '}
                      <span className="text-cyan-400">{judge.avgScore}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bias:</span>{' '}
                      <span
                        className={
                          judge.bias > 0
                            ? 'text-emerald-400'
                            : judge.bias < 0
                              ? 'text-red-400'
                              : 'text-gray-400'
                        }
                      >
                        {judge.bias > 0 ? '+' : ''}
                        {judge.bias}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">σ:</span>{' '}
                      <span className="text-gray-400">{judge.internalStdDev}</span>
                    </div>
                  </div>
                  {/* Score range bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[9px] font-mono text-gray-600">
                      {judge.scoreRange.min}
                    </span>
                    <div className="flex-1 bg-white/[0.05] rounded-full h-1.5 relative">
                      <div
                        className="absolute h-1.5 rounded-full bg-purple-400/40"
                        style={{
                          left: `${judge.scoreRange.min}%`,
                          width: `${judge.scoreRange.max - judge.scoreRange.min}%`,
                        }}
                      />
                      <div
                        className="absolute w-1.5 h-1.5 rounded-full bg-purple-400 top-0"
                        style={{ left: `${judge.avgScore}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-gray-600">
                      {judge.scoreRange.max}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conflicts */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
          <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            SCORING_CONFLICTS ({conflicts.total})
          </h3>
          {conflicts.total === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl mb-2">✓</div>
                <p className="text-xs font-mono text-emerald-400">NO CONFLICTS DETECTED</p>
                <p className="text-[10px] font-mono text-gray-600 mt-1">
                  All scores within {conflicts.threshold}pt threshold
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {conflicts.teams.map((team) => (
                <Link
                  key={team.teamId}
                  href={`/admin/teams/${team.teamId}`}
                  className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/10 rounded-lg hover:bg-red-500/10 transition-all group"
                >
                  <div>
                    <span className="text-xs font-mono text-gray-200 group-hover:text-white">
                      {team.teamName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-red-400 font-bold">
                      Δ {team.maxDiff}pt
                    </span>
                    <AlertTriangle className="h-3 w-3 text-red-400/60" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Teams */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
          <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            TOP_TEAMS
          </h3>
          <div className="space-y-1">
            {leaderboard.top.map((team) => (
              <Link
                key={team.teamId}
                href={`/admin/teams/${team.teamId}`}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-white/[0.03] transition-all group"
              >
                <span
                  className={`text-sm font-mono font-bold w-6 text-center ${
                    team.rank <= 3 ? 'text-amber-400' : 'text-gray-500'
                  }`}
                >
                  #{team.rank}
                </span>
                <span className="text-xs font-mono text-gray-300 flex-1 group-hover:text-white truncate">
                  {team.teamName}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    team.track === 'IDEA_SPRINT'
                      ? 'text-cyan-400 bg-cyan-500/10'
                      : 'text-orange-400 bg-orange-500/10'
                  }`}
                >
                  {team.track === 'IDEA_SPRINT' ? 'IS' : 'BS'}
                </span>
                <span className="text-xs font-mono text-gray-500">{team.judgeCount}J</span>
                <span className="text-sm font-mono font-bold text-emerald-400 w-12 text-right">
                  {team.score}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom Teams */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
          <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-red-400" />
            NEEDS_IMPROVEMENT
          </h3>
          <div className="space-y-1">
            {leaderboard.bottom.map((team) => (
              <Link
                key={team.teamId}
                href={`/admin/teams/${team.teamId}`}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-white/[0.03] transition-all group"
              >
                <span className="text-sm font-mono font-bold w-6 text-center text-gray-600">
                  #{team.rank}
                </span>
                <span className="text-xs font-mono text-gray-400 flex-1 group-hover:text-white truncate">
                  {team.teamName}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    team.track === 'IDEA_SPRINT'
                      ? 'text-cyan-400 bg-cyan-500/10'
                      : 'text-orange-400 bg-orange-500/10'
                  }`}
                >
                  {team.track === 'IDEA_SPRINT' ? 'IS' : 'BS'}
                </span>
                <span className="text-xs font-mono text-gray-500">{team.judgeCount}J</span>
                <span className="text-sm font-mono font-bold text-red-400 w-12 text-right">
                  {team.score}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tie Analytics ──────────────────────────────────── */}
      <TieAnalyticsSection />

      {/* Scoring Progress */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
        <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-3">
          SCORING_PROGRESS
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-white/[0.05] rounded-full h-4">
            <div
              className="bg-gradient-to-r from-amber-500 to-emerald-500 h-4 rounded-full transition-all relative"
              style={{ width: `${overview.scoringProgress}%` }}
            >
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-black">
                {overview.scoringProgress}%
              </span>
            </div>
          </div>
          <span className="text-xs font-mono text-gray-400 whitespace-nowrap">
            {overview.scoredTeams} / {overview.totalApproved} teams
          </span>
        </div>
      </div>
    </div>
  );
}


// ── Metric Card ──────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-3 md:p-4">
      <div className={`inline-flex p-1.5 rounded-md border ${color} mb-2`}>{icon}</div>
      <div className="text-base md:text-lg font-mono font-bold text-white">{value}</div>
      <div className="text-[9px] font-mono font-bold text-gray-500 tracking-[0.15em] uppercase mt-0.5">
        {label}
      </div>
      <div className="text-[9px] font-mono text-gray-600 mt-0.5">{sub}</div>
    </div>
  );
}

// ── Tie Analytics Section ─────────────────────────────────

function TieAnalyticsSection() {
  const [data, setData] = useState<{
    ideasprint: { totalTies: number; tieGroups: { score: number; teams: { id: string; name: string; manualRank: number | null }[]; resolutionType: 'manual' | 'auto' | null }[]; manualResolved: number; autoResolved: number; totalTeams: number; scoredTeams: number };
    buildstorm: { totalTies: number; tieGroups: { score: number; teams: { id: string; name: string; manualRank: number | null }[]; resolutionType: 'manual' | 'auto' | null }[]; manualResolved: number; autoResolved: number; totalTeams: number; scoredTeams: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/analytics/tie-analytics')
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 flex items-center gap-2">
      <div className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
      <span className="text-[10px] font-mono text-gray-600">Loading tie analytics…</span>
    </div>
  );

  if (!data) return null;

  const tracks = [
    { key: 'ideasprint' as const, label: 'IDEA_SPRINT', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
    { key: 'buildstorm' as const, label: 'BUILD_STORM', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  ];

  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase">
          TIE_ANALYTICS
        </h3>
        <a
          href="/admin/teams"
          className="text-[9px] font-mono text-amber-400 hover:text-amber-300 border border-amber-500/20 bg-amber-500/10 px-2 py-1 rounded transition-colors"
        >
          OPEN TIEBREAKER →
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {tracks.map((t) => {
          const d = data[t.key];
          return (
            <div key={t.key} className={`rounded-lg border ${t.border} ${t.bg} p-3 space-y-3`}>
              <p className={`text-[9px] font-mono font-bold tracking-widest ${t.color}`}>{t.label}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-mono font-bold text-amber-400">{d.totalTies}</div>
                  <div className="text-[8px] font-mono text-gray-600">TIED</div>
                </div>
                <div>
                  <div className="text-lg font-mono font-bold text-emerald-400">{d.autoResolved}</div>
                  <div className="text-[8px] font-mono text-gray-600">AUTO</div>
                </div>
                <div>
                  <div className="text-lg font-mono font-bold text-orange-400">{d.manualResolved}</div>
                  <div className="text-[8px] font-mono text-gray-600">MANUAL</div>
                </div>
              </div>

              {d.tieGroups.length > 0 && (
                <div className="space-y-1.5">
                  {d.tieGroups.slice(0, 3).map((g, gi) => (
                    <div key={gi} className="flex items-center justify-between bg-black/20 rounded px-2 py-1">
                      <span className="text-[9px] font-mono text-gray-400">{g.teams.length} teams @ {g.score.toFixed(1)}</span>
                      <span className={`text-[8px] font-mono font-bold ${g.resolutionType === 'manual' ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {g.resolutionType === 'manual' ? '🔒 MANUAL' : '⚡ AUTO'}
                      </span>
                    </div>
                  ))}
                  {d.tieGroups.length > 3 && (
                    <p className="text-[8px] font-mono text-gray-600 text-center">+{d.tieGroups.length - 3} more groups</p>
                  )}
                </div>
              )}

              {d.tieGroups.length === 0 && (
                <p className="text-[9px] font-mono text-gray-600 text-center">No ties detected</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
