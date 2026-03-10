"use client";

import { useState, useEffect } from "react";
import { Calendar, User, FileText, Filter, Search, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────

interface AuditFilters {
  fromDate?: string;
  toDate?: string;
  userId?: string;
  fieldName?: string;
  action?: "CREATE" | "UPDATE" | "DELETE";
  search?: string;
}

interface AuditFiltersProps {
  teamId: string;
  filters: AuditFilters;
  onChange: (filters: AuditFilters) => void;
  loading?: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
}

// ── Main Component ──────────────────────────────────────────

export function AuditFilters({ teamId, filters, onChange, loading = false }: AuditFiltersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersFetchError, setUsersFetchError] = useState<string | null>(null);

  // Fetch team members for user filter
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      setUsersFetchError(null);
      try {
        const response = await fetch(`/api/admin/teams/${teamId}/members`, {
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setUsers(data.data);
          } else {
            throw new Error('Failed to load team members');
          }
        } else {
          throw new Error('Failed to load team members');
        }
      } catch (error) {
        console.error("Failed to fetch team members:", error);
        if (error instanceof Error) {
          if (error.name === 'AbortError' || error.name === 'TimeoutError') {
            setUsersFetchError('Timeout loading members');
          } else if (error.message.includes('Failed to fetch')) {
            setUsersFetchError('Network error');
          } else {
            setUsersFetchError('Failed to load members');
          }
        } else {
          setUsersFetchError('Failed to load members');
        }
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [teamId]);

  // Available field names for filtering
  const fieldNames = [
    { value: "teamName", label: "Team Name" },
    { value: "hearAbout", label: "How Did You Hear About Us" },
    { value: "additionalNotes", label: "Additional Notes" },
    { value: "member2Email", label: "Member 2 Email" },
    { value: "member2Name", label: "Member 2 Name" },
    { value: "member2College", label: "Member 2 College" },
    { value: "member2Degree", label: "Member 2 Degree" },
    { value: "member2Gender", label: "Member 2 Gender" },
    { value: "member3Email", label: "Member 3 Email" },
    { value: "member3Name", label: "Member 3 Name" },
    { value: "member3College", label: "Member 3 College" },
    { value: "member3Degree", label: "Member 3 Degree" },
    { value: "member3Gender", label: "Member 3 Gender" },
    { value: "member4Email", label: "Member 4 Email" },
    { value: "member4Name", label: "Member 4 Name" },
    { value: "member4College", label: "Member 4 College" },
    { value: "member4Degree", label: "Member 4 Degree" },
    { value: "member4Gender", label: "Member 4 Gender" },
    { value: "ideaTitle", label: "Idea Title" },
    { value: "problemStatement", label: "Problem Statement" },
    { value: "proposedSolution", label: "Proposed Solution" },
    { value: "targetUsers", label: "Target Users" },
    { value: "expectedImpact", label: "Expected Impact" },
    { value: "techStack", label: "Tech Stack" },
    { value: "docLink", label: "Document Link" },
    { value: "problemDesc", label: "Problem Description" },
    { value: "githubLink", label: "GitHub Link" },
  ];

  // Action types
  const actionTypes = [
    { value: "CREATE", label: "Created" },
    { value: "UPDATE", label: "Updated" },
    { value: "DELETE", label: "Deleted" },
  ];

  // Check if any filters are active
  const hasActiveFilters =
    filters.fromDate ||
    filters.toDate ||
    filters.userId ||
    filters.fieldName ||
    filters.action ||
    filters.search;

  // Clear all filters
  const handleClearFilters = () => {
    onChange({});
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-white/[0.04] rounded"></div>
            <div className="h-2 w-16 bg-white/[0.04] rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-2 w-12 bg-white/[0.04] rounded"></div>
              <div className="h-8 bg-white/[0.04] rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0A] rounded-lg border border-white/[0.06] p-4 hover:border-white/[0.12] transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-[0.2em]">
            FILTERS
          </span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono font-bold text-gray-400 hover:text-gray-300 bg-white/[0.03] hover:bg-white/[0.06] rounded transition-all duration-200 hover:scale-105 transform"
          >
            <X className="h-3 w-3" />
            CLEAR ALL
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Date Range Picker */}
        <DateRangePicker
          fromDate={filters.fromDate}
          toDate={filters.toDate}
          onChange={(fromDate, toDate) =>
            onChange({ ...filters, fromDate, toDate })
          }
        />

        {/* User Select */}
        <UserSelect
          value={filters.userId}
          users={users}
          loading={loadingUsers}
          error={usersFetchError}
          onChange={(userId) => onChange({ ...filters, userId })}
        />

        {/* Field Select */}
        <FieldSelect
          value={filters.fieldName}
          fields={fieldNames}
          onChange={(fieldName) => onChange({ ...filters, fieldName })}
        />

        {/* Action Select */}
        <ActionSelect
          value={filters.action}
          actions={actionTypes}
          onChange={(action) => onChange({ ...filters, action })}
        />

        {/* Search Input */}
        <SearchInput
          value={filters.search}
          onChange={(search) => onChange({ ...filters, search })}
        />
      </div>
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────

interface DateRangePickerProps {
  fromDate?: string;
  toDate?: string;
  onChange: (fromDate?: string, toDate?: string) => void;
}

function DateRangePicker({ fromDate, toDate, onChange }: DateRangePickerProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
        <Calendar className="h-3 w-3" />
        DATE RANGE
      </label>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={fromDate || ""}
          onChange={(e) => onChange(e.target.value || undefined, toDate)}
          placeholder="From"
          className="w-full px-2 py-1.5 text-xs font-mono bg-black/40 border border-white/[0.06] rounded text-gray-300 placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 hover:border-white/[0.12] transition-colors duration-200"
        />
        <input
          type="date"
          value={toDate || ""}
          onChange={(e) => onChange(fromDate, e.target.value || undefined)}
          placeholder="To"
          className="w-full px-2 py-1.5 text-xs font-mono bg-black/40 border border-white/[0.06] rounded text-gray-300 placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 hover:border-white/[0.12] transition-colors duration-200"
        />
      </div>
    </div>
  );
}

