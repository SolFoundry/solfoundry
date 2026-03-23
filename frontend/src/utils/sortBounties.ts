/**
 * @fileoverview Bounty sorting utility for SolFoundry
 * @module utils/sortBounties
 * @author SolFoundry Contributor
 * @version 1.0.0
 * 
 * Provides sorting functionality for bounty listings with persistence support.
 * Supports 5 sort options: newest, oldest, highest-reward, lowest-reward, tier
 * 
 * @example
 * ```typescript
 * // Sort bounties by newest first
 * const sorted = sortBounties(bounties, { option: 'newest' });
 * 
 * // Get current sort config (from URL/localStorage)
 * const config = getSortConfig(); // { option: 'newest' }
 * 
 * // Save sort config (persists to URL + localStorage)
 * saveSortConfig({ option: 'highest-reward' });
 * ```
 */

import { Bounty, SortConfig, SortOption } from '../types/bounty';

/** LocalStorage key for sort configuration - uses const assertion for type safety */
const STORAGE_KEY = 'solfoundry-sort-config' as const;

/**
 * Error messages as a frozen object for consistency
 * Prevents typos and enables IDE autocomplete
 */
const ErrorMessages = {
  INVALID_SORT_OPTION: (option: string) => 
    `Invalid sort option: "${option}". Valid options are: newest, oldest, highest-reward, lowest-reward, tier`,
  STORAGE_ERROR: 'Failed to access localStorage',
  URL_ERROR: 'Failed to update URL',
} as const;

/**
 * Validates if a string is a valid SortOption
 * Uses TypeScript type predicate for type narrowing
 * 
 * @param option - The option string to validate
 * @returns True if valid SortOption, false otherwise
 * 
 * @example
 * ```typescript
 * if (isValidSortOption(userInput)) {
 *   // TypeScript knows userInput is SortOption here
 *   const config: SortConfig = { option: userInput };
 * }
 * ```
 */
function isValidSortOption(option: string): option is SortOption {
  const validOptions: readonly SortOption[] = [
    'newest',
    'oldest', 
    'highest-reward',
    'lowest-reward',
    'tier',
  ];
  return validOptions.includes(option as SortOption);
}

/**
 * Safely parses an ISO date string to timestamp
 * Handles invalid dates gracefully
 * 
 * @param dateString - ISO date string
 * @returns Timestamp in milliseconds, or NaN if invalid
 */
function parseDate(dateString: string): number {
  const timestamp = new Date(dateString).getTime();
  
  // Validate the result
  if (Number.isNaN(timestamp)) {
    console.warn('Invalid date encountered:', dateString);
  }
  
  return timestamp;
}

/**
 * Compares two dates from ISO strings
 * 
 * @param dateA - First date string (ISO format)
 * @param dateB - Second date string (ISO format)
 * @returns Negative if A < B, positive if A > B, 0 if equal
 */
function compareDates(dateA: string, dateB: string): number {
  const timeA = parseDate(dateA);
  const timeB = parseDate(dateB);
  return timeA - timeB;
}

/**
 * Compares two bounties by creation date (descending - newest first)
 * 
 * @param a - First bounty
 * @param b - Second bounty
 * @returns Negative if a is newer, positive if b is newer
 */
function compareByDateDesc(a: Bounty, b: Bounty): number {
  return compareDates(b.createdAt, a.createdAt);
}

/**
 * Compares two bounties by creation date (ascending - oldest first)
 * 
 * @param a - First bounty
 * @param b - Second bounty
 * @returns Negative if a is older, positive if b is older
 */
function compareByDateAsc(a: Bounty, b: Bounty): number {
  return compareDates(a.createdAt, b.createdAt);
}

/**
 * Compares two bounties by reward (descending - highest first)
 * 
 * @param a - First bounty
 * @param b - Second bounty
 * @returns Negative if a has higher reward
 */
function compareByRewardDesc(a: Bounty, b: Bounty): number {
  return b.reward - a.reward;
}

/**
 * Compares two bounties by reward (ascending - lowest first)
 * 
 * @param a - First bounty
 * @param b - Second bounty
 * @returns Negative if a has lower reward
 */
