import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Search, X, Save, RotateCcw } from 'lucide-react';

export interface BountyFilters {
  skills: string[];
  tiers: string[];
  categories: string[];
  rewardMin: number;
  rewardMax: number;
  sortBy: 'reward' | 'deadline' | 'created';
  sortOrder: 'asc' | 'desc';
}

const ALL_SKILLS = ['TypeScript', 'Rust', 'Solidity', 'Python', 'Go', 'JavaScript', 'React', 'Node.js', 'Next.js', 'AI/ML'];
const ALL_TIERS = ['T1', 'T2', 'T3'];
const ALL_CATEGORIES = ['Frontend', 'Backend', 'Blockchain', 'AI/ML', 'DevOps', 'Security', 'Integration', 'Content', 'Design'];

const TIER_RANGES: Record<string, [number, number]> = {
  T1: [0, 200],
  T2: [200, 1000],
  T3: [1000, 10000],
};

const SORT_OPTIONS = [
  { value: 'reward', label: 'Reward' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'created', label: 'Created Date' },
];

interface AdvancedBountySearchProps {
  onFiltersChange: (filters: BountyFilters) => void;
  maxReward?: number;
}

const DEFAULT_FILTERS: BountyFilters = {
  skills: [],
  tiers: [],
  categories: [],
  rewardMin: 0,
  rewardMax: 10000,
  sortBy: 'created',
  sortOrder: 'desc',
};

