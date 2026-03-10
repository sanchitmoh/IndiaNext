/**
 * Unit Tests: Pagination Component
 * 
 * Tests the Pagination component functionality:
 * - Displays current page and total pages
 * - Previous/Next buttons work correctly
 * - Buttons are disabled appropriately (first/last page)
 * - Page number input for direct navigation
 * - Updates parent state when page changes
 * - Validates page input (rejects invalid values)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '@/components/admin/teams/Pagination';

describe('Pagination Component', () => {
  describe('Display', () => {
    it('should display current page and total pages', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={3}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      expect(screen.getByDisplayValue('3')).toBeInTheDocument();
      expect(screen.getByText('of 10')).toBeInTheDocument();
    });

    it('should display page 1 of 1 for single page', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={1}
          onPageChange={onPageChange}
        />
      );

      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
      expect(screen.getByText('of 1')).toBeInTheDocument();
    });
  });

  describe('Previous Button', () => {
    it('should call onPageChange with previous page when clicked', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const prevButton = screen.getByLabelText('Previous page');
      fireEvent.click(prevButton);

      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('should be disabled on first page', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const prevButton = screen.getByLabelText('Previous page');
      expect(prevButton).toBeDisabled();
    });

    it('should not call onPageChange when disabled and clicked', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const prevButton = screen.getByLabelText('Previous page');
      fireEvent.click(prevButton);

      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('should be enabled on any page except first', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={2}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const prevButton = screen.getByLabelText('Previous page');
      expect(prevButton).not.toBeDisabled();
    });
  });

  describe('Next Button', () => {
    it('should call onPageChange with next page when clicked', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const nextButton = screen.getByLabelText('Next page');
      fireEvent.click(nextButton);

      expect(onPageChange).toHaveBeenCalledWith(6);
    });

    it('should be disabled on last page', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={10}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const nextButton = screen.getByLabelText('Next page');
      expect(nextButton).toBeDisabled();
    });

    it('should not call onPageChange when disabled and clicked', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={10}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const nextButton = screen.getByLabelText('Next page');
      fireEvent.click(nextButton);

      expect(onPageChange).not.toHaveBeenCalled();
    });

    it('should be enabled on any page except last', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={9}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const nextButton = screen.getByLabelText('Next page');
      expect(nextButton).not.toBeDisabled();
    });
  });

  describe('Direct Page Navigation', () => {
    it('should allow typing a page number', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '7' } });

      expect(input.value).toBe('7');
    });

    it('should navigate to typed page on form submit', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number');
      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.submit(input.closest('form')!);

      expect(onPageChange).toHaveBeenCalledWith(7);
    });

    it('should navigate to typed page on blur', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number');
      fireEvent.change(input, { target: { value: '8' } });
      fireEvent.blur(input);

      expect(onPageChange).toHaveBeenCalledWith(8);
    });

    it('should accept page 1', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number');
      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.submit(input.closest('form')!);

      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('should accept last page', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number');
      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.submit(input.closest('form')!);

      expect(onPageChange).toHaveBeenCalledWith(10);
    });
  });

  describe('Input Validation', () => {
    it('should reject page number less than 1', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.submit(input.closest('form')!);

      expect(onPageChange).not.toHaveBeenCalled();
      // Should reset to current page
      expect(input.value).toBe('5');
    });

    it('should reject page number greater than total pages', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '11' } });
      fireEvent.submit(input.closest('form')!);

      expect(onPageChange).not.toHaveBeenCalled();
      // Should reset to current page
      expect(input.value).toBe('5');
    });

    it('should reject negative page numbers', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '-1' } });
      fireEvent.submit(input.closest('form')!);

      expect(onPageChange).not.toHaveBeenCalled();
      expect(input.value).toBe('5');
    });

    it('should reject non-numeric input', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.submit(input.closest('form')!);

      expect(onPageChange).not.toHaveBeenCalled();
      expect(input.value).toBe('5');
    });

    it('should reject empty input', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.submit(input.closest('form')!);

      expect(onPageChange).not.toHaveBeenCalled();
      expect(input.value).toBe('5');
    });

    it('should accept decimal numbers by truncating to integer', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '7.5' } });
      fireEvent.submit(input.closest('form')!);

      // parseInt truncates to 7, which is valid
      expect(onPageChange).toHaveBeenCalledWith(7);
    });
  });

  describe('State Synchronization', () => {
    it('should update input when currentPage prop changes', () => {
      const onPageChange = vi.fn();
      const { rerender } = render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      expect(input.value).toBe('5');

      // Update currentPage prop
      rerender(
        <Pagination
          currentPage={7}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      expect(input.value).toBe('7');
    });

    it('should maintain input value during typing', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number') as HTMLInputElement;
      
      // Type partial value
      fireEvent.change(input, { target: { value: '1' } });
      expect(input.value).toBe('1');
      
      // Continue typing
      fireEvent.change(input, { target: { value: '10' } });
      expect(input.value).toBe('10');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single page scenario', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={1}
          onPageChange={onPageChange}
        />
      );

      const prevButton = screen.getByLabelText('Previous page');
      const nextButton = screen.getByLabelText('Next page');

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('should handle two page scenario on first page', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={1}
          totalPages={2}
          onPageChange={onPageChange}
        />
      );

      const prevButton = screen.getByLabelText('Previous page');
      const nextButton = screen.getByLabelText('Next page');

      expect(prevButton).toBeDisabled();
      expect(nextButton).not.toBeDisabled();
    });

    it('should handle two page scenario on last page', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={2}
          totalPages={2}
          onPageChange={onPageChange}
        />
      );

      const prevButton = screen.getByLabelText('Previous page');
      const nextButton = screen.getByLabelText('Next page');

      expect(prevButton).not.toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('should handle large page numbers', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={999}
          totalPages={1000}
          onPageChange={onPageChange}
        />
      );

      expect(screen.getByDisplayValue('999')).toBeInTheDocument();
      expect(screen.getByText('of 1000')).toBeInTheDocument();

      const nextButton = screen.getByLabelText('Next page');
      fireEvent.click(nextButton);

      expect(onPageChange).toHaveBeenCalledWith(1000);
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria labels', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
      expect(screen.getByLabelText('Next page')).toBeInTheDocument();
      expect(screen.getByLabelText('Page number')).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      const onPageChange = vi.fn();
      render(
        <Pagination
          currentPage={5}
          totalPages={10}
          onPageChange={onPageChange}
        />
      );

      const input = screen.getByLabelText('Page number');
      
      // Focus input
      input.focus();
      expect(document.activeElement).toBe(input);
      
      // Type and submit with Enter (form submission)
      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.submit(input.closest('form')!);

      expect(onPageChange).toHaveBeenCalledWith(7);
    });
  });
});
