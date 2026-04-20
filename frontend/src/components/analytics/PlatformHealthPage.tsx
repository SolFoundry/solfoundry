import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MetricCard } from './MetricCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { exportToCSV, exportToPDF } from '../../lib/exportUtils';

// Mock API function - replace with actual API call
async function getPlatformHealth() {
  const response = await fetch('/api/analytics/platform-health');
  if (!response.ok) throw new Error('Failed to fetch platform health');
  return response.json();
}

interface GrowthTrend {
  date: string;
  bounties_created: number;
  bounties_completed: number;
  new_contributors: number;
  fndry_paid: number;
}

interface CategoryStats {
  category: string;
  total_bounties: number;
  completed: number;
  completion_rate: number;
  average_review_score: number;
  total_reward_paid: number;
}

interface PlatformHealth {
  total_contributors: number;
  active_contributors: number;
  total_bounties: number;
  open_bounties: number;
  in_progress_bounties: number;
  completed_bounties: number;
  total_fndry_paid: number;
  total_prs_reviewed: number;
  average_review_score: number;
  bounties_by_status: Record<string, number>;
  growth_trend: GrowthTrend[];
  top_categories: CategoryStats[];
}

export function PlatformHealthPage() {
  const { data, isLoading, error } = useQuery<PlatformHealth>({
    queryKey: ['platform-health'],
    queryFn: getPlatformHealth,
  });

  if (isLoading) {
    return (
      <div data-testid="platform-health-page" className="min-h-screen bg-forge-950 p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-forge-800 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-forge-800 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-forge-800 rounded-xl mb-8"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="platform-health-page" className="min-h-screen bg-forge-950 p-8">
        <div role="alert" className="bg-red-900/20 border border-red-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Platform Health</h2>
          <p className="text-red-300">Failed to load platform health data.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Export functions
  const handleExportCSV = () => {
    if (!data) return;
    
    // Export growth trend data
    const growthData = data.growth_trend.map(item => ({
      Date: item.date,
      'Bounties Created': item.bounties_created,
      'Bounties Completed': item.bounties_completed,
      'New Contributors': item.new_contributors,
      'FNDRY Paid': item.fndry_paid.toLocaleString(),
    }));
    
    exportToCSV({
      filename: 'platform-growth-trend',
      data: growthData,
    });
    
    // Export top categories
    const categoryData = data.top_categories.map(category => ({
      Category: category.category,
      'Total Bounties': category.total_bounties,
      'Completed': category.completed,
      'Completion Rate': `${category.completion_rate.toFixed(1)}%`,
      'Average Review Score': category.average_review_score.toFixed(1),
      'Total Reward Paid': category.total_reward_paid.toLocaleString(),
    }));
    
    exportToCSV({
      filename: 'platform-top-categories',
      data: categoryData,
    });
  };

  const handleExportPDF = () => {
    if (!data) return;
    
    // Export summary as PDF
    const summaryData = [
      { Metric: 'Total Contributors', Value: data.total_contributors },
      { Metric: 'Active Contributors', Value: data.active_contributors },
      { Metric: 'Total Bounties', Value: data.total_bounties },
      { Metric: 'Open Bounties', Value: data.open_bounties },
      { Metric: 'In Progress Bounties', Value: data.in_progress_bounties },
      { Metric: 'Completed Bounties', Value: data.completed_bounties },
      { Metric: 'Total FNDRY Paid', Value: data.total_fndry_paid.toLocaleString() },
      { Metric: 'Total PRs Reviewed', Value: data.total_prs_reviewed },
      { Metric: 'Average Review Score', Value: data.average_review_score.toFixed(1) },
    ];
    
    exportToPDF({
      filename: 'platform-health-report',
      data: summaryData,
      title: 'Platform Health Report',
    });
  };

  // Format growth trend data for charts
  const chartData = data.growth_trend.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div data-testid="platform-health-page" className="min-h-screen bg-forge-950 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Platform Health</h1>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard
          label="Total Contributors"
          value={data.total_contributors}
          testId="metric-total-contributors"
        />
        <MetricCard
          label="Active Contributors"
          value={data.active_contributors}
          testId="metric-active-contributors"
        />
        <MetricCard
          label="Total Bounties"
          value={data.total_bounties}
          testId="metric-total-bounties"
        />
        <MetricCard
          label="Total FNDRY Paid"
          value={data.total_fndry_paid.toLocaleString()}
          testId="metric-total-fndry-paid"
        />
      </div>

      {/* Bounty Status Distribution */}
      <div className="bg-forge-900 border border-forge-800 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-4">Bounty Status Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-emerald-400">{data.open_bounties}</div>
            <div className="text-sm text-muted-foreground">Open</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-yellow-400">{data.in_progress_bounties}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-400">{data.completed_bounties}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
        </div>
      </div>

      {/* Growth Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Bounties Created vs Completed */}
        <div className="bg-forge-900 border border-forge-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Bounty Activity</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="bounties_created"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Created"
                />
                <Line
                  type="monotone"
                  dataKey="bounties_completed"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Completed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FNDRY Paid */}
        <div className="bg-forge-900 border border-forge-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">FNDRY Paid</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                />
                <Bar dataKey="fndry_paid" fill="#10B981" name="FNDRY Paid" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Categories */}
      <div className="bg-forge-900 border border-forge-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Top Categories</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
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
              {data.top_categories.map((category) => (
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
