import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Save,
  Bookmark,
  Trash2,
  Check,
  Plus,
  Minus,
  Filter,
} from 'lucide-react';
import {
  AVAILABLE_LANGUAGES,
  AVAILABLE_TIERS,
  AVAILABLE_DOMAINS,
  REWARD_PRESETS,
  DEFAULT_ADVANCED_FILTERS,
  SAVED_FILTERS_KEY,
} from '../../types/bounty';
import type {
  AdvancedFilters,
  BountyTier,
  SavedFilterSet,
} from '../../types/bounty';
import { cn } from '../../lib/utils';

// ── localStorage helpers ──

function loadSavedFilters(): SavedFilterSet[] {
  try {
    const raw = localStorage.getItem(SAVED_FILTERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedFilters(sets: SavedFilterSet[]) {
  localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(sets));
}

// ── Sub-components ──

/** A single toggleable chip used for multi-select */
function Chip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border',
        active
          ? 'bg-emerald/15 text-emerald border-emerald/30 shadow-sm shadow-emerald/10'
          : 'bg-forge-800 text-text-muted border-border hover:border-border-hover hover:text-text-secondary'
      )}
    >
      {color && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {active && <Check className="w-3 h-3" />}
      {label}
    </button>
  );
}

/** Dual-thumb range slider for reward amounts */
function RewardRangeSlider({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max === Infinity ? 100000 : max);

  useEffect(() => {
    setLocalMin(min);
    setLocalMax(max === Infinity ? 100000 : max);
  }, [min, max]);

  const handleMin = (v: number) => {
    const clamped = Math.min(v, localMax - 100);
    setLocalMin(clamped);
    onChange(clamped, localMax);
  };

  const handleMax = (v: number) => {
    const clamped = Math.max(v, localMin + 100);
    setLocalMax(clamped);
    onChange(localMin, clamped);
  };

  const formatLabel = (v: number) => {
    if (v >= 100000) return '100K+';
    if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`;
    return `${v}`;
  };

  const minPercent = (localMin / 100000) * 100;
  const maxPercent = (localMax / 100000) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span className="font-mono text-emerald">{formatLabel(localMin)}</span>
        <span className="font-mono text-emerald">{formatLabel(localMax)}</span>
      </div>
      <div className="relative h-2 bg-forge-700 rounded-full">
        {/* Active track */}
        <div
          className="absolute h-full bg-emerald/40 rounded-full"
          style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
        />
        {/* Min thumb */}
        <input
          type="range"
          min={0}
          max={100000}
          step={100}
          value={localMin}
          onChange={(e) => handleMin(Number(e.target.value))}
          className="absolute w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-emerald/30 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-forge-900"
        />
        {/* Max thumb */}
        <input
          type="range"
          min={0}
          max={100000}
          step={100}
          value={localMax}
          onChange={(e) => handleMax(Number(e.target.value))}
          className="absolute w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-emerald/30 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-forge-900"
        />
      </div>
    </div>
  );
}

/** Save / Load filter set dialog */
function SavedFiltersPanel({
  current,
  onApply,
}: {
  current: AdvancedFilters;
  onApply: (filters: AdvancedFilters) => void;
}) {
  const [saved, setSaved] = useState<SavedFilterSet[]>(loadSavedFilters);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    persistSavedFilters(saved);
  }, [saved]);

  useEffect(() => {
    if (showSaveInput) inputRef.current?.focus();
  }, [showSaveInput]);

  const handleSave = () => {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    const newSet: SavedFilterSet = {
      id: crypto.randomUUID(),
      name: trimmed,
      filters: { ...current, rewardMax: current.rewardMax },
      createdAt: new Date().toISOString(),
    };
    setSaved((prev) => [newSet, ...prev]);
    setSaveName('');
    setShowSaveInput(false);
  };

  const handleDelete = (id: string) => {
    setSaved((prev) => prev.filter((s) => s.id !== id));
  };

  const activeCount =
    (current.languages.length > 0 ? 1 : 0) +
    (current.tiers.length > 0 ? 1 : 0) +
    (current.domains.length > 0 ? 1 : 0) +
    (current.rewardMin > 0 || current.rewardMax < Infinity ? 1 : 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
          expanded
            ? 'bg-forge-700 text-text-primary border-border'
            : 'bg-forge-800 text-text-muted border-border hover:border-border-hover hover:text-text-secondary'
        )}
      >
        <Bookmark className="w-3.5 h-3.5" />
        Saved Filters
        {saved.length > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-forge-600 text-text-secondary text-[10px] font-bold">
            {saved.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 bg-forge-800 border border-border rounded-xl shadow-xl shadow-black/40 z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-text-primary">Your Saved Filters</span>
                <button
                  type="button"
                  onClick={() => setShowSaveInput(!showSaveInput)}
                  className="inline-flex items-center gap-1 text-[11px] text-emerald hover:text-emerald/80 transition-colors"
                >
                  <Save className="w-3 h-3" />
                  Save Current
                </button>
              </div>

              <AnimatePresence>
                {showSaveInput && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-1.5">
                      <input
                        ref={inputRef}
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        placeholder="Filter set name…"
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-forge-900 border border-border text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-emerald/50"
                      />
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={!saveName.trim()}
                        className="px-2 py-1.5 rounded-md bg-emerald/20 text-emerald text-xs font-medium disabled:opacity-40 hover:bg-emerald/30 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="max-h-52 overflow-y-auto">
              {saved.length === 0 ? (
                <div className="py-6 text-center text-xs text-text-muted">
                  No saved filters yet.<br />
                  Apply filters and click "Save Current".
                </div>
              ) : (
                saved.map((set) => (
                  <div
                    key={set.id}
                    className="flex items-center gap-2 px-3 py-2.5 hover:bg-forge-700/50 transition-colors group"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onApply({
                          ...set.filters,
                          rewardMax: set.filters.rewardMax ?? Infinity,
                        });
                        setExpanded(false);
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-xs font-medium text-text-primary truncate">{set.name}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {new Date(set.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(set.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-forge-600 text-text-muted hover:text-status-error transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ──

export interface AdvancedSearchProps {
  filters: AdvancedFilters;
  onFiltersChange: (filters: AdvancedFilters) => void;
  resultCount?: number;
  totalCount?: number;
}

export function AdvancedSearch({
  filters,
  onFiltersChange,
  resultCount,
  totalCount,
}: AdvancedSearchProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.query);

  // Sync search input with external filter changes
  useEffect(() => {
    setSearchInput(filters.query);
  }, [filters.query]);

  // Debounced search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, query: value });
    }, 300);
  };

  const toggleLanguage = (lang: string) => {
    const languages = filters.languages.includes(lang)
      ? filters.languages.filter((l) => l !== lang)
      : [...filters.languages, lang];
    onFiltersChange({ ...filters, languages });
  };

  const toggleTier = (tier: BountyTier) => {
    const tiers = filters.tiers.includes(tier)
      ? filters.tiers.filter((t) => t !== tier)
      : [...filters.tiers, tier];
    onFiltersChange({ ...filters, tiers });
  };

  const toggleDomain = (domain: string) => {
    const domains = filters.domains.includes(domain)
      ? filters.domains.filter((d) => d !== domain)
      : [...filters.domains, domain];
    onFiltersChange({ ...filters, domains });
  };

  const applyRewardPreset = (preset: (typeof REWARD_PRESETS)[number]) => {
    onFiltersChange({ ...filters, rewardMin: preset.min, rewardMax: preset.max });
  };

  const handleRewardRange = (min: number, max: number) => {
    onFiltersChange({ ...filters, rewardMin: min, rewardMax: max === 100000 ? Infinity : max });
  };

  const clearAll = () => {
    onFiltersChange({ ...DEFAULT_ADVANCED_FILTERS });
    setSearchInput('');
  };

  const activeCount =
    filters.languages.length +
    filters.tiers.length +
    filters.domains.length +
    (filters.rewardMin > 0 || filters.rewardMax < Infinity ? 1 : 0) +
    (filters.query ? 1 : 0);

  const isPresetActive = (preset: (typeof REWARD_PRESETS)[ number]) => {
    if (preset.max === Infinity && filters.rewardMax === Infinity && filters.rewardMin === 0) return preset.label === 'All';
    return filters.rewardMin === preset.min && filters.rewardMax === preset.max;
  };

  return (
    <div className="space-y-4">
      {/* ── Search Bar + Toggle ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search bounties by title, repo, or description…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-forge-800 border border-border text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-emerald/50 transition-colors duration-150"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => handleSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPanel(!showPanel)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 border',
            showPanel
              ? 'bg-emerald/15 text-emerald border-emerald/30'
              : 'bg-forge-800 text-text-secondary border-border hover:border-border-hover'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald/20 text-emerald text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </button>

        <SavedFiltersPanel
          current={filters}
          onApply={(f) => {
            onFiltersChange(f);
            setSearchInput(f.query);
          }}
        />
      </div>

      {/* ── Active filter tags (shown above panel) ── */}
      {activeCount > 0 && !showPanel && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-text-muted">
            {resultCount !== undefined && totalCount !== undefined
              ? `${resultCount} of ${totalCount} bounties`
              : `${activeCount} filter${activeCount > 1 ? 's' : ''} active`}
          </span>
          {filters.languages.map((l) => (
            <button
              key={`lang-${l}`}
              type="button"
              onClick={() => toggleLanguage(l)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald/10 text-emerald text-[11px] font-medium"
            >
              {l}
              <X className="w-2.5 h-2.5" />
            </button>
          ))}
          {filters.tiers.map((t) => (
            <button
              key={`tier-${t}`}
              type="button"
              onClick={() => toggleTier(t)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-magenta/10 text-magenta text-[11px] font-medium"
            >
              {t}
              <X className="w-2.5 h-2.5" />
            </button>
          ))}
          {filters.domains.map((d) => (
            <button
              key={`domain-${d}`}
              type="button"
              onClick={() => toggleDomain(d)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-status-info/10 text-status-info text-[11px] font-medium"
            >
              {d}
              <X className="w-2.5 h-2.5" />
            </button>
          ))}
          {(filters.rewardMin > 0 || filters.rewardMax < Infinity) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald/10 text-emerald text-[11px] font-medium">
              <Filter className="w-2.5 h-2.5" />
              Reward: {filters.rewardMin > 0 ? `${filters.rewardMin}` : '0'} – {filters.rewardMax < Infinity ? `${filters.rewardMax}` : '∞'}
            </span>
          )}
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] text-text-muted hover:text-status-error transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Expandable Filter Panel ── */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="bg-forge-800/60 border border-border rounded-xl p-5 space-y-6 backdrop-blur-sm">
              {/* ── Languages ── */}
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  Programming Languages
                </h4>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_LANGUAGES.map((lang) => (
                    <Chip
                      key={lang}
                      label={lang}
                      active={filters.languages.includes(lang)}
                      onClick={() => toggleLanguage(lang)}
                    />
                  ))}
                </div>
              </div>

              {/* ── Tiers ── */}
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  Tier Level
                </h4>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TIERS.map((tier) => {
                    const tierColors: Record<string, string> = {
                      T1: 'text-tier-t1',
                      T2: 'text-tier-t2',
                      T3: 'text-tier-t3',
                    };
                    return (
                      <Chip
                        key={tier}
                        label={`${tier} – ${tier === 'T1' ? 'Starter' : tier === 'T2' ? 'Builder' : 'Expert'}`}
                        active={filters.tiers.includes(tier)}
                        onClick={() => toggleTier(tier)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* ── Domains ── */}
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  Domain / Category
                </h4>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_DOMAINS.map((domain) => (
                    <Chip
                      key={domain}
                      label={domain}
                      active={filters.domains.includes(domain)}
                      onClick={() => toggleDomain(domain)}
                    />
                  ))}
                </div>
              </div>

              {/* ── Reward Range ── */}
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                  Reward Range
                </h4>
                {/* Preset buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {REWARD_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyRewardPreset(preset)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border',
                        isPresetActive(preset)
                          ? 'bg-emerald/15 text-emerald border-emerald/30'
                          : 'bg-forge-900 text-text-muted border-border hover:border-border-hover'
                      )}
                    >
                      {preset.label === 'All' ? 'All Prices' : `$${preset.label}`}
                    </button>
                  ))}
                </div>
                {/* Slider */}
                <RewardRangeSlider
                  min={filters.rewardMin}
                  max={filters.rewardMax}
                  onChange={handleRewardRange}
                />
              </div>

              {/* ── Result count + Clear ── */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-xs text-text-muted">
                  {resultCount !== undefined && totalCount !== undefined
                    ? `${resultCount} of ${totalCount} bounties`
                    : 'Adjust filters to narrow results'}
                </span>
                <div className="flex items-center gap-2">
                  {activeCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-status-error border border-border hover:border-status-error/30 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Clear All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPanel(false)}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald text-forge-950 hover:bg-emerald/90 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
