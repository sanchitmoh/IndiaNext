"use client";

import { useState, useEffect } from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const [pageInput, setPageInput] = useState(currentPage.toString());

  // Update input when currentPage changes externally
  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput, 10);
    
    // Validate page number
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    } else {
      // Reset to current page if invalid
      setPageInput(currentPage.toString());
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
      {/* Previous Button */}
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:bg-white/[0.03] rounded"
        aria-label="Previous page"
      >
        ← PREVIOUS
      </button>

      {/* Page Info and Direct Navigation */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-gray-500">Page</span>
        <form onSubmit={handlePageInputSubmit} className="inline-flex items-center">
          <input
            type="text"
            value={pageInput}
            onChange={handlePageInputChange}
            onBlur={handlePageInputSubmit}
            className="w-12 px-2 py-1 text-xs font-mono text-center bg-white/[0.03] border border-white/[0.06] rounded text-gray-300 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 hover:border-white/[0.12] transition-colors duration-200"
            aria-label="Page number"
          />
        </form>
        <span className="text-xs font-mono text-gray-500">of {totalPages}</span>
      </div>

      {/* Next Button */}
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-gray-400 hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:bg-white/[0.03] rounded"
        aria-label="Next page"
      >
        NEXT →
      </button>
    </div>
  );
}
