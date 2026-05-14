import React, { useState, useCallback } from 'react';
import { X, BookmarkPlus, Trash2, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterState {
 languages: string[];
 tiers: string[];
 domains: string[];
 rewardMin: number;
 rewardMax: number;
 deadlineBefore: string;
 deadlineAfter: string;
}

export interface SavedFilterSet {
 id: string;
 name: string;
 filters: FilterState;
 search?: string;
 status?: string;
 skill?: string;
 createdAt: string;
}

interface BountyFilterPanelProps {
 filters: FilterState;
 onChange: (filters: FilterState) => void;
 onClear: () => void;
 savedFilterSets: SavedFilterSet[];
 onSaveFilterSet: (name: string) => void;
 onApplyFilterSet: (set: SavedFilterSet) => void;
 onDeleteFilterSet: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LANGUAGES = ['TypeScript', 'Rust', 'Solidity', 'Python', 'Go', 'JavaScript', 'C++', 'Swift', 'Kotlin', 'Move'];
const TIERS = ['T1', 'T2', 'T3'];
const DOMAINS = ['Frontend', 'Backend', 'Smart Contracts', 'SDK', 'Infrastructure', 'DevOps', 'Mobile', 'AI/ML', 'Security', 'Documentation'];
const REWARD_PRESETS = [
 { label: 'All', min: 0, max: 0 },
 { label: '< 100K', min: 0, max: 100000 },
 { label: '100K-500K', min: 100000, max: 500000 },
 { label: '500K-1M', min: 500000, max: 1000000 },
 { label: '1M+', min: 1000000, max: 0 },
];

// ---------------------------------------------------------------------------
// Multi-select chip component
// ---------------------------------------------------------------------------

function ChipSelect({ options, selected, onChange, label }: {
 options: string[];
 selected: string[];
 onChange: (selected: string[]) => void;
 label: string;
}) {
 const toggle = useCallback((opt: string) => {
   if (selected.includes(opt)) {
     onChange(selected.filter(s => s !== opt));
   } else {
     onChange([...selected, opt]);
   }
 }, [selected, onChange]);

 return (
 <div>
 <label className="block text-sm font-medium text-text-secondary mb-2">{label}</label>
 <div className="flex flex-wrap gap-1.5">
 {options.map(opt => (
 <button
 key={opt}
 onClick={() => toggle(opt)}
 className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 ${
 selected.includes(opt)
 ? 'bg-emerald/20 text-emerald border border-emerald/30'
 : 'bg-forge-800 text-text-muted border border-border hover:border-border-hover hover:text-text-secondary'
 }`}
 >
 {opt}
 {selected.includes(opt) && <Check className="w-3 h-3 ml-1 inline" />}
 </button>
 ))}
 </div>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Reward range slider
// ---------------------------------------------------------------------------

function RewardRangeFilter({ min, max, onChange }: {
 min: number;
 max: number;
 onChange: (min: number, max: number) => void;
}) {
 return (
 <div>
 <label className="block text-sm font-medium text-text-secondary mb-2">Reward Range</label>
 <div className="flex flex-wrap gap-1.5 mb-3">
 {REWARD_PRESETS.map(preset => {
 const isActive = min === preset.min && max === preset.max;
 return (
 <button
 key={preset.label}
 onClick={() => onChange(preset.min, preset.max)}
 className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150 ${
 isActive
 ? 'bg-emerald/20 text-emerald border border-emerald/30'
 : 'bg-forge-800 text-text-muted border border-border hover:border-border-hover hover:text-text-secondary'
 }`}
 >
 {preset.label} $FNDRY
 </button>
 );
 })}
 </div>
 <div className="flex items-center gap-3">
 <div className="flex-1">
 <input
 type="range"
 min={0}
 max={5000000}
 step={50000}
 value={min}
 onChange={e => onChange(Number(e.target.value), max)}
 className="w-full accent-emerald"
 />
 <span className="text-xs text-text-muted">{(min / 1000).toFixed(0)}K min</span>
 </div>
 <span className="text-text-muted">—</span>
 <div className="flex-1">
 <input
 type="range"
 min={0}
 max={5000000}
 step={50000}
 value={max}
 onChange={e => onChange(min, Number(e.target.value))}
 className="w-full accent-emerald"
 />
 <span className="text-xs text-text-muted">{max > 0 ? `${(max / 1000).toFixed(0)}K max` : 'No max'}</span>
 </div>
 </div>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Save filter set dialog
// ---------------------------------------------------------------------------

function SaveFilterDialog({ onSave, onClose }: { onSave: (name: string) => void; onClose: () => void }) {
 const [name, setName] = useState('');
 return (
 <div className="flex items-center gap-2 mt-2">
 <input
 type="text"
 value={name}
 onChange={e => setName(e.target.value)}
 placeholder="Filter set name..."
 className="flex-1 bg-forge-800 border border-border rounded px-2 py-1 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald outline-none"
 onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); onClose(); } }}
 />
 <button
 onClick={() => { if (name.trim()) { onSave(name.trim()); onClose(); } }}
 disabled={!name.trim()}
 className="px-2 py-1 rounded bg-emerald text-forge-950 text-xs font-medium disabled:opacity-50"
 >
 Save
 </button>
 <button onClick={onClose} className="px-2 py-1 rounded text-text-muted hover:text-text-secondary text-xs">
 Cancel
 </button>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Main filter panel
