'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { BountySort, BountyStatus, BountyTier } from '@/types/bounty';
import { mockBounties } from '@/data/mockBounties';

// ─── BountyCard ─────────────────────────────────────────────────────────────

const tierColors: Record<BountyTier, string> = {
  T1: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  T2: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  T3: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const tierLabels: Record<BountyTier, string> = {
  T1: 'Tier 1 — Open Race',
  T2: 'Tier 2 — Assigned',
  T3: 'Tier 3 — Complex',
};

function formatReward(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d left`;
  return `${Math.floor(days / 7)}w left`;
}

function BountyCard({ bounty }: { bounty: (typeof mockBounties)[0] }) {
  return (
    <Link
      href={`/bounty/${bounty.id}`}
      className="group flex flex-col rounded-xl border border-gray-200 dark:border-gray-800
                 bg-white dark:bg-gray-900 p-5
                 hover:border-green-500/50 dark:hover:border-green-500/50
                 hover:shadow-lg hover:shadow-green-500/5
                 transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${tierColors[bounty.tier]}`}>
          {bounty.tier}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{timeLeft(bounty.deadline)}</span>
      </div>

      <h3 className="font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-green-400 transition-colors line-clamp-2">
        {bounty.title}
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 flex-1">
        {bounty.description}
      </p>

      {bounty.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {bounty.skills.map(skill => (
            <span
              key={skill}
              className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold text-green-400">{formatReward(bounty.reward)}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">FNDRY</span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {bounty.submissions} submission{bounty.submissions !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">{tierLabels[bounty.tier]}</div>
    </Link>
  );
}

// ─── Filters ────────────────────────────────────────────────────────────────

interface FiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  tier: BountyTier | 'all';
  onTierChange: (v: BountyTier | 'all') => void;
  status: BountyStatus | 'all';
  onStatusChange: (v: BountyStatus | 'all') => void;
  sort: BountySort;
  onSortChange: (v: BountySort) => void;
  total: number;
}

function Filters({ search, onSearchChange, tier, onTierChange, status, onStatusChange, sort, onSortChange, total }: FiltersProps) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Search bounties by title, skill, or description…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm
                     placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                     transition-colors"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Tier:</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(['all', 'T1', 'T2', 'T3'] as const).map(t => (
              <button
                key={t}
                onClick={() => onTierChange(t)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${tier === t
                    ? 'bg-green-500 text-black'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status:</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(['all', 'open', 'in-progress', 'completed'] as const).map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors
                  ${status === s
                    ? 'bg-green-500 text-black'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
              >
                {s === 'all' ? 'All' : s === 'in-progress' ? 'Active' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Sort:</span>
          <select
            value={sort}
            onChange={e => onSortChange(e.target.value as BountySort)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                       focus:outline-none focus:ring-2 focus:ring-green-500/50 cursor-pointer"
          >
            <option value="newest">Newest</option>
            <option value="reward">Reward</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        Showing <span className="font-medium text-gray-700 dark:text-gray-300">{total}</span> bounty{total !== 1 ? 'ies' : ''}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BountiesPage() {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState<BountyTier | 'all'>('all');
  const [status, setStatus] = useState<BountyStatus | 'all'>('all');
  const [sort, setSort] = useState<BountySort>('newest');

  const filtered = useMemo(() => {
    let result = mockBounties;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        b => b.title.toLowerCase().includes(q) ||
             b.description.toLowerCase().includes(q) ||
             b.skills.some(s => s.toLowerCase().includes(q))
      );
    }
    if (tier !== 'all') result = result.filter(b => b.tier === tier);
    if (status !== 'all') result = result.filter(b => b.status === status);
    if (sort === 'newest') result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sort === 'reward') result = [...result].sort((a, b) => b.reward - a.reward);
    else if (sort === 'deadline') result = [...result].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
    return result;
  }, [search, tier, status, sort]);

  const totalReward = filtered.reduce((sum, b) => sum + b.reward, 0);
  const openCount = mockBounties.filter(b => b.status === 'open').length;
  const t1Count = mockBounties.filter(b => b.tier === 'T1').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Bounty Board
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Open-race bounties · First valid PR wins · Paid in $FNDRY
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{openCount}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Open</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{t1Count}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Tier 1</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{(totalReward / 1000).toFixed(0)}K</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">FNDRY Pool</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Filters
            search={search} onSearchChange={setSearch}
            tier={tier} onTierChange={setTier}
            status={status} onStatusChange={setStatus}
            sort={sort} onSortChange={setSort}
            total={filtered.length}
          />
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(bounty => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm">No bounties match your filters.</p>
            <button onClick={() => { setSearch(''); setTier('all'); setStatus('all'); }} className="mt-3 text-sm text-green-400 hover:text-green-300">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
