import { useRef, useEffect, useState, useCallback } from 'react';
import type { BountyBoardFilters, BountyTier, BountyStatus, BountyCategory, AutocompleteItem } from '../../types/bounty';
import { SKILL_OPTIONS, TIER_OPTIONS, STATUS_OPTIONS, CATEGORY_OPTIONS } from '../../types/bounty';

interface Props {
  filters: BountyBoardFilters;
  onFilterChange: <K extends keyof BountyBoardFilters>(k: K, v: BountyBoardFilters[K]) => void;
  onReset: () => void;
  resultCount: number;
  totalCount: number;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const SHORTCUT_LABEL = isMac ? '\u2318K' : 'Ctrl+K';

export function BountyFilters({ filters: f, onFilterChange, onReset, resultCount, totalCount }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localQuery, setLocalQuery] = useState(f.searchQuery);
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Sync local query when external reset clears searchQuery
  useEffect(() => {
    if (f.searchQuery === '' && localQuery !== '') {
      setLocalQuery('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.searchQuery]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Cmd/Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSearch = useCallback((v: string) => {
    setLocalQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onFilterChange('searchQuery', v), 300);

    if (v.trim().length >= 2) {
      fetch(`/api/bounties/autocomplete?q=${encodeURIComponent(v.trim())}&limit=6`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.suggestions) {
            setSuggestions(data.suggestions);
            setShowSuggestions(true);
          }
        })
        .catch(() => {});
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [onFilterChange]);

  const clearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLocalQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    onFilterChange('searchQuery', '');
    searchRef.current?.focus();
  }, [onFilterChange]);

  const selectSuggestion = useCallback((item: AutocompleteItem) => {
    if (item.type === 'skill') {
      const skills = f.skills;
      if (!skills.includes(item.text)) {
        onFilterChange('skills', [...skills, item.text]);
      }
    } else {
      setLocalQuery(item.text);
      onFilterChange('searchQuery', item.text);
    }
    setShowSuggestions(false);
  }, [f.skills, onFilterChange]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasActive = f.tier !== 'all' || f.status !== 'all' || f.skills.length > 0 ||
    f.searchQuery.trim() !== '' || f.rewardMin !== '' || f.rewardMax !== '' ||
    f.creatorType !== 'all' || f.category !== 'all' || f.deadlineBefore !== '';

  const selectClass =
    'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ' +
    'focus:outline-none focus:border-solana-green/50 transition-colors cursor-pointer ' +
    'dark:border-surface-300 dark:bg-surface-50 dark:text-white';

  return (
    <div className="space-y-3" data-testid="bounty-filters">

      {/* Search bar */}
      <div className="relative" ref={suggestionsRef}>
        <div className="relative flex items-center">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          <input
            ref={searchRef}
            type="search"
            placeholder="Search bounties..."
            value={localQuery}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-20 text-base text-gray-900 placeholder-gray-500 focus:outline-none focus:border-solana-green/50 transition-colors dark:border-surface-300 dark:bg-surface-50 dark:text-white dark:placeholder-gray-500"
            aria-label="Search bounties"
            data-testid="bounty-search"
          />

          {!localQuery && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 pointer-events-none select-none dark:border-surface-300 dark:bg-surface-100 dark:text-gray-500">
              {SHORTCUT_LABEL}
            </kbd>
          )}

          {localQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 hover:text-gray-900 transition-colors dark:hover:text-white"
              aria-label="Clear search"
              data-testid="clear-search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden dark:border-surface-300 dark:bg-surface-100">
            {suggestions.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectSuggestion(item)}
                className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-base hover:bg-gray-100 transition-colors dark:hover:bg-surface-200"
              >
                <span className={
                  'rounded px-1.5 py-0.5 text-[10px] font-medium ' +
                  (item.type === 'skill' ? 'bg-solana-purple/15 text-solana-purple' : 'bg-gray-200 text-gray-600 dark:bg-surface-300 dark:text-gray-400')
                }>
                  {item.type}
                </span>
                <span className="text-gray-900 truncate dark:text-white">{item.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compact filter row: dropdowns + controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={f.status}
          onChange={e => onFilterChange('status', e.target.value as BountyStatus | 'all')}
          className={selectClass}
          aria-label="Filter by status"
          data-testid="status-filter"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={f.tier}
          onChange={e => onFilterChange('tier', e.target.value as BountyTier | 'all')}
          className={selectClass}
          aria-label="Filter by tier"
          data-testid="tier-filter"
        >
          {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select
          value={f.category}
          onChange={e => onFilterChange('category', e.target.value as BountyCategory | 'all')}
          className={selectClass}
          aria-label="Filter by category"
          data-testid="category-filter"
        >
          {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={'rounded-lg border px-3 py-2 text-sm transition-colors ' +
            (showAdvanced ? 'border-solana-green/40 text-solana-green' : 'border-gray-300 text-gray-600 hover:text-gray-900 dark:border-surface-300 dark:text-gray-400 dark:hover:text-white')}
          data-testid="toggle-advanced"
        >
          <svg className="w-4 h-4 inline-block mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Filters
        </button>

        {hasActive && (
          <button
            type="button"
            onClick={() => { onReset(); setSuggestions([]); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors dark:border-surface-300 dark:text-gray-400 dark:hover:text-white"
            data-testid="reset-filters"
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-xs text-gray-500" data-testid="result-count">
          {resultCount} of {totalCount} bounties
        </span>
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white dark:border-surface-300 dark:bg-surface-50" data-testid="advanced-filters">
          <span className="text-xs text-gray-500">Reward:</span>
          <input
            type="number"
            placeholder="Min"
            value={f.rewardMin}
            onChange={e => onFilterChange('rewardMin', e.target.value)}
            className="w-24 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-solana-green/50 dark:border-surface-300 dark:bg-surface-100 dark:text-white"
            aria-label="Minimum reward"
            data-testid="reward-min"
          />
          <span className="text-xs text-gray-500">&mdash;</span>
          <input
            type="number"
            placeholder="Max"
            value={f.rewardMax}
            onChange={e => onFilterChange('rewardMax', e.target.value)}
            className="w-24 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:border-solana-green/50 dark:border-surface-300 dark:bg-surface-100 dark:text-white"
            aria-label="Maximum reward"
            data-testid="reward-max"
          />
          <span className="text-xs text-gray-500">USDC</span>

          <span className="text-xs text-gray-500 ml-3">Deadline:</span>
          <input
            type="date"
            value={f.deadlineBefore}
            onChange={e => onFilterChange('deadlineBefore', e.target.value)}
            className="rounded-lg border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-solana-green/50 dark:border-surface-300 dark:bg-surface-100 dark:text-white dark:scheme-dark"
            aria-label="Deadline before date"
            data-testid="deadline-filter"
          />

          <select
            value={f.creatorType}
            onChange={e => onFilterChange('creatorType', e.target.value as 'all' | 'platform' | 'community')}
            className="rounded-lg border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-solana-green/50 dark:border-surface-300 dark:bg-surface-100 dark:text-white ml-auto"
            aria-label="Filter by creator type"
            data-testid="creator-type-filter"
          >
            <option value="all">All Creators</option>
            <option value="platform">Platform</option>
            <option value="community">Community</option>
          </select>
        </div>
      )}
    </div>
  );
}
