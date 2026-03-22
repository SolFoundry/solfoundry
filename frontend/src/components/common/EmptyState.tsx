/**
 * EmptyState - Reusable empty state component
 * Displays icon, message, and optional CTA button when no data is available
 * @module components/common/EmptyState
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export type EmptyStateVariant = 'default' | 'compact' | 'card';

export interface EmptyStateProps {
  /** Icon to display (emoji string or React node) */
  icon?: string | React.ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** CTA button text */
  actionLabel?: string;
  /** CTA button click handler */
  onAction?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Layout variant */
  variant?: EmptyStateVariant;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Test ID */
  testId?: string;
}

// ============================================================================
// Default Icons
// ============================================================================

const DEFAULT_ICONS: Record<string, string> = {
  bounties: '📋',
  contributions: '🤝',
  activity: '📭',
  search: '🔍',
  error: '⚠️',
  default: '📭',
};

// ============================================================================
// Component
// ============================================================================

/**
 * EmptyState component for displaying helpful messages when no data is available
 * 
 * @example
 * // Basic usage
 * <EmptyState title="No bounties found" description="Try adjusting your filters" />
 * 
 * @example
 * // With action button
 * <EmptyState
 *   icon="🔍"
 *   title="No results"
 *   description="No bounties match your search"
 *   actionLabel="Clear filters"
 *   onAction={handleReset}
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
  variant = 'default',
  size = 'md',
  testId = 'empty-state',
}: EmptyStateProps) {
  // Determine icon to display
  const displayIcon = typeof icon === 'string' ? icon : (icon ?? DEFAULT_ICONS.default);
  
  // Size classes
  const sizeClasses: Record<string, { container: string; icon: string; title: string; description: string }> = {
    sm: {
      container: 'py-8',
      icon: 'text-2xl mb-2',
      title: 'text-sm font-semibold mb-1',
      description: 'text-xs',
    },
    md: {
      container: 'py-12',
      icon: 'text-4xl mb-3 opacity-50',
      title: 'text-lg font-semibold text-gray-900 dark:text-white mb-1',
      description: 'text-sm text-gray-500',
    },
    lg: {
      container: 'py-16',
      icon: 'text-5xl mb-4 opacity-40',
      title: 'text-xl font-semibold text-gray-900 dark:text-white mb-2',
      description: 'text-base text-gray-500',
    },
  };
  
  const classes = sizeClasses[size];
  
  // Render icon
  const renderIcon = () => {
    if (React.isValidElement(displayIcon)) {
      return <div className={classes.icon}>{displayIcon}</div>;
    }
    return <div className={classes.icon} aria-hidden="true">{displayIcon}</div>;
  };
  
  // Variant: Card wrapper
  if (variant === 'card') {
    return (
      <div
        className={`rounded-xl border border-gray-200 dark:border-surface-300 bg-white dark:bg-surface-50 ${className}`}
        data-testid={testId}
        role="status"
      >
        <div className={`flex flex-col items-center justify-center text-center px-6 ${classes.container}`}>
          {renderIcon()}
          <h3 className={classes.title}>{title}</h3>
          {description && <p className={`${classes.description} mb-4`}>{description}</p>}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="rounded-lg bg-solana-green/15 px-4 py-2 text-sm text-solana-green hover:bg-solana-green/25 transition-colors"
              data-testid={`${testId}-action`}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // Variant: Compact
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center gap-3 py-4 px-4 ${className}`}
        data-testid={testId}
        role="status"
      >
        {renderIcon()}
        <div>
          <p className={classes.title}>{title}</p>
          {description && <p className={classes.description}>{description}</p>}
        </div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="ml-auto rounded-lg bg-solana-green/15 px-3 py-1.5 text-xs text-solana-green hover:bg-solana-green/25 transition-colors"
            data-testid={`${testId}-action`}
          >
            {actionLabel}
          </button>
        )}
      </div>
    );
  }
  
  // Variant: Default (full width)
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 ${classes.container} ${className}`}
      data-testid={testId}
      role="status"
    >
      {renderIcon()}
      <h3 className={classes.title}>{title}</h3>
      {description && <p className={`${classes.description} mb-4`}>{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-lg bg-solana-green/15 px-4 py-2 text-sm text-solana-green hover:bg-solana-green/25 transition-colors"
          data-testid={`${testId}-action`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Preset Empty States
// ============================================================================

export interface NoBountiesProps {
  onReset?: () => void;
  hasFilters?: boolean;
  className?: string;
}

/**
 * Empty state for bounty list when no bounties are found
 */
export function NoBountiesFound({ onReset, hasFilters = false, className = '' }: NoBountiesProps) {
  return (
    <EmptyState
      icon="🔍"
      title={hasFilters ? 'No bounties match your search' : 'No bounties found'}
      description={hasFilters ? 'Try adjusting your filters or search terms' : 'Check back soon for new opportunities'}
      actionLabel={hasFilters ? 'Clear all filters' : undefined}
      onAction={hasFilters ? onReset : undefined}
      className={className}
      testId="empty-bounties"
    />
  );
}

export interface NoContributionsProps {
  className?: string;
}

/**
 * Empty state for contributor profile when no contributions exist
 */
export function NoContributionsYet({ className = '' }: NoContributionsProps) {
  return (
    <EmptyState
      icon="🤝"
      title="No contributions yet"
      description="Start exploring bounties to begin your journey"
      className={className}
      testId="empty-contributions"
    />
  );
}

export interface NoActivityProps {
  className?: string;
}

/**
 * Empty state for activity feed when no activity exists
 */
export function NoActivityYet({ className = '' }: NoActivityProps) {
  return (
    <EmptyState
      icon="📭"
      title="No activity yet"
      description="Events will appear here as the platform comes alive"
      className={className}
      testId="empty-activity"
    />
  );
}

export interface NoSearchResultsProps {
  query?: string;
  onReset?: () => void;
  className?: string;
}

/**
 * Empty state for search results when nothing matches
 */
export function NoSearchResults({ query, onReset, className = '' }: NoSearchResultsProps) {
  return (
    <EmptyState
      icon="🔍"
      title="No results found"
      description={query ? `No results for "${query}"` : "No items match your search"}
      actionLabel="Clear search"
      onAction={onReset}
      className={className}
      testId="empty-search"
    />
  );
}

export interface NoDataProps {
  dataType?: string;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

/**
 * Generic empty state for any data type
 */
export function NoDataAvailable({
  dataType = 'data',
  onAction,
  actionLabel,
  className = '',
}: NoDataProps) {
  return (
    <EmptyState
      icon="📊"
      title={`No ${dataType} available`}
      actionLabel={actionLabel}
      onAction={onAction}
      className={className}
      testId="empty-data"
    />
  );
}

// ============================================================================
// Exports
// ============================================================================

export default EmptyState;