interface Props {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: Props) {
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

  return (
    <nav className="flex items-center justify-center gap-1 mt-8" data-testid="pagination" aria-label="Search results pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-lg px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
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
            onClick={() => onPageChange(p)}
            className={
              'rounded-lg px-3 py-1.5 text-xs font-medium ' +
              (p === page
                ? 'bg-solana-green/15 text-solana-green'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-surface-200')
            }
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-lg px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        Next &rarr;
      </button>
    </nav>
  );
}
