import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
}

function getPageItems(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const range: number[] = [];
  for (
    let i = Math.max(2, page - 2);
    i <= Math.min(totalPages - 1, page + 2);
    i++
  ) {
    range.push(i);
  }

  const pages: (number | '…')[] = [1];
  if (range[0] > 2) pages.push('…');
  pages.push(...range);
  if (range[range.length - 1] < totalPages - 1) pages.push('…');
  pages.push(totalPages);
  return pages;
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  const [goToValue, setGoToValue] = useState('');
  const pages = getPageItems(page, totalPages);
  const showGoTo = totalPages > 5;

  function handleGoToKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const num = parseInt(goToValue, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= totalPages) {
      onPageChange(num);
      setGoToValue('');
    }
  }

  return (
    <nav role="navigation" className="flex flex-col items-center gap-3">
      {total !== undefined && (
        <p data-testid="page-metadata" className="text-sm text-text-muted">
          Page {page} of {totalPages} ({total} {total === 1 ? 'bounty' : 'bounties'})
        </p>
      )}
      <div className="flex items-center gap-1">
        <button
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-forge-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-text-muted select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p as number)}
              className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-emerald text-forge-950 font-bold'
                  : 'text-text-secondary hover:bg-forge-800 hover:text-text-primary'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-2 rounded-md text-text-muted hover:text-text-primary hover:bg-forge-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {showGoTo && (
        <div data-testid="go-to-page" className="flex items-center gap-2 text-sm text-text-muted">
          <label htmlFor="goto-page-input" className="text-xs">
            Go to page
          </label>
          <input
            id="goto-page-input"
            data-testid="go-to-page-input"
            type="number"
            min={1}
            max={totalPages}
            value={goToValue}
            onChange={(e) => setGoToValue(e.target.value)}
            onKeyDown={handleGoToKeyDown}
            className="w-16 px-2 py-1 text-sm bg-forge-800 border border-border rounded-md text-text-primary focus:border-emerald outline-none"
          />
        </div>
      )}
    </nav>
  );
}
