/**
 * Unit Tests: ExportButton Component
 * 
 * Tests the ExportButton component to ensure it:
 * - Renders correctly with download icon
 * - Builds export URL with current filters
 * - Shows loading state during export
 * - Handles export errors gracefully
 * 
 * Requirements: FR-4, US-6.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ExportButton } from '../../components/admin/teams/ExportButton';

// Mock fetch
global.fetch = vi.fn();

describe('ExportButton Component', () => {
  const mockTeamId = 'team-123';
  const mockTeamName = 'Test Team';
  const mockFilters = {
    fromDate: '2024-01-01',
    toDate: '2024-12-31',
    userId: 'user-123',
    fieldName: 'teamName',
    action: 'UPDATE' as const,
    search: 'test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render export button with download icon', () => {
    render(
      <ExportButton
        teamId={mockTeamId}
        teamName={mockTeamName}
        filters={{}}
      />
    );

    const button = screen.getByRole('button', { name: /export csv/i });
    expect(button).toBeDefined();
    expect(button.textContent).toContain('EXPORT CSV');
  });

  it('should build export URL with current filters', async () => {
    const mockBlob = new Blob(['test csv data'], { type: 'text/csv' });
    const mockHeaders = new Headers();
    mockHeaders.set('Content-Disposition', 'attachment; filename="test.csv"');
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: mockHeaders,
    });

    render(
      <ExportButton
        teamId={mockTeamId}
        teamName={mockTeamName}
        filters={mockFilters}
      />
    );

    const button = screen.getByRole('button', { name: /export csv/i });
    fireEvent.click(button);

    await waitFor(() => {
      const fetchCall = (global.fetch as any).mock.calls[0]?.[0];
      expect(fetchCall).toContain(`/api/admin/teams/${mockTeamId}/audit/export`);
      expect(fetchCall).toContain('fromDate=2024-01-01');
      expect(fetchCall).toContain('toDate=2024-12-31');
      expect(fetchCall).toContain('userId=user-123');
      expect(fetchCall).toContain('fieldName=teamName');
      expect(fetchCall).toContain('action=UPDATE');
      expect(fetchCall).toContain('search=test');
    });
  });

  it('should show loading state during export', async () => {
    let resolveExport: any;
    (global.fetch as any).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExport = resolve;
        })
    );

    render(
      <ExportButton
        teamId={mockTeamId}
        teamName={mockTeamName}
        filters={{}}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/exporting/i)).toBeDefined();
      expect(button).toHaveProperty('disabled', true);
    });

    // Cleanup
    if (resolveExport) {
      resolveExport({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test'])),
        headers: new Headers(),
      });
    }
  });

  it('should handle export errors', async () => {
    const errorMessage = 'Export failed';
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: errorMessage }),
    });

    render(
      <ExportButton
        teamId={mockTeamId}
        teamName={mockTeamName}
        filters={{}}
      />
    );

    const button = screen.getByRole('button', { name: /export csv/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeDefined();
    });
  });

  it('should not include empty filters in export URL', async () => {
    const mockBlob = new Blob(['test csv data'], { type: 'text/csv' });
    (global.fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: new Headers(),
    });

    render(
      <ExportButton
        teamId={mockTeamId}
        teamName={mockTeamName}
        filters={{}}
      />
    );

    const button = screen.getByRole('button', { name: /export csv/i });
    fireEvent.click(button);

    await waitFor(() => {
      const fetchCall = (global.fetch as any).mock.calls[0]?.[0];
      expect(fetchCall).toBeDefined();
      expect(fetchCall).not.toContain('fromDate=');
      expect(fetchCall).not.toContain('toDate=');
      expect(fetchCall).not.toContain('userId=');
      expect(fetchCall).not.toContain('fieldName=');
      expect(fetchCall).not.toContain('action=');
      expect(fetchCall).not.toContain('search=');
    });
  });
});