function loadSavedFilters(): BountyFilters | null {
  try {
    const saved = localStorage.getItem('advancedBountyFilters');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="relative">
      <label className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mt-1 w-full flex items-center justify-between px-3 py-2 bg-forge-800 border border-border rounded-lg text-sm text-text-secondary hover:border-border-hover transition-colors"
      >
        <span className="truncate">
          {selected.length === 0 ? `All ${label}` : `${selected.length} selected`}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-forge-800 border border-border rounded-lg shadow-xl p-2 max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-forge-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-border bg-forge-700 text-emerald focus:ring-emerald"
              />
              <span className="text-sm text-text-secondary">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdvancedBountySearch({ onFiltersChange, maxReward = 10000 }: AdvancedBountySearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [filters, setFilters] = useState<BountyFilters>(() => {
    const saved = loadSavedFilters();
    return saved ?? DEFAULT_FILTERS;
  });

  useEffect(() => {
    const saved = loadSavedFilters();
    if (saved) setSavedCount(1);
  }, []);

  const updateFilters = useCallback(
    (partial: Partial<BountyFilters>) => {
      const next = { ...filters, ...partial };
      setFilters(next);
      onFiltersChange(next);
    },
    [filters, onFiltersChange]
  );

  const saveFilters = () => {
    try {
      localStorage.setItem('advancedBountyFilters', JSON.stringify(filters));
      setSavedCount(1);
    } catch {}
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    onFiltersChange(DEFAULT_FILTERS);
  };

  const applyTierPreset = (tier: string) => {
    const range = TIER_RANGES[tier];
    if (!range) return;
    const next: BountyFilters = {
      ...DEFAULT_FILTERS,
      tiers: [tier],
      rewardMin: range[0],
      rewardMax: range[1],
      sortBy: 'reward',
      sortOrder: 'desc',
    };
    setFilters(next);
    onFiltersChange(next);
  };

  const hasActiveFilters =
    filters.skills.length > 0 ||
    filters.tiers.length > 0 ||
    filters.categories.length > 0 ||
    filters.rewardMin > 0 ||
    filters.rewardMax < maxReward;

  return (
    <div className="mb-6">
      {/* Collapsible trigger */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            isOpen
              ? 'bg-emerald text-forge-950 border-emerald'
              : hasActiveFilters
              ? 'bg-forge-700 text-emerald border-emerald/50'
              : 'bg-forge-800 text-text-secondary border-border hover:border-border-hover'
          }`}
        >
          <Search className="w-4 h-4" />
          Advanced Search
          {hasActiveFilters && (
            <span className="bg-emerald text-forge-950 text-xs rounded-full w-5 h-5 flex items-center justify-center">
              !
            </span>
          )}
        </button>

        {/* Tier preset buttons */}
        <div className="flex items-center gap-1">
          {ALL_TIERS.map((tier) => (
            <button
              key={tier}
              onClick={() => applyTierPreset(tier)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${
                filters.tiers.includes(tier)
                  ? 'bg-tier-t1/20 text-tier-t1 border-tier-t1/50'
                  : 'bg-forge-800 text-text-muted border-border hover:border-border-hover'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>

        {/* Saved indicator */}
        {savedCount > 0 && (
          <span className="text-xs text-emerald flex items-center gap-1">
            <Save className="w-3 h-3" /> Saved
          </span>
        )}

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
          >
            <RotateCcw className="w-3 h-3" /> Clear all
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {isOpen && (
        <div className="mt-4 p-5 bg-forge-800 border border-border rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Skill filter */}
            <MultiSelect
              label="Language / Skill"
              options={ALL_SKILLS}
              selected={filters.skills}
              onChange={(skills) => updateFilters({ skills })}
            />

            {/* Tier filter */}
            <MultiSelect
              label="Bounty Tier"
              options={ALL_TIERS}
              selected={filters.tiers}
              onChange={(tiers) => updateFilters({ tiers })}
            />

            {/* Category filter */}
            <MultiSelect
              label="Domain / Category"
              options={ALL_CATEGORIES}
              selected={filters.categories}
              onChange={(categories) => updateFilters({ categories })}
            />

            {/* Reward range */}
            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Reward Range (FNDRY)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={filters.rewardMax}
                  value={filters.rewardMin}
                  onChange={(e) => updateFilters({ rewardMin: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-forge-700 border border-border rounded-lg text-sm text-text-secondary focus:border-emerald outline-none"
                  placeholder="Min"
                />
                <span className="text-text-muted">—</span>
                <input
                  type="number"
                  min={filters.rewardMin}
                  max={maxReward}
                  value={filters.rewardMax}
                  onChange={(e) => updateFilters({ rewardMax: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-forge-700 border border-border rounded-lg text-sm text-text-secondary focus:border-emerald outline-none"
                  placeholder="Max"
                />
              </div>
              {/* Reward preset buttons */}
              <div className="mt-2 flex gap-1">
                {ALL_TIERS.map((tier) => {
                  const range = TIER_RANGES[tier];
                  return (
                    <button
                      key={tier}
                      onClick={() => applyTierPreset(tier)}
                      className="flex-1 px-1 py-0.5 bg-forge-700 border border-border rounded text-xs text-text-muted hover:text-text-secondary"
                    >
                      {tier}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sort row */}
          <div className="mt-5 flex items-center gap-4 flex-wrap">
            <div>
              <label className="text-xs font-medium text-text-muted uppercase tracking-wide mr-2">
                Sort By:
              </label>
              <div className="inline-flex items-center gap-1 bg-forge-700 rounded-lg p-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateFilters({ sortBy: opt.value as BountyFilters['sortBy'] })}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      filters.sortBy === opt.value
                        ? 'bg-forge-600 text-text-primary'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="inline-flex items-center gap-1 bg-forge-700 rounded-lg p-1">
              <button
                onClick={() => updateFilters({ sortOrder: 'desc' })}
                className={`px-3 py-1 rounded-md text-xs font-medium ${
                  filters.sortOrder === 'desc' ? 'bg-forge-600 text-text-primary' : 'text-text-muted'
                }`}
              >
                ↓ High first
              </button>
              <button
                onClick={() => updateFilters({ sortOrder: 'asc' })}
                className={`px-3 py-1 rounded-md text-xs font-medium ${
                  filters.sortOrder === 'asc' ? 'bg-forge-600 text-text-primary' : 'text-text-muted'
                }`}
              >
                ↑ Low first
              </button>
            </div>

            {/* Save */}
            <button
              type="button"
              onClick={saveFilters}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald/10 border border-emerald/30 text-emerald rounded-lg text-xs font-medium hover:bg-emerald/20 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Filters
            </button>
          </div>

          {/* Active filter pills */}
          {hasActiveFilters && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-text-muted">Active:</span>
              {filters.skills.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-forge-700 border border-border rounded-full text-xs text-text-secondary"
                >
                  {s}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-text-primary"
                    onClick={() => updateFilters({ skills: filters.skills.filter((x) => x !== s) })}
                  />
                </span>
              ))}
              {filters.tiers.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-tier-t1/10 border border-tier-t1/20 rounded-full text-xs text-tier-t1"
                >
                  {t}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => updateFilters({ tiers: filters.tiers.filter((x) => x !== t) })}
                  />
                </span>
              ))}
              {(filters.rewardMin > 0 || filters.rewardMax < maxReward) && (
                <span className="px-2 py-0.5 bg-emerald/10 border border-emerald/20 rounded-full text-xs text-emerald">
                  {filters.rewardMin}–{filters.rewardMax} FNDRY
                  <X
                    className="w-3 h-3 ml-1 cursor-pointer inline"
                    onClick={() => updateFilters({ rewardMin: 0, rewardMax: maxReward })}
                  />
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
