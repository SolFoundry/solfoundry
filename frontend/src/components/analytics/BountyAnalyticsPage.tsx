import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MetricCard } from './MetricCard';
import { exportToCSV, exportToPDF } from '../../lib/exportUtils';

// Mock API function - replace with actual API call
async function getBountyAnalytics() {
  // This would be replaced with actual API call
  const response = await fetch('/api/analytics/bounties');
  if (!response.ok) throw new Error('Failed to fetch bounty analytics');
  return response.json();
}

interface TierStats {
  tier: number;
  total_bounties: number;
  completed: number;
  in_progress: number;
  open: number;
  completion_rate: number;
  average_review_score: number;
  average_time_to_complete_hours: number;
  total_reward_paid: number;
}

interface CategoryStats {
  category: string;
  total_bounties: number;
  completed: number;
  completion_rate: number;
  average_review_score: number;
  total_reward_paid: number;
}

interface BountyAnalytics {
  by_tier: TierStats[];
  by_category: CategoryStats[];
  overall_completion_rate: number;
  overall_average_review_score: number;
  total_bounties: number;
  total_completed: number;
  total_reward_paid: number;
}

export function BountyAnalyticsPage() {
  const { data, isLoading, error } = useQuery<BountyAnalytics>({
    queryKey: ['bounty-analytics'],
    queryFn: getBountyAnalytics,
  });

  if (isLoading) {
    return (
      <div data-testid="bounty-analytics-page" className="min-h-screen bg-forge-950 p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-forge-800 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-forge-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="bounty-analytics-page" className="min-h-screen bg-forge-950 p-8">
        <div role="alert" className="bg-red-900/20 border border-red-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Analytics</h2>
          <p className="text-red-300">Failed to load bounty analytics data.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Export functions
  const handleExportCSV = () => {
    if (!data) return;
    
    // Export tier statistics
    const tierData = data.by_tier.map(tier => ({
      Tier: `Tier ${tier.tier}`,
      'Total Bounties': tier.total_bounties,
      'Completed': tier.completed,
      'In Progress': tier.in_progress,
      'Open': tier.open,
      'Completion Rate': `${tier.completion_rate.toFixed(1)}%`,
      'Average Review Score': tier.average_review_score.toFixed(1),
      'Average Time (hours)': tier.average_time_to_complete_hours,
      'Total Reward Paid': tier.total_reward_paid.toLocaleString(),
    }));
    
    exportToCSV({
      filename: 'bounty-analytics-tiers',
      data: tierData,
    });
    
    // Export category statistics
    const categoryData = data.by_category.map(category => ({
      Category: category.category,
      'Total Bounties': category.total_bounties,
      'Completed': category.completed,
      'Completion Rate': `${category.completion_rate.toFixed(1)}%`,
      'Average Review Score': category.average_review_score.toFixed(1),
      'Total Reward Paid': category.total_reward_paid.toLocaleString(),
    }));
    
    exportToCSV({
      filename: 'bounty-analytics-categories',
      data: categoryData,
    });
  };

  const handleExportPDF = () => {
    if (!data) return;
    
    // Export tier statistics as PDF
    const tierData = data.by_tier.map(tier => ({
      Tier: `Tier ${tier.tier}`,
      'Total Bounties': tier.total_bounties,
      'Completed': tier.completed,
      'In Progress': tier.in_progress,
      'Open': tier.open,
      'Completion Rate': `${tier.completion_rate.toFixed(1)}%`,
      'Average Review Score': tier.average_review_score.toFixed(1),
      'Average Time (hours)': tier.average_time_to_complete_hours,
      'Total Reward Paid': tier.total_reward_paid.toLocaleString(),
    }));
    
    exportToPDF({
      filename: 'bounty-analytics-report',
      data: tierData,
      title: 'Bounty Analytics Report',
    });
  };

  return (
    <div data-testid="bounty-analytics-page" className="min-h-screen bg-forge-950 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Bounty Analytics</h1>
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
      
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          label="Total Bounties"
          value={data.total_bounties}
          testId="metric-total-bounties"
        />
        <MetricCard
          label="Completed"
          value={data.total_completed}
          testId="metric-completed"
        />
        <MetricCard
          label="Completion Rate"
          value={`${data.overall_completion_rate.toFixed(1)}%`}
          testId="metric-completion-rate"
        />
      </div>

      {/* Tier Statistics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4">Tier Statistics</h2>
        <div className="bg-forge-900 border border-forge-800 rounded-xl overflow-hidden">
          <table aria-label="Tier statistics" className="w-full">
            <thead className="bg-forge-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">In Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Open</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Completion Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Time (hrs)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forge-800">
              {data.by_tier.map((tier) => (
                <tr key={tier.tier} className="hover:bg-forge-800/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">Tier {tier.tier}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{tier.total_bounties}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{tier.completed}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{tier.in_progress}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{tier.open}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{tier.completion_rate.toFixed(1)}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{tier.average_review_score.toFixed(1)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{tier.average_time_to_complete_hours}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{tier.total_reward_paid.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Statistics */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Category Statistics</h2>
        <div className="bg-forge-900 border border-forge-800 rounded-xl overflow-hidden">
          <table aria-label="Category statistics" className="w-full">
            <thead className="bg-forge-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Completion Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forge-800">
              {data.by_category.map((category) => (
                <tr key={category.category} className="hover:bg-forge-800/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground capitalize">{category.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{category.total_bounties}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{category.completed}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{category.completion_rate.toFixed(1)}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{category.average_review_score.toFixed(1)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{category.total_reward_paid.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
