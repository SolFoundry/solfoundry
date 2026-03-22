import { useState, useEffect, useCallback, useRef } from 'react';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
  loading?: boolean;
}

export function Pagination({ page, totalPages, total, onPageChange, loading = false }: Props) {
  const [goToValue, setGoToValue] = useState('');
  const navRef = useRef<HTMLElement>(null);

  const range = () => {
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
  };

  const changePage = useCallback(
    (p: number) => {
      const clamped = Math.max(1, Math.min(p, totalPages));
      if (clamped !== page) {
        onPageChange(clamped);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [page, totalPages, onPageChange],
  );

  // Keyboard navigation: left/right arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only fire when not focused inside an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') changePage(page - 1);
      else if (e.key === 'ArrowRight') changePage(page + 1);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [page, changePage]);

  const handleGoTo = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(goToValue, 10);
    if (!isNaN(num)) {
      changePage(num);
      setGoToValue('');
    }
  };

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      {/* Total count display */}
      <p className="text-xs text-gray-400" aria-live="polite">
        {loading ? (
          <span className="animate-pulse text-gray-500">Loading…</span>
        ) : (
          <>
            Page <span className="text-white font-medium">{page}</span> of{' '}
            <span className="text-white font-medium">{totalPages}</span>
            {' '}
            <span className="text-gray-500">({total.toLocaleString()} {total === 1 ? 'bounty' : 'bounties'})</span>
          </>
        )}
      </p>

      <nav
        ref={navRef}
        className="flex items-center justify-center gap-1"
        data-testid="pagination"
        aria-label="Search results pagination"
      >
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => changePage(page - 1)}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          &larr; Prev
        </button>

        {range().map((p, i) =>
          p === '...' ? (
            <span key={'e' + i} className="px-2 text-xs text-gray-500">&hellip;</span>
          ) : (
            <button
              key={p}
              type="button"
              disabled={loading}
              onClick={() => changePage(p)}
              className={
                'rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ' +
                (p === page
                  ? 'bg-solana-green/15 text-solana-green'
                  : 'text-gray-400 hover:text-white hover:bg-surface-200')
              }
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => changePage(page + 1)}
          className="rounded-lg px-3 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          Next &rarr;
        </button>
      </nav>

      {/* Go to page input */}
      {totalPages > 1 && (
        <form onSubmit={handleGoTo} className="flex items-center gap-2">
          <label htmlFor="pagination-goto" className="text-xs text-gray-500 select-none">
            Go to page
          </label>
          <input
            id="pagination-goto"
            type="number"
            min={1}
            max={totalPages}
            value={goToValue}
            onChange={e => setGoToValue(e.target.value)}
            placeholder={String(page)}
            className="w-16 rounded-lg bg-surface-200 border border-white/10 px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-solana-green/50"
            aria-label="Go to page number"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg px-3 py-1 text-xs font-medium bg-surface-200 text-gray-300 hover:text-white hover:bg-surface-300 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10"
          >
            Go
          </button>
        </form>
      )}
    </div>
  );
}
