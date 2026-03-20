'use client';

import React, { useState, useEffect, useMemo } from 'react';

interface LeaderboardEntry {
  id: string;
  rank: number;
  username: string;
  avatarUrl?: string;
  totalEarned: number;
  bountiesCompleted: number;
  reputationScore: number;
  categories: string[];
}

interface LeaderboardPageProps {
  data?: LeaderboardEntry[];
  currentUserId?: string;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  onFilterChange?: (filters: FilterState) => void;
  onRowClick?: (entry: LeaderboardEntry) => void;
}

interface FilterState {
  timePeriod: 'week' | 'month' | 'all';
  category: string;
  searchQuery: string;
}

const CATEGORIES = [
  'All Categories',
  'Frontend',
  'Backend',
  'Smart Contracts',
  'Documentation',
  'Design',
  'Testing',
  'Security',
];

// Mock data for demonstration
const MOCK_DATA: LeaderboardEntry[] = [
  {
    id: 'user-1',
    rank: 1,
    username: 'solmaster',
    avatarUrl: undefined,
    totalEarned: 2500000,
    bountiesCompleted: 42,
    reputationScore: 98,
    categories: ['Frontend', 'Smart Contracts'],
  },
  {
    id: 'user-2',
    rank: 2,
    username: 'crypto_dev',
    avatarUrl: undefined,
    totalEarned: 1850000,
    bountiesCompleted: 35,
    reputationScore: 94,
    categories: ['Backend', 'Security'],
  },
  {
    id: 'user-3',
    rank: 3,
    username: 'web3_builder',
    avatarUrl: undefined,
    totalEarned: 1500000,
    bountiesCompleted: 28,
    reputationScore: 91,
    categories: ['Smart Contracts', 'Frontend'],
  },
  {
    id: 'user-4',
    rank: 4,
    username: 'rustacean',
    avatarUrl: undefined,
    totalEarned: 1200000,
    bountiesCompleted: 22,
    reputationScore: 87,
    categories: ['Backend', 'Smart Contracts'],
  },
  {
    id: 'user-5',
    rank: 5,
    username: 'code_ninja',
    avatarUrl: undefined,
    totalEarned: 950000,
    bountiesCompleted: 18,
    reputationScore: 85,
    categories: ['Frontend', 'Design'],
  },
  {
    id: 'user-6',
    rank: 6,
    username: 'sol_dev_42',
    avatarUrl: undefined,
    totalEarned: 800000,
    bountiesCompleted: 15,
    reputationScore: 82,
    categories: ['Testing', 'Documentation'],
  },
  {
    id: 'user-7',
    rank: 7,
    username: 'blockchain_wizard',
    avatarUrl: undefined,
    totalEarned: 650000,
    bountiesCompleted: 12,
    reputationScore: 79,
    categories: ['Smart Contracts', 'Security'],
  },
  {
    id: 'user-8',
    rank: 8,
    username: 'frontend_hero',
    avatarUrl: undefined,
    totalEarned: 550000,
    bountiesCompleted: 10,
    reputationScore: 76,
    categories: ['Frontend', 'Design'],
  },
  {
    id: 'user-9',
    rank: 9,
    username: 'dev_ops_pro',
    avatarUrl: undefined,
    totalEarned: 450000,
    bountiesCompleted: 8,
    reputationScore: 73,
    categories: ['Backend', 'Testing'],
  },
  {
    id: 'user-10',
    rank: 10,
    username: 'newcomer',
    avatarUrl: undefined,
    totalEarned: 300000,
    bountiesCompleted: 5,
    reputationScore: 70,
    categories: ['Documentation', 'Testing'],
  },
];

// Loading Skeleton Component
const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-4 p-4 animate-pulse">
    <div className="w-8 h-6 bg-gray-700 rounded" />
    <div className="w-10 h-10 bg-gray-700 rounded-full" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-700 rounded w-1/3" />
      <div className="h-3 bg-gray-700 rounded w-1/4" />
    </div>
    <div className="w-24 h-4 bg-gray-700 rounded" />
    <div className="w-16 h-4 bg-gray-700 rounded hidden sm:block" />
    <div className="w-12 h-4 bg-gray-700 rounded hidden sm:block" />
  </div>
);

// Empty State Component
const EmptyState: React.FC<{ onReset: () => void }> = ({ onReset }) => (
  <div className="text-center py-16 px-4">
    <div className="text-6xl mb-4">🏆</div>
    <h3 className="text-xl font-semibold text-gray-300 mb-2">No contributors found</h3>
    <p className="text-gray-500 mb-6">
      No contributors match your current filters.
      <br />
      Try adjusting your search criteria.
    </p>
    <button
      onClick={onReset}
      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors min-h-[44px]"
    >
      Reset Filters
    </button>
  </div>
);

