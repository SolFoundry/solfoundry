import { useState, useCallback, type KeyboardEvent } from 'react';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}

function pageRange(page: number, totalPages: number): (number | '...')[] {
  const pages: (number | '...')[] = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }
  return pages;
}

export function Pagination({ page, totalPages, total, onPageChange }: Props) {
  const [goToValue, setGoToValue] = useState('');

  const handleGoTo = useCallback(() => {
    const n = parseInt(goToValue, 10);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
      onPageChange(n);
      setGoToValue('');
    }
  }, [goToValue, totalPages, onPageChange]);

  const handleGoToKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleGoTo();
  }, [handleGoTo]);

  return (
    <div className="mt-8 space-y-3" data-testid="pagination">
      <p className="text-center text-xs text-gray-500" data-testid="page-metadata" aria-live="polite">
        Page {page} of {totalPages} ({total} {total === 1 ? 'bounty' : 'bounties'})
      </p>

      <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-solana-green/50 transition-colors"
          aria-label="Previous page"
        >
          &larr; Prev
        </button>
        {pageRange(page, totalPages).map((p, i) =>
          p === '...' ? (
            <span key={'e' + i} className="px-2 text-xs text-gray-500" aria-hidden="true">&hellip;</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={
                'rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-solana-green/50 transition-colors ' +
                (p === page
                  ? 'bg-solana-green/15 text-solana-green'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-surface-200')
              }
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-solana-green/50 transition-colors"
          aria-label="Next page"
        >
          Next &rarr;
        </button>
      </nav>

      {totalPages > 5 && (
        <div className="flex items-center justify-center gap-2" data-testid="go-to-page">
          <label htmlFor="go-to-page-input" className="text-xs text-gray-500">Go to page:</label>
          <input
            id="go-to-page-input"
            type="number"
            min={1}
            max={totalPages}
            value={goToValue}
            onChange={e => setGoToValue(e.target.value)}
            onKeyDown={handleGoToKeyDown}
            className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 text-center focus:outline-none focus:border-solana-green/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none dark:border-surface-300 dark:bg-surface-50 dark:text-white"
            aria-label={`Go to page, 1 to ${totalPages}`}
            data-testid="go-to-page-input"
          />
          <button
            type="button"
            onClick={handleGoTo}
            disabled={!goToValue}
            className="rounded-lg px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-solana-green/50 transition-colors"
            data-testid="go-to-page-btn"
          >
            Go
          </button>
        </div>
      )}
    </div>
  );
}
