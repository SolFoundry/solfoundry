import React, { useState, useCallback, useEffect } from 'react';
import { Search, SlidersHorizontal, X, Save, RotateCcw, ChevronDown } from 'lucide-react';

// Types
export interface SearchFilters {
  query: string;
  languages: string[];
  tiers: string[];
  domains: string[];
  rewardMin: number;
  rewardMax: number;
  hasDeadline: boolean | null;
  sortBy: 'newest' | 'reward_high' | 'reward_low' | 'deadline';
}

export interface SavedFilterSet {
  id: string;
  name: string;
  filters: SearchFilters;
  createdAt: string;
}

const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  languages: [],
  tiers: [],
  domains: [],
  rewardMin: 0,
  rewardMax: 1000000,
  hasDeadline: null,
  sortBy: 'newest',
};

const AVAILABLE_LANGUAGES = [
  'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go',
  'Java', 'C++', 'Swift', 'Kotlin', 'Ruby', 'Solidity',
];

const AVAILABLE_DOMAINS = [
  'Frontend', 'Backend', 'AI/Agent', 'Creative', 'Integration',
  'Security', 'DevOps', 'Documentation', 'Mobile',
];

const REWARD_PRESETS = [
  { label: 'All', min: 0, max: 1000000 },
  { label: '100K+', min: 100000, max: 1000000 },
  { label: '500K+', min: 500000, max: 1000000 },
  { label: '1M+', min: 1000000, max: 10000000 },
];

