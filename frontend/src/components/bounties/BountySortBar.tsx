import type { BountySortBy } from '../../types/bounty';
import { SORT_OPTIONS } from '../../types/bounty';
export function BountySortBar({ sortBy, onSortChange }: { sortBy: BountySortBy; onSortChange: (s: BountySortBy) => void }) {
  return (<div className="flex items-center gap-2" data-testid="bounty-sort-bar"><span className="text-xs text-gray-500">Sort:</span>{SORT_OPTIONS.map(o => <button key={o.value} type="button" onClick={() => onSortChange(o.value)} className={'rounded-lg px-3 py-1.5 text-xs font-medium ' + (sortBy === o.value ? 'bg-solana-green/15 text-solana-green' : 'text-gray-400 hover:text-white')} aria-pressed={sortBy === o.value} data-testid={'sort-' + o.value}>{o.label}</button>)}</div>);
}
