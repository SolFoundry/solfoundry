export function EmptyState({ onReset }: { onReset: () => void }) {
  return (<div className="flex flex-col items-center py-16 text-center" data-testid="empty-state"><h3 className="text-lg font-semibold text-white mb-1">No bounties found</h3><p className="text-sm text-gray-500 mb-4">Try adjusting your filters.</p><button type="button" onClick={onReset} className="rounded-lg bg-solana-green/15 px-4 py-2 text-sm text-solana-green" data-testid="empty-state-reset">Clear all filters</button></div>);
}
