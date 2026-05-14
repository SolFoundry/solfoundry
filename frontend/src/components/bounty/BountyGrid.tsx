import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, Loader2, Plus, Search, X, SlidersHorizontal, ChevronUp, BookmarkPlus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BountyCard } from './BountyCard';
import { BountyFilterPanel, type FilterState, type SavedFilterSet } from './BountyFilterPanel';
import { useInfiniteBounties } from '../../hooks/useBounties';
import { staggerContainer, staggerItem } from '../../lib/animations';

const SEARCH_DEBOUNCE_MS = 300;
const SAVED_FILTERS_KEY = 'solfoundry-saved-filters';

export function BountyGrid() {
 const [activeSkill, setActiveSkill] = useState<string>('All');
 const [statusFilter, setStatusFilter] = useState<string>('open');
 const [searchQuery, setSearchQuery] = useState<string>('');
 const [debouncedSearch, setDebouncedSearch] = useState<string>('');
 const [showFilters, setShowFilters] = useState(false);
 const [filters, setFilters] = useState<FilterState>({
   languages: [],
   tiers: [],
   domains: [],
   rewardMin: 0,
   rewardMax: 0,
   deadlineBefore: '',
   deadlineAfter: '',
 });
 const [savedFilterSets, setSavedFilterSets] = useState<SavedFilterSet[]>([]);
 const debounceRef = useRef<ReturnType<typeof setTimeout>>();

 // Load saved filter sets from localStorage
 useEffect(() => {
   try {
     const stored = localStorage.getItem(SAVED_FILTERS_KEY);
     if (stored) setSavedFilterSets(JSON.parse(stored));
   } catch { /* ignore corrupt data */ }
 }, []);

 const saveFilterSets = useCallback((sets: SavedFilterSet[]) => {
   setSavedFilterSets(sets);
   try { localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(sets)); } catch { /* quota */ }
 }, []);

 const handleSearchChange = useCallback((value: string) => {
   setSearchQuery(value);
   if (debounceRef.current) clearTimeout(debounceRef.current);
   debounceRef.current = setTimeout(() => setDebouncedSearch(value), SEARCH_DEBOUNCE_MS);
 }, []);

 const clearSearch = useCallback(() => {
   setSearchQuery('');
   setDebouncedSearch('');
   if (debounceRef.current) clearTimeout(debounceRef.current);
 }, []);

 const clearAllFilters = useCallback(() => {
   setFilters({ languages: [], tiers: [], domains: [], rewardMin: 0, rewardMax: 0, deadlineBefore: '', deadlineAfter: '' });
   setActiveSkill('All');
   clearSearch();
 }, [clearSearch]);

 const saveCurrentFilterSet = useCallback((name: string) => {
   const newSet: SavedFilterSet = {
     id: Date.now().toString(36),
     name,
     filters: { ...filters },
     search: debouncedSearch,
     status: statusFilter,
     skill: activeSkill,
     createdAt: new Date().toISOString(),
   };
   saveFilterSets([...savedFilterSets, newSet]);
 }, [filters, debouncedSearch, statusFilter, activeSkill, savedFilterSets, saveFilterSets]);

 const applyFilterSet = useCallback((set: SavedFilterSet) => {
   setFilters(set.filters);
   setDebouncedSearch(set.search ?? '');
   setSearchQuery(set.search ?? '');
   setStatusFilter(set.status ?? 'open');
   setActiveSkill(set.skill ?? 'All');
 }, []);

 const deleteFilterSet = useCallback((id: string) => {
   saveFilterSets(savedFilterSets.filter(s => s.id !== id));
 }, [savedFilterSets, saveFilterSets]);

 // Build API params from filters
 const params = {
   status: statusFilter,
   skill: activeSkill !== 'All' ? activeSkill : undefined,
   search: debouncedSearch || undefined,
   tier: filters.tiers.length === 1 ? filters.tiers[0] : undefined,
   reward_min: filters.rewardMin || undefined,
   reward_max: filters.rewardMax || undefined,
 };

 const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
   useInfiniteBounties(params);

 const allBountiesRaw = data?.pages.flatMap((p) => p.items) ?? [];

 // Client-side filtering for fields the API might not support
 const allBounties = allBountiesRaw.filter((b) => {
   // Search filter
   if (debouncedSearch) {
     const q = debouncedSearch.toLowerCase();
     const matchesSearch = b.title?.toLowerCase().includes(q) ||
       b.description?.toLowerCase().includes(q) ||
       b.skills?.some((s) => s.toLowerCase().includes(q));
     if (!matchesSearch) return false;
   }

   // Multi-select language filter
   if (filters.languages.length > 0) {
     const bountySkills = b.skills?.map(s => s.toLowerCase()) ?? [];
     const matchesLang = filters.languages.some(l => bountySkills.includes(l.toLowerCase()));
     if (!matchesLang) return false;
   }

   // Multi-select tier filter
   if (filters.tiers.length > 0) {
     if (!filters.tiers.includes(b.tier)) return false;
   }

   // Multi-select domain filter
   if (filters.domains.length > 0) {
     const bDomain = (b as any).category?.toLowerCase() ?? '';
     const matchesDomain = filters.domains.some(d => bDomain.includes(d.toLowerCase()));
     if (!matchesDomain) return false;
   }

   // Reward range filter
   if (filters.rewardMin > 0 && b.reward_amount < filters.rewardMin) return false;
   if (filters.rewardMax > 0 && b.reward_amount > filters.rewardMax) return false;

   // Deadline filter
   if (filters.deadlineBefore && b.deadline) {
     if (new Date(b.deadline) > new Date(filters.deadlineBefore)) return false;
   }
   if (filters.deadlineAfter && b.deadline) {
     if (new Date(b.deadline) < new Date(filters.deadlineAfter)) return false;
   }

   return true;
 });

 const hasActiveFilters = filters.languages.length > 0 || filters.tiers.length > 0 ||
   filters.domains.length > 0 || filters.rewardMin > 0 || filters.rewardMax > 0 ||
   filters.deadlineBefore || filters.deadlineAfter;

 return (
 <section id="bounties" className="py-16 md:py-24">
 <div className="max-w-7xl mx-auto px-4">
 {/* Header row */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
 <h2 className="font-sans text-2xl font-semibold text-text-primary">Open Bounties</h2>
 <div className="flex items-center gap-2">
 <Link
 to="/bounties/create"
 className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald text-forge-950 font-semibold text-sm hover:bg-emerald/90 transition-colors duration-150"
 >
 <Plus className="w-4 h-4" />
 Post a Bounty
 </Link>
 {/* Status filter */}
 <div className="relative">
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="appearance-none bg-forge-800 border border-border rounded-lg px-3 py-1.5 pr-8 text-sm text-text-secondary font-medium focus:border-emerald outline-none transition-colors duration-150 cursor-pointer"
 >
 <option value="open">Open</option>
 <option value="funded">Funded</option>
 <option value="in_review">In Review</option>
 <option value="completed">Completed</option>
 </select>
 <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
 </div>
 {/* Filter toggle */}
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors duration-150 ${
   hasActiveFilters
     ? 'border-emerald text-emerald bg-emerald/10'
     : 'border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
 }`}
 >
 <SlidersHorizontal className="w-4 h-4" />
 Filters
 {hasActiveFilters && (
 <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald/20 text-emerald text-xs font-bold">
 {(filters.languages.length + filters.tiers.length + filters.domains.length) || ''}
 {(filters.rewardMin > 0 || filters.rewardMax > 0) ? '+' : ''}
 </span>
 )}
 {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
 </button>
 </div>
 </div>

 {/* Search bar */}
 <div className="relative mb-4">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => handleSearchChange(e.target.value)}
 placeholder="Search bounties by title, description, or skills..."
 className="w-full bg-forge-800 border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none transition-all duration-150"
 />
 {searchQuery && (
 <button
 onClick={clearSearch}
 className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-text-muted hover:text-text-secondary transition-colors"
 aria-label="Clear search"
 >
 <X className="w-4 h-4" />
 </button>
 )}
 </div>

 {/* Advanced filter panel */}
 <AnimatePresence>
 {showFilters && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="overflow-hidden"
 >
 <BountyFilterPanel
 filters={filters}
 onChange={setFilters}
 onClear={clearAllFilters}
 savedFilterSets={savedFilterSets}
 onSaveFilterSet={saveCurrentFilterSet}
 onApplyFilterSet={applyFilterSet}
 onDeleteFilterSet={deleteFilterSet}
 />
 </motion.div>
 )}
 </AnimatePresence>



 {/* Loading state */}
 {isLoading && (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
 {Array.from({ length: 6 }).map((_, i) => (
 <div
 key={i}
 className="h-52 rounded-xl border border-border bg-forge-900 overflow-hidden"
 >
 <div className="h-full bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer" />
 </div>
 ))}
 </div>
 )}

 {/* Error state */}
 {isError && !isLoading && (
 <div className="text-center py-16">
 <p className="text-text-muted mb-4">Could not load bounties. Backend may be offline.</p>
 <p className="text-text-muted text-sm font-mono">Running in demo mode — no bounties to display.</p>
 </div>
 )}

 {/* Empty state */}
 {!isLoading && !isError && allBounties.length === 0 && (
 <div className="text-center py-16">
 <p className="text-text-muted text-lg mb-2">No bounties found</p>
 <p className="text-text-muted text-sm">
 {debouncedSearch ? `No results for "${debouncedSearch}". Try a different search term.` : hasActiveFilters ? 'Try adjusting your filters.' : 'Check back soon for new bounties.'}
 </p>
 {hasActiveFilters && (
 <button
 onClick={clearAllFilters}
 className="mt-4 px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:border-emerald hover:text-emerald transition-colors"
 >
 Clear all filters
 </button>
 )}
 </div>
 )}

 {/* Bounty grid */}
 {!isLoading && allBounties.length > 0 && (
 <motion.div
 variants={staggerContainer}
 initial="initial"
 whileInView="animate"
 viewport={{ once: true, margin: '-50px' }}
 className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
 >
 {allBounties.map((bounty) => (
 <motion.div key={bounty.id} variants={staggerItem}>
 <BountyCard bounty={bounty} />
 </motion.div>
 ))}
 </motion.div>
 )}

 {/* Load more */}
 {hasNextPage && (
 <div className="mt-10 text-center">
 <button
 onClick={() => fetchNextPage()}
 disabled={isFetchingNextPage}
 className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:border-border-hover hover:text-text-primary transition-all duration-200 disabled:opacity-50"
 >
 {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" />}
 Load More
 </button>
 </div>
 )}
 </div>
 </section>
 );
}
