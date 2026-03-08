'use client';

import { Calendar, Users, FileText } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

interface AuditSummary {
  totalEdits: number;
  lastEditDate: Date | string | null;
  mostActiveUser: {
    id: string;
    name: string;
    email: string;
    count: number;
    role: string;
  } | null;
  topChangedFields: Array<{
    field: string;
    count: number;
  }>;
}

interface AuditSummaryProps {
  summary: AuditSummary | null;
  loading?: boolean;
}

// ── Helper Functions ────────────────────────────────────────

function formatFieldName(fieldName: string): string {
  // Convert camelCase to Title Case
  const formatted = fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  // Handle specific field names
  const fieldNameMap: Record<string, string> = {
    'Team Name': 'Team Name',
    'Hear About': 'How Did You Hear About Us',
    'Additional Notes': 'Additional Notes',
    'Member 2 Email': 'Member 2 Email',
    'Member 2 Name': 'Member 2 Name',
    'Member 2 College': 'Member 2 College',
    'Member 2 Degree': 'Member 2 Degree',
    'Member 2 Gender': 'Member 2 Gender',
    'Member 3 Email': 'Member 3 Email',
    'Member 3 Name': 'Member 3 Name',
    'Member 3 College': 'Member 3 College',
    'Member 3 Degree': 'Member 3 Degree',
    'Member 3 Gender': 'Member 3 Gender',
    'Member 4 Email': 'Member 4 Email',
    'Member 4 Name': 'Member 4 Name',
    'Member 4 College': 'Member 4 College',
    'Member 4 Degree': 'Member 4 Degree',
    'Member 4 Gender': 'Member 4 Gender',
    'Idea Title': 'Idea Title',
    'Problem Statement': 'Problem Statement',
    'Proposed Solution': 'Proposed Solution',
    'Target Users': 'Target Users',
    'Expected Impact': 'Expected Impact',
    'Tech Stack': 'Tech Stack',
    'Doc Link': 'Document Link',
    'Problem Desc': 'Problem Description',
    'Github Link': 'GitHub Link',
  };

  return fieldNameMap[formatted] || formatted;
}

// ── Main Component ──────────────────────────────────────────

export function AuditSummary({ summary, loading = false }: AuditSummaryProps) {
  // Loading skeleton
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 animate-pulse"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-4 bg-white/[0.04] rounded"></div>
              <div className="h-2 w-20 bg-white/[0.04] rounded"></div>
            </div>
            <div className="h-6 bg-white/[0.04] rounded w-16 mb-2"></div>
            <div className="h-3 bg-white/[0.04] rounded w-24"></div>
          </div>
        ))}
      </div>
    );
  }

  // Handle null summary (teams with no edits)
  if (!summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Edits */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-orange-500" />
            <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
              TOTAL EDITS
            </span>
          </div>
          <p className="text-2xl font-mono font-bold text-white">0</p>
        </div>

        {/* Last Edit */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4 text-cyan-500" />
            <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
              LAST EDIT
            </span>
          </div>
          <p className="text-sm font-mono text-gray-300">N/A</p>
        </div>

        {/* Most Active User */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-emerald-500" />
            <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
              MOST ACTIVE
            </span>
          </div>
          <p className="text-sm font-mono text-gray-300 truncate">N/A</p>
        </div>

        {/* Top Changed Field */}
        <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-amber-500" />
            <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
              TOP FIELD
            </span>
          </div>
          <p className="text-sm font-mono text-gray-300 truncate">N/A</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Edits */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 hover:border-orange-500/30 hover:bg-orange-500/5 transition-all duration-300 group">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-orange-500 group-hover:scale-110 transition-transform duration-300" />
          <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
            TOTAL EDITS
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-mono font-bold text-white">{summary.totalEdits}</p>
          <span className="inline-flex items-center justify-center px-2 py-0.5 text-[9px] font-mono font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20 rounded hover:bg-orange-500/25 hover:border-orange-500/30 transition-all duration-200">
            {summary.totalEdits === 1 ? 'EDIT' : 'EDITS'}
          </span>
        </div>
      </div>

      {/* Last Edit */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all duration-300 group">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-cyan-500 group-hover:scale-110 transition-transform duration-300" />
          <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
            LAST EDIT
          </span>
        </div>
        <p className="text-sm font-mono text-gray-300">
          {summary.lastEditDate
            ? new Date(summary.lastEditDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'N/A'}
        </p>
        {summary.lastEditDate && (
          <p className="text-[10px] font-mono text-gray-600 mt-1">
            {new Date(summary.lastEditDate).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>

      {/* Most Active User */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-300 group">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-emerald-500 group-hover:scale-110 transition-transform duration-300" />
          <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
            MOST ACTIVE
          </span>
        </div>
        {summary.mostActiveUser ? (
          <>
            <p className="text-sm font-mono text-gray-300 truncate">
              {summary.mostActiveUser.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/25 hover:border-emerald-500/30 transition-all duration-200">
                {summary.mostActiveUser.count}{' '}
                {summary.mostActiveUser.count === 1 ? 'CHANGE' : 'CHANGES'}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm font-mono text-gray-300 truncate">N/A</p>
        )}
      </div>

      {/* Top Changed Field */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all duration-300 group">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform duration-300" />
          <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
            TOP FIELD
          </span>
        </div>
        {summary.topChangedFields.length > 0 ? (
          <>
            <p className="text-sm font-mono text-gray-300 truncate">
              {formatFieldName(summary.topChangedFields[0].field)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-[9px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500/25 hover:border-amber-500/30 transition-all duration-200">
                {summary.topChangedFields[0].count}{' '}
                {summary.topChangedFields[0].count === 1 ? 'CHANGE' : 'CHANGES'}
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm font-mono text-gray-300 truncate">N/A</p>
        )}
      </div>
    </div>
  );
}
