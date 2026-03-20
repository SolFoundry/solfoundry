'use client';

import React from 'react';
import {
  AgentFilters as AgentFiltersType,
  AgentRole,
  AgentStatus,
  ROLE_LABELS,
  ROLE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  SortCriterion,
  SortDirection,
} from '../../lib/agents';

interface AgentFiltersProps {
  filters: AgentFiltersType;
  sortCriterion: SortCriterion;
  sortDirection: SortDirection;
  onSearchChange: (query: string) => void;
  onToggleRole: (role: AgentRole) => void;
  onSetMinSuccessRate: (rate: number) => void;
  onToggleAvailability: (status: AgentStatus) => void;
  onSetSortCriterion: (criterion: SortCriterion) => void;
  onToggleSortDirection: () => void;
  onClearFilters: () => void;
  resultCount: number;
}

const ALL_ROLES: AgentRole[] = ['backend', 'frontend', 'security', 'data', 'devops', 'fullstack'];
const ALL_STATUSES: AgentStatus[] = ['available', 'working', 'offline'];
const SORT_OPTIONS: { value: SortCriterion; label: string }[] = [
  { value: 'successRate', label: 'Success Rate' },
  { value: 'bountiesCompleted', label: 'Bounties Completed' },
  { value: 'name', label: 'Name' },
  { value: 'pricing', label: 'Price' },
];

/**
 * AgentFilters
 */
export default function AgentFilters({
  filters,
  sortCriterion,
  sortDirection,
  onSearchChange,
  onToggleRole,
  onSetMinSuccessRate,
  onToggleAvailability,
  onSetSortCriterion,
  onToggleSortDirection,
  onClearFilters,
  resultCount,
}: AgentFiltersProps) {
  const hasActiveFilters =
    filters.roles.length > 0 ||
    filters.minSuccessRate > 0 ||
    filters.availability.length > 0 ||
    filters.searchQuery.trim() !== '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5" data-testid="agent-filters">
      {/* Search */}
      <div>
        <label htmlFor="agent-search" className="block text-sm font-medium text-gray-700 mb-1.5">
          Search Agents
        </label>
        <input
          id="agent-search"
          type="text"
          placeholder="Search by name, role, or description..."
          value={filters.searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
          data-testid="search-input"
        />
      </div>

      {/* Role filter */}
      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">Role</span>
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => onToggleRole(role)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filters.roles.includes(role)
                  ? `${ROLE_COLORS[role]} border-transparent`
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
              data-testid={`filter-role-${role}`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      </div>

      {/* Availability filter */}
      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">Availability</span>
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => onToggleAvailability(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                filters.availability.includes(status)
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
              data-testid={`filter-status-${status}`}
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {/* Min success rate */}
      <div>
        <label htmlFor="min-success-rate" className="block text-sm font-medium text-gray-700 mb-1.5">
          Min Success Rate: {filters.minSuccessRate > 0 ? `${filters.minSuccessRate}%` : 'Any'}
        </label>
        <input
          id="min-success-rate"
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minSuccessRate}
          onChange={(e) => onSetMinSuccessRate(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          data-testid="success-rate-slider"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Any</span>
          <span>100%</span>
        </div>
      </div>

      {/* Sort */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label htmlFor="sort-criterion" className="block text-sm font-medium text-gray-700 mb-1.5">
            Sort By
          </label>
          <select
            id="sort-criterion"
            value={sortCriterion}
            onChange={(e) => onSetSortCriterion(e.target.value as SortCriterion)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            data-testid="sort-select"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onToggleSortDirection}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          title={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
          data-testid="sort-direction-toggle"
        >
          {sortDirection === 'asc' ? 'â Asc' : 'â Desc'}
        </button>
      </div>

      {/* Results count + clear */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-sm text-gray-500">
          <span className="font-medium text-gray-900">{resultCount}</span> agent{resultCount !== 1 ? 's' : ''} found
        </span>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            data-testid="clear-filters"
          >
            Clear All Filters
          </button>
        )}
      </div>
    </div>
  );
}