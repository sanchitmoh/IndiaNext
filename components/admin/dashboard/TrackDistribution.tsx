'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface TrackData {
  track: string;
  status: string;
  _count: number;
}

interface TrackDistributionProps {
  data: TrackData[];
}

const TRACK_COLORS: Record<string, string> = {
  IDEA_SPRINT: '#00CCFF',
  BUILD_STORM: '#FF6600',
};

const TRACK_LABELS: Record<string, string> = {
  IDEA_SPRINT: 'Idea Sprint',
  BUILD_STORM: 'Build Storm',
};

export function TrackDistribution({ data }: TrackDistributionProps) {
  // Aggregate by track (since data is grouped by track + status)
  const trackTotals = data.reduce(
    (acc, item) => {
      acc[item.track] = (acc[item.track] || 0) + item._count;
      return acc;
    },
    {} as Record<string, number>
  );

  const chartData = Object.entries(trackTotals).map(([track, count]) => ({
    name: TRACK_LABELS[track] || track,
    value: count,
    color: TRACK_COLORS[track] || '#555',
  }));

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-6">
      <h3 className="text-xs font-mono font-bold text-gray-400 mb-4 tracking-[0.2em] uppercase">
        TRACK_DISTRIBUTION
      </h3>
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-600 text-xs font-mono tracking-widest">
          NO DATA AVAILABLE
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-full sm:w-[55%]">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [Number(value), 'Teams']}
                  contentStyle={{
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    backgroundColor: '#0D0D0D',
                    color: '#fff',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-3">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center gap-3">
                <div
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 8px ${item.color}40` }}
                />
                <div className="flex-1">
                  <div className="text-xs font-mono font-medium text-gray-300">{item.name}</div>
                  <div className="text-[10px] font-mono text-gray-500">
                    {item.value} teams ({total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}
                    %)
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-white/[0.06]">
              <div className="text-xs font-mono font-bold text-gray-300">Total: {total} teams</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
