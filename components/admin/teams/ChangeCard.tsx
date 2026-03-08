'use client';

import { Calendar } from 'lucide-react';
import { ChangeItem } from './ChangeItem';

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

interface ChangeCardProps {
  changes: AuditLogEntry[];
}

// ── Main Component ──────────────────────────────────────────

export function ChangeCard({ changes }: ChangeCardProps) {
  const firstChange = changes[0];

  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-5 hover:border-white/[0.12] transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/5">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4 pb-4 border-b border-white/[0.04]">
        <div className="flex-1 min-w-0">
          {/* Timestamp */}
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-3.5 w-3.5 text-gray-600" />
            <span className="text-sm font-mono text-gray-300">
              {new Date(firstChange.timestamp).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400">By:</span>
            <span className="text-xs font-mono text-orange-400 font-medium">
              {firstChange.user.name}
            </span>
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-all duration-200 ${
                firstChange.user.role === 'LEADER'
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20 hover:bg-orange-500/25 hover:border-orange-500/30'
                  : 'bg-white/[0.04] text-gray-400 border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12]'
              }`}
            >
              {firstChange.user.role}
            </span>
          </div>

          {/* User Email */}
          <div className="text-[10px] font-mono text-gray-600 mt-1">{firstChange.user.email}</div>
        </div>

        {/* IP Address */}
        {firstChange.ipAddress && (
          <div className="text-[10px] font-mono text-gray-600">IP: {firstChange.ipAddress}</div>
        )}
      </div>

      {/* Changes List */}
      <div>
        <h4 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">
          CHANGES ({changes.length})
        </h4>
        <ul className="space-y-2">
          {changes.map((change) => (
            <ChangeItem key={change.id} change={change} />
          ))}
        </ul>
      </div>
    </div>
  );
}