function compareByRewardAsc(a: Bounty, b: Bounty): number {
  return a.reward - b.reward;
}

/**
 * Tier order mapping for comparison (higher number = higher tier)
 * Uses Readonly and const assertion for immutability
 * 
 * Order: t3 > t2 > t1
 */
const TIER_ORDER: Readonly<Record<SortOption extends 'tier' ? string : never, number>> = {
  t3: 3,
  t2: 2,
  t1: 1,
} as const;

/**
 * Compares two bounties by tier (descending - high to low)
 * Handles unknown tiers gracefully (treats as lowest priority)
 * 
 * @param a - First bounty
 * @param b - Second bounty
 * @returns Negative if a has higher tier
 */
function compareByTierDesc(a: Bounty, b: Bounty): number {
  // Default to 0 for unknown tiers (lowest priority)
  const orderA = (a.tier as keyof typeof TIER_ORDER) in TIER_ORDER 
    ? TIER_ORDER[a.tier as keyof typeof TIER_ORDER] 
    : 0;
  const orderB = (b.tier as keyof typeof TIER_ORDER) in TIER_ORDER 
    ? TIER_ORDER[b.tier as keyof typeof TIER_ORDER] 
    : 0;
  return orderB - orderA;
}

/**
 * Gets the appropriate comparison function for a sort option
 * Uses a record for O(1) lookup instead of switch statement
 * 
 * @param option - The sort option
 * @returns Comparison function for the option
 * @throws Error if option is invalid (should be caught by type system)
 */
function getComparisonFunction(
  option: SortOption
): (a: Bounty, b: Bounty) => number {
  // Type-safe comparison function map
  const comparisonFunctions: Record<SortOption, (a: Bounty, b: Bounty) => number> = {
    newest: compareByDateDesc,
    oldest: compareByDateAsc,
    'highest-reward': compareByRewardDesc,
    'lowest-reward': compareByRewardAsc,
    tier: compareByTierDesc,
  };
  
  return comparisonFunctions[option];
}

/**
 * Sorts an array of bounties based on the provided configuration
 * 
 * Important: This function does NOT mutate the input array.
 * Returns a new sorted array.
 * 
 * @param bounties - Array of bounties to sort (immutable - will not be modified)
 * @param config - Sort configuration containing the sort option
 * @returns New sorted array of bounties
 * @throws Error if sort option is invalid
 * 
 * @example
 * ```typescript
 * const bounties = [
 *   { id: '1', reward: 100, createdAt: '2024-01-01', tier: 't1', ... },
 *   { id: '2', reward: 500, createdAt: '2024-01-02', tier: 't2', ... },
 * ];
 * 
 * // Sort by highest reward
 * const sorted = sortBounties(bounties, { option: 'highest-reward' });
 * // Result: [{ id: '2', reward: 500, ... }, { id: '1', reward: 100, ... }]
 * 
 * // Original array unchanged
 * console.log(bounties[0].reward); // 100
 * ```
 */
export function sortBounties(
  bounties: readonly Bounty[],
  config: SortConfig
): Bounty[] {
  // Defensive: Validate config before processing
  if (!isValidSortOption(config.option)) {
    throw new Error(ErrorMessages.INVALID_SORT_OPTION(config.option));
  }
  
  // Create a shallow copy to avoid mutating the original array
  // This is important for React state immutability
  const sorted = [...bounties];
  
  // Get the appropriate comparison function
  const compare = getComparisonFunction(config.option);
  
  // Sort using the comparison function
  // JavaScript's sort is stable (maintains relative order of equal elements)
  return sorted.sort(compare);
}

// ==================== Persistence Layer ====================

/**
 * Checks if code is running in a browser environment
 * Important for SSR (Server-Side Rendering) compatibility
 * 
 * @returns True if in browser, false otherwise (e.g., Node.js, SSR)
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Retrieves sort configuration from URL search parameters
 * 
 * @returns SortConfig if valid params found, null otherwise
 * 
 * @example
 * ```typescript
 * // URL: /bounties?sort=highest-reward
 * const config = getSortConfigFromURL(); // { option: 'highest-reward' }
 * 
 * // URL: /bounties (no params)
 * const config = getSortConfigFromURL(); // null
 * ```
 */
