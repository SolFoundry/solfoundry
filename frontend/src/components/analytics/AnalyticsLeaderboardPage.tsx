import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MetricCard } from './MetricCard';
import { exportToCSV, exportToPDF } from '../../lib/exportUtils';

// Mock API function - replace with actual API call
async function getAnalyticsLeaderboard(params: {
  search?: string;
  timeRange?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set('search', params.search);
  if (params.timeRange) searchParams.set('time_range', params.timeRange);
  if (params.sortBy) searchParams.set('sort_by', params.sortBy);
  if (params.sortOrder) searchParams.set('sort_order', params.sortOrder);
  
  const response = await fetch(`/api/analytics/leaderboard?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch leaderboard');
  return response.json();
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  display_name: string;
  avatar_url: string;
  tier: number;
  total_earned: number;
  bounties_completed: number;
  quality_score: number;
  reputation_score: number;
  on_chain_verified: boolean;
  wallet_address: string | null;
  top_skills: string[];
  streak_days: number;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  per_page: number;
  sort_by: string;
  sort_order: string;
  filters_applied: Record<string, unknown>;
}

export function AnalyticsLeaderboardPage() {
  const [search, setSearch] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  
  const { data, isLoading, error } = useQuery<LeaderboardResponse>({
    queryKey: ['analytics-leaderboard', search, timeRange],
    queryFn: () => getAnalyticsLeaderboard({ search, timeRange }),
  });

  const timeRanges = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: 'all', label: 'All time' },
  ];

  if (isLoading) {
    return (
      <div data-testid="analytics-leaderboard-page" className="min-h-screen bg-forge-950 p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-forge-800 rounded w-64 mb-8"></div>
          <div className="h-10 bg-forge-800 rounded w-full max-w-md mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-forge-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="analytics-leaderboard-page" className="min-h-screen bg-forge-950 p-8">
        <div role="alert" className="bg-red-900/20 border border-red-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Leaderboard</h2>
          <p className="text-red-300">Failed to load leaderboard data.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Export functions
  const handleExportCSV = () => {
    if (!data) return;
    
    // Export leaderboard data
    const leaderboardData = data.entries.map(entry => ({
      Rank: entry.rank,
      Username: entry.username,
      'Display Name': entry.display_name,
      Tier: `Tier ${entry.tier}`,
      'Total Earned': entry.total_earned.toLocaleString(),
      'Bounties Completed': entry.bounties_completed,
      'Quality Score': entry.quality_score,
      'Reputation Score': entry.reputation_score,
      'On-chain Verified': entry.on_chain_verified ? 'Yes' : 'No',
      'Top Skills': entry.top_skills.join(', '),
      'Streak Days': entry.streak_days,
    }));
    
    exportToCSV({
      filename: 'contributor-leaderboard',
      data: leaderboardData,
    });
  };

  const handleExportPDF = () => {
    if (!data) return;
    
    // Export leaderboard as PDF
    const leaderboardData = data.entries.map(entry => ({
      Rank: entry.rank,
      Username: entry.username,
      Tier: `Tier ${entry.tier}`,
      'Total Earned': entry.total_earned.toLocaleString(),
      'Bounties Completed': entry.bounties_completed,
      'Quality Score': entry.quality_score,
    }));
    
    exportToPDF({
      filename: 'contributor-leaderboard-report',
      data: leaderboardData,
      title: 'Contributor Leaderboard Report',
    });
  };

  return (
    <div data-testid="analytics-leaderboard-page" className="min-h-screen bg-forge-950 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Contributor Leaderboard</h1>
        <div className="flex gap-4">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">Search contributors</label>
          <input
            type="search"
            id="search"
            placeholder="Search contributors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 bg-forge-900 border border-forge-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-forge-900 text-muted-foreground hover:bg-forge-800'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-6">
        Showing {data.entries.length} of {data.total} contributors
      </p>
      
      {/* Leaderboard */}
      <div className="space-y-4">
        {data.entries.map((entry) => (
          <div
            key={entry.username}
            className="bg-forge-900 border border-forge-800 rounded-xl p-6 flex items-center gap-6"
          >
            {/* Rank */}
            <div className="text-2xl font-bold text-emerald-400 w-12 text-center">
              #{entry.rank}
            </div>
            
            {/* Avatar */}
            <div className="relative">
              <img
                src={entry.avatar_url}
                alt={entry.display_name}
                className="w-12 h-12 rounded-full"
              />
              {entry.on_chain_verified && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-foreground">{entry.display_name}</span>
                <span className="text-sm text-muted-foreground">@{entry.username}</span>
                <span className="px-2 py-0.5 bg-emerald-900/30 text-emerald-400 text-xs rounded-full">
                  T{entry.tier}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{entry.bounties_completed} bounties</span>
                <span>{entry.total_earned.toLocaleString()} FNDRY</span>
                <span>Score: {entry.quality_score}</span>
                {entry.streak_days > 0 && (
                  <span>🔥 {entry.streak_days} day streak</span>
                )}
              </div>
              {entry.top_skills.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {entry.top_skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 bg-forge-800 text-muted-foreground text-xs rounded"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Score */}
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">{entry.quality_score}</div>
              <div className="text-xs text-muted-foreground">Quality Score</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
