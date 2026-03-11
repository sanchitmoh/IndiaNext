// Admin Teams Management Page
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import { useAdminRole } from '@/components/admin/AdminRoleContext';
import { TeamsTable } from '@/components/admin/teams/TeamsTable';
import { TeamsFilters } from '@/components/admin/teams/TeamsFilters';
import { BulkActions } from '@/components/admin/teams/BulkActions';
import { Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function TeamsManagementPage() {
  const { role: _role, isLogistics, isOrganizer } = useAdminRole();
  const [filters, setFilters] = useState({
    status: 'all',
    track: 'all',
    college: '',
    search: '',
    dateRange: { from: undefined, to: undefined },
    sortBy: 'createdAt' as 'createdAt' | 'name' | 'status' | 'college',
    sortOrder: 'desc' as 'asc' | 'desc',
    page: 1,
    pageSize: 50,
  });

  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  // ✅ SECURITY FIX: Use React Context instead of DOM attribute
  const isReadOnly = isLogistics || isOrganizer;

  const { data, isLoading, refetch } = trpc.admin.getTeams.useQuery(filters);
  const exportMutation = trpc.admin.exportTeams.useMutation();

  const handleExport = async () => {
    try {
      const result = await exportMutation.mutateAsync({
        status: filters.status,
        track: filters.track,
        format: 'csv',
      });

      // Convert to CSV
      const csv = convertToCSV(result.teams);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Create descriptive filename based on filters
      const trackLabel =
        filters.track === 'all'
          ? 'all-tracks'
          : filters.track === 'IDEA_SPRINT'
            ? 'ideasprint'
            : 'buildstorm';
      const statusLabel = filters.status === 'all' ? 'all-status' : filters.status.toLowerCase();
      const timestamp = new Date().toISOString().split('T')[0];

      a.download = `teams-${trackLabel}-${statusLabel}-${timestamp}.csv`;
      a.click();

      const filterDesc = [];
      if (filters.track !== 'all') {
        filterDesc.push(filters.track === 'IDEA_SPRINT' ? 'IdeaSprint' : 'BuildStorm');
      }
      if (filters.status !== 'all') {
        filterDesc.push(filters.status.replace('_', ' '));
      }

      const message =
        filterDesc.length > 0
          ? `Exported ${result.count} teams (${filterDesc.join(', ')})`
          : `Exported ${result.count} teams`;

      toast.success(message);
    } catch (_error) {
      toast.error('Failed to export teams');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-mono font-bold text-white tracking-wider">
            TEAMS_MANAGEMENT
          </h1>
          <p className="text-[11px] font-mono text-gray-500 mt-1">
            {data?.totalCount || 0} total teams registered
            {(filters.track !== 'all' || filters.status !== 'all') && (
              <span className="text-orange-400 ml-2">
                • Filtered: {data?.teams.length || 0} teams
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            REFRESH
          </button>
          {!isReadOnly && (
            <button
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-orange-400 hover:border-orange-500/20 transition-all disabled:opacity-40"
              title={`Export ${filters.track !== 'all' ? (filters.track === 'IDEA_SPRINT' ? 'IdeaSprint' : 'BuildStorm') + ' teams' : 'all teams'}${filters.status !== 'all' ? ' with status: ' + filters.status : ''}`}
            >
              <Download className="h-3.5 w-3.5" />
              {exportMutation.isPending ? 'EXPORTING...' : 'EXPORT CSV'}
            </button>
          )}
        </div>
      </div>

      <TeamsFilters
        filters={filters}
        onChange={(newFilters) => {
          const merged = { ...filters, ...newFilters };
          setFilters({
            ...merged,
            sortBy: merged.sortBy as 'createdAt' | 'name' | 'status' | 'college',
            sortOrder: merged.sortOrder as 'asc' | 'desc',
          });
        }}
      />

      {selectedTeams.length > 0 && !isReadOnly && (
        <BulkActions
          selectedTeams={selectedTeams}
          onComplete={() => {
            setSelectedTeams([]);
            refetch();
          }}
        />
      )}

      <TeamsTable
        teams={data?.teams || []}
        totalCount={data?.totalCount || 0}
        currentPage={filters.page}
        pageSize={filters.pageSize}
        isLoading={isLoading}
        selectedTeams={isReadOnly ? [] : selectedTeams}
        onSelectionChange={isReadOnly ? () => {} : setSelectedTeams}
        onPageChange={(page: number) => setFilters({ ...filters, page })}
        onSort={(field: string, order: string) => {
          if (
            field === 'createdAt' ||
            field === 'name' ||
            field === 'status' ||
            field === 'college'
          ) {
            if (order === 'asc' || order === 'desc') {
              setFilters({ ...filters, sortBy: field, sortOrder: order });
            }
          }
        }}
        readOnly={isReadOnly}
      />
    </div>
  );
}

interface ExportTeam {
  id: string;
  shortCode?: string | null;
  name: string;
  track: string;
  status: string;
  college?: string | null;
  members: {
    id: string;
    role: string;
    user: {
      id: string;
      name?: string | null;
      email: string;
      phone?: string | null;
      college?: string | null;
      degree?: string | null;
      year?: string | null;
      branch?: string | null;
      github?: string | null;
      linkedIn?: string | null;
      portfolio?: string | null;
    };
  }[];
  submission?: {
    id: string;
    ideaTitle?: string | null;
    problemStatement?: string | null;
    assignedProblemStatement?: { title: string } | null;
    proposedSolution?: string | null;
    targetUsers?: string | null;
    expectedImpact?: string | null;
    techStack?: string | null;
    docLink?: string | null;
    problemDesc?: string | null;
    githubLink?: string | null;
    demoLink?: string | null;
    techStackUsed?: string | null;
    submittedAt?: string | Date | null;
  } | null;
  createdAt: string | Date;
  reviewedAt?: string | Date | null;
  reviewNotes?: string | null;
}

function convertToCSV(teams: ExportTeam[]): string {
  const headers = [
    'Team ID',
    'Team Name',
    'Track',
    'Status',
    'College',
    'Members Count',
    'Registered At',
    'Reviewed At',
    'Review Notes',
    // Member 1 (Leader)
    'Member 1 ID',
    'Member 1 Role',
    'Member 1 Name',
    'Member 1 Email',
    'Member 1 Phone',
    'Member 1 College',
    'Member 1 Degree',
    'Member 1 Year',
    'Member 1 Branch',
    'Member 1 GitHub',
    'Member 1 LinkedIn',
    'Member 1 Portfolio',
    // Member 2
    'Member 2 ID',
    'Member 2 Role',
    'Member 2 Name',
    'Member 2 Email',
    'Member 2 Phone',
    'Member 2 College',
    'Member 2 Degree',
    'Member 2 Year',
    'Member 2 Branch',
    'Member 2 GitHub',
    'Member 2 LinkedIn',
    'Member 2 Portfolio',
    // Member 3
    'Member 3 ID',
    'Member 3 Role',
    'Member 3 Name',
    'Member 3 Email',
    'Member 3 Phone',
    'Member 3 College',
    'Member 3 Degree',
    'Member 3 Year',
    'Member 3 Branch',
    'Member 3 GitHub',
    'Member 3 LinkedIn',
    'Member 3 Portfolio',
    // Member 4
    'Member 4 ID',
    'Member 4 Role',
    'Member 4 Name',
    'Member 4 Email',
    'Member 4 Phone',
    'Member 4 College',
    'Member 4 Degree',
    'Member 4 Year',
    'Member 4 Branch',
    'Member 4 GitHub',
    'Member 4 LinkedIn',
    'Member 4 Portfolio',
    // Submission Details
    "Submission ID",
    "Idea Title",
    "Problem Statement / Assigned PS",
    "Proposed Solution",
    "Target Users",
    "Expected Impact",
    "Tech Stack",
    "Document Link",
    "Problem Description",
    "GitHub Link",
    "Demo Link",
    "Tech Stack Used",
    "Submitted At",
  ];

  const rows = teams.map((team) => {
    // Sort members: LEADER first, then others
    const sortedMembers = [...team.members].sort((a, b) => {
      if (a.role === 'LEADER') return -1;
      if (b.role === 'LEADER') return 1;
      return 0;
    });

    const getMemberData = (index: number) => {
      const member = sortedMembers[index];
      if (!member) {
        return ['', '', '', '', '', '', '', '', '', '', '', ''];
      }
      return [
        member.user.id,
        member.role,
        member.user.name || '',
        member.user.email,
        member.user.phone || '',
        member.user.college || '',
        member.user.degree || '',
        member.user.year || '',
        member.user.branch || '',
        member.user.github || '',
        member.user.linkedIn || '',
        member.user.portfolio || '',
      ];
    };

    return [
      team.shortCode || team.id,
      team.name,
      team.track,
      team.status,
      team.college || '',
      team.members.length,
      new Date(team.createdAt).toLocaleString(),
      team.reviewedAt ? new Date(team.reviewedAt).toLocaleString() : '',
      team.reviewNotes || '',
      // All 4 members
      ...getMemberData(0),
      ...getMemberData(1),
      ...getMemberData(2),
      ...getMemberData(3),
      // Submission
      team.submission?.id || "",
      team.submission?.ideaTitle || "",
      team.submission?.assignedProblemStatement?.title || team.submission?.problemStatement || "",
      team.submission?.proposedSolution || "",
      team.submission?.targetUsers || "",
      team.submission?.expectedImpact || "",
      team.submission?.techStack || "",
      team.submission?.docLink || "",
      team.submission?.problemDesc || "",
      team.submission?.githubLink || "",
      team.submission?.demoLink || "",
      team.submission?.techStackUsed || "",
      team.submission?.submittedAt ? new Date(team.submission.submittedAt).toLocaleString() : "",
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}
