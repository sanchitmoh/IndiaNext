/**
 * Judge-specific Teams View
 * 
 * Simplified view for judges that only shows:
 * - Team list with submissions
 * - Ability to view team details
 * - Ability to add scores and comments
 * 
 * Hidden features:
 * - Bulk actions
 * - Export
 * - Delete/Edit teams
 * - Filters (simplified)
 */

"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { TeamsTable } from "@/components/admin/teams/TeamsTable";
import { RefreshCw, Award } from "lucide-react";

export function JudgeTeamsView() {
  const [filters, setFilters] = useState({
    status: "APPROVED", // ⭐ JUDGES ONLY SEE APPROVED TEAMS
    track: "all",
    college: "",
    search: "",
    dateRange: { from: undefined, to: undefined },
    sortBy: "createdAt" as "createdAt" | "name" | "status" | "college",
    sortOrder: "desc" as "asc" | "desc",
    page: 1,
    pageSize: 50,
  });

  const { data, isLoading, refetch } = trpc.admin.getTeams.useQuery(filters);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-6 h-6 text-amber-500" />
            <h1 className="text-lg md:text-xl font-mono font-bold text-white tracking-wider">
              JUDGING_PANEL
            </h1>
          </div>
          <p className="text-[11px] font-mono text-gray-500">
            {data?.teams.length || 0} approved teams ready for evaluation
          </p>
          <div className="mt-1 inline-flex items-center gap-2 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-[10px] font-mono text-green-400">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            SHOWING APPROVED TEAMS ONLY
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 bg-white/[0.03] border border-white/[0.06] rounded-md hover:text-amber-400 hover:border-amber-500/20 transition-all disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            REFRESH
          </button>
        </div>
      </div>

      {/* Simple Filters */}
      <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Track Filter */}
          <div>
            <label className="block text-[10px] font-mono text-gray-500 mb-2 uppercase tracking-wider">
              Track
            </label>
            <select
              title="Filter teams by track"
              value={filters.track}
              onChange={(e) => setFilters({ ...filters, track: e.target.value, page: 1 })}
              className="w-full px-3 py-2 bg-black/40 border border-white/[0.1] rounded-md text-sm text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Tracks</option>
              <option value="IDEA_SPRINT">IdeaSprint</option>
              <option value="BUILD_STORM">BuildStorm</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-[10px] font-mono text-gray-500 mb-2 uppercase tracking-wider">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              placeholder="Team name, college..."
              className="w-full px-3 py-2 bg-black/40 border border-white/[0.1] rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-[10px] font-mono text-gray-500 mb-2 uppercase tracking-wider">
              Sort By
            </label>
            <select
              title="Sort teams by"
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split("-");
                setFilters({ 
                  ...filters, 
                  sortBy: sortBy as "createdAt" | "name" | "status" | "college",
                  sortOrder: sortOrder as "asc" | "desc",
                });
              }}
              className="w-full px-3 py-2 bg-black/40 border border-white/[0.1] rounded-md text-sm text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Teams Table (Judge Mode) */}
      <TeamsTable
        teams={data?.teams || []}
        totalCount={data?.totalCount || 0}
        currentPage={filters.page}
        pageSize={filters.pageSize}
        isLoading={isLoading}
        selectedTeams={[]} // No selection for judges
        onSelectionChange={() => {}} // Disabled
        onPageChange={(page: number) => setFilters({ ...filters, page })}
        onSort={(field: string, order: string) => {
          if (field === "createdAt" || field === "name" || field === "status" || field === "college") {
            if (order === "asc" || order === "desc") {
              setFilters({ ...filters, sortBy: field, sortOrder: order });
            }
          }
        }}
        judgeMode={true} // Enable judge mode
      />
    </div>
  );
}
