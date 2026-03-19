'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string;
  avatar: string;
  totalEarned: number;
  bountiesCompleted: number;
  reputation: number;
  walletAddress: string;
  category: string;
}

// Mock wallet for logged-in user
const MOCK_WALLET = 'E4UWo5a5QrHFbjnj1UUKdsxixE5pTm3SdZcz7EUag1B7';

// ─── Mock Data ──────────────────────────────────────────────────────────────

const categories = ['All', 'DeFi', 'NFTs', 'Infrastructure', 'Tooling', 'Security'];

const generateMockData = (): LeaderboardEntry[] => {
  const usernames = [
    'satoshi_dev', 'vitalik_eth', 'solana_maxi', 'rustacean_42', 'web3_ninja',
    'defi_whale', 'nft_collector', 'contract_wizard', 'token_economist', 'dao_master',
    'bridge_builder', 'amm_creator', 'oracle_node', 'validator_pro', 'memecoin_king',
    'layer2_hero', 'zk_prover', 'mev_hunter', 'delegate_x', 'governance_guru',
    'yield_farmer', 'liquidity_pro', 'swap_queen', 'stake_runner', 'airdrop_hunter',
    'ens_domain', 'poap_collector', 'gitcoin_grantee', 'hackathon_winner', 'bounty_hunter_pro'
  ];

  const avatars = [
    'https://api.dicebear.com/7.x/identicon/svg?seed=1',
    'https://api.dicebear.com/7.x/identicon/svg?seed=2',
    'https://api.dicebear.com/7.x/identicon/svg?seed=3',
    'https://api.dicebear.com/7.x/identicon/svg?seed=4',
    'https://api.dicebear.com/7.x/identicon/svg?seed=5',
    'https://api.dicebear.com/7.x/identicon/svg?seed=6',
    'https://api.dicebear.com/7.x/identicon/svg?seed=7',
    'https://api.dicebear.com/7.x/identicon/svg?seed=8',
    'https://api.dicebear.com/7.x/identicon/svg?seed=9',
    'https://api.dicebear.com/7.x/identicon/svg?seed=10',
  ];

  const categoryList = ['DeFi', 'NFTs', 'Infrastructure', 'Tooling', 'Security'];

  return usernames.map((username, idx) => ({
    id: `user_${idx + 1}`,
    rank: idx + 1,
    username,
    avatar: avatars[idx % avatars.length],
    totalEarned: Math.floor(Math.random() * 50000) + 100,
    bountiesCompleted: Math.floor(Math.random() * 50) + 1,
    reputation: Math.floor(Math.random() * 1000) / 10 + 80,
    walletAddress: `${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`,
    category: categoryList[idx % categoryList.length],
  })).sort((a, b) => b.totalEarned - a.totalEarned)
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
};

const mockLeaderboard = generateMockData();

// ─── Helper Functions ───────────────────────────────────────────────────────

function formatFNDRY(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function getMedal(rank: number): string {
  switch (rank) {
    case 1: return '🥇';
    case 2: return '🥈';
    case 3: return '🥉';
    default: return '';
  }
}

function getMedalColor(rank: number): string {
  switch (rank) {
    case 1: return 'from-yellow-400 to-yellow-600 border-yellow-400';
    case 2: return 'from-gray-300 to-gray-500 border-gray-400';
    case 3: return 'from-amber-600 to-amber-800 border-amber-600';
    default: return '';
  }
}

// ─── Skeleton Components ───────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-4"><div className="h-4 w-8 bg-gray-700 rounded" /></td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-gray-700 rounded-full" />
          <div className="h-4 w-24 bg-gray-700 rounded" />
        </div>
      </td>
      <td className="px-4 py-4"><div className="h-4 w-16 bg-gray-700 rounded" /></td>
      <td className="px-4 py-4"><div className="h-4 w-12 bg-gray-700 rounded" /></td>
      <td className="px-4 py-4 hidden md:table-cell"><div className="h-4 w-14 bg-gray-700 rounded" /></td>
    </tr>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-12 w-12 bg-gray-700 rounded-full" />
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-700 rounded mb-2" />
          <div className="h-3 w-16 bg-gray-700 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-8 bg-gray-700 rounded" />
        <div className="h-8 bg-gray-700 rounded" />
        <div className="h-8 bg-gray-700 rounded" />
      </div>
    </div>
  );
}

