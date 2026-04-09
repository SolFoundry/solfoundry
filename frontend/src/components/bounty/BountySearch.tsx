import React, { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface BountySearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function BountySearch({
  onSearch,
  placeholder = 'Search bounties by title, description, or tags...',
  debounceMs = 300,
}: BountySearchProps) {
  const [query, setQuery] = useState('');
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (timer) clearTimeout(timer);

      const newTimer = setTimeout(() => {
        onSearch(value);
      }, debounceMs);

      setTimer(newTimer);
    },
    [debounceMs, onSearch, timer]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
    if (timer) clearTimeout(timer);
  }, [onSearch, timer]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-forge-700 bg-forge-800/50 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-emerald/50 focus:border-emerald/50 transition-colors duration-150 text-sm"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
