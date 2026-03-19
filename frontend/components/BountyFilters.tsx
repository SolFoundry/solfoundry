import React, { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';

export interface FilterOptions {
  search: string;
  tier: string[];
  skills: string[];
  status: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface BountyFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableSkills: string[];
}

const TIER_OPTIONS = ['T1', 'T2', 'T3', 'T4', 'T5'];
const STATUS_OPTIONS = ['Open', 'In Progress', 'Under Review', 'Completed', 'Cancelled'];
const SORT_OPTIONS = [
  { value: 'created', label: 'Date Created' },
  { value: 'reward', label: 'Reward Amount' },
  { value: 'tier', label: 'Tier' },
  { value: 'deadline', label: 'Deadline' }
];

export const BountyFilters: React.FC<BountyFiltersProps> = ({
  filters,
  onFiltersChange,
  availableSkills
}) => {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const toggleArrayFilter = (key: 'tier' | 'skills' | 'status', value: string) => {
    const currentArray = filters[key];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    
    updateFilter(key, newArray);
  };

  const clearAllFilters = () => {
    onFiltersChange({
      search: '',
      tier: [],
      skills: [],
      status: [],
      sortBy: 'created',
      sortOrder: 'desc'
    });
  };

  const activeFilterCount = filters.tier.length + filters.skills.length + filters.status.length + (filters.search ? 1 : 0);

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Search and Controls Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search bounties..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Controls */}
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter('sortBy', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title={`Sort ${filters.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {filters.sortOrder === 'asc' ? '↑' : '↓'}
            </button>

            {/* Filter Toggle */}
            <button
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className={`relative px-4 py-2 border rounded-lg flex items-center gap-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                isFilterPanelOpen 
                  ? 'bg-blue-50 border-blue-300 text-blue-700' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Expandable Filter Panel */}
        {isFilterPanelOpen && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tier Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tier
                </label>
                <div className="space-y-2">
                  {TIER_OPTIONS.map(tier => (
                    <label key={tier} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.tier.includes(tier)}
                        onChange={() => toggleArrayFilter('tier', tier)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{tier}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Skills Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Skills
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {availableSkills.map(skill => (
                    <label key={skill} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.skills.includes(skill)}
                        onChange={() => toggleArrayFilter('skills', skill)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{skill}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={() => toggleArrayFilter('status', status)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{status}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filters.search && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Search: "{filters.search}"
                <button
                  onClick={() => updateFilter('search', '')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            
            {filters.tier.map(tier => (
              <span key={`tier-${tier}`} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                {tier}
                <button
                  onClick={() => toggleArrayFilter('tier', tier)}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            
            {filters.skills.map(skill => (
              <span key={`skill-${skill}`} className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                {skill}
                <button
                  onClick={() => toggleArrayFilter('skills', skill)}
                  className="text-purple-600 hover:text-purple-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            
            {filters.status.map(status => (
              <span key={`status-${status}`} className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                {status}
                <button
                  onClick={() => toggleArrayFilter('status', status)}
                  className="text-orange-600 hover:text-orange-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};