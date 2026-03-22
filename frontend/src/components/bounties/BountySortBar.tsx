import type { BountySortBy } from '../../types/bounty';
import { SORT_OPTIONS, bountySortDirection } from '../../types/bounty';

function SortDirectionIcon({ direction }: { direction: 'asc' | 'desc' }) {
  const label = direction === 'desc' ? 'Sorted descending' : 'Sorted ascending';
  return (
    <span
      className="inline-flex shrink-0 text-gray-500 dark:text-gray-400"
      title={label}
      aria-hidden
      data-testid={`sort-direction-${direction}`}
    >
      {direction === 'desc' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      )}
    </span>
  );
}

export function BountySortBar({
  sortBy,
  onSortChange,
}: {
  sortBy: BountySortBy;
  onSortChange: (s: BountySortBy) => void;
}) {
  const direction = bountySortDirection(sortBy);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" data-testid="bounty-sort-bar">
      <label htmlFor="bounty-sort-select" className="text-xs font-medium text-gray-600 whitespace-nowrap dark:text-gray-400">
        Sort
      </label>
      <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white pl-2 pr-1 py-0.5 dark:border-surface-300 dark:bg-surface-50">
        <select
          id="bounty-sort-select"
          value={sortBy}
          aria-label="Sort bounties"
          onChange={e => onSortChange(e.target.value as BountySortBy)}
          className="min-w-0 flex-1 cursor-pointer bg-transparent py-1.5 pl-1 pr-2 text-xs font-medium text-gray-900 focus:outline-none dark:text-white"
          data-testid="bounty-sort-select"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <SortDirectionIcon direction={direction} />
      </div>
      <span className="sr-only" aria-live="polite">
        {direction === 'desc' ? 'Descending order' : 'Ascending order'}
      </span>
    </div>
  );
}
