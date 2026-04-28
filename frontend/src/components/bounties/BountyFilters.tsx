import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { BOUNTY_CATEGORIES } from '../../types/bounty';
import type { BountyBoardFilters, BountyCategory } from '../../types/bounty';
import { cn } from '../../lib/utils';

const SKILL_OPTIONS = [
  'TypeScript',
  'Rust',
  'Solidity',
  'Python',
  'Go',
  'JavaScript',
  'Move',
  'C++',
];

export interface BountyFiltersProps {
  filters: BountyBoardFilters;
  onFilterChange: (key: string, value: unknown) => void;
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasActiveFilters =
    filters.category !== 'all' ||
    filters.skills.length > 0 ||
    filters.status !== 'all' ||
    filters.deadlineBefore !== '' ||
    filters.rewardMin > 0 ||
    filters.rewardMax < Infinity;

  return (
    <div className="space-y-4">
      {/* Category chips */}
      <div data-testid="category-chips" className="flex items-center gap-2 flex-wrap">
        {BOUNTY_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            data-testid={`category-chip-${cat.value}`}
            role="button"
            aria-pressed={filters.category === cat.value}
            onClick={() => onFilterChange('category', cat.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 border',
              filters.category === cat.value
                ? 'bg-emerald/15 text-emerald border-emerald/30'
                : 'bg-forge-800 text-text-muted border-border hover:border-border-hover hover:text-text-secondary',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Skill pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {SKILL_OPTIONS.map((skill) => (
          <button
            key={skill}
            data-testid={`skill-filter-${skill}`}
            onClick={() => {
              const skills = filters.skills.includes(skill)
                ? filters.skills.filter((s) => s !== skill)
                : [...filters.skills, skill];
              onFilterChange('skills', skills);
            }}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors duration-150 border',
              filters.skills.includes(skill)
                ? 'bg-emerald/15 text-emerald border-emerald/30'
                : 'bg-forge-800 text-text-muted border-border hover:border-border-hover',
            )}
          >
            {skill}
          </button>
        ))}
      </div>

      {/* Toggle advanced */}
      <button
        type="button"
        data-testid="toggle-advanced"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {showAdvanced ? 'Hide' : 'Show'} advanced filters
      </button>

      {/* Advanced section */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-forge-800/60 border border-border rounded-xl p-4 space-y-4">
              {/* Status */}
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => onFilterChange('status', e.target.value)}
                  className="w-full max-w-xs px-3 py-2 rounded-lg bg-forge-900 border border-border text-sm text-text-primary outline-none focus:border-emerald/50"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="funded">Funded</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Deadline */}
              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 block">
                  Deadline
                </label>
                <input
                  type="date"
                  data-testid="deadline-filter"
                  aria-label="Deadline before date"
                  value={filters.deadlineBefore}
                  onChange={(e) => onFilterChange('deadlineBefore', e.target.value)}
                  className="w-full max-w-xs px-3 py-2 rounded-lg bg-forge-900 border border-border text-sm text-text-primary outline-none focus:border-emerald/50"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result count & reset */}
      <div className="flex items-center justify-between">
        <span data-testid="result-count" className="text-xs text-text-muted">
          {resultCount} of {totalCount} bounties
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            data-testid="reset-filters"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-status-error transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
