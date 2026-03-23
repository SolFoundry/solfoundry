/**
 * @fileoverview Bounty Sort Component
 * @module components/BountySort
 * 
 * Provides a dropdown selector for sorting bounties.
 * Sort options: Newest, Oldest, Highest Reward, Lowest Reward, Tier
 * 
 * @example
 * ```tsx
 * <BountySort 
 *   config={{ option: 'newest' }} 
 *   onChange={(config) => setSortConfig(config)} 
 * />
 * ```
 */

import React, { useCallback, useEffect, memo } from 'react';
import { SortConfig, SortOption, SORT_OPTION_LABELS } from '../types/bounty';
import { saveSortConfig } from '../utils/sortBounties';
import './BountySort.css';

/** Props for BountySort component */
export interface BountySortProps {
  /** Current sort configuration */
  config: SortConfig;
  /** Callback when sort changes - receives new config */
  onChange: (config: SortConfig) => void;
  /** Whether to persist sort state to URL and localStorage - defaults to true */
  persist?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Optional test id for testing */
  'data-testid'?: string;
}

/**
 * Gets the appropriate icon for a sort option
 * Indicates the direction of sorting
 * 
 * @param option - The sort option
 * @returns Icon character (arrow)
 */
function getSortIcon(option: SortOption): string {
  const icons: Record<SortOption, string> = {
    newest: '↓',      // descending (newest first)
    oldest: '↑',      // ascending (oldest first)
    'highest-reward': '↓', // descending (highest first)
    'lowest-reward': '↑',  // ascending (lowest first)
    tier: '↓',        // descending (high to low)
  };
  
  return icons[option] ?? '↓';
}

/**
 * BountySort Component
 * 
 * Renders a dropdown for selecting sort option with a visual indicator.
 * Automatically persists changes if persist prop is true.
 * 
 * @param props - Component props
 * @returns React element
 */
export const BountySort: React.FC<BountySortProps> = memo(({
  config,
  onChange,
  persist = true,
  className = '',
  'data-testid': testId = 'bounty-sort',
}) => {
  const { option } = config;

  /**
   * Effect: Persist sort config when it changes
   * Only runs if persist is true
   */
  useEffect(() => {
    if (persist) {
      try {
        saveSortConfig(config);
      } catch (error) {
        // Silently fail persistence errors - UI still works
        console.warn('Failed to persist sort config:', error);
      }
    }
  }, [config, persist]);

  /**
   * Handle sort option change
   * Called when user selects a different option from dropdown
   */
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newOption = event.target.value as SortOption;
      onChange({ option: newOption });
    },
    [onChange]
  );

  // Combine CSS classes
  const containerClass = `bounty-sort ${className}`.trim();

  return (
    <div className={containerClass} data-testid={testId}>
      <label 
        htmlFor="sort-select" 
        className="sort-label"
        id="sort-label"
      >
        Sort by:
      </label>
      
      <div className="sort-wrapper">
        <select
          id="sort-select"
          value={option}
          onChange={handleChange}
          className="sort-select"
          data-testid={`${testId}-select`}
          aria-labelledby="sort-label"
          aria-describedby="sort-description"
        >
          {(Object.keys(SORT_OPTION_LABELS) as SortOption[]).map((opt) => (
            <option key={opt} value={opt}>
              {SORT_OPTION_LABELS[opt]}
            </option>
          ))}
        </select>
        
        <span 
          className="sort-icon" 
          aria-hidden="true"
          title={`Sorted ${getSortDirectionLabel(option)}`}
        >
          {getSortIcon(option)}
        </span>
      </div>
      
      <span id="sort-description" className="visually-hidden">
        Select how to sort the bounty list
      </span>
    </div>
  );
});

/**
 * Gets a human-readable label for the sort direction
 * Used for accessibility
 * 
 * @param option - The sort option
 * @returns Human-readable direction label
 */
function getSortDirectionLabel(option: SortOption): string {
  const labels: Record<SortOption, string> = {
    newest: 'newest first',
    oldest: 'oldest first',
    'highest-reward': 'highest reward first',
    'lowest-reward': 'lowest reward first',
    tier: 'highest tier first',
  };
  
  return labels[option] ?? '';
}

// Display name for debugging
BountySort.displayName = 'BountySort';

export default BountySort;
