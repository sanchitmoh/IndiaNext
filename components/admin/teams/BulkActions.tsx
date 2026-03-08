'use client';

import { trpc } from '@/lib/trpc-client';
import { CheckCircle, XCircle, Clock, AlertTriangle, X, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface BulkActionsProps {
  selectedTeams: string[];
  onComplete: () => void;
}

const actions = [
  {
    status: 'APPROVED',
    label: 'Approve',
    icon: CheckCircle,
    color:
      'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25',
  },
  {
    status: 'REJECTED',
    label: 'Reject',
    icon: XCircle,
    color: 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25',
  },
  {
    status: 'UNDER_REVIEW',
    label: 'Under Review',
    icon: Eye,
    color: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25',
  },
  {
    status: 'WAITLISTED',
    label: 'Waitlist',
    icon: AlertTriangle,
    color: 'bg-orange-500/15 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25',
  },
  {
    status: 'PENDING',
    label: 'Reset to Pending',
    icon: Clock,
    color: 'bg-white/[0.05] text-gray-300 border border-white/[0.08] hover:bg-white/[0.08]',
  },
];

export function BulkActions({ selectedTeams, onComplete }: BulkActionsProps) {
  const bulkUpdate = trpc.admin.bulkUpdateStatus.useMutation();

  const handleAction = async (status: string) => {
    try {
      const result = await bulkUpdate.mutateAsync({
        teamIds: selectedTeams,
        status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITLISTED' | 'UNDER_REVIEW',
      });
      toast.success(`Updated ${result.count} teams to ${status}`);
      onComplete();
    } catch {
      toast.error('Failed to update teams');
    }
  };

  return (
    <div className="bg-orange-500/[0.04] border border-orange-500/20 rounded-lg p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-mono font-bold text-orange-400 tracking-wider">
          {selectedTeams.length} TEAM
          {selectedTeams.length > 1 ? 'S' : ''} SELECTED
        </span>
        <div className="flex gap-2 flex-wrap">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.status}
                onClick={() => handleAction(action.status)}
                disabled={bulkUpdate.isPending}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider rounded-md transition-all disabled:opacity-50 ${action.color}`}
              >
                <Icon className="h-3 w-3" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
      <button
        onClick={onComplete}
        title="Close bulk actions"
        className="p-1.5 text-gray-600 hover:text-orange-400 rounded-md transition-all"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
