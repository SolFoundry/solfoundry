import React, { useState } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import type { BountyBoardFilters } from '../../types/bounty';
import { DEFAULT_FILTERS } from '../../types/bounty';

const CATEGORIES = ['All', 'DeFi', 'AI', 'Infrastructure', 'Security', 'Gaming', 'NFT', 'Tooling', 'Other'];
const SKILLS = ['TypeScript', 'Rust', 'Solidity', 'Python', 'Go', 'JavaScript', 'React', 'Move'];
const TIERS = ['T1', 'T2', 'T3'];
const REWARD_PRESETS = [
  { label: 'All', min: 0, max: 500000 },
  { label: 'Under 100K', min: 0, max: 100000 },
  { label: '100K–250K', min: 100000, max: 250000 },
  { label: '250K–500K', min: 250000, max: 500000 },
  { label: '500K+', min: 500000, max: 1000000 },
];

interface BountyFiltersProps {
  filters: BountyBoardFilters;
  onFilterChange: (key: string, value: unknown) => void;
  onReset: () => void;
  resultCount: number;
  totalCount: number;
}

export function BountyFilters({ filters, onFilterChange, onReset, resultCount, totalCount }: BountyFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const activePreset = REWARD_PRESETS.find(
    (p) => p.min === filters.rewardMin && p.max === filters.rewardMax,
  );

  return (
    <div className="space-y-4">
      {/* Search + Toggle row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
            placeholder="Search bounties by title, description, or tags..."
            className="w-full pl-10 pr-4 py-2.5 bg-forge-800 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:border-emerald outline-none transition-colors duration-150"
            data-testid="search-input"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange('searchQuery', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          data-testid="toggle-advanced"
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
            showAdvanced
              ? 'border-emerald text-emerald bg-emerald/10'
              : 'border-border text-text-secondary hover:border-border-hover'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            data-testid="reset-filters"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-status-error/30 text-status-error text-sm font-medium hover:bg-status-error/10 transition-all duration-150"
          >
            <X className="w-4 h-4" />
            Clear all
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2 flex-wrap" data-testid="category-chips">
        {CATEGORIES.map((cat) => {
          const catKey = cat.toLowerCase();
          const isActive = filters.category === catKey;
          return (
            <button
              key={cat}
              onClick={() => onFilterChange('category', catKey)}
              data-testid={`category-chip-${catKey}`}
              aria-pressed={isActive}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-forge-700 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary bg-forge-800'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Skills multi-select (always visible) */}
      <div className="flex items-center gap-2 flex-wrap">
        {SKILLS.map((skill) => {
          const isSelected = filters.skills.includes(skill);
          return (
            <button
              key={skill}
              onClick={() => {
                const next = isSelected
                  ? filters.skills.filter((s) => s !== skill)
                  : [...filters.skills, skill];
                onFilterChange('skills', next);
              }}
              data-testid={`skill-filter-${skill}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                isSelected
                  ? 'bg-emerald/20 text-emerald border border-emerald/30'
                  : 'bg-forge-800 text-text-muted border border-border hover:text-text-secondary'
              }`}
            >
              {skill}
            </button>
          );
        })}
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && (
        <div className="p-4 rounded-xl border border-border bg-forge-900/50 space-y-5">
          {/* Tier filter */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Tier Level</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onFilterChange('tier', '')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                  !filters.tier
                    ? 'bg-forge-700 text-text-primary'
                    : 'bg-forge-800 text-text-muted border border-border'
                }`}
              >
                All
              </button>
              {TIERS.map((tier) => {
                const isActive = filters.tier === tier;
                const tierColors: Record<string, string> = {
                  T1: isActive ? 'bg-tier-t1/20 text-tier-t1 border-tier-t1/30' : '',
                  T2: isActive ? 'bg-tier-t2/20 text-tier-t2 border-tier-t2/30' : '',
                  T3: isActive ? 'bg-tier-t3/20 text-tier-t3 border-tier-t3/30' : '',
                };
                return (
                  <button
                    key={tier}
                    onClick={() => onFilterChange('tier', isActive ? '' : tier)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? `${tierColors[tier]} border`
                        : 'bg-forge-800 text-text-muted border border-border hover:text-text-secondary'
                    }`}
                  >
                    {tier}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reward range */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Reward Range</label>
            <div className="flex items-center gap-2 flex-wrap">
              {REWARD_PRESETS.map((preset) => {
                const isActive = activePreset?.label === preset.label;
                return (
                  <button
                    key={preset.label}
                    onClick={() => {
                      onFilterChange('rewardMin', preset.min);
                      onFilterChange('rewardMax', preset.max);
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-emerald/20 text-emerald border border-emerald/30'
                        : 'bg-forge-800 text-text-muted border border-border hover:text-text-secondary'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deadline filter */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Deadline</label>
            <input
              type="date"
              value={filters.deadlineBefore}
              onChange={(e) => onFilterChange('deadlineBefore', e.target.value)}
              data-testid="deadline-filter"
              aria-label="Deadline before date"
              className="bg-forge-800 border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-emerald outline-none transition-colors duration-150"
            />
          </div>
        </div>
      )}

      {/* Result count */}
      <div className="text-sm text-text-muted" data-testid="result-count">
        {resultCount} of {totalCount} bounties
      </div>
    </div>
  );
}