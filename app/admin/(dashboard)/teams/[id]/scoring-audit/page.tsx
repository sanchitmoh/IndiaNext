'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc-client';
import {
  ArrowLeft,
  Loader2,
  History,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';

export default function ScoringAuditPage() {
  const params = useParams<{ id: string }>();
  const teamId = params.id;

  // First get the team to find its submissionId
  const { data: teamData, isLoading: teamLoading } = trpc.admin.getTeamById.useQuery(
    { id: teamId },
    { enabled: !!teamId }
  );

  const submissionId = (teamData as any)?.submission?.id;

  const [page, setPage] = useState(1);
  const { data, isLoading } = trpc.admin.getScoreAuditLog.useQuery(
    { submissionId: submissionId!, page, pageSize: 50 },
    { enabled: !!submissionId }
  );

  const [now] = useState(new Date());

  function timeSince(date: Date | string) {
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!submissionId) {
    return (
      <div className="space-y-4">
        <Link href={`/admin/teams/${teamId}`} className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-xs font-mono transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to team
        </Link>
        <div className="p-8 text-center text-gray-600 text-xs font-mono">
          This team has no submission — no score history to display.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/teams/${teamId}`}
          className="p-1.5 text-gray-500 hover:text-white rounded-md hover:bg-white/[0.05] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-lg font-mono font-bold text-white flex items-center gap-2">
            <History className="h-5 w-5 text-amber-400" />
            SCORE_AUDIT_LOG
          </h2>
          <p className="text-[10px] font-mono text-gray-500 tracking-[0.2em] mt-0.5">
            {teamData?.name} · {data?.totalCount ?? '…'} changes
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
          </div>
        ) : !data?.logs.length ? (
          <div className="p-12 text-center text-gray-600 text-xs font-mono tracking-widest">
            NO SCORE CHANGES RECORDED YET
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                  {['Judge', 'Criterion', 'Old', 'New', 'Δ', 'Confidence', 'When'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {data.logs.map((log) => {
                  const delta = log.delta;
                  const isFirst = log.oldPoints === null;
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-gray-300">{log.judgeName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-xs font-mono text-gray-300">{log.criterionName}</span>
                          <span className="text-[9px] font-mono text-gray-600 ml-1.5">{log.criterionWeight}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-gray-500">
                          {isFirst ? '—' : log.oldPoints?.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-white font-bold">{log.newPoints.toFixed(1)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {isFirst ? (
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">NEW</span>
                        ) : delta === null ? null : delta > 0 ? (
                          <span className="flex items-center gap-0.5 text-xs font-mono text-emerald-400">
                            <TrendingUp className="h-3 w-3" />+{delta.toFixed(1)}
                          </span>
                        ) : delta < 0 ? (
                          <span className="flex items-center gap-0.5 text-xs font-mono text-red-400">
                            <TrendingDown className="h-3 w-3" />{delta.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-gray-600"><Minus className="h-3 w-3" /></span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.confidence !== null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 bg-white/[0.05] rounded-full h-1">
                              <div
                                className="h-1 rounded-full bg-purple-400"
                                style={{ width: `${log.confidence}%` }}
                              />
                            </div>
                            <span className="text-[9px] font-mono text-gray-500">{log.confidence}%</span>
                          </div>
                        ) : (
                          <span className="text-[9px] font-mono text-gray-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono text-gray-500" title={new Date(log.changedAt).toISOString()}>
                          {timeSince(log.changedAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <span className="text-[10px] font-mono text-gray-600">
              {(page - 1) * 50 + 1}–{Math.min(page * 50, data.totalCount)} of {data.totalCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded text-gray-500 hover:text-white disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="p-1.5 rounded text-gray-500 hover:text-white disabled:opacity-30 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg">
        <History className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[9px] font-mono text-gray-500">
          This log records every time a judge edits their scores for this submission. The first entry per criterion shows the initial submission (no old value). Subsequent entries show the before/after with delta.
        </p>
      </div>
    </div>
  );
}
