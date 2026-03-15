'use client';

import { useRouter } from 'next/navigation';
import { Eye, ChevronLeft, ChevronRight, MessageSquare, Tag, Crown, Users, Trophy, Award } from 'lucide-react';

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    college: string | null;
    avatar: string | null;
  };
}

interface TeamSubmission {
  id: string;
  submittedAt: Date | string | null;
  ideaTitle: string | null;
  assignedProblemStatement?: { title: string } | null;
  _count: { files: number };
}

interface TeamTag {
  id: string;
  tag: string;
  color: string;
}

interface Team {
  id: string;
  shortCode: string;
  name: string;
  track: string;
  status: string;
  size: number;
  college: string | null;
  hearAbout: string | null;
  additionalNotes: string | null;
  referralCode: string | null;
  createdBy: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  score: number | null;
  rank: number | null;
  attendance: string;
  checkedInAt: Date | string | null;
  checkedInBy: string | null;
  attendanceNotes: string | null;
  venueId: string | null;
  tableId: string | null;
  tableNumber: string | null;
  checkedIn: boolean;
  breakfastCouponsIssued: number;
  lunchCouponsIssued: number;
  isFlagged: boolean;
  flagReason: string | null;
  shortlistedEmailSent: boolean;
  approvedEmailSent: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
  members?: TeamMember[];
  submission?: TeamSubmission | null;
  tags?: TeamTag[];
  venue?: any;
  _count?: { comments: number };
  // Additional fields for ranking calculations
  calculatedScore?: number;
  scoreCount?: number;
  globalRank?: number;
  currentRank?: number;
}