// Multi-Select Filter
function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-card border border-border-primary text-sm text-text-primary hover:border-border-secondary transition-colors w-full"
      >
        <span className="flex-1 text-left">{label}</span>
        {selected.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-emerald/10 text-emerald text-xs font-medium">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 right-0 z-40 bg-surface-card border border-border-primary rounded-lg shadow-xl p-2 max-h-60 overflow-y-auto">
          <button
            onClick={() => { onChange([]); }}
            className="w-full text-left px-2 py-1.5 text-xs text-text-muted hover:bg-surface-hover rounded"
          >
            Clear all
          </button>
          {options.map((option) => (
            <button
              key={option}
              onClick={() => toggle(option)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded transition-colors ${
                selected.includes(option)
                  ? 'bg-emerald/10 text-emerald'
                  : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {selected.includes(option) && '✓ '}{option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Reward Range Slider
function RewardRangeSlider({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const formatReward = (val: number) => {
    if (val >= 1000000) return `${val / 1000000}M`;
    if (val >= 1000) return `${val / 1000}K`;
    return val.toString();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">Reward Range</span>
        <span className="text-xs font-medium text-anvil-orange">
          {formatReward(min)} – {formatReward(max)} $FNDRY
        </span>
      </div>

      {/* Preset buttons */}
      <div className="flex gap-1.5">
        {REWARD_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onChange(preset.min, preset.max)}
            className={`px-2 py-1 rounded text-xs border transition-colors ${
              min === preset.min && max === preset.max
                ? 'border-anvil-orange bg-anvil-orange/10 text-anvil-orange'
                : 'border-border-primary text-text-muted hover:border-border-secondary'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Range inputs */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={1000000}
          step={50000}
          value={min}
          onChange={(e) => onChange(Number(e.target.value), max)}
          className="flex-1 accent-anvil-orange"
        />
        <input
          type="range"
          min={0}
          max={1000000}
          step={50000}
          value={max}
          onChange={(e) => onChange(min, Number(e.target.value))}
          className="flex-1 accent-anvil-orange"
        />
      </div>
    </div>
  );
}

// Main Component
export function AdvancedBountySearch({
  filters: externalFilters,
  onFiltersChange,
}: {
  filters?: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
}) {
  const [filters, setFilters] = useState<SearchFilters>(externalFilters || DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [savedSets, setSavedSets] = useState<SavedFilterSet[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Load saved filter sets from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('solfoundry-saved-filters');
      if (saved) setSavedSets(JSON.parse(saved));
    } catch {}
  }, []);

  const updateFilters = useCallback((partial: Partial<SearchFilters>) => {
    const updated = { ...filters, ...partial };
    setFilters(updated);
    onFiltersChange(updated);
  }, [filters, onFiltersChange]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    onFiltersChange(DEFAULT_FILTERS);
  }, [onFiltersChange]);

  const saveFilterSet = useCallback(() => {
    if (!saveName.trim()) return;
    const newSet: SavedFilterSet = {
      id: `filter-${Date.now()}`,
      name: saveName.trim(),
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedSets, newSet];
    setSavedSets(updated);
    setSaveName('');
    setShowSaveDialog(false);
    localStorage.setItem('solfoundry-saved-filters', JSON.stringify(updated));
  }, [filters, saveName, savedSets]);

  const loadFilterSet = useCallback((set: SavedFilterSet) => {
    setFilters(set.filters);
    onFiltersChange(set.filters);
  }, [onFiltersChange]);

  const deleteFilterSet = useCallback((id: string) => {
    const updated = savedSets.filter((s) => s.id !== id);
    setSavedSets(updated);
    localStorage.setItem('solfoundry-saved-filters', JSON.stringify(updated));
  }, [savedSets]);

  const activeFilterCount = [
    filters.languages.length > 0,
    filters.tiers.length > 0,
    filters.domains.length > 0,
    filters.rewardMin > 0 || filters.rewardMax < 1000000,
    filters.hasDeadline !== null,
    filters.sortBy !== 'newest',
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search Bar + Filter Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => updateFilters({ query: e.target.value })}
            placeholder="Search bounties by title, description, or tags..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-card border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald/50"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'border-emerald/50 bg-emerald/10 text-emerald'
              : 'border-border-primary text-text-muted hover:border-border-secondary'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-sm hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald text-dark-forge text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active Filter Tags */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-1.5">
          {filters.languages.map((lang) => (
            <button
              key={lang}
              onClick={() => updateFilters({ languages: filters.languages.filter((l) => l !== lang) })}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald/10 text-emerald text-xs border border-emerald/20"
            >
              {lang} <X className="w-3 h-3" />
            </button>
          ))}
          {filters.tiers.map((tier) => (
            <button
              key={tier}
              onClick={() => updateFilters({ tiers: filters.tiers.filter((t) => t !== tier) })}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-anvil-orange/10 text-anvil-orange text-xs border border-anvil-orange/20"
            >
              {tier} <X className="w-3 h-3" />
            </button>
          ))}
          {filters.domains.map((domain) => (
            <button
              key={domain}
              onClick={() => updateFilters({ domains: filters.domains.filter((d) => d !== domain) })}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-status-info/10 text-status-info text-xs border border-status-info/20"
            >
              {domain} <X className="w-3 h-3" />
            </button>
          ))}
          <button
            onClick={resetFilters}
            className="px-2 py-1 rounded-full bg-surface-hover text-text-muted text-xs hover:text-text-primary"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="p-4 rounded-lg bg-surface-card border border-border-primary space-y-4">
          {/* Multi-select filters row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MultiSelectFilter
              label="Language"
              options={AVAILABLE_LANGUAGES}
              selected={filters.languages}
              onChange={(v) => updateFilters({ languages: v })}
            />
            <MultiSelectFilter
              label="Tier"
              options={['T1', 'T2', 'T3']}
              selected={filters.tiers}
              onChange={(v) => updateFilters({ tiers: v })}
            />
            <MultiSelectFilter
              label="Domain"
              options={AVAILABLE_DOMAINS}
              selected={filters.domains}
              onChange={(v) => updateFilters({ domains: v })}
            />
          </div>

          {/* Reward range */}
          <RewardRangeSlider
            min={filters.rewardMin}
            max={filters.rewardMax}
            onChange={(min, max) => updateFilters({ rewardMin: min, rewardMax: max })}
          />

          {/* Sort + Deadline toggle */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Sort:</span>
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilters({ sortBy: e.target.value as SearchFilters['sortBy'] })}
                className="px-2 py-1 rounded bg-surface-hover border border-border-primary text-sm text-text-primary"
              >
                <option value="newest">Newest</option>
                <option value="reward_high">Highest Reward</option>
                <option value="reward_low">Lowest Reward</option>
                <option value="deadline">Deadline</option>
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasDeadline === true}
                onChange={(e) => updateFilters({ hasDeadline: e.target.checked ? true : null })}
                className="rounded border-border-primary"
              />
              <span className="text-xs text-text-secondary">Has deadline</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border-primary">
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <div className="flex items-center gap-2">
              {/* Saved filter sets */}
              {savedSets.length > 0 && (
                <div className="flex items-center gap-1">
                  {savedSets.slice(0, 3).map((set) => (
                    <button
                      key={set.id}
                      onClick={() => loadFilterSet(set)}
                      onContextMenu={(e) => { e.preventDefault(); deleteFilterSet(set.id); }}
                      className="px-2 py-1 rounded text-xs bg-surface-hover text-text-muted hover:text-text-primary"
                      title={`Load "${set.name}" (right-click to delete)`}
                    >
                      {set.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowSaveDialog(!showSaveDialog)}
                className="flex items-center gap-1.5 text-xs text-emerald hover:text-emerald/80"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>

          {/* Save dialog */}
          {showSaveDialog && (
            <div className="flex items-center gap-2 pt-2 border-t border-border-primary">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Filter set name..."
                className="flex-1 px-3 py-1.5 bg-surface-hover border border-border-primary rounded text-sm text-text-primary"
                onKeyDown={(e) => e.key === 'Enter' && saveFilterSet()}
              />
              <button
                onClick={saveFilterSet}
                className="px-3 py-1.5 rounded bg-emerald text-dark-forge text-sm font-medium"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdvancedBountySearch;
