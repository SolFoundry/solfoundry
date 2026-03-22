import type { BountySortBy } from '../../types/bounty';
import { SORT_OPTIONS } from '../../types/bounty';

/** Ascending arrow icon (points up). */
function ArrowUp({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className ?? 'w-3 h-3'}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8 2.25a.75.75 0 0 1 .566.258l4 4.5a.75.75 0 1 1-1.132.984L8.75 4.56V13a.75.75 0 0 1-1.5 0V4.56L4.566 7.992a.75.75 0 0 1-1.132-.984l4-4.5A.75.75 0 0 1 8 2.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Descending arrow icon (points down). */
function ArrowDown({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className ?? 'w-3 h-3'}
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8 13.75a.75.75 0 0 1-.566-.258l-4-4.5a.75.75 0 1 1 1.132-.984L7.25 11.44V3a.75.75 0 0 1 1.5 0v8.44l2.684-3.432a.75.75 0 1 1 1.132.984l-4 4.5A.75.75 0 0 1 8 13.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function BountySortBar({ sortBy, onSortChange }: { sortBy: BountySortBy; onSortChange: (s: BountySortBy) => void }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto" data-testid="bounty-sort-bar">
      <span className="text-xs text-gray-500 whitespace-nowrap">Sort by:</span>
      {SORT_OPTIONS.map(o => {
        const isActive = sortBy === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onSortChange(o.value)}
            className={
              'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ' +
              (isActive
                ? 'bg-solana-green/15 text-solana-green'
                : 'text-gray-400 hover:text-white hover:bg-surface-200')
            }
            aria-pressed={isActive}
            data-testid={'sort-' + o.value}
          >
            {o.label}
            {isActive && (
              o.direction === 'asc'
                ? <ArrowUp className="w-3 h-3" />
                : <ArrowDown className="w-3 h-3" />
            )}
          </button>
        );
      })}
    </div>
  );
}
