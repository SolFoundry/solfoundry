import React from 'react';
import { Search } from 'lucide-react';

interface EmptyStateProps {
  onReset: () => void;
}

export function EmptyState({ onReset }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-forge-800 flex items-center justify-center mb-4">
        <Search className="w-7 h-7 text-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">No bounties found</h3>
      <p className="text-text-muted text-sm mb-6 max-w-sm">
        No bounties match your current filters. Try adjusting your search or clearing the filters.
      </p>
      <button
        onClick={onReset}
        className="px-4 py-2 rounded-lg bg-forge-800 text-text-secondary text-sm font-medium hover:bg-forge-700 hover:text-text-primary transition-colors"
      >
        Clear all filters
      </button>
    </div>
  );
}
