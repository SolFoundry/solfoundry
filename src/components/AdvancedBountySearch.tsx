import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Save, Trash2, Filter, ChevronDown } from 'lucide-react';

interface SearchFilters {
  query: string;
  languages: string[];
  tiers: string[];
  domains: string[];
  rewardMin: number;
  rewardMax: number;
  sortBy: 'reward' | 'deadline' | 'created';
  sortOrder: 'asc' | 'desc';
}

interface SavedFilter {
  id: string;
  name: string;
  filters: SearchFilters;
}

const LANGUAGES = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Rust',
  'Go',
  'Solidity',
  'C++',
  'Java',
];

const TIERS = ['T1', 'T2', 'T3'];

const DOMAINS = [
  'Frontend',
  'Backend',
  'Smart Contracts',
  'Documentation',
  'Design',
  'DevOps',
  'AI/ML',
];

const REWARD_PRESETS = [
  { label: 'All', min: 0, max: 1000000 },
  { label: '< 100K', min: 0, max: 100000 },
  { label: '100K - 500K', min: 100000, max: 500000 },
  { label: '> 500K', min: 500000, max: 1000000 },
];

const defaultFilters: SearchFilters = {
  query: '',
  languages: [],
  tiers: [],
  domains: [],
  rewardMin: 0,
  rewardMax: 1000000,
  sortBy: 'reward',
  sortOrder: 'desc',
};

export function AdvancedBountySearch({
  onFiltersChange,
}: {
  onFiltersChange: (filters: SearchFilters) => void;
}) {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [activePreset, setActivePreset] = useState(0);

  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('bounty-saved-filters');
    if (saved) {
      setSavedFilters(JSON.parse(saved));
    }
  }, []);

  // Notify parent of filter changes
  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const toggleArrayFilter = (
    key: 'languages' | 'tiers' | 'domains',
    value: string
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  };

  const applyPreset = (index: number) => {
    const preset = REWARD_PRESETS[index];
    setFilters((prev) => ({
      ...prev,
      rewardMin: preset.min,
      rewardMax: preset.max,
    }));
    setActivePreset(index);
  };

  const saveFilterSet = () => {
    if (!saveName.trim()) return;

    const newSaved: SavedFilter = {
      id: Date.now().toString(),
      name: saveName,
      filters,
    };

    const updated = [...savedFilters, newSaved];
    setSavedFilters(updated);
    localStorage.setItem('bounty-saved-filters', JSON.stringify(updated));
    setShowSaveModal(false);
    setSaveName('');
  };

  const loadFilterSet = (saved: SavedFilter) => {
    setFilters(saved.filters);
    setShowFilters(false);
  };

  const deleteFilterSet = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem('bounty-saved-filters', JSON.stringify(updated));
  };

  const clearAllFilters = () => {
    setFilters(defaultFilters);
    setActivePreset(0);
  };

  const hasActiveFilters =
    filters.languages.length > 0 ||
    filters.tiers.length > 0 ||
    filters.domains.length > 0 ||
    filters.query !== '';

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, query: e.target.value }))
            }
            placeholder="Search bounties..."
            className="w-full pl-10 pr-4 py-3 bg-forge-800 border border-forge-700 rounded-lg text-primary placeholder:text-muted focus:outline-none focus:border-emerald transition-colors"
          />
          {filters.query && (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, query: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 rounded-lg border transition-colors flex items-center gap-2 ${
            showFilters || hasActiveFilters
              ? 'bg-emerald/10 border-emerald text-emerald'
              : 'bg-forge-800 border-forge-700 text-secondary hover:border-forge-600'
          }`}
        >
          <Filter className="w-5 h-5" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="bg-emerald text-forge-950 text-xs font-bold px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </button>

        <button
          onClick={() => setShowSaveModal(true)}
          className="px-4 py-3 rounded-lg border border-forge-700 bg-forge-800 text-secondary hover:border-forge-600 transition-colors"
          title="Save current filters"
        >
          <Save className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-forge-900 border border-forge-700 rounded-lg p-4 space-y-4"
          >
            {/* Reward Range */}
            <div>
              <label className="text-sm font-medium text-secondary mb-2 block">
                Reward Range
              </label>
              <div className="flex gap-2">
                {REWARD_PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(i)}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      activePreset === i
                        ? 'bg-emerald text-forge-950 font-medium'
                        : 'bg-forge-800 text-secondary hover:text-primary'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tiers */}
            <div>
              <label className="text-sm font-medium text-secondary mb-2 block">
                Tier Level
              </label>
              <div className="flex gap-2">
                {TIERS.map((tier) => (
                  <button
                    key={tier}
                    onClick={() => toggleArrayFilter('tiers', tier)}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      filters.tiers.includes(tier)
                        ? 'bg-emerald text-forge-950 font-medium'
                        : 'bg-forge-800 text-secondary hover:text-primary'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Languages */}
            <div>
              <label className="text-sm font-medium text-secondary mb-2 block">
                Programming Language
              </label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleArrayFilter('languages', lang)}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      filters.languages.includes(lang)
                        ? 'bg-emerald text-forge-950 font-medium'
                        : 'bg-forge-800 text-secondary hover:text-primary'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Domains */}
            <div>
              <label className="text-sm font-medium text-secondary mb-2 block">
                Domain
              </label>
              <div className="flex flex-wrap gap-2">
                {DOMAINS.map((domain) => (
                  <button
                    key={domain}
                    onClick={() => toggleArrayFilter('domains', domain)}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      filters.domains.includes(domain)
                        ? 'bg-emerald text-forge-950 font-medium'
                        : 'bg-forge-800 text-secondary hover:text-primary'
                    }`}
                  >
                    {domain}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort & Clear */}
            <div className="flex items-center justify-between pt-2 border-t border-forge-700">
              <div className="flex items-center gap-3">
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      sortBy: e.target.value as SearchFilters['sortBy'],
                    }))
                  }
                  className="bg-forge-800 border border-forge-700 rounded px-3 py-1.5 text-sm text-primary"
                >
                  <option value="reward">Sort by Reward</option>
                  <option value="deadline">Sort by Deadline</option>
                  <option value="created">Sort by Created</option>
                </select>

                <button
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
                    }))
                  }
                  className="px-3 py-1.5 bg-forge-800 border border-forge-700 rounded text-sm text-secondary"
                >
                  {filters.sortOrder === 'asc' ? '鈫?Ascending' : '鈫?Descending'}
                </button>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-error hover:text-error/80 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted">Saved:</span>
          {savedFilters.map((saved) => (
            <div
              key={saved.id}
              className="flex items-center gap-1 bg-forge-800 border border-forge-700 rounded px-2 py-1 text-sm"
            >
              <button
                onClick={() => loadFilterSet(saved)}
                className="text-secondary hover:text-primary"
              >
                {saved.name}
              </button>
              <button
                onClick={() => deleteFilterSet(saved.id)}
                className="text-muted hover:text-error"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Save Modal */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowSaveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-forge-900 border border-forge-700 rounded-lg p-6 w-full max-w-md"
            >
              <h3 className="text-lg font-semibold text-primary mb-4">
                Save Filter Set
              </h3>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Filter name..."
                className="w-full px-4 py-2 bg-forge-800 border border-forge-700 rounded text-primary placeholder:text-muted focus:outline-none focus:border-emerald mb-4"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 text-secondary hover:text-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={saveFilterSet}
                  className="px-4 py-2 bg-emerald text-forge-950 font-medium rounded hover:bg-emerald-light"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdvancedBountySearch;