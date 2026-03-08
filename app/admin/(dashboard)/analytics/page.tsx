// Analytics Page — Registration trends, track comparison, college stats
'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc-client';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Loader2,
  TrendingUp,
  Users,
  Building2,
  PieChart as PieChartIcon,
  Award,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  UNDER_REVIEW: '#00CCFF',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  WAITLISTED: '#FF6600',
  WITHDRAWN: '#6b7280',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  WAITLISTED: 'Waitlisted',
  WITHDRAWN: 'Withdrawn',
};

const _TRACK_COLORS: Record<string, string> = {
  IDEA_SPRINT: '#00CCFF',
  BUILD_STORM: '#FF6600',
};

const TRACK_LABELS: Record<string, string> = {
  IDEA_SPRINT: 'Idea Sprint',
  BUILD_STORM: 'Build Storm',
};

export default function AnalyticsPage() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.getStats.useQuery();
  const { data: analytics, isLoading: analyticsLoading } = trpc.admin.getAnalytics.useQuery();

  if (statsLoading || analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  // ── Prepare chart data ────────────────────────────────

  // Registration trends
  const trendData = (analytics?.registrationTrends || []).map(
    (item: { date: string | Date; count: number }) => ({
      date: new Date(String(item.date)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      count: item.count,
    })
  );

  // Status breakdown for pie chart
  const statsData = stats?.data;
  const statusData = statsData
    ? [
        { name: 'Pending', value: statsData.pendingTeams, color: STATUS_COLORS.PENDING },
        {
          name: 'Under Review',
          value: statsData.underReviewTeams,
          color: STATUS_COLORS.UNDER_REVIEW,
        },
        { name: 'Approved', value: statsData.approvedTeams, color: STATUS_COLORS.APPROVED },
        { name: 'Rejected', value: statsData.rejectedTeams, color: STATUS_COLORS.REJECTED },
        { name: 'Waitlisted', value: statsData.waitlistedTeams, color: STATUS_COLORS.WAITLISTED },
      ].filter((d) => d.value > 0)
    : [];

  // Track + Status grouped data for stacked bar
  const trackStatusMap: Record<string, Record<string, number>> = {};
  (analytics?.trackComparison || []).forEach(
    (item: { track: string; status: string; _count: number }) => {
      const trackLabel = TRACK_LABELS[item.track] || item.track;
      if (!trackStatusMap[trackLabel]) trackStatusMap[trackLabel] = {};
      trackStatusMap[trackLabel][STATUS_LABELS[item.status] || item.status] = item._count;
    }
  );
  const trackStatusData = Object.entries(trackStatusMap).map(([track, statuses]) => ({
    track,
    ...statuses,
  }));
  const allStatuses = [
    ...new Set(
      (analytics?.trackComparison || []).map(
        (item: { status: string }) => STATUS_LABELS[item.status] || item.status
      )
    ),
  ];

  // College distribution
  const collegeData = (analytics?.collegeDistribution || [])
    .slice(0, 10)
    .map((item: { college: string | null; _count: number }) => ({
      name: item.college ?? 'Unknown',
      count: item._count,
    }));

  // Team size distribution
  const sizeData = (analytics?.teamSizeDistribution || []).map(
    (item: { size: number; _count: number }) => ({
      size: `${item.size} member${item.size !== 1 ? 's' : ''}`,
      count: item._count,
    })
  );

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="TOTAL_TEAMS"
            value={statsData.totalTeams}
            icon={<Users className="h-4 w-4" />}
            color="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
          />
          <MetricCard
            label="APPROVAL_RATE"
            value={`${statsData.approvalRate.toFixed(1)}%`}
            icon={<TrendingUp className="h-4 w-4" />}
            color="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
          />
          <MetricCard
            label="AVG_REVIEW_TIME"
            value={`${statsData.avgReviewTime} hrs`}
            icon={<PieChartIcon className="h-4 w-4" />}
            color="text-orange-400 bg-orange-500/10 border-orange-500/20"
          />
          <MetricCard
            label="NEW_THIS_WEEK"
            value={statsData.newTeamsThisWeek}
            icon={<Building2 className="h-4 w-4" />}
            color="text-amber-400 bg-amber-500/10 border-amber-500/20"
          />
        </div>
      )}

      {/* Registration Trends — Full Width */}
      {/* Scoring Analytics Quick Link */}
      <Link
        href="/admin/analytics/scoring"
        className="block bg-[#0A0A0A] rounded-lg border border-amber-500/20 hover:border-amber-500/40 p-4 md:p-5 transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex p-2 rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-mono font-bold text-white group-hover:text-amber-400 transition-colors">
                SCORING_ANALYTICS
              </h3>
              <p className="text-[10px] font-mono text-gray-500 tracking-[0.15em]">
                MULTI-JUDGE SCORES // CRITERION COMPARISON // JUDGE CONSISTENCY // EXPORT CSV
              </p>
            </div>
          </div>
          <TrendingUp className="h-5 w-5 text-gray-600 group-hover:text-amber-400 transition-colors" />
        </div>
      </Link>

      {/* Registration Trends — Full Width */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
        <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4">
          REGISTRATION_TRENDS // LAST 30 DAYS
        </h3>
        {trendData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-gray-600 text-xs font-mono tracking-widest">
            NO DATA AVAILABLE
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6600" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#FF6600" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }}
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
              <Area
                type="monotone"
                dataKey="count"
                stroke="#FF6600"
                strokeWidth={2}
                fill="url(#colorTrend)"
                name="Registrations"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Status Breakdown + Track Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown Pie */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
          <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4">
            STATUS_BREAKDOWN
          </h3>
          {statusData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-600 text-xs font-mono tracking-widest">
              NO DATA
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-[55%]">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [Number(value), 'Teams']}
                      contentStyle={{
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        backgroundColor: '#0D0D0D',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#d1d5db',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {statusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[11px] font-mono text-gray-400 flex-1">{item.name}</span>
                    <span className="text-[11px] font-mono font-bold text-gray-200">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Track vs Status Stacked Bar */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
          <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4">
            TRACK_X_STATUS
          </h3>
          {trackStatusData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-600 text-xs font-mono tracking-widest">
              NO DATA
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trackStatusData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }}
                  stroke="rgba(255,255,255,0.06)"
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="track"
                  width={90}
                  tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#9ca3af' }}
                  stroke="rgba(255,255,255,0.06)"
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
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
                {allStatuses.map((status) => {
                  const originalKey = Object.keys(STATUS_LABELS).find(
                    (k) => STATUS_LABELS[k] === status
                  );
                  return (
                    <Bar
                      key={String(status)}
                      dataKey={String(status)}
                      stackId="a"
                      fill={originalKey ? STATUS_COLORS[originalKey] : '#4b5563'}
                    />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* College Distribution + Team Size */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* College Distribution */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
          <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4">
            TOP_COLLEGES
          </h3>
          {collegeData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-600 text-xs font-mono tracking-widest">
              NO DATA
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={collegeData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }}
                  stroke="rgba(255,255,255,0.06)"
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 9, fontFamily: 'monospace', fill: '#9ca3af' }}
                  stroke="rgba(255,255,255,0.06)"
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
                <Bar dataKey="count" fill="#FF6600" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Team Size Distribution */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
          <h3 className="text-xs font-mono font-bold text-gray-400 tracking-[0.2em] uppercase mb-4">
            TEAM_SIZE_DISTRIBUTION
          </h3>
          {sizeData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-600 text-xs font-mono tracking-widest">
              NO DATA
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sizeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="size"
                  tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#6b7280' }}
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
                <Bar dataKey="count" fill="#00CCFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Metric Card Component ───────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-3 md:p-5">
      <div className={`inline-flex p-2 rounded-md border ${color} mb-2 md:mb-3`}>{icon}</div>
      <div className="text-lg md:text-xl font-mono font-bold text-white">{value}</div>
      <div className="text-[9px] font-mono font-bold text-gray-500 tracking-[0.2em] uppercase mt-1">
        {label}
      </div>
    </div>
  );
}