// Top 3 Card Component
const TopThreeCard: React.FC<{
  entry: LeaderboardEntry;
  medal: string;
  isCurrentUser: boolean;
  onClick: () => void;
}> = ({ entry, medal, isCurrentUser, onClick }) => {
  const bgColors = {
    '🥇': 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    '🥈': 'bg-gradient-to-br from-gray-400/20 to-gray-500/10 border-gray-400/30',
    '🥉': 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30',
  };

  return (
    <div
      onClick={onClick}
      className={`
        ${bgColors[medal as keyof typeof bgColors]}
        border rounded-lg p-4 sm:p-6 cursor-pointer transition-transform hover:scale-[1.02] min-h-[44px]
        ${isCurrentUser ? 'ring-2 ring-purple-500' : ''}
      `}
    >
      <div className="text-center">
        <div className="text-4xl mb-3">{medal}</div>
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-500 flex items-center justify-center mx-auto mb-3">
          {entry.avatarUrl ? (
            <img src={entry.avatarUrl} alt={entry.username} className="w-full h-full rounded-full" />
          ) : (
            <span className="text-2xl sm:text-3xl font-bold text-white">
              {entry.username.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <h3 className="font-semibold text-white text-lg truncate">
          {entry.username}
          {isCurrentUser && (
            <span className="ml-2 text-xs px-2 py-1 bg-purple-500/30 rounded-full text-purple-300">
              You
            </span>
          )}
        </h3>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Earned</span>
            <span className="text-green-400 font-bold">{entry.totalEarned.toLocaleString()} FNDRY</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Bounties</span>
            <span className="text-purple-400 font-bold">{entry.bountiesCompleted}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Reputation</span>
            <span className="text-yellow-400 font-bold">{entry.reputationScore}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1">
          {entry.categories.slice(0, 2).map((cat) => (
            <span
              key={cat}
              className="px-2 py-0.5 text-xs bg-gray-700/50 text-gray-300 rounded"
            >
              {cat}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// Mobile Card Component
const MobileCard: React.FC<{
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  onClick: () => void;
}> = ({ entry, isCurrentUser, onClick }) => (
  <div
    onClick={onClick}
    className={`
      bg-gray-800 rounded-lg p-4 cursor-pointer transition-colors hover:bg-gray-700
      ${isCurrentUser ? 'ring-2 ring-purple-500' : ''}
    `}
  >
    <div className="flex items-center gap-3">
      <span className="text-lg font-bold text-gray-400 w-8">#{entry.rank}</span>
      <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
        {entry.avatarUrl ? (
          <img src={entry.avatarUrl} alt={entry.username} className="w-full h-full rounded-full" />
        ) : (
          <span className="text-lg font-bold text-white">{entry.username.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white truncate">{entry.username}</span>
          {isCurrentUser && (
            <span className="text-xs px-2 py-0.5 bg-purple-500/30 rounded-full text-purple-300">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm">
          <span className="text-green-400">{entry.totalEarned.toLocaleString()} FNDRY</span>
          <span className="text-gray-500">•</span>
          <span className="text-purple-400">{entry.bountiesCompleted} bounties</span>
        </div>
      </div>
      <div className="text-right">
        <span className="text-yellow-400 font-bold">{entry.reputationScore}</span>
        <p className="text-xs text-gray-500">reputation</p>
      </div>
    </div>
  </div>
);

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  data = MOCK_DATA,
  currentUserId,
  isLoading = false,
  onPageChange,
  onFilterChange,
  onRowClick,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    timePeriod: 'all',
    category: 'All Categories',
    searchQuery: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  const itemsPerPage = 10;

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter((entry) => {
      // Search filter
      if (
        filters.searchQuery &&
        !entry.username.toLowerCase().includes(filters.searchQuery.toLowerCase())
      ) {
        return false;
      }
      // Category filter
      if (
        filters.category !== 'All Categories' &&
        !entry.categories.includes(filters.category)
      ) {
        return false;
      }
      return true;
    });
  }, [data, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  // Top 3 entries
  const topThree = useMemo(() => filteredData.slice(0, 3), [filteredData]);

  // Current user's rank (if logged in)
  const currentUserRank = useMemo(() => {
    if (!currentUserId) return null;
    const entry = data.find((e) => e.id === currentUserId);
    return entry ? entry.rank : null;
  }, [data, currentUserId]);

  // Handlers
  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    setCurrentPage(1); // Reset to first page on filter change
    onFilterChange?.(updated);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    onPageChange?.(page);
  };

  const handleRowClick = (entry: LeaderboardEntry) => {
    onRowClick?.(entry);
  };

  const handleResetFilters = () => {
    handleFilterChange({
      timePeriod: 'all',
      category: 'All Categories',
      searchQuery: '',
    });
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 space-y-4">
            <div className="h-10 bg-gray-800 rounded w-1/3 animate-pulse" />
            <div className="flex gap-4 flex-wrap">
              <div className="h-10 w-32 bg-gray-800 rounded animate-pulse" />
              <div className="h-10 w-40 bg-gray-800 rounded animate-pulse" />
              <div className="h-10 w-48 bg-gray-800 rounded animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Leaderboard</h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Top contributors ranked by FNDRY earnings
          </p>
          {currentUserRank && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg">
              <span className="text-purple-300">Your Rank:</span>
              <span className="text-white font-bold">#{currentUserRank}</span>
            </div>
          )}
        </div>

        {/* Top 3 Cards */}
        {topThree.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {topThree.map((entry, index) => (
              <TopThreeCard
                key={entry.id}
                entry={entry}
                medal={['🥇', '🥈', '🥉'][index]}
                isCurrentUser={entry.id === currentUserId}
                onClick={() => handleRowClick(entry)}
              />
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Time Period */}
            <div className="flex-1 sm:flex-initial">
              <label className="block text-sm text-gray-400 mb-1">Time Period</label>
              <select
                value={filters.timePeriod}
                onChange={(e) =>
                  handleFilterChange({ timePeriod: e.target.value as FilterState['timePeriod'] })
                }
                className="w-full sm:w-auto bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white min-h-[44px] focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Category */}
            <div className="flex-1 sm:flex-initial">
              <label className="block text-sm text-gray-400 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange({ category: e.target.value })}
                className="w-full sm:w-auto bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white min-h-[44px] focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="flex-1 sm:flex-initial sm:min-w-[200px]">
              <label className="block text-sm text-gray-400 mb-1">Search Username</label>
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange({ searchQuery: e.target.value })}
                placeholder="Search users..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredData.length === 0 ? (
          <EmptyState onReset={handleResetFilters} />
        ) : (
          <>
            {/* Table (Desktop) / Cards (Mobile) */}
            {isMobile ? (
              <div className="space-y-3">
                {paginatedData.map((entry) => (
                  <MobileCard
                    key={entry.id}
                    entry={entry}
                    isCurrentUser={entry.id === currentUserId}
                    onClick={() => handleRowClick(entry)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="px-4 py-3 text-gray-400 font-medium text-sm">Rank</th>
                      <th className="px-4 py-3 text-gray-400 font-medium text-sm">User</th>
                      <th className="px-4 py-3 text-gray-400 font-medium text-sm">Total Earned</th>
                      <th className="px-4 py-3 text-gray-400 font-medium text-sm">Bounties</th>
                      <th className="px-4 py-3 text-gray-400 font-medium text-sm">Reputation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((entry) => (
                      <tr
                        key={entry.id}
                        onClick={() => handleRowClick(entry)}
                        className={`
                          border-b border-gray-800 cursor-pointer transition-colors hover:bg-gray-800
                          ${entry.id === currentUserId ? 'bg-purple-500/10' : ''}
                        `}
                      >
                        <td className="px-4 py-4">
                          <span className="font-bold text-gray-300">#{entry.rank}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                              {entry.avatarUrl ? (
                                <img
                                  src={entry.avatarUrl}
                                  alt={entry.username}
                                  className="w-full h-full rounded-full"
                                />
                              ) : (
                                <span className="font-bold text-white">
                                  {entry.username.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{entry.username}</span>
                              {entry.id === currentUserId && (
                                <span className="text-xs px-2 py-0.5 bg-purple-500/30 rounded-full text-purple-300">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-green-400 font-medium">
                            {entry.totalEarned.toLocaleString()} FNDRY
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-purple-400 font-medium">
                            {entry.bountiesCompleted}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-yellow-400 font-medium">{entry.reputationScore}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors min-h-[44px]"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`
                          w-10 h-10 rounded-lg transition-colors min-h-[44px]
                          ${
                            currentPage === pageNum
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }
                        `}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors min-h-[44px]"
                >
                  Next
                </button>
              </div>
            )}

            {/* Results count */}
            <div className="text-center text-gray-500 text-sm mt-4">
              Showing {(currentPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}{' '}
              contributors
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;