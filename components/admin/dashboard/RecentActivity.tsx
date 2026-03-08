'use client';

import { trpc } from '@/lib/trpc-client';
import { Clock, Shield, FileText, Users } from 'lucide-react';

const actionIcons: Record<string, typeof Clock> = {
  'team.status_updated': Shield,
  'team.bulk_status_updated': Shield,
  'team.deleted': Users,
  'comment.created': FileText,
  'teams.exported': FileText,
  'user.role_updated': Shield,
};

const actionLabels: Record<string, string> = {
  'team.status_updated': 'Updated team status',
  'team.bulk_status_updated': 'Bulk status update',
  'team.deleted': 'Deleted a team',
  'comment.created': 'Added a comment',
  'teams.exported': 'Exported teams',
  'user.role_updated': 'Updated user role',
};

function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function RecentActivity() {
  const { data, isLoading } = trpc.admin.getActivityLogs.useQuery({
    page: 1,
    pageSize: 10,
  });

  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 md:p-6">
      <h3 className="text-xs font-mono font-bold text-gray-400 mb-4 tracking-[0.2em] uppercase">
        RECENT_ACTIVITY
      </h3>
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-7 h-7 bg-white/[0.04] rounded-md shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/[0.04] rounded w-3/4" />
                <div className="h-2 bg-white/[0.02] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : !data?.logs.length ? (
        <div className="h-48 flex items-center justify-center text-gray-600 text-xs font-mono tracking-widest">
          NO ACTIVITY YET
        </div>
      ) : (
        <div className="space-y-3">
          {data.logs.map((log) => {
            const Icon = actionIcons[log.action] || Clock;
            return (
              <div key={log.id} className="flex gap-3 items-start group">
                <div className="w-7 h-7 bg-white/[0.04] border border-white/[0.06] rounded-md flex items-center justify-center shrink-0 group-hover:border-orange-500/20 transition-colors">
                  <Icon className="h-3.5 w-3.5 text-gray-500 group-hover:text-orange-400 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">
                    <span className="font-medium text-gray-300">{log.user?.name || 'Admin'}</span>{' '}
                    {actionLabels[log.action] || log.action}
                  </p>
                  <p className="text-[10px] font-mono text-gray-600 mt-0.5">
                    {timeAgo(log.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
