import { useRef, useEffect, useState, useCallback } from 'react';
import type { BountyBoardFilters, BountyTier, BountyStatus, BountyCategory, AutocompleteItem } from '../../types/bounty';
import { SKILL_OPTIONS, TIER_OPTIONS, STATUS_OPTIONS, CREATOR_TYPE_OPTIONS, CATEGORY_OPTIONS } from '../../types/bounty';

interface Props {
  filters: BountyBoardFilters;
  onFilterChange: <K extends keyof BountyBoardFilters>(k: K, v: BountyBoardFilters[K]) => void;
  onReset: () => void;
  resultCount: number;
  totalCount: number;
}

// Compact chip labels (shorter than full option labels)
const TIER_CHIP_LABELS: Record<string, string> = {
  all: 'All', T1: 'T1', T2: 'T2', T3: 'T3',
};

const STATUS_CHIP_LABELS: Record<string, string> = {
  all: 'All', open: 'Open', 'in-progress': 'In Progress',
  under_review: 'Under Review', completed: 'Completed',
  disputed: 'Disputed', paid: 'Paid', cancelled: 'Cancelled',
};

const CATEGORY_CHIP_LABELS: Record<string, string> = {
  all: 'All', 'smart-contract': 'Smart Contract', frontend: 'Frontend',
  backend: 'Backend', design: 'Design', content: 'Content',
  security: 'Security', devops: 'DevOps', documentation: 'Docs',
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl+K';

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

  const toggleSkill = useCallback((s: string) => {
    const current = f.skills;
    onFilterChange('skills', current.includes(s) ? current.filter(x => x !== s) : [...current, s]);
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

  const chipBase = 'rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors';
  const chipActive = 'bg-solana-green/15 text-solana-green border-solana-green/30';
  const chipInactive = 'bg-surface-50 text-gray-400 border-surface-300 hover:text-white hover:border-surface-200';

  return (
    <div className="space-y-3" data-testid="bounty-filters">

      {/* Search bar */}
      <div className="relative" ref={suggestionsRef}>
        <div className="relative flex items-center">
          {/* Search icon */}
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
            placeholder="Search bounties by title, description, tags..."
            value={localQuery}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="w-full rounded-lg border border-surface-300 bg-surface-50 pl-10 pr-20 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-solana-green/50 transition-colors"
            aria-label="Search bounties"
            data-testid="bounty-search"
          />

          {/* Keyboard shortcut hint (hidden when typing) */}
          {!localQuery && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 rounded border border-surface-300 bg-surface-100 px-1.5 py-0.5 text-[10px] text-gray-500 pointer-events-none select-none">
              {SHORTCUT_LABEL}
            </kbd>
          )}

          {/* Clear (X) button */}
          {localQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-500 hover:text-white transition-colors"
              aria-label="Clear search"
              data-testid="clear-search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-surface-300 bg-surface-100 shadow-xl overflow-hidden">
            {suggestions.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectSuggestion(item)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-surface-200 transition-colors"
              >
                <span className={
                  'rounded px-1.5 py-0.5 text-[10px] font-medium ' +
                  (item.type === 'skill' ? 'bg-solana-purple/15 text-solana-purple' : 'bg-surface-300 text-gray-400')
                }>
                  {item.type}
                </span>
                <span className="text-white truncate">{item.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter chip groups: Tier, Status, Category */}
      <div className="space-y-2">

        {/* Tier chips */}
        <div className="flex flex-wrap items-center gap-1.5" data-testid="tier-chips">
          <span className="text-xs text-gray-500 shrink-0 w-14">Tier:</span>
          {TIER_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => onFilterChange('tier', o.value)}
              className={`${chipBase} ${f.tier === o.value ? chipActive : chipInactive}`}
              aria-pressed={f.tier === o.value}
              title={o.label}
              data-testid={`tier-chip-${o.value}`}
            >
              {TIER_CHIP_LABELS[o.value] ?? o.label}
            </button>
          ))}
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-1.5" data-testid="status-chips">
          <span className="text-xs text-gray-500 shrink-0 w-14">Status:</span>
          {STATUS_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => onFilterChange('status', o.value as BountyStatus | 'all')}
              className={`${chipBase} ${f.status === o.value ? chipActive : chipInactive}`}
              aria-pressed={f.status === o.value}
              data-testid={`status-chip-${o.value}`}
            >
              {STATUS_CHIP_LABELS[o.value] ?? o.label}
            </button>
          ))}
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap items-center gap-1.5" data-testid="category-chips">
          <span className="text-xs text-gray-500 shrink-0 w-14">Category:</span>
          {CATEGORY_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => onFilterChange('category', o.value as BountyCategory | 'all')}
              className={`${chipBase} ${f.category === o.value ? chipActive : chipInactive}`}
              aria-pressed={f.category === o.value}
              title={o.label}
              data-testid={`category-chip-${o.value}`}
            >
              {CATEGORY_CHIP_LABELS[o.value] ?? o.label}
            </button>
          ))}
        </div>

      </div>

      {/* Controls row: creator type, more filters, clear all, result count */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={f.creatorType}
          onChange={e => onFilterChange('creatorType', e.target.value as 'all' | 'platform' | 'community')}
          className="rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-solana-green/50"
          aria-label="Filter by creator type"
          data-testid="creator-type-filter"
        >
          {CREATOR_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={'rounded-lg border px-3 py-1.5 text-sm transition-colors ' +
            (showAdvanced ? 'border-solana-green/40 text-solana-green' : 'border-surface-300 text-gray-400 hover:text-white')}
          data-testid="toggle-advanced"
        >
          {showAdvanced ? 'Less' : 'More'} Filters
        </button>

        {hasActive && (
          <button
            type="button"
            onClick={() => { onReset(); setSuggestions([]); }}
            className="rounded-lg border border-surface-300 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            data-testid="reset-filters"
          >
            Clear all
          </button>
        )}

        <span className="ml-auto text-xs text-gray-500" data-testid="result-count">
          Showing {resultCount} of {totalCount} bounties
        </span>
      </div>

      {/* Advanced filters: reward range + deadline */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-surface-300 bg-surface-50" data-testid="advanced-filters">
          <span className="text-xs text-gray-500">Reward:</span>
          <input
            type="number"
            placeholder="Min"
            value={f.rewardMin}
            onChange={e => onFilterChange('rewardMin', e.target.value)}
            className="w-24 rounded-lg border border-surface-300 bg-surface-100 px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-solana-green/50"
            aria-label="Minimum reward"
            data-testid="reward-min"
          />
          <span className="text-xs text-gray-500">—</span>
          <input
            type="number"
            placeholder="Max"
            value={f.rewardMax}
            onChange={e => onFilterChange('rewardMax', e.target.value)}
            className="w-24 rounded-lg border border-surface-300 bg-surface-100 px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-solana-green/50"
            aria-label="Maximum reward"
            data-testid="reward-max"
          />
          <span className="text-xs text-gray-500 ml-1">$FNDRY</span>

          <span className="text-xs text-gray-500 ml-3">Deadline before:</span>
          <input
            type="date"
            value={f.deadlineBefore}
            onChange={e => onFilterChange('deadlineBefore', e.target.value)}
            className="rounded-lg border border-surface-300 bg-surface-100 px-2 py-1 text-sm text-white focus:outline-none focus:border-solana-green/50 scheme-dark"
            aria-label="Deadline before date"
            data-testid="deadline-filter"
          />
        </div>
      )}

      {/* Skill pills */}
      <div className="flex flex-wrap gap-1.5" data-testid="skill-filters">
        {SKILL_OPTIONS.map(s => {
          const active = f.skills.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleSkill(s)}
              className={
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ' +
                (active ? 'bg-solana-green/15 text-solana-green' : 'bg-surface-200 text-gray-400 hover:text-white')
              }
              aria-pressed={active}
              data-testid={'skill-filter-' + s}
            >
              {s}
            </button>
          );
        })}
      </div>

    </div>
  );
}
