/**
 * Bounty List Component with Sorting
 * SolFoundry Bounty #482 - Updated
 * 
 * Works alongside search/filter - sorts filtered results
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Bounty, SortConfig, DEFAULT_SORT_CONFIG } from '../types/bounty';
import { sortBounties, getSortConfig } from '../utils/sortBounties';
import { BountySort } from './BountySort';
import './BountyList.css';

export interface BountyListProps {
  /** Array of bounties to display */
  bounties: Bounty[];
  /** Optional filter function */
  filter?: (bounty: Bounty) => boolean;
  /** Optional search query */
  searchQuery?: string;
  /** Optional initial sort config */
  initialSort?: SortConfig;
  /** Optional callback when bounty is clicked */
  onBountyClick?: (bounty: Bounty) => void;
  /** Whether to show loading state */
  isLoading?: boolean;
  /** Optional error message */
  error?: string | null;
}

/**
 * BountyList Component
 * Displays a list of bounties with sorting functionality
 * Works alongside search and filter
 */
export const BountyList: React.FC<BountyListProps> = ({
  bounties,
  filter,
  searchQuery,
  initialSort,
  onBountyClick,
  isLoading = false,
  error = null,
}) => {
  // Initialize sort config from URL/localStorage or props
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    return initialSort || getSortConfig();
  });

  // Filter bounties first
  const filteredBounties = useMemo(() => {
    let result = bounties;
    
    // Apply filter if provided
    if (filter) {
      result = result.filter(filter);
    }
    
    // Apply search if provided
    if (searchQuery?.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          b.description.toLowerCase().includes(query) ||
          b.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    
    return result;
  }, [bounties, filter, searchQuery]);

  // Then sort filtered results
  const sortedBounties = useMemo(() => {
    return sortBounties(filteredBounties, sortConfig);
  }, [filteredBounties, sortConfig]);

  // Handle sort change
  const handleSortChange = useCallback((newConfig: SortConfig) => {
    setSortConfig(newConfig);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="bounty-list bounty-list--loading" data-testid="bounty-list-loading">
        <div className="bounty-list__spinner" />
        <p className="bounty-list__message">Loading bounties...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bounty-list bounty-list--error" data-testid="bounty-list-error">
        <p className="bounty-list__error">Error: {error}</p>
      </div>
    );
  }

  // Empty state
  if (bounties.length === 0) {
    return (
      <div className="bounty-list bounty-list--empty" data-testid="bounty-list-empty">
        <p className="bounty-list__message">No bounties found.</p>
      </div>
    );
  }

  // No results after filter
  if (sortedBounties.length === 0) {
    return (
      <div className="bounty-list">
        <BountySort config={sortConfig} onChange={handleSortChange} />
        <div className="bounty-list--empty">
          <p className="bounty-list__message">
            No bounties match your criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bounty-list" data-testid="bounty-list">
      <BountySort config={sortConfig} onChange={handleSortChange} />
      
      <div className="bounty-list__info">
        <span className="bounty-list__count">
          Showing {sortedBounties.length} bounty{sortedBounties.length !== 1 ? 'ies' : 'y'}
        </span>
        {filteredBounties.length !== bounties.length && (
          <span className="bounty-list__filtered">
            (filtered from {bounties.length})
          </span>
        )}
      </div>

      <ul className="bounty-list__items">
        {sortedBounties.map((bounty) => (
          <li
            key={bounty.id}
            className="bounty-item"
            data-testid={`bounty-item-${bounty.id}`}
            onClick={() => onBountyClick?.(bounty)}
            role={onBountyClick ? 'button' : undefined}
            tabIndex={onBountyClick ? 0 : undefined}
          >
            <div className="bounty-item__header">
              <h3 className="bounty-item__title">{bounty.title}</h3>
              <span className={`bounty-item__tier bounty-item__tier--${bounty.tier}`}>
                {bounty.tier.toUpperCase()}
              </span>
            </div>
            
            <p className="bounty-item__description">
              {bounty.description.substring(0, 150)}
              {bounty.description.length > 150 ? '...' : ''}
            </p>
            
            <div className="bounty-item__footer">
              <span className="bounty-item__reward">
                {bounty.reward.toLocaleString()} $FNDRY
              </span>
              <span className={`bounty-item__status bounty-item__status--${bounty.status}`}>
                {bounty.status}
              </span>
              <span className="bounty-item__date">
                {new Date(bounty.createdAt).toLocaleDateString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BountyList;