// ─── Top 3 Card Component ───────────────────────────────────────────────────

function TopThreeCard({ entry, isYourRank }: { entry: LeaderboardEntry; isYourRank: boolean }) {
  return (
    <Link
      href={`/profile/${entry.username}`}
      className={`group relative flex flex-col rounded-2xl border-2 p-6 transition-all duration-300
        ${isYourRank ? 'border-green-500 shadow-lg shadow-green-500/20' : `border-transparent ${getMedalColor(entry.rank)}`}
        bg-gray-900/80 hover:scale-105 hover:shadow-xl
        ${entry.rank === 1 ? 'bg-gradient-to-b from-yellow-900/30 to-gray-900' : ''}
        ${entry.rank === 2 ? 'bg-gradient-to-b from-gray-700/30 to-gray-900' : ''}
        ${entry.rank === 3 ? 'bg-gradient-to-b from-amber-900/30 to-gray-900' : ''}
      `}
    >
      {/* Medal */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-3xl">
        {getMedal(entry.rank)}
      </div>

      {/* Rank Badge */}
      <div className={`absolute top-2 right-2 text-xs font-mono px-2 py-1 rounded
        ${entry.rank === 1 ? 'bg-yellow-500 text-black' : ''}
        ${entry.rank === 2 ? 'bg-gray-400 text-black' : ''}
        ${entry.rank === 3 ? 'bg-amber-600 text-white' : ''}
      `}>
        #{entry.rank}
      </div>

      {/* Avatar */}
      <div className="flex justify-center mb-4 mt-2">
        <div className={`relative ${entry.rank === 1 ? 'w-20 h-20' : entry.rank === 2 ? 'w-16 h-16' : 'w-16 h-16'}`}>
          <img
            src={entry.avatar}
            alt={entry.username}
            className={`rounded-full border-4 
              ${entry.rank === 1 ? 'border-yellow-400' : ''}
              ${entry.rank === 2 ? 'border-gray-400' : ''}
              ${entry.rank === 3 ? 'border-amber-600' : ''}
            `}
          />
          {isYourRank && (
            <div className="absolute -bottom-1 -right-1 bg-green-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">
              YOU
            </div>
          )}
        </div>
      </div>

      {/* Username */}
      <h3 className="text-center font-mono font-bold text-white text-lg mb-1 group-hover:text-green-400 transition-colors">
        {entry.username}
      </h3>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <div>
          <div className="text-green-400 font-bold font-mono text-sm">{formatFNDRY(entry.totalEarned)}</div>
          <div className="text-gray-500 text-xs">FNDRY</div>
        </div>
        <div>
          <div className="text-white font-bold font-mono text-sm">{entry.bountiesCompleted}</div>
          <div className="text-gray-500 text-xs">Bounties</div>
        </div>
        <div>
          <div className="text-purple-400 font-bold font-mono text-sm">{entry.reputation.toFixed(1)}</div>
          <div className="text-gray-500 text-xs">Rep</div>
        </div>
      </div>

      {/* Category Badge */}
      <div className="mt-4 flex justify-center">
        <span className="text-xs px-3 py-1 rounded-full bg-gray-800 text-gray-400">
          {entry.category}
        </span>
      </div>
    </Link>
  );
}

// ─── Leaderboard Row Component ──────────────────────────────────────────────

function LeaderboardRow({ entry, isYourRank }: { entry: LeaderboardEntry; isYourRank: boolean }) {
  return (
    <Link
      href={`/profile/${entry.username}`}
      className={`group flex items-center px-4 py-3 transition-all duration-200
        ${isYourRank 
          ? 'bg-green-500/10 border-l-4 border-green-500' 
          : 'hover:bg-gray-800/50 border-l-4 border-transparent'
        }
      `}
    >
      {/* Rank */}
      <div className="w-12 text-center">
        {entry.rank <= 3 ? (
          <span className="text-xl">{getMedal(entry.rank)}</span>
        ) : (
          <span className="font-mono text-gray-400">#{entry.rank}</span>
        )}
      </div>

      {/* Avatar & Username */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <img
          src={entry.avatar}
          alt={entry.username}
          className="w-10 h-10 rounded-full border-2 border-gray-700 group-hover:border-green-500 transition-colors"
        />
        <div className="min-w-0">
          <div className="font-mono font-medium text-white truncate group-hover:text-green-400 transition-colors">
            {entry.username}
            {isYourRank && (
              <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">YOU</span>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate">{entry.walletAddress}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 ml-4">
        <div className="text-right hidden sm:block">
          <div className="font-mono font-bold text-green-400">{formatFNDRY(entry.totalEarned)}</div>
          <div className="text-xs text-gray-500">FNDRY</div>
        </div>
        <div className="text-right hidden md:block">
          <div className="font-mono font-bold text-white">{entry.bountiesCompleted}</div>
          <div className="text-xs text-gray-500">Bounties</div>
        </div>
        <div className="text-right w-20">
          <div className="font-mono font-bold text-purple-400">{entry.reputation.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Rep</div>
        </div>
      </div>
    </Link>
  );
}

// ─── Mobile Card Component ──────────────────────────────────────────────────

function MobileCard({ entry, isYourRank }: { entry: LeaderboardEntry; isYourRank: boolean }) {
  return (
    <Link
      href={`/profile/${entry.username}`}
      className={`block p-4 rounded-xl border transition-all duration-200
        ${isYourRank 
          ? 'bg-green-500/10 border-green-500' 
          : 'bg-gray-900/50 border-gray-800 hover:border-green-500/50'
        }
      `}
    >
      <div className="flex items-center gap-3 mb-3">
        {entry.rank <= 3 && <span className="text-2xl">{getMedal(entry.rank)}</span>}
        <img
          src={entry.avatar}
          alt={entry.username}
          className="w-12 h-12 rounded-full border-2 border-gray-700"
        />
        <div className="flex-1">
          <div className="font-mono font-medium text-white">
            {entry.username}
            {isYourRank && (
              <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">YOU</span>
            )}
          </div>
          <div className="text-xs text-gray-500">Rank #{entry.rank}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="font-mono font-bold text-green-400 text-sm">{formatFNDRY(entry.totalEarned)}</div>
          <div className="text-xs text-gray-500">FNDRY</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="font-mono font-bold text-white text-sm">{entry.bountiesCompleted}</div>
          <div className="text-xs text-gray-500">Bounties</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="font-mono font-bold text-purple-400 text-sm">{entry.reputation.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Rep</div>
        </div>
      </div>
    </Link>
  );
}

// ─── Filter Bar Component ────────────────────────────────────────────────────

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  timePeriod: string;
  onTimePeriodChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
}

function FilterBar({ search, onSearchChange, timePeriod, onTimePeriodChange, category, onCategoryChange }: FilterBarProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-4 mb-6">
      {/* Search */}
      <div className="relative flex-1">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Search by username..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-800 bg-gray-900 text-white text-sm
                     placeholder-gray-500 font-mono
                     focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50
                     transition-colors"
        />
      </div>

      {/* Time Period */}
      <div className="flex rounded-lg border border-gray-800 overflow-hidden">
        {['week', 'month', 'all-time'].map(period => (
          <button
            key={period}
            onClick={() => onTimePeriodChange(period)}
            className={`px-4 py-2 text-sm font-medium font-mono transition-colors
              ${timePeriod === period
                ? 'bg-green-500 text-black'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white'
              }
              ${period === 'week' ? 'rounded-l-lg' : ''}
              ${period === 'all-time' ? 'rounded-r-lg' : ''}
            `}
          >
            {period === 'all-time' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      {/* Category */}
      <select
        value={category}
        onChange={e => onCategoryChange(e.target.value)}
        className="px-4 py-2.5 rounded-lg border border-gray-800 bg-gray-900 text-white text-sm font-mono
                   focus:outline-none focus:ring-2 focus:ring-green-500/50 cursor-pointer"
      >
        {categories.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Empty State Component ─────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-20">
      <svg className="mx-auto h-16 w-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-gray-400 font-mono text-lg">No contributors found</p>
      <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(false); // Set to true to see skeletons
  const [search, setSearch] = useState('');
  const [timePeriod, setTimePeriod] = useState('all-time');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Find user's rank in mock data
  const userRank = useMemo(() => {
    // Simulate user in the data
    const userEntry = mockLeaderboard.find(e => e.walletAddress.includes(MOCK_WALLET.slice(0, 6))) || null;
    if (!userEntry) {
      // Add user to mock data for demo
      return { rank: 15, entry: { ...mockLeaderboard[14], walletAddress: MOCK_WALLET, username: 'your_wallet' } };
    }
    return { rank: userEntry.rank, entry: userEntry };
  }, []);

  const filtered = useMemo(() => {
    let result = [...mockLeaderboard];
    
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e => e.username.toLowerCase().includes(q));
    }
    
    if (category !== 'All') {
      result = result.filter(e => e.category === category);
    }
    
    // Time period would filter data in real app - just using mock for all
    return result;
  }, [search, category, timePeriod]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const topThree = filtered.slice(0, 3);

  // Handle loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        {/* Header Skeleton */}
        <div className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="h-10 w-48 bg-gray-800 rounded animate-pulse mb-2" />
            <div className="h-5 w-64 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Filter Skeleton */}
          <div className="flex gap-4 mb-6">
            <div className="h-10 flex-1 bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-10 w-48 bg-gray-800 rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-gray-800 rounded-lg animate-pulse" />
          </div>

          {/* Top 3 Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>

          {/* Table Skeleton */}
          <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-mono text-gray-500 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-mono text-gray-500 uppercase">Contributor</th>
                  <th className="px-4 py-3 text-left text-xs font-mono text-gray-500 uppercase">Earned</th>
                  <th className="px-4 py-3 text-left text-xs font-mono text-gray-500 uppercase">Bounties</th>
                  <th className="px-4 py-3 text-left text-xs font-mono text-gray-500 uppercase hidden md:table-cell">Reputation</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-mono">
      {/* Header */}
      <div className="bg-gray-900/50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Leaderboard
          </h1>
          <p className="text-gray-400">
            Top contributors ranked by total $FNDRY earned
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Bar */}
        <FilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          timePeriod={timePeriod}
          onTimePeriodChange={(v) => { setTimePeriod(v); setPage(1); }}
          category={category}
          onCategoryChange={(v) => { setCategory(v); setPage(1); }}
        />

        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Top 3 Podium */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Reorder for visual hierarchy: 2nd, 1st, 3rd */}
              {topThree[1] && (
                <TopThreeCard 
                  entry={topThree[1]} 
                  isYourRank={userRank.entry.username === topThree[1].username} 
                />
              )}
              {topThree[0] && (
                <TopThreeCard 
                  entry={topThree[0]} 
                  isYourRank={userRank.entry.username === topThree[0].username} 
                />
              )}
              {topThree[2] && (
                <TopThreeCard 
                  entry={topThree[2]} 
                  isYourRank={userRank.entry.username === topThree[2].username} 
                />
              )}
            </div>

            {/* Your Rank Highlight */}
            {userRank.entry.username !== topThree[0]?.username && 
             userRank.entry.username !== topThree[1]?.username && 
             userRank.entry.username !== topThree[2]?.username && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-400 font-bold">#{userRank.rank}</span>
                  </div>
                  <div>
                    <div className="text-white font-medium">Your Rank</div>
                    <div className="text-gray-400 text-sm">Keep completing bounties to climb!</div>
                  </div>
                </div>
                <Link 
                  href={`/profile/${userRank.entry.username}`}
                  className="px-4 py-2 bg-green-500 text-black rounded-lg font-medium hover:bg-green-400 transition-colors"
                >
                  View Profile
                </Link>
              </div>
            )}

            {/* Desktop Table */}
            <div className="hidden md:block bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contributor</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Earned</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Bounties</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reputation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {paginatedData.map(entry => (
                    <LeaderboardRow 
                      key={entry.id} 
                      entry={entry}
                      isYourRank={userRank.entry.username === entry.username}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {paginatedData.map(entry => (
                <MobileCard 
                  key={entry.id} 
                  entry={entry}
                  isYourRank={userRank.entry.username === entry.username}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
                <div className="text-sm text-gray-400">
                  Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filtered.length)} of {filtered.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 rounded-lg border border-gray-800 bg-gray-900 text-gray-400 
                             hover:bg-gray-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors text-sm"
                  >
                    Previous
                  </button>
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-4 py-2 rounded-lg text-sm transition-colors
                          ${page === pageNum 
                            ? 'bg-green-500 text-black font-medium' 
                            : 'border border-gray-800 bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white'
                          }
                        `}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 rounded-lg border border-gray-800 bg-gray-900 text-gray-400 
                             hover:bg-gray-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors text-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
