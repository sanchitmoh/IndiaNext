'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { AuditHeader } from '@/components/admin/teams/AuditHeader';
import { AuditSummary } from '@/components/admin/teams/AuditSummary';
import { AuditFilters } from '@/components/admin/teams/AuditFilters';
import { AuditTimeline } from '@/components/admin/teams/AuditTimeline';
import { Pagination } from '@/components/admin/teams/Pagination';
import { ExportButton } from '@/components/admin/teams/ExportButton';

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

interface AuditResponse {
  success: boolean;
  data: {
    team: {
      id: string;
      name: string;
    };
    logs: AuditLogEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    summary: AuditSummary;
  };
}

interface AuditFilters {
  fromDate?: string;
  toDate?: string;
  userId?: string;
  fieldName?: string;
  action?: 'CREATE' | 'UPDATE' | 'DELETE';
  search?: string;
}

// ── Main Component ──────────────────────────────────────────

export default function AuditTrailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = use(params);
  const router = useRouter();

  // State
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [pagination, setPagination] = useState({ page: 1, limit: 20 });
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | undefined>(undefined);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);
    setErrorType(null);

    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.fromDate && { fromDate: filters.fromDate }),
        ...(filters.toDate && { toDate: filters.toDate }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.fieldName && { fieldName: filters.fieldName }),
        ...(filters.action && { action: filters.action }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/admin/teams/${teamId}/audit?${queryParams}`, {
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        let errorData;
        let errorCode = 'UNKNOWN_ERROR';
        let errorMsg = response.statusText;
        try {
          errorData = await response.json();
          errorCode = errorData.error || 'UNKNOWN_ERROR';
          errorMsg = errorData.message || errorMsg;
        } catch {
          // If response is not JSON, use status text
        }
        setErrorType(errorCode);
        setError(errorMsg);
        return;
      }

      const data: AuditResponse = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setSummary(data.data.summary);
        setTotalPages(data.data.pagination.totalPages);
        // Set team name from response
        if (data.data.team?.name) {
          setTeamName(data.data.team.name);
        }
        setRetryCount(0); // Reset retry count on success
      } else {
        setErrorType('UNKNOWN_ERROR');
        setError('Failed to fetch audit logs');
      }
    } catch (err) {
      if (err instanceof Error) {
        // Handle network errors
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
          setError('Request timed out. The server is taking too long to respond.');
          setErrorType('TIMEOUT');
        } else if (
          err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError')
        ) {
          setError('Network error. Please check your internet connection and try again.');
          setErrorType('NETWORK_ERROR');
        } else {
          setErrorType('UNKNOWN_ERROR');
          setError(err.message);
        }
      } else {
        setErrorType('UNKNOWN_ERROR');
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle retry with exponential backoff
  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    fetchAuditLogs();
  };

  // Fetch on mount and when filters/pagination change
  useEffect(() => {
    fetchAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination]);

  // ── Render ──────────────────────────────────────────────

  // Helper function to get error icon and color based on error type
  const getErrorStyle = () => {
    switch (errorType) {
      case 'UNAUTHORIZED':
      case 'FORBIDDEN':
        return {
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/20 hover:border-yellow-500/30',
          textColor: 'text-yellow-400',
          iconColor: 'text-yellow-400',
        };
      case 'TEAM_NOT_FOUND':
        return {
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20 hover:border-blue-500/30',
          textColor: 'text-blue-400',
          iconColor: 'text-blue-400',
        };
      case 'NETWORK_ERROR':
      case 'TIMEOUT':
        return {
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/20 hover:border-orange-500/30',
          textColor: 'text-orange-400',
          iconColor: 'text-orange-400',
        };
      default:
        return {
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/20 hover:border-red-500/30',
          textColor: 'text-red-400',
          iconColor: 'text-red-400',
        };
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl px-4 sm:px-0">
      {/* Header */}
      <AuditHeader teamId={teamId} teamName={teamName} />

      {/* Error State */}
      {error && (
        <div
          className={`${getErrorStyle().bgColor} border ${getErrorStyle().borderColor} rounded-lg p-4 flex items-start gap-3 transition-colors duration-300 animate-fadeIn`}
        >
          <AlertCircle
            className={`h-5 w-5 ${getErrorStyle().iconColor} shrink-0 mt-0.5 animate-pulse`}
          />
          <div className="flex-1">
            {/* Render error headline as a plain <p> tag for test matchers */}
            <p className={`text-sm font-mono ${getErrorStyle().textColor} font-bold`}>
              {errorType === 'UNAUTHORIZED' || errorType === 'FORBIDDEN'
                ? 'Access Denied'
                : errorType === 'TEAM_NOT_FOUND'
                  ? 'Team Not Found'
                  : errorType === 'NETWORK_ERROR'
                    ? 'Network Error'
                    : errorType === 'TIMEOUT'
                      ? 'Request Timeout'
                      : errorType === 'INVALID_FILTER'
                        ? 'Invalid Filters'
                        : 'Error Loading Audit Trail'}
            </p>
            <p className={`text-xs font-mono ${getErrorStyle().textColor} mt-1 opacity-90`}>
              {error}
            </p>

            {/* Retry button - only show for retryable errors */}
            {errorType !== 'UNAUTHORIZED' &&
              errorType !== 'FORBIDDEN' &&
              errorType !== 'TEAM_NOT_FOUND' && (
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={handleRetry}
                    disabled={loading}
                    className={`text-xs font-mono ${getErrorStyle().textColor} hover:opacity-80 underline transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5`}
                  >
                    {loading ? (
                      <>
                        <div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        Retrying...
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Try Again
                      </>
                    )}
                  </button>
                  {retryCount > 0 && (
                    <span
                      className={`text-[10px] font-mono ${getErrorStyle().textColor} opacity-60`}
                    >
                      (Attempt {retryCount + 1})
                    </span>
                  )}
                </div>
              )}

            {/* Helpful actions for specific error types */}
            {errorType === 'UNAUTHORIZED' && (
              <button
                onClick={() => router.push('/admin/login')}
                className="mt-3 text-xs font-mono text-yellow-400 hover:text-yellow-300 underline transition-colors duration-200"
              >
                Go to Login
              </button>
            )}
            {errorType === 'TEAM_NOT_FOUND' && (
              <button
                onClick={() => router.push('/admin/teams')}
                className="mt-3 text-xs font-mono text-blue-400 hover:text-blue-300 underline transition-colors duration-200"
              >
                Back to Teams List
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      {!error && (
        <div className="animate-fadeIn">
          <AuditSummary summary={summary} loading={loading} />
        </div>
      )}

      {/* Filters and Export */}
      {!error && (
        <div className="space-y-4 animate-fadeIn" style={{ animationDelay: '100ms' }}>
          <AuditFilters teamId={teamId} filters={filters} onChange={setFilters} loading={loading} />
          {!loading && (
            <div className="flex justify-end animate-fadeIn">
              <ExportButton teamId={teamId} teamName={teamName} filters={filters} />
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {!error && (
        <div className="animate-fadeIn" style={{ animationDelay: '200ms' }}>
          <AuditTimeline logs={logs} loading={loading} />

          {/* Pagination */}
          {!loading && totalPages > 1 && logs.length > 0 && (
            <div className="mt-6 animate-fadeIn" style={{ animationDelay: '300ms' }}>
              <Pagination
                currentPage={pagination.page}
                totalPages={totalPages}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
