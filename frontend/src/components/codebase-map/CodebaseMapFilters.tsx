/**
 * CodebaseMapFilters — Search and filter controls for the codebase map.
 *
 * Provides text search, file type filter, module filter, and bounty-only
 * toggle to narrow down the visualization. Integrates with the map's
 * filter state to dynamically update the displayed nodes.
 *
 * Spec requirement: "Search/filter by file type, directory, bounty association"
 *
 * @module components/codebase-map/CodebaseMapFilters
 */

import type { CodebaseMapFilters as FilterState } from '../../types/codebase-map';

/** Props for the CodebaseMapFilters component. */
export interface CodebaseMapFiltersProps {
  /** Current filter state. */
  filters: FilterState;
  /** Callback to update a single filter field. */
  onFilterChange: <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => void;
  /** Callback to reset all filters to defaults. */
  onReset: () => void;
  /** Available file extensions for the dropdown. */
  fileExtensions: string[];
  /** Available module names for the dropdown. */
  moduleNames: string[];
  /** Whether to show the dependency arrows toggle. */
  showDependencies: boolean;
  /** Callback to toggle dependency arrows. */
  onToggleDependencies: () => void;
}

/**
 * Filter toolbar for the interactive codebase map.
 *
 * Renders a compact toolbar with search input, filter dropdowns,
 * bounty-only toggle, and dependency arrows toggle. Responsive
 * layout collapses gracefully on mobile screens.
 */
export function CodebaseMapFilters({
  filters,
  onFilterChange,
  onReset,
  fileExtensions,
  moduleNames,
  showDependencies,
  onToggleDependencies,
}: CodebaseMapFiltersProps): JSX.Element {
  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.fileType !== '' ||
    filters.module !== '' ||
    filters.bountyOnly;

  return (
    <div
      className="flex flex-wrap items-center gap-2 p-3 bg-surface-50 border border-white/10
                 rounded-lg"
      data-testid="codebase-map-filters"
      role="search"
      aria-label="Codebase map filters"
    >
      {/* Search Input */}
      <div className="relative flex-grow min-w-[160px] max-w-xs">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="search"
          value={filters.searchQuery}
          onChange={(event) =>
            onFilterChange('searchQuery', event.target.value)
          }
          placeholder="Search files..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-200 border border-white/10
                     rounded-md text-gray-200 placeholder-gray-600 focus:outline-none
                     focus:border-[#9945FF]/50 transition-colors"
          data-testid="codebase-map-search"
          aria-label="Search files and directories"
        />
      </div>

      {/* File Type Filter */}
      <select
        value={filters.fileType}
        onChange={(event) => onFilterChange('fileType', event.target.value)}
        className="text-xs bg-surface-200 border border-white/10 rounded-md px-2 py-1.5
                   text-gray-300 focus:outline-none focus:border-[#9945FF]/50"
        data-testid="codebase-map-filetype-filter"
        aria-label="Filter by file type"
      >
        <option value="">All Types</option>
        {fileExtensions.map((ext) => (
          <option key={ext} value={ext}>
            .{ext}
          </option>
        ))}
      </select>

      {/* Module Filter */}
      <select
        value={filters.module}
        onChange={(event) => onFilterChange('module', event.target.value)}
        className="text-xs bg-surface-200 border border-white/10 rounded-md px-2 py-1.5
                   text-gray-300 focus:outline-none focus:border-[#9945FF]/50"
        data-testid="codebase-map-module-filter"
        aria-label="Filter by module"
      >
        <option value="">All Modules</option>
        {moduleNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      {/* Bounty-Only Toggle */}
      <button
        onClick={() => onFilterChange('bountyOnly', !filters.bountyOnly)}
        className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
          filters.bountyOnly
            ? 'bg-[#14F195]/10 border-[#14F195]/30 text-[#14F195]'
            : 'bg-surface-200 border-white/10 text-gray-500 hover:text-gray-300'
        }`}
        data-testid="codebase-map-bounty-filter"
        aria-pressed={filters.bountyOnly}
        aria-label="Show only files with active bounties"
      >
        Bounties
      </button>

      {/* Dependencies Toggle */}
      <button
        onClick={onToggleDependencies}
        className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
          showDependencies
            ? 'bg-[#9945FF]/10 border-[#9945FF]/30 text-[#9945FF]'
            : 'bg-surface-200 border-white/10 text-gray-500 hover:text-gray-300'
        }`}
        data-testid="codebase-map-deps-toggle"
        aria-pressed={showDependencies}
        aria-label="Toggle dependency arrows"
      >
        Deps
      </button>

      {/* Reset Filters */}
      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1.5"
          data-testid="codebase-map-reset-filters"
          aria-label="Clear all filters"
        >
          Clear
        </button>
      )}
    </div>
  );
}

export default CodebaseMapFilters;
