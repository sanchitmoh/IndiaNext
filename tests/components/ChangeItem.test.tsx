/**
 * Unit Tests: ChangeItem Component
 * 
 * Tests the ChangeItem component functionality:
 * - Displays field name formatted for readability
 * - Displays old value → new value for UPDATE
 * - Displays "Added: [value]" for CREATE (green)
 * - Displays "Removed: [value]" for DELETE (red)
 * - Color codes by action type (green/red/yellow)
 * - Shows "View Full Diff" button for long text fields
 * - Toggles full text display when button is clicked
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChangeItem } from '@/components/admin/teams/ChangeItem';

describe('ChangeItem Component', () => {
  const mockUser = {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'LEADER' as const,
  };

  describe('Field Name Formatting', () => {
    it('should format camelCase field names to Title Case', () => {
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'UPDATE' as const,
        fieldName: 'teamName',
        oldValue: 'Old Name',
        newValue: 'New Name',
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      expect(screen.getByText('Team Name:')).toBeInTheDocument();
    });

    it('should format member fields correctly', () => {
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'UPDATE' as const,
        fieldName: 'member2Email',
        oldValue: 'old@example.com',
        newValue: 'new@example.com',
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      expect(screen.getByText('Member 2 Email:')).toBeInTheDocument();
    });
  });

  describe('CREATE Action', () => {
    it('should display "Added:" with green color for CREATE action', () => {
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'CREATE' as const,
        fieldName: 'additionalNotes',
        oldValue: null,
        newValue: 'New notes added',
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const { container } = render(<ChangeItem change={change} />);
      
      expect(screen.getByText('Added:')).toBeInTheDocument();
      expect(screen.getByText('"New notes added"')).toBeInTheDocument();
      
      // Check for green color class
      const listItem = container.querySelector('li');
      expect(listItem?.className).toContain('text-emerald-400');
    });

    it('should truncate long text for CREATE action', () => {
      const longText = 'A'.repeat(150);
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'CREATE' as const,
        fieldName: 'problemStatement',
        oldValue: null,
        newValue: longText,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      // Should show truncated text
      expect(screen.getByText(/"A{100}\.\.\."/)).toBeInTheDocument();
    });
  });

  describe('DELETE Action', () => {
    it('should display "Removed:" with red color for DELETE action', () => {
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'DELETE' as const,
        fieldName: 'member3Email',
        oldValue: 'removed@example.com',
        newValue: null,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const { container } = render(<ChangeItem change={change} />);
      
      expect(screen.getByText('Removed:')).toBeInTheDocument();
      expect(screen.getByText('"removed@example.com"')).toBeInTheDocument();
      
      // Check for red color class
      const listItem = container.querySelector('li');
      expect(listItem?.className).toContain('text-red-400');
    });

    it('should truncate long text for DELETE action', () => {
      const longText = 'B'.repeat(150);
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'DELETE' as const,
        fieldName: 'problemStatement',
        oldValue: longText,
        newValue: null,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      // Should show truncated text
      expect(screen.getByText(/"B{100}\.\.\."/)).toBeInTheDocument();
    });
  });

  describe('UPDATE Action', () => {
    it('should display old value → new value with yellow color for UPDATE action', () => {
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'UPDATE' as const,
        fieldName: 'teamName',
        oldValue: 'Old Team Name',
        newValue: 'New Team Name',
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      const { container } = render(<ChangeItem change={change} />);
      
      expect(screen.getByText('"Old Team Name"')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('"New Team Name"')).toBeInTheDocument();
      
      // Check for yellow color class
      const listItem = container.querySelector('li');
      expect(listItem?.className).toContain('text-amber-400');
    });

    it('should truncate long text for UPDATE action', () => {
      const longOldText = 'C'.repeat(150);
      const longNewText = 'D'.repeat(150);
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'UPDATE' as const,
        fieldName: 'problemStatement',
        oldValue: longOldText,
        newValue: longNewText,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      // Should show truncated text (50 chars for UPDATE)
      expect(screen.getByText(/"C{50}\.\.\."/)).toBeInTheDocument();
      expect(screen.getByText(/"D{50}\.\.\."/)).toBeInTheDocument();
    });
  });

  describe('View Full Diff Button', () => {
    it('should show "View Full Diff" button for long text fields', () => {
      const longText = 'E'.repeat(150);
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'CREATE' as const,
        fieldName: 'problemStatement',
        oldValue: null,
        newValue: longText,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      expect(screen.getByText('View Full Diff')).toBeInTheDocument();
    });

    it('should not show "View Full Diff" button for short text fields', () => {
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'UPDATE' as const,
        fieldName: 'teamName',
        oldValue: 'Old Name',
        newValue: 'New Name',
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      expect(screen.queryByText('View Full Diff')).not.toBeInTheDocument();
    });

    it('should toggle full text display when button is clicked', () => {
      const longText = 'F'.repeat(150);
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'CREATE' as const,
        fieldName: 'problemStatement',
        oldValue: null,
        newValue: longText,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      // Initially shows truncated text
      expect(screen.getByText(/"F{100}\.\.\."/)).toBeInTheDocument();
      expect(screen.queryByText(`"${longText}"`)).not.toBeInTheDocument();
      
      // Click "View Full Diff" button
      const button = screen.getByText('View Full Diff');
      fireEvent.click(button);
      
      // Should now show full text
      expect(screen.getByText(`"${longText}"`)).toBeInTheDocument();
      expect(screen.getByText('Hide Full Diff')).toBeInTheDocument();
      
      // Click "Hide Full Diff" button
      fireEvent.click(screen.getByText('Hide Full Diff'));
      
      // Should show truncated text again
      expect(screen.getByText(/"F{100}\.\.\."/)).toBeInTheDocument();
      expect(screen.getByText('View Full Diff')).toBeInTheDocument();
    });

    it('should show button when old value is long in UPDATE action', () => {
      const longOldText = 'G'.repeat(150);
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'UPDATE' as const,
        fieldName: 'problemStatement',
        oldValue: longOldText,
        newValue: 'Short new value',
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      expect(screen.getByText('View Full Diff')).toBeInTheDocument();
    });

    it('should show button when new value is long in UPDATE action', () => {
      const longNewText = 'H'.repeat(150);
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'UPDATE' as const,
        fieldName: 'problemStatement',
        oldValue: 'Short old value',
        newValue: longNewText,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      expect(screen.getByText('View Full Diff')).toBeInTheDocument();
    });

    it('should expand both old and new values when toggled in UPDATE action', () => {
      const longOldText = 'I'.repeat(150);
      const longNewText = 'J'.repeat(150);
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'UPDATE' as const,
        fieldName: 'problemStatement',
        oldValue: longOldText,
        newValue: longNewText,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      // Initially shows truncated text
      expect(screen.getByText(/"I{50}\.\.\."/)).toBeInTheDocument();
      expect(screen.getByText(/"J{50}\.\.\."/)).toBeInTheDocument();
      
      // Click "View Full Diff" button
      const button = screen.getByText('View Full Diff');
      fireEvent.click(button);
      
      // Should now show full text for both values
      expect(screen.getByText(`"${longOldText}"`)).toBeInTheDocument();
      expect(screen.getByText(`"${longNewText}"`)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values gracefully', () => {
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'CREATE' as const,
        fieldName: 'additionalNotes',
        oldValue: null,
        newValue: null,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      expect(screen.getByText('Additional Notes:')).toBeInTheDocument();
    });

    it('should handle exactly 100 character text (boundary)', () => {
      const exactText = 'K'.repeat(100);
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'CREATE' as const,
        fieldName: 'problemStatement',
        oldValue: null,
        newValue: exactText,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      // Should not show "View Full Diff" button for exactly 100 chars
      expect(screen.queryByText('View Full Diff')).not.toBeInTheDocument();
      expect(screen.getByText(`"${exactText}"`)).toBeInTheDocument();
    });

    it('should handle 101 character text (just over boundary)', () => {
      const justOverText = 'L'.repeat(101);
      const change = {
        id: 'change-1',
        submissionId: 'sub-1',
        timestamp: new Date(),
        action: 'CREATE' as const,
        fieldName: 'problemStatement',
        oldValue: null,
        newValue: justOverText,
        user: mockUser,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      render(<ChangeItem change={change} />);
      
      // Should show "View Full Diff" button for 101 chars
      expect(screen.getByText('View Full Diff')).toBeInTheDocument();
    });
  });
});