interface TeamsTableProps {
  teams: Team[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  selectedTeams: string[];
  onSelectionChange: (ids: string[]) => void;
  onPageChange: (page: number) => void;
  onSort: (field: string, order: string) => void;
  judgeMode?: boolean;
  readOnly?: boolean;
}

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  UNDER_REVIEW: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  WAITLISTED: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  SHORTLISTED: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  WITHDRAWN: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const trackStyles: Record<string, string> = {
  IDEA_SPRINT: 'bg-cyan-500/10 text-cyan-400',
  BUILD_STORM: 'bg-orange-500/10 text-orange-400',
};

const trackLabels: Record<string, string> = {
  IDEA_SPRINT: 'Idea Sprint',
  BUILD_STORM: 'Build Storm',
};

export function TeamsTable({
  teams,
  totalCount,
  currentPage,
  pageSize,
  isLoading,
  selectedTeams,
  onSelectionChange,
  onPageChange,
  onSort,
  judgeMode = false,
  readOnly = false,
}: TeamsTableProps) {
  const router = useRouter();
  const totalPages = Math.ceil(totalCount / pageSize);

  const toggleAll = () => {
    if (selectedTeams.length === teams.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(teams.map((t) => t.id));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedTeams.includes(id)) {
      onSelectionChange(selectedTeams.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedTeams, id]);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] overflow-hidden">
        <div className="p-8 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-5 h-5 bg-white/[0.04] rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/[0.04] rounded w-1/3" />
                <div className="h-3 bg-white/[0.02] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] overflow-hidden">
      {/* ── Mobile Card Layout ── */}
      <div className="md:hidden">
        {/* Mobile select all */}
        {!readOnly && (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <input
              type="checkbox"
              title="Select all teams"
              aria-label="Select all teams"
              checked={teams.length > 0 && selectedTeams.length === teams.length}
              onChange={toggleAll}
              className="rounded border-gray-600 bg-transparent text-orange-500 focus:ring-orange-500/50"
            />
            <span className="text-[9px] font-mono font-bold text-gray-500 tracking-[0.2em] uppercase">
              SELECT ALL ({teams.length})
            </span>
          </div>
        )}

        {teams.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-600 text-xs font-mono tracking-widest">
            NO TEAMS FOUND
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {teams.map((team) => {
              const leader = team.members?.find((m) => m.role === 'LEADER');
              return (
                <div
                  key={team.id}
                  className={`px-4 py-3.5 transition-colors ${
                    selectedTeams.includes(team.id) ? 'bg-orange-500/[0.04]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!readOnly && (
                      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          title={`Select team ${team.name}`}
                          aria-label={`Select team ${team.name}`}
                          checked={selectedTeams.includes(team.id)}
                          onChange={() => toggleOne(team.id)}
                          className="rounded border-gray-600 bg-transparent text-orange-500 focus:ring-orange-500/50"
                        />
                      </div>
                    )}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => router.push(`/admin/teams/${team.id}`)}
                    >
                      {/* Team name + status */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-gray-200 truncate">
                          {team.name}
                        </span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-wider shrink-0">
                          {team.shortCode}
                        </span>
                        <span
                          className={`inline-flex text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                            statusStyles[team.status] || 'bg-white/[0.03] text-gray-400'
                          }`}
                        >
                          {team.status.replace('_', ' ')}
                        </span>
                        {/* Judge Mode: Show ranking */}
                        {judgeMode && (team as any).calculatedScore !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-400">
                              <Trophy className="h-2.5 w-2.5" />
                              {(team as any).calculatedScore.toFixed(1)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-400">
                              <Award className="h-2.5 w-2.5" />
                              #{(team as any).globalRank || (team as any).currentRank || 'N/A'}
                            </span>
                          </div>
                        )}
                        {/* Admin view: Show score badge when team has been scored */}
                        {!judgeMode && (team.submission as any)?.judgeScore != null && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shrink-0">
                            <Trophy className="h-2.5 w-2.5" />
                            {Number((team.submission as any).judgeScore).toFixed(1)}
                          </span>
                        )}
                        {/* Manual rank badge */}
                        {!judgeMode && (team as any).rank != null && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-orange-500/20 bg-orange-500/10 text-orange-400 shrink-0">
                            🔒 #{(team as any).rank}
                          </span>
                        )}
                      </div>
                      {/* Leader */}
                      <div className="flex items-center gap-1.5 mb-2">
                        {leader ? (
                          <>
                            <Crown className="h-3 w-3 text-orange-500 shrink-0" />
                            <span className="text-[11px] font-mono text-gray-400 truncate">
                              {leader.user.name || leader.user.email}
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] font-mono text-gray-600">No leader</span>
                        )}
                      </div>
                      {/* Meta row */}
                      <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-gray-500">
                        <span
                          className={`inline-flex font-bold px-1.5 py-0.5 rounded ${
                            trackStyles[team.track] || 'bg-white/[0.03] text-gray-400'
                          }`}
                        >
                          {trackLabels[team.track] || team.track}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3 text-gray-600" />
                          {team.members?.length || 0}
                        </span>
                        <span>
                          {new Date(team.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {team._count && team._count.comments > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <MessageSquare className="h-3 w-3" />
                            {team._count.comments}
                          </span>
                        )}
                      </div>
                      {/* Problem Statement Display */}
                      {team.submission?.assignedProblemStatement?.title && (
                        <div
                          className="mt-1.5 text-[10px] font-mono text-cyan-400 line-clamp-1 border border-cyan-500/20 bg-cyan-500/5 px-1.5 py-0.5 rounded w-fit max-w-full truncate"
                          title={team.submission.assignedProblemStatement.title}
                        >
                          PS: {team.submission.assignedProblemStatement.title}
                        </div>
                      )}
                      {/* Tags */}
                      {team.tags && team.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {team.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded border"
                              style={{
                                borderColor: `${tag.color}40`,
                                color: tag.color,
                                backgroundColor: `${tag.color}10`,
                              }}
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {tag.tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* View button */}
                    <button
                      onClick={() => router.push(`/admin/teams/${team.id}`)}
                      className="p-1.5 text-gray-600 hover:text-orange-400 hover:bg-orange-500/5 rounded-md transition-all shrink-0"
                      title="View team details"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Desktop Table Layout ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/[0.06]">
              {!readOnly && (
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    title="Select all teams"
                    aria-label="Select all teams"
                    checked={teams.length > 0 && selectedTeams.length === teams.length}
                    onChange={toggleAll}
                    className="rounded border-gray-600 bg-transparent text-orange-500 focus:ring-orange-500/50"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
                Team
              </th>
              <th className="px-4 py-3 text-left text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
                Track
              </th>
              <th className="px-4 py-3 text-left text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
                Status
              </th>
              {judgeMode && (
                <>
                  <th className="px-4 py-3 text-center text-[9px] font-mono font-bold text-amber-500 uppercase tracking-[0.2em]">
                    <div className="flex items-center justify-center gap-1">
                      <Trophy className="h-3 w-3" />
                      Score
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-[9px] font-mono font-bold text-amber-500 uppercase tracking-[0.2em]">
                    <div className="flex items-center justify-center gap-1">
                      <Award className="h-3 w-3" />
                      Rank
                    </div>
                  </th>
                </>
              )}
              <th className="px-4 py-3 text-left text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
                College
              </th>
              <th className="px-4 py-3 text-center text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
                Members
              </th>
              <th className="px-4 py-3 text-left text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
                Registered
              </th>
              <th className="px-4 py-3 text-right text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {teams.length === 0 ? (
              <tr>
                <td
                  colSpan={judgeMode ? (readOnly ? 9 : 10) : (readOnly ? 7 : 8)}
                  className="px-4 py-12 text-center text-gray-600 text-xs font-mono tracking-widest"
                >
                  NO TEAMS FOUND
                </td>
              </tr>
            ) : (
              teams.map((team) => {
                const leader = team.members?.find((m) => m.role === 'LEADER');
                return (
                  <tr
                    key={team.id}
                    className={`hover:bg-white/[0.02] transition-colors cursor-pointer ${
                      selectedTeams.includes(team.id) ? 'bg-orange-500/[0.04]' : ''
                    }`}
                    onClick={() => router.push(`/admin/teams/${team.id}`)}
                  >
                    {!readOnly && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          title={`Select team ${team.name}`}
                          aria-label={`Select team ${team.name}`}
                          checked={selectedTeams.includes(team.id)}
                          onChange={() => toggleOne(team.id)}
                          className="rounded border-gray-600 bg-transparent text-orange-500 focus:ring-orange-500/50"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-200">{team.name}</span>
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tracking-wider shrink-0">
                            {team.shortCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {leader ? (
                            <>
                              <Crown className="h-3 w-3 text-orange-500 shrink-0" />
                              <span className="text-[11px] font-mono text-gray-400">
                                {leader.user.name || leader.user.email}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] font-mono text-gray-600">No leader</span>
                          )}
                        </div>
                        {team.tags && team.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {team.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.5 rounded border"
                                style={{
                                  borderColor: `${tag.color}40`,
                                  color: tag.color,
                                  backgroundColor: `${tag.color}10`,
                                }}
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {tag.tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Problem Statement Display */}
                        {team.submission?.assignedProblemStatement?.title && (
                          <div
                            className="mt-1.5 text-[10px] font-mono text-cyan-400 line-clamp-1 border border-cyan-500/20 bg-cyan-500/5 px-1.5 py-0.5 rounded w-fit max-w-full truncate"
                            title={team.submission.assignedProblemStatement.title}
                          >
                            PS: {team.submission.assignedProblemStatement.title}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          trackStyles[team.track] || 'bg-white/[0.03] text-gray-400'
                        }`}
                      >
                        {trackLabels[team.track] || team.track}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          statusStyles[team.status] || 'bg-white/[0.03] text-gray-400'
                        }`}
                      >
                        {team.status.replace('_', ' ')}
                      </span>
                    </td>
                    {judgeMode && (
                      <>
                        {/* Score Column */}
                        <td className="px-4 py-3 text-center">
                          {(team as any).calculatedScore !== undefined ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-mono font-bold text-amber-400">
                                {(team as any).calculatedScore.toFixed(1)}
                              </span>
                              <span className="text-[9px] font-mono text-gray-500">
                                ({(team as any).scoreCount} judge{(team as any).scoreCount !== 1 ? 's' : ''})
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-gray-600">Not scored</span>
                          )}
                        </td>
                        {/* Rank Column */}
                        <td className="px-4 py-3 text-center">
                          {(team as any).calculatedScore !== undefined ? (
                            <div className="flex items-center justify-center gap-1">
                              <Award className="h-3 w-3 text-amber-500" />
                              <span className="text-sm font-mono font-bold text-amber-400">
                                #{(team as any).globalRank || (team as any).currentRank || 'N/A'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-gray-600">—</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-400 max-w-[200px] truncate block">
                        {team.college || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-gray-400">
                        <Users className="h-3 w-3 text-gray-600" />
                        {team.members?.length || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-mono text-gray-500">
                        {new Date(team.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {team._count && team._count.comments > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-mono text-gray-600">
                            <MessageSquare className="h-3 w-3" />
                            {team._count.comments}
                          </span>
                        )}
                        <button
                          onClick={() => router.push(`/admin/teams/${team.id}`)}
                          className="p-1.5 text-gray-600 hover:text-orange-400 hover:bg-orange-500/5 rounded-md transition-all"
                          title="View team details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-white/[0.06]">
          <div className="text-[11px] font-mono text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              title="Previous page"
              className="p-1.5 rounded-md text-gray-500 hover:text-orange-400 hover:bg-white/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => onPageChange(page)}
                  title={`Go to page ${page}`}
                  className={`w-7 h-7 text-[11px] font-mono rounded-md transition-all ${
                    page === currentPage
                      ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
                      : 'text-gray-500 hover:bg-white/[0.03] hover:text-gray-300'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-md text-gray-500 hover:text-orange-400 hover:bg-white/[0.03] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