interface UserSelectProps {
  value?: string;
  users: User[];
  loading: boolean;
  error?: string | null;
  onChange: (userId?: string) => void;
}

function UserSelect({ value, users, loading, error, onChange }: UserSelectProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
        <User className="h-3 w-3" />
        USER
        {loading && (
          <span className="ml-1 text-[8px] text-orange-500 animate-pulse">
            LOADING...
          </span>
        )}
        {error && (
          <span className="ml-1 text-[8px] text-red-400" title={error}>
            ERROR
          </span>
        )}
      </label>
      <div className="relative">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          disabled={loading || !!error}
          aria-label="User filter"
          className="w-full px-2 py-1.5 text-xs font-mono bg-black/40 border border-white/[0.06] rounded text-gray-300 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:border-white/[0.12] transition-all duration-200"
        >
          <option value="">
            {error ? 'Failed to load users' : loading ? 'Loading...' : 'All Users'}
          </option>
          {!error && users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.email})
            </option>
          ))}
        </select>
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="h-3 w-3 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      {error && (
        <p className="text-[9px] font-mono text-red-400 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

interface FieldSelectProps {
  value?: string;
  fields: Array<{ value: string; label: string }>;
  onChange: (fieldName?: string) => void;
}

function FieldSelect({ value, fields, onChange }: FieldSelectProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
        <FileText className="h-3 w-3" />
        FIELD
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        aria-label="Field filter"
        className="w-full px-2 py-1.5 text-xs font-mono bg-black/40 border border-white/[0.06] rounded text-gray-300 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 hover:border-white/[0.12] transition-colors duration-200"
      >
        <option value="">All Fields</option>
        {fields.map((field) => (
          <option key={field.value} value={field.value}>
            {field.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ActionSelectProps {
  value?: "CREATE" | "UPDATE" | "DELETE";
  actions: Array<{ value: string; label: string }>;
  onChange: (action?: "CREATE" | "UPDATE" | "DELETE") => void;
}

function ActionSelect({ value, actions, onChange }: ActionSelectProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
        <Filter className="h-3 w-3" />
        ACTION
      </label>
      <select
        value={value || ""}
        onChange={(e) =>
          onChange(
            e.target.value
              ? (e.target.value as "CREATE" | "UPDATE" | "DELETE")
              : undefined
          )
        }
        aria-label="Action filter"
        className="w-full px-2 py-1.5 text-xs font-mono bg-black/40 border border-white/[0.06] rounded text-gray-300 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 hover:border-white/[0.12] transition-colors duration-200"
      >
        <option value="">All Actions</option>
        {actions.map((action) => (
          <option key={action.value} value={action.value}>
            {action.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface SearchInputProps {
  value?: string;
  onChange: (search?: string) => void;
}

function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="space-y-2 sm:col-span-2 lg:col-span-1">
      <label className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500">
        <Search className="h-3 w-3" />
        SEARCH
      </label>
      <div className="relative">
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="Search in values..."
          className="w-full px-2 py-1.5 text-xs font-mono bg-black/40 border border-white/[0.06] rounded text-gray-300 placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 hover:border-white/[0.12] transition-colors duration-200"
        />
        {value && (
          <button
            onClick={() => onChange(undefined)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400 transition-colors duration-200"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