function getSortConfigFromURL(): SortConfig | null {
  if (!isBrowser()) return null;
  
  try {
    const params = new URLSearchParams(window.location.search);
    const sort = params.get('sort');
    
    if (sort && isValidSortOption(sort)) {
      return { option: sort };
    }
  } catch (error) {
    // Log warning but don't throw - app should still work
    console.warn('Failed to parse URL parameters:', error);
  }
  
  return null;
}

/**
 * Retrieves sort configuration from localStorage
 * Includes validation to handle corrupted data
 * 
 * @returns SortConfig if found and valid, null otherwise
 */
function getSortConfigFromStorage(): SortConfig | null {
  if (!isBrowser()) return null;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      
      // Validate parsed data structure (defensive programming)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'option' in parsed &&
        isValidSortOption((parsed as SortConfig).option)
      ) {
        return parsed as SortConfig;
      }
      
      // Invalid data - remove it
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    // Silently fail on localStorage errors
    // Common cases: private mode, quota exceeded, security restrictions
    console.warn(ErrorMessages.STORAGE_ERROR, error);
  }
  
  return null;
}

/**
 * Gets the current sort configuration
 * 
 * Priority order:
 * 1. URL params (for shareable links)
 * 2. localStorage (for session persistence)
 * 3. Default value ('newest')
 * 
 * @returns SortConfig from the first available source
 * @default { option: 'newest' }
 * 
 * @example
 * ```typescript
 * // Case 1: URL has priority
 * // URL: /bounties?sort=highest-reward
 * // localStorage: { option: 'oldest' }
 * const config = getSortConfig(); // { option: 'highest-reward' }
 * 
 * // Case 2: Fallback to localStorage
 * // URL: /bounties (no params)
 * // localStorage: { option: 'oldest' }
 * const config = getSortConfig(); // { option: 'oldest' }
 * 
 * // Case 3: Use default
 * // URL: /bounties (no params)
 * // localStorage: (empty)
 * const config = getSortConfig(); // { option: 'newest' }
 * ```
 */
export function getSortConfig(): SortConfig {
  // Priority 1: URL params (most explicit user intent)
  const urlConfig = getSortConfigFromURL();
  if (urlConfig) return urlConfig;
  
  // Priority 2: localStorage (previous session preference)
  const storageConfig = getSortConfigFromStorage();
  if (storageConfig) return storageConfig;
  
  // Priority 3: Default (sensible default - newest first)
  return { option: 'newest' };
}

/**
 * Updates the URL with the current sort configuration
 * Uses replaceState to avoid adding to browser history
 * 
 * @param config - Sort configuration to save
 */
function updateURLWithSortConfig(config: SortConfig): void {
  if (!isBrowser()) return;
  
  try {
    const params = new URLSearchParams(window.location.search);
    params.set('sort', config.option);
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  } catch (error) {
    console.warn(ErrorMessages.URL_ERROR, error);
  }
}

/**
 * Saves sort configuration to localStorage
 * 
 * @param config - Sort configuration to save
 */
function saveSortConfigToStorage(config: SortConfig): void {
  if (!isBrowser()) return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    // Silently fail - app still works without persistence
    console.warn(ErrorMessages.STORAGE_ERROR, error);
  }
}

/**
 * Saves sort configuration to both URL and localStorage
 * 
 * This ensures:
 * - Shareable links work (URL)
 * - Session persists across page reloads (localStorage)
 * 
 * @param config - Sort configuration to save
 * @throws Error if sort option is invalid
 * 
 * @example
 * ```typescript
 * saveSortConfig({ option: 'highest-reward' });
 * // Updates URL: ?sort=highest-reward
 * // Saves to localStorage: { option: 'highest-reward' }
 * ```
 */
export function saveSortConfig(config: SortConfig): void {
  // Validate before saving (fail fast)
  if (!isValidSortOption(config.option)) {
    throw new Error(ErrorMessages.INVALID_SORT_OPTION(config.option));
  }
  
  // Save to both locations
  updateURLWithSortConfig(config);
  saveSortConfigToStorage(config);
}
