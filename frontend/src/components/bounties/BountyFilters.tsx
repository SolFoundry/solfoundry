import { useRef, useEffect } from 'react';
import type { BountyBoardFilters, BountyTier, BountyStatus } from '../../types/bounty';
import { SKILL_OPTIONS, TIER_OPTIONS, STATUS_OPTIONS } from '../../types/bounty';
interface Props { filters: BountyBoardFilters; onFilterChange: <K extends keyof BountyBoardFilters>(k: K, v: BountyBoardFilters[K]) => void; onReset: () => void; resultCount: number; totalCount: number; }
export function BountyFilters({ filters: f, onFilterChange, onReset, resultCount, totalCount }: Props) {
  const sr = useRef<HTMLInputElement>(null), dr = useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(() => () => { if (dr.current) clearTimeout(dr.current); }, []);
  const hs = (v: string) => { if (dr.current) clearTimeout(dr.current); dr.current = setTimeout(() => onFilterChange('searchQuery', v), 300); };
  const ts = (s: string) => { const c = f.skills; onFilterChange('skills', c.includes(s) ? c.filter(x => x !== s) : [...c, s]); };
  const ha = f.tier !== 'all' || f.status !== 'all' || f.skills.length > 0 || f.searchQuery.trim() !== '';
  return (
    <div className="space-y-3" data-testid="bounty-filters">
      <input ref={sr} type="search" placeholder="Search bounties..." defaultValue={f.searchQuery} onChange={e => hs(e.target.value)} className="w-full rounded-lg border border-surface-300 bg-surface-50 px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none" aria-label="Search bounties" data-testid="bounty-search" />
      <div className="flex flex-wrap items-center gap-2">
        <select value={f.tier} onChange={e => onFilterChange('tier', e.target.value as BountyTier|'all')} className="rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-white" aria-label="Filter by tier" data-testid="tier-filter">{TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select value={f.status} onChange={e => onFilterChange('status', e.target.value as BountyStatus|'all')} className="rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-white" aria-label="Filter by status" data-testid="status-filter">{STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        {ha && <button type="button" onClick={() => { onReset(); if (sr.current) sr.current.value = ''; }} className="text-sm text-gray-400 hover:text-white" data-testid="reset-filters">Clear</button>}
        <span className="ml-auto text-xs text-gray-500" data-testid="result-count">{resultCount} of {totalCount}</span>
      </div>
      <div className="flex flex-wrap gap-1" data-testid="skill-filters">{SKILL_OPTIONS.map(s => { const a = f.skills.includes(s); return <button key={s} type="button" onClick={() => ts(s)} className={'rounded-full px-2 py-0.5 text-xs ' + (a ? 'bg-solana-green/15 text-solana-green' : 'bg-surface-200 text-gray-400')} aria-pressed={a} data-testid={'skill-filter-' + s}>{s}</button>; })}</div>
    </div>);
}
