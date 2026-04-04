import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { BountyBoardFilters } from '../../types/bounty';
import { DEFAULT_FILTERS } from '../../types/bounty';

const CATEGORIES = ['all', 'defi', 'frontend', 'security', 'infrastructure', 'tooling', 'nft', 'mobile'];
const SKILLS = ['TypeScript', 'Rust', 'Solidity', 'Python', 'Go', 'JavaScript', 'React'];

function isFiltersActive(filters: BountyBoardFilters): boolean {
  return (
    filters.category !== 'all' ||
    filters.skills.length > 0 ||
    !!filters.deadlineBefore ||
    (!!filters.tier && filters.tier !== 'all') ||
    (!!filters.rewardMin && filters.rewardMin > 0) ||
    !!filters.rewardMax
  );
}

interface BountyFiltersProps {
  filters: BountyBoardFilters;
  onFilterChange: (key: keyof BountyBoardFilters, value: unknown) => void;
  onReset: () => void;
  resultCount: number;
  totalCount: number;
}

export function BountyFilters({
  filters,
  onFilterChange,
  onReset,
  resultCount,
  totalCount,
}: BountyFiltersProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const active = isFiltersActive(filters);

  function toggleSkill(skill: string) {
    const next = filters.skills.includes(skill)
      ? filters.skills.filter((s) => s !== skill)
      : [...filters.skills, skill];
    onFilterChange('skills', next);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Category chips */}
      <div data-testid="category-chips" className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            data-testid={`category-chip-${cat}`}
            aria-pressed={filters.category === cat}
            onClick={() => onFilterChange('category', cat)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filters.category === cat
                ? 'bg-emerald text-forge-950'
                : 'bg-forge-800 text-text-muted hover:text-text-primary'
            }`}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Skill pills */}
      <div className="flex flex-wrap gap-2">
        {SKILLS.map((skill) => (
          <button
            key={skill}
            data-testid={`skill-filter-${skill}`}
            aria-pressed={filters.skills.includes(skill)}
            onClick={() => toggleSkill(skill)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filters.skills.includes(skill)
                ? 'bg-purple text-white'
                : 'bg-forge-800 text-text-muted hover:text-text-primary border border-border'
            }`}
          >
            {skill}
          </button>
        ))}
      </div>

      {/* Advanced toggle */}
      <button
        data-testid="toggle-advanced"
        onClick={() => setAdvancedOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary w-fit transition-colors"
      >
        {advancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Advanced filters
      </button>

      {/* Advanced section */}
      {advancedOpen && (
        <div className="flex flex-wrap gap-4 p-4 bg-forge-900 rounded-lg border border-border">
          <div className="flex flex-col gap-1">
            <label htmlFor="deadline-filter-input" className="text-xs text-text-muted">
              Deadline before date
            </label>
            <input
              id="deadline-filter-input"
              data-testid="deadline-filter"
              type="date"
              aria-label="Deadline before date"
              value={filters.deadlineBefore ?? ''}
              onChange={(e) => onFilterChange('deadlineBefore', e.target.value)}
              className="px-3 py-1.5 text-sm bg-forge-800 border border-border rounded-md text-text-primary focus:border-emerald outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Reward range (USDC)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                value={filters.rewardMin ?? ''}
                onChange={(e) =>
                  onFilterChange('rewardMin', e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-24 px-2 py-1.5 text-sm bg-forge-800 border border-border rounded-md text-text-primary focus:border-emerald outline-none"
              />
              <span className="text-text-muted text-xs">–</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.rewardMax ?? ''}
                onChange={(e) =>
                  onFilterChange('rewardMax', e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-24 px-2 py-1.5 text-sm bg-forge-800 border border-border rounded-md text-text-primary focus:border-emerald outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer: result count + reset */}
      <div className="flex items-center justify-between">
        <span data-testid="result-count" className="text-sm text-text-muted">
          {resultCount} of {totalCount} bounties
        </span>
        {active && (
          <button
            data-testid="reset-filters"
            onClick={onReset}
            className="text-sm text-emerald hover:text-emerald/80 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

export { DEFAULT_FILTERS };
