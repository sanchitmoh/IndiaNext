/**
 * Unit Tests: AuditFilters Component
 *
 * Tests the AuditFilters component functionality:
 * - Renders all filter controls
 * - Updates parent state when filters change
 * - Clear filters button works correctly
 * - Date range picker updates filters
 * - User select updates filters
 * - Field select updates filters
 * - Action select updates filters
 * - Search input updates filters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuditFilters } from '@/components/admin/teams/AuditFilters';

// Mock fetch
global.fetch = vi.fn();

describe('AuditFilters Component', () => {
  const mockOnChange = vi.fn();
  const mockTeamId = 'team-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful fetch for team members
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
          { id: 'user-2', name: 'Jane Smith', email: 'jane@example.com' },
        ],
      }),
    });
  });

  it('should render all filter controls', async () => {
    render(<AuditFilters teamId={mockTeamId} filters={{}} onChange={mockOnChange} />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('FILTERS')).toBeInTheDocument();
    });

    // Check for filter labels
    expect(screen.getByText('DATE RANGE')).toBeInTheDocument();
    expect(screen.getByText('USER')).toBeInTheDocument();
    expect(screen.getByText('FIELD')).toBeInTheDocument();
    expect(screen.getByText('ACTION')).toBeInTheDocument();
    expect(screen.getByText('SEARCH')).toBeInTheDocument();
  });

  it('should fetch team members on mount', async () => {
    render(<AuditFilters teamId={mockTeamId} filters={{}} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toBe(`/api/admin/teams/${mockTeamId}/members`);
    });
  });

  it('should update filters when date range changes', async () => {
    render(<AuditFilters teamId={mockTeamId} filters={{}} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText('DATE RANGE')).toBeInTheDocument();
    });

    // Get date inputs by type
    const dateInputs = screen.getAllByDisplayValue('');
    const fromDateInput = dateInputs.find(
      (input) =>
        input.getAttribute('type') === 'date' && input.getAttribute('placeholder') === 'From'
    );

    if (fromDateInput) {
      fireEvent.change(fromDateInput, { target: { value: '2024-01-01' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        fromDate: '2024-01-01',
      });
    }
  });

  it('should update filters when user is selected', async () => {
    render(<AuditFilters teamId={mockTeamId} filters={{}} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText('USER')).toBeInTheDocument();
    });

    const userSelect = screen.getByRole('combobox', { name: /user/i });
    fireEvent.change(userSelect, { target: { value: 'user-1' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      userId: 'user-1',
    });
  });

  it('should update filters when field is selected', async () => {
    render(<AuditFilters teamId={mockTeamId} filters={{}} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText('FIELD')).toBeInTheDocument();
    });

    const fieldSelect = screen.getByRole('combobox', { name: /field/i });
    fireEvent.change(fieldSelect, { target: { value: 'teamName' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      fieldName: 'teamName',
    });
  });

  it('should update filters when action is selected', async () => {
    render(<AuditFilters teamId={mockTeamId} filters={{}} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText('ACTION')).toBeInTheDocument();
    });

    const actionSelect = screen.getByRole('combobox', { name: /action/i });
    fireEvent.change(actionSelect, { target: { value: 'UPDATE' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      action: 'UPDATE',
    });
  });

  it('should update filters when search term is entered', async () => {
    render(<AuditFilters teamId={mockTeamId} filters={{}} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText('SEARCH')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search in values...');
    fireEvent.change(searchInput, { target: { value: 'test search' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      search: 'test search',
    });
  });

  it('should show clear filters button when filters are active', async () => {
    render(
      <AuditFilters
        teamId={mockTeamId}
        filters={{ search: 'test', userId: 'user-1' }}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('CLEAR ALL')).toBeInTheDocument();
    });
  });

  it('should not show clear filters button when no filters are active', async () => {
    render(<AuditFilters teamId={mockTeamId} filters={{}} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText('FILTERS')).toBeInTheDocument();
    });

    expect(screen.queryByText('CLEAR ALL')).not.toBeInTheDocument();
  });

  it('should clear all filters when clear button is clicked', async () => {
    render(
      <AuditFilters
        teamId={mockTeamId}
        filters={{ search: 'test', userId: 'user-1', action: 'UPDATE' }}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('CLEAR ALL')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('CLEAR ALL');
    fireEvent.click(clearButton);

    expect(mockOnChange).toHaveBeenCalledWith({});
  });

  it('should handle fetch error gracefully', async () => {
    // Mock fetch error
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<AuditFilters teamId={mockTeamId} filters={{}} onChange={mockOnChange} />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch team members:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should preserve other filters when updating one filter', async () => {
    render(
      <AuditFilters
        teamId={mockTeamId}
        filters={{ search: 'test', userId: 'user-1' }}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('ACTION')).toBeInTheDocument();
    });

    const actionSelect = screen.getByRole('combobox', { name: /action/i });
    fireEvent.change(actionSelect, { target: { value: 'CREATE' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      search: 'test',
      userId: 'user-1',
      action: 'CREATE',
    });
  });
});
