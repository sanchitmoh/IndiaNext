import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock the child components
vi.mock('@/components/admin/teams/AuditHeader', () => ({
  AuditHeader: ({ teamId, teamName }: any) => (
    <div data-testid="audit-header">
      Header: {teamId} - {teamName}
    </div>
  ),
}));

vi.mock('@/components/admin/teams/AuditSummary', () => ({
  AuditSummary: ({ summary, loading }: any) => (
    <div data-testid="audit-summary">
      {loading ? 'Loading summary...' : `Summary: ${summary?.totalEdits || 0} edits`}
    </div>
  ),
}));

vi.mock('@/components/admin/teams/AuditFilters', () => ({
  AuditFilters: ({ filters, onChange }: any) => (
    <div data-testid="audit-filters">Filters</div>
  ),
}));

vi.mock('@/components/admin/teams/AuditTimeline', () => ({
  AuditTimeline: ({ logs, loading }: any) => (
    <div data-testid="audit-timeline">
      {loading ? 'Loading timeline...' : `Timeline: ${logs.length} logs`}
    </div>
  ),
}));

vi.mock('@/components/admin/teams/Pagination', () => ({
  Pagination: ({ currentPage, totalPages }: any) => (
    <div data-testid="pagination">
      Page {currentPage} of {totalPages}
    </div>
  ),
}));

vi.mock('@/components/admin/teams/ExportButton', () => ({
  ExportButton: ({ teamId }: any) => (
    <button data-testid="export-button">Export</button>
  ),
}));

// Import the component after mocks
const AuditTrailPage = (await import('@/app/admin/(dashboard)/teams/[id]/audit/page')).default;

describe('AuditTrailPage - Error Handling', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: mockPush });
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should display user-friendly error message for unauthorized access', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Admin access required',
      }),
    });

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(screen.getByText(/Your session has expired/)).toBeInTheDocument();

    // Should show login button
    const loginButton = screen.getByText('Go to Login');
    expect(loginButton).toBeInTheDocument();

    // Should not show retry button for unauthorized
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should display error message for team not found', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        error: 'TEAM_NOT_FOUND',
        message: 'Team with ID test-team-id does not exist',
      }),
    });

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Team Not Found')).toBeInTheDocument();
      expect(screen.getByText(/This team could not be found/)).toBeInTheDocument();
    });

    // Should show back to teams button
    const backButton = screen.getByText('Back to Teams List');
    expect(backButton).toBeInTheDocument();
  });

  it('should display error message for network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Failed to fetch'));

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
      expect(screen.getByText(/Please check your internet connection/)).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should display error message for timeout', async () => {
    const timeoutError = new Error('Timeout');
    timeoutError.name = 'TimeoutError';
    (global.fetch as any).mockRejectedValueOnce(timeoutError);

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Request Timeout')).toBeInTheDocument();
      expect(screen.getByText(/The server is taking too long to respond/)).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should display error message for invalid filters', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: 'INVALID_FILTER',
        message: 'Invalid date format',
      }),
    });

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Invalid Filters')).toBeInTheDocument();
      expect(screen.getByText(/Please check your filters and try again/)).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should display error message for database errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Unable to fetch audit logs',
      }),
    });

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Audit Trail')).toBeInTheDocument();
      expect(screen.getByText(/Unable to connect to the database/)).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should allow retry after error', async () => {
    // First call fails
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Unable to fetch audit logs',
      }),
    });

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Audit Trail')).toBeInTheDocument();
    });

    // Second call succeeds
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          team: { id: 'test-team-id', name: 'Test Team' },
          logs: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          summary: { totalEdits: 0, lastEditDate: null, mostActiveUser: null, topChangedFields: [] },
        },
      }),
    });

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.queryByText('Error Loading Audit Trail')).not.toBeInTheDocument();
      expect(screen.getByTestId('audit-timeline')).toBeInTheDocument();
    });
  });

  it('should track retry count', async () => {
    // First call fails
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Unable to fetch audit logs',
      }),
    });

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Audit Trail')).toBeInTheDocument();
    });

    // Retry once
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Unable to fetch audit logs',
      }),
    });

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('(Attempt 2)')).toBeInTheDocument();
    });
  });

  it('should navigate to login on unauthorized login button click', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Admin access required',
      }),
    });

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Go to Login')).toBeInTheDocument();
    });

    const loginButton = screen.getByText('Go to Login');
    fireEvent.click(loginButton);

    expect(mockPush).toHaveBeenCalledWith('/admin/login');
  });

  it('should navigate to teams list on team not found button click', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        error: 'TEAM_NOT_FOUND',
        message: 'Team not found',
      }),
    });

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Back to Teams List')).toBeInTheDocument();
    });

    const backButton = screen.getByText('Back to Teams List');
    fireEvent.click(backButton);

    expect(mockPush).toHaveBeenCalledWith('/admin/teams');
  });

  it('should handle non-JSON error responses', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('Not JSON');
      },
    });

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText(/HTTP 500: Internal Server Error/)).toBeInTheDocument();
    });
  });

  it('should hide error when data loads successfully', async () => {
    // First call fails
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        error: 'DATABASE_ERROR',
        message: 'Unable to fetch audit logs',
      }),
    });

    const mockParams = Promise.resolve({ id: 'test-team-id' });
    render(<AuditTrailPage params={mockParams} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Audit Trail')).toBeInTheDocument();
    });

    // Retry succeeds
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          team: { id: 'test-team-id', name: 'Test Team' },
          logs: [
            {
              id: '1',
              submissionId: 'sub-1',
              timestamp: new Date().toISOString(),
              action: 'UPDATE',
              fieldName: 'teamName',
              oldValue: 'Old Name',
              newValue: 'New Name',
              user: {
                id: 'user-1',
                name: 'John Doe',
                email: 'john@example.com',
                role: 'LEADER',
              },
              ipAddress: '192.168.1.1',
              userAgent: 'Mozilla/5.0',
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          summary: {
            totalEdits: 1,
            lastEditDate: new Date().toISOString(),
            mostActiveUser: {
              id: 'user-1',
              name: 'John Doe',
              email: 'john@example.com',
              count: 1,
              role: 'LEADER',
            },
            topChangedFields: [{ field: 'teamName', count: 1 }],
          },
        },
      }),
    });

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.queryByText('Error Loading Audit Trail')).not.toBeInTheDocument();
      expect(screen.getByText('Timeline: 1 logs')).toBeInTheDocument();
    });
  });
});
