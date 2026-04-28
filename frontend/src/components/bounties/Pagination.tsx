import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPages = (): (number | '…')[] => {
    const pages: (number | '…')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('…');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('…');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className="flex items-center gap-1"
    >
      <button
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-forge-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {getPages().map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-text-muted text-sm">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={page === p ? 'page' : undefined}
            className={cn(
              'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
              page === p
                ? 'bg-emerald/15 text-emerald border border-emerald/30'
                : 'text-text-muted hover:text-text-secondary hover:bg-forge-700',
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-forge-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