// ---------------------------------------------------------------------------

export function BountyFilterPanel({
 filters,
 onChange,
 onClear,
 savedFilterSets,
 onSaveFilterSet,
 onApplyFilterSet,
 onDeleteFilterSet,
}: BountyFilterPanelProps) {
 const [showSaveDialog, setShowSaveDialog] = useState(false);

 const updateFilters = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
   onChange({ ...filters, [key]: value });
 }, [filters, onChange]);

 const activeFilterCount = filters.languages.length + filters.tiers.length + filters.domains.length +
   (filters.rewardMin > 0 ? 1 : 0) + (filters.rewardMax > 0 ? 1 : 0) +
   (filters.deadlineBefore ? 1 : 0) + (filters.deadlineAfter ? 1 : 0);

 return (
 <div className="bg-forge-900 border border-border rounded-xl p-4 mb-6 space-y-4">
 {/* Header */}
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-semibold text-text-primary">
 Advanced Filters
 {activeFilterCount > 0 && (
 <span className="ml-2 px-1.5 py-0.5 rounded-full bg-emerald/20 text-emerald text-xs font-bold">
 {activeFilterCount} active
 </span>
 )}
 </h3>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowSaveDialog(!showSaveDialog)}
 className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-text-muted hover:text-text-secondary transition-colors"
 >
 <BookmarkPlus className="w-3.5 h-3.5" />
 Save
 </button>
 <button
 onClick={onClear}
 className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 transition-colors"
 >
 <X className="w-3.5 h-3.5" />
 Clear
 </button>
 </div>
 </div>

 {showSaveDialog && (
 <SaveFilterDialog onSave={onSaveFilterSet} onClose={() => setShowSaveDialog(false)} />
 )}

 {/* Saved filter sets */}
 {savedFilterSets.length > 0 && (
 <div>
 <label className="block text-sm font-medium text-text-secondary mb-2">Saved Filter Sets</label>
 <div className="flex flex-wrap gap-1.5">
 {savedFilterSets.map(set => (
 <div key={set.id} className="flex items-center gap-1 px-2 py-1 rounded-md bg-forge-800 border border-border">
 <button
 onClick={() => onApplyFilterSet(set)}
 className="text-xs text-text-secondary hover:text-emerald transition-colors"
 >
 {set.name}
 </button>
 <button
 onClick={() => onDeleteFilterSet(set.id)}
 className="text-text-muted hover:text-red-400 transition-colors"
 >
 <Trash2 className="w-3 h-3" />
 </button>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Filter groups */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 <ChipSelect
 label="Languages"
 options={LANGUAGES}
 selected={filters.languages}
 onChange={v => updateFilters('languages', v)}
 />
 <ChipSelect
 label="Tiers"
 options={TIERS}
 selected={filters.tiers}
 onChange={v => updateFilters('tiers', v)}
 />
 <ChipSelect
 label="Domains"
 options={DOMAINS}
 selected={filters.domains}
 onChange={v => updateFilters('domains', v)}
 />
 </div>

 {/* Reward range */}
 <RewardRangeFilter
 min={filters.rewardMin}
 max={filters.rewardMax}
 onChange={(min, max) => { updateFilters('rewardMin', min); updateFilters('rewardMax', max); }}
 />

 {/* Deadline range */}
 <div>
 <label className="block text-sm font-medium text-text-secondary mb-2">Deadline</label>
 <div className="flex items-center gap-3">
 <div>
 <span className="text-xs text-text-muted">After</span>
 <input
 type="date"
 value={filters.deadlineAfter}
 onChange={e => updateFilters('deadlineAfter', e.target.value)}
 className="block bg-forge-800 border border-border rounded px-2 py-1 text-sm text-text-primary focus:border-emerald outline-none"
 />
 </div>
 <span className="text-text-muted">—</span>
 <div>
 <span className="text-xs text-text-muted">Before</span>
 <input
 type="date"
 value={filters.deadlineBefore}
 onChange={e => updateFilters('deadlineBefore', e.target.value)}
 className="block bg-forge-800 border border-border rounded px-2 py-1 text-sm text-text-primary focus:border-emerald outline-none"
 />
 </div>
 </div>
 </div>
 </div>
 );
}
