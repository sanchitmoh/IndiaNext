'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RegistrationChartProps {
  data: Array<{ date: string; count: number }>;
}

export function RegistrationChart({ data }: RegistrationChartProps) {
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    count: item.count,
  }));

  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
      <h3 className="text-xs font-mono font-bold text-gray-400 mb-4 tracking-[0.2em] uppercase">
        REGISTRATION_TRENDS
      </h3>
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-600 text-xs font-mono tracking-widest">
          NO DATA AVAILABLE
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF6600" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#FF6600" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#555', fontFamily: 'monospace' }}
              stroke="rgba(255,255,255,0.06)"
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#555', fontFamily: 'monospace' }}
              stroke="rgba(255,255,255,0.06)"
              allowDecimals={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.06)',
                backgroundColor: '#0D0D0D',
                color: '#fff',
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
              labelStyle={{ fontWeight: 700, color: '#FF6600' }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#FF6600"
              strokeWidth={2}
              fill="url(#colorCount)"
              name="Registrations"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
