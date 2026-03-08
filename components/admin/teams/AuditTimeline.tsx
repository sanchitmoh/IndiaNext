'use client';

import { FileText } from 'lucide-react';
import { ChangeCard } from './ChangeCard';

// ── Types ──────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  submissionId: string;
  timestamp: Date | string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'LEADER' | 'CO_LEADER' | 'MEMBER';
  };
  ipAddress: string | null;
  userAgent: string | null;
}

interface ChangeGroup {
  submissionId: string;
  changes: AuditLogEntry[];
}

interface AuditTimelineProps {
  logs: AuditLogEntry[];
  loading: boolean;
}

// ── Main Component ──────────────────────────────────────────

export function AuditTimeline({ logs, loading }: AuditTimelineProps) {
  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold text-gray-500 tracking-[0.3em] uppercase">
            CHANGE_HISTORY
          </span>
          <div className="h-2 w-16 bg-white/[0.04] rounded animate-pulse"></div>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-5 hover:border-white/[0.12] transition-all duration-300"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Header skeleton */}
            <div className="flex items-start justify-between mb-4 pb-3 border-b border-white/[0.04]">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-white/[0.04] rounded w-1/3 animate-pulse"></div>
                <div className="h-3 bg-white/[0.04] rounded w-1/2 animate-pulse"></div>
              </div>
              <div className="h-3 w-24 bg-white/[0.04] rounded animate-pulse"></div>
            </div>

            {/* Changes skeleton */}
            <div className="space-y-3">
              <div className="h-3 bg-white/[0.04] rounded w-1/4 animate-pulse"></div>
              {[1, 2].map((j) => (
                <div key={j} className="flex items-start gap-2 pl-4">
                  <div className="h-2 w-2 bg-white/[0.04] rounded-full mt-1 animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-white/[0.04] rounded w-3/4 animate-pulse"></div>
                    <div className="h-2 bg-white/[0.04] rounded w-1/2 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (logs.length === 0) {
    return (
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-8 text-center hover:border-white/[0.12] transition-all duration-300 animate-fadeIn">
        <FileText className="h-10 w-10 text-gray-700 mx-auto mb-3" />
        <p className="text-xs font-mono text-gray-600 tracking-widest font-bold">
          NO CHANGES RECORDED YET
        </p>
        <p className="text-[10px] font-mono text-gray-700 mt-2 max-w-md mx-auto">
          This team has not edited their registration. Changes will appear here when team members
          update their information.
        </p>
        <div className="mt-4 pt-4 border-t border-white/[0.04]">
          <p className="text-[9px] font-mono text-gray-700 uppercase tracking-wider">
            What gets tracked?
          </p>
          <ul className="mt-2 space-y-1 text-[10px] font-mono text-gray-600 text-left max-w-sm mx-auto">
            <li className="flex items-start gap-2">
              <span className="text-orange-500/50 shrink-0">•</span>
              <span>Team name and details</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500/50 shrink-0">•</span>
              <span>Member information changes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500/50 shrink-0">•</span>
              <span>Project and submission updates</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // Timeline with grouped changes
  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono font-bold text-gray-500 tracking-[0.3em] uppercase">
          CHANGE_HISTORY
        </span>
        <span className="text-[9px] font-mono text-gray-600">({logs.length} changes)</span>
      </div>

      {/* Group logs by submissionId */}
      {groupLogsBySubmission(logs).map((group, index) => (
        <div
          key={group.submissionId}
          className="animate-slideIn"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <ChangeCard changes={group.changes} />
        </div>
      ))}
    </div>
  );
}

// ── Helper Functions ────────────────────────────────────────

function groupLogsBySubmission(logs: AuditLogEntry[]): ChangeGroup[] {
  const groups = new Map<string, AuditLogEntry[]>();

  for (const log of logs) {
    const existing = groups.get(log.submissionId);
    if (existing) {
      existing.push(log);
    } else {
      groups.set(log.submissionId, [log]);
    }
  }

  return Array.from(groups.entries()).map(([submissionId, changes]) => ({
    submissionId,
    changes,
  }));
}
