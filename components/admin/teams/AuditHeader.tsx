'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface AuditHeaderProps {
  teamId: string;
  teamName?: string;
}

export function AuditHeader({ teamId, teamName }: AuditHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-start gap-3 md:gap-4">
      <button
        onClick={() => router.push(`/admin/teams/${teamId}`)}
        className="p-2 hover:bg-white/[0.03] rounded-md transition-all duration-200 shrink-0 hover:scale-110 transform"
        aria-label="Back to team details"
      >
        <ArrowLeft className="h-5 w-5 text-gray-500 group-hover:text-gray-400" />
      </button>
      <div className="min-w-0">
        <h1 className="text-lg md:text-xl font-mono font-bold text-white tracking-wider">
          AUDIT TRAIL
        </h1>
        {teamName && (
          <p className="text-xs font-mono text-gray-400 mt-1">
            {teamName} <span className="text-gray-600">({teamId})</span>
          </p>
        )}
        <p className="text-xs font-mono text-gray-500 mt-1">
          Complete change history for this team
        </p>
      </div>
    </div>
  );
}
