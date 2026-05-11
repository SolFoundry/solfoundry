import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface BountySearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function BountySearchBar({
  onSearch,
  placeholder = 'Search bounties by title, description, or tags...',
  debounceMs = 300,
  className = '',
}: BountySearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onSearch(value.trim().toLowerCase());
      }, debounceMs);
    },
    [onSearch, debounceMs]
  );

  // Clear search
  const handleClear = useCallback(() => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  }, [onSearch]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && isFocused) {
        inputRef.current?.blur();
        if (query) handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, query, handleClear]);

  return (
    <div className={`relative group ${className}`}>
      {/* Search icon */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search
          className={`w-4 h-4 transition-colors ${
            isFocused ? 'text-emerald' : 'text-text-muted'
          }`}
        />
      </div>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        aria-label="Search bounties"
        className={`
          w-full pl-10 pr-10 py-2.5
          bg-surface-card border rounded-lg
          text-sm text-text-primary placeholder-text-muted
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald/50
          ${isFocused
            ? 'border-emerald/50 shadow-sm shadow-emerald/10'
            : 'border-border-primary hover:border-border-secondary'
          }
        `}
      />

      {/* Clear button or keyboard shortcut hint */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-3">
        {query ? (
          <button
            onClick={handleClear}
            className="p-1 rounded-md hover:bg-surface-hover transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4 text-text-muted hover:text-text-primary" />
          </button>
        ) : !isFocused ? (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-surface-hover rounded border border-border-primary">
            ⌘K
          </kbd>
        ) : null}
      </div>
    </div>
  );
}

// Utility hook: filter bounties client-side
export function useBountySearch() {
  const [searchQuery, setSearchQuery] = useState('');

  const filterBounties = useCallback(
    <T extends { title?: string; description?: string; tags?: string[]; skills?: string[] }>(
      bounties: T[]
    ): T[] => {
      if (!searchQuery) return bounties;

      return bounties.filter((bounty) => {
        const q = searchQuery;
        const title = (bounty.title ?? '').toLowerCase();
        const desc = (bounty.description ?? '').toLowerCase();
        const tags = (bounty.tags ?? bounty.skills ?? []).join(' ').toLowerCase();

        return title.includes(q) || desc.includes(q) || tags.includes(q);
      });
    },
    [searchQuery]
  );

  return { searchQuery, setSearchQuery, filterBounties };
}

export default BountySearchBar;
