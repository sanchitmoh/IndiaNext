"use client";

import { useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────

interface ExportButtonProps {
  teamId: string;
  teamName?: string;
  filters: {
    fromDate?: string;
    toDate?: string;
    userId?: string;
    fieldName?: string;
    action?: "CREATE" | "UPDATE" | "DELETE";
    search?: string;
  };
}

// ── Main Component ──────────────────────────────────────────

export function ExportButton({ teamId, teamName, filters }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Build query string with current filters
      const queryParams = new URLSearchParams({
        ...(filters.fromDate && { fromDate: filters.fromDate }),
        ...(filters.toDate && { toDate: filters.toDate }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.fieldName && { fieldName: filters.fieldName }),
        ...(filters.action && { action: filters.action }),
        ...(filters.search && { search: filters.search }),
      });

      // Build export URL
      const exportUrl = `/api/admin/teams/${teamId}/audit/export?${queryParams}`;

      // Trigger download with timeout
      const response = await fetch(exportUrl, {
        signal: AbortSignal.timeout(60000), // 60 second timeout for exports
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          throw new Error(`Export failed: ${response.statusText}`);
        }

        const errorCode = errorData.error || 'UNKNOWN_ERROR';

        // Provide user-friendly error messages
        switch (errorCode) {
          case 'UNAUTHORIZED':
            throw new Error('Your session has expired. Please log in again.');
          case 'FORBIDDEN':
            throw new Error('You do not have permission to export audit logs.');
          case 'TEAM_NOT_FOUND':
            throw new Error('Team not found. It may have been deleted.');
          case 'EXPORT_TOO_LARGE':
            throw new Error('Export too large (max 10,000 records). Please apply filters to reduce the result set.');
          case 'DATABASE_ERROR':
            throw new Error('Database error. Please try again in a moment.');
          default:
            throw new Error(errorData.message || 'Export failed. Please try again.');
        }
      }

      // Get the CSV content
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      // Set filename from Content-Disposition header or generate default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `audit_${teamName || teamId}_${new Date().toISOString().split("T")[0]}.csv`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Show success message briefly
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
          setError('Export timed out. The file may be too large. Try applying filters to reduce the size.');
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Export failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleExport}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold text-gray-300 hover:text-white bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 hover:border-orange-500/50 rounded transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-orange-500/20 hover:scale-105 transform"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            EXPORTING...
          </>
        ) : success ? (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            EXPORTED
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            EXPORT CSV
          </>
        )}
      </button>

      {/* Success Message */}
      {success && (
        <div className="flex items-start gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-xs font-mono text-green-400 animate-fadeIn">
          <svg className="h-3 w-3 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Export downloaded successfully</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs font-mono text-red-400 animate-fadeIn">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
            <button
              onClick={handleExport}
              disabled={loading}
              className="block mt-1 text-[10px] underline hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
