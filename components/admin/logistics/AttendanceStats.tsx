// AttendanceStats — Stats cards for logistics dashboard
'use client';

import { CheckCircle2, XCircle, Clock, AlertTriangle, Users, BarChart3 } from 'lucide-react';

interface StatsData {
  totalApproved: number;
  present: number;
  absent: number;
  partial: number;
  notMarked: number;
  totalMembers: number;
  membersPresent: number;
  attendanceRate: number;
}

export function AttendanceStats({ stats }: { stats: StatsData }) {
  const cards = [
    {
      label: 'TOTAL TEAMS',
      value: stats.totalApproved,
      icon: Users,
      color: 'text-gray-300',
      bgColor: 'bg-white/[0.03]',
      borderColor: 'border-white/[0.06]',
    },
    {
      label: 'PRESENT',
      value: stats.present,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/5',
      borderColor: 'border-emerald-500/15',
    },
    {
      label: 'ABSENT',
      value: stats.absent,
      icon: XCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/5',
      borderColor: 'border-red-500/15',
    },
    {
      label: 'PARTIAL',
      value: stats.partial,
      icon: AlertTriangle,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/5',
      borderColor: 'border-amber-500/15',
    },
    {
      label: 'UNMARKED',
      value: stats.notMarked,
      icon: Clock,
      color: 'text-gray-400',
      bgColor: 'bg-white/[0.02]',
      borderColor: 'border-white/[0.06]',
    },
    {
      label: 'ATTENDANCE',
      value: `${stats.attendanceRate}%`,
      subValue: `${stats.membersPresent}/${stats.totalMembers} members`,
      icon: BarChart3,
      color:
        stats.attendanceRate >= 80
          ? 'text-emerald-400'
          : stats.attendanceRate >= 50
            ? 'text-amber-400'
            : 'text-red-400',
      bgColor:
        stats.attendanceRate >= 80
          ? 'bg-emerald-500/5'
          : stats.attendanceRate >= 50
            ? 'bg-amber-500/5'
            : 'bg-red-500/5',
      borderColor:
        stats.attendanceRate >= 80
          ? 'border-emerald-500/15'
          : stats.attendanceRate >= 50
            ? 'border-amber-500/15'
            : 'border-red-500/15',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`rounded-lg border ${card.bgColor} ${card.borderColor} p-3`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`h-3.5 w-3.5 ${card.color}`} />
              <span className="text-[8px] font-mono font-bold text-gray-500 tracking-widest">
                {card.label}
              </span>
            </div>
            <p className={`text-xl font-mono font-bold ${card.color}`}>{card.value}</p>
            {'subValue' in card && card.subValue && (
              <p className="text-[8px] font-mono text-gray-600 mt-0.5">{card.subValue}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
