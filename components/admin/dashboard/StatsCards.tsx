'use client';

import {
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  UserCheck,
  Timer,
} from 'lucide-react';
import { AnimatedCard } from '@/components/animations';

interface Stats {
  totalTeams: number;
  pendingTeams: number;
  approvedTeams: number;
  rejectedTeams: number;
  waitlistedTeams: number;
  underReviewTeams: number;
  totalUsers: number;
  newTeamsToday: number;
  newTeamsThisWeek: number;
  approvalRate: number;
  avgReviewTime: number;
}

const statCards = [
  {
    key: 'totalTeams',
    label: 'TOTAL TEAMS',
    icon: Users,
    accent: 'text-cyan-400',
    glow: 'shadow-[0_0_15px_rgba(0,204,255,0.08)]',
    border: 'border-cyan-500/10',
    iconBg: 'bg-cyan-500/10',
  },
  {
    key: 'pendingTeams',
    label: 'PENDING',
    icon: Clock,
    accent: 'text-amber-400',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.08)]',
    border: 'border-amber-500/10',
    iconBg: 'bg-amber-500/10',
  },
  {
    key: 'approvedTeams',
    label: 'APPROVED',
    icon: CheckCircle,
    accent: 'text-emerald-400',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.08)]',
    border: 'border-emerald-500/10',
    iconBg: 'bg-emerald-500/10',
  },
  {
    key: 'rejectedTeams',
    label: 'REJECTED',
    icon: XCircle,
    accent: 'text-red-400',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.08)]',
    border: 'border-red-500/10',
    iconBg: 'bg-red-500/10',
  },
  {
    key: 'underReviewTeams',
    label: 'UNDER REVIEW',
    icon: Eye,
    accent: 'text-blue-400',
    glow: 'shadow-[0_0_15px_rgba(96,165,250,0.08)]',
    border: 'border-blue-500/10',
    iconBg: 'bg-blue-500/10',
  },
  {
    key: 'waitlistedTeams',
    label: 'WAITLISTED',
    icon: AlertTriangle,
    accent: 'text-orange-400',
    glow: 'shadow-[0_0_15px_rgba(255,102,0,0.08)]',
    border: 'border-orange-500/10',
    iconBg: 'bg-orange-500/10',
  },
  {
    key: 'totalUsers',
    label: 'PARTICIPANTS',
    icon: UserCheck,
    accent: 'text-purple-400',
    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.08)]',
    border: 'border-purple-500/10',
    iconBg: 'bg-purple-500/10',
  },
  {
    key: 'avgReviewTime',
    label: 'AVG REVIEW',
    icon: Timer,
    accent: 'text-teal-400',
    glow: 'shadow-[0_0_15px_rgba(45,212,191,0.08)]',
    border: 'border-teal-500/10',
    iconBg: 'bg-teal-500/10',
    suffix: ' hrs',
  },
] as const;

export function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((card) => {
        const Icon = card.icon;
        const value = stats[card.key as keyof Stats];
        const displayValue = 'suffix' in card && card.suffix ? `${value}${card.suffix}` : value;

        return (
          <AnimatedCard
            key={card.key}
            className={`bg-[#0A0A0A] rounded-lg border ${card.border} p-5 ${card.glow} hover:bg-[#0D0D0D] transition-all group`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-md ${card.iconBg}`}>
                <Icon className={`h-4 w-4 ${card.accent}`} />
              </div>
              {card.key === 'pendingTeams' && stats.pendingTeams > 0 && (
                <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold tracking-wider">
                  NEEDS REVIEW
                </span>
              )}
            </div>
            <div className="text-2xl font-black text-white font-mono tabular-nums">
              {displayValue}
            </div>
            <div className="text-[10px] font-mono text-gray-500 mt-1.5 tracking-[0.2em] font-bold">
              {card.label}
            </div>
            {card.key === 'totalTeams' && stats.newTeamsToday > 0 && (
              <div className="text-[10px] font-mono text-emerald-400/70 mt-2 tracking-wider">
                +{stats.newTeamsToday} today &middot; +{stats.newTeamsThisWeek} this week
              </div>
            )}
            {card.key === 'approvedTeams' && stats.totalTeams > 0 && (
              <div className="text-[10px] font-mono text-gray-600 mt-2 tracking-wider">
                {stats.approvalRate.toFixed(1)}% approval rate
              </div>
            )}
          </AnimatedCard>
        );
      })}
    </div>
  );
}
