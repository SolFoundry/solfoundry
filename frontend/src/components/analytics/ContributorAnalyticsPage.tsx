import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MetricCard } from './MetricCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock API function - replace with actual API call
async function getContributorProfile(username: string) {
  const response = await fetch(`/api/analytics/contributors/${username}`);
  if (!response.ok) throw new Error('Failed to fetch contributor profile');
  return response.json();
}

interface CompletionHistory {
  bounty_id: string;
  bounty_title: string;
  tier: number;
  category: string;
  reward_amount: number;
  review_score: number;
  completed_at: string;
  time_to_complete_hours: number;
  on_chain_tx_hash: string;
}

interface TierProgression {
  tier: number;
  achieved_at: string | null;
  qualifying_bounties: number;
  average_score_at_achievement: number;
}

interface ReviewScoreTrend {
  date: string;
  score: number;
  bounty_title: string;
  bounty_tier: number;
}

interface ContributorProfile {
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  wallet_address: string;
  tier: number;
  total_earned: number;
  bounties_completed: number;
  quality_score: number;
  reputation_score: number;
  on_chain_verified: boolean;
  top_skills: string[];
  badges: string[];
  completion_history: CompletionHistory[];
  tier_progression: TierProgression[];
  review_score_trend: ReviewScoreTrend[];
  joined_at: string;
  last_active_at: string;
  streak_days: number;
  completions_by_tier: Record<string, number>;
  completions_by_category: Record<string, number>;
}

export function ContributorAnalyticsPage() {
  const { username } = useParams<{ username: string }>();
  
  const { data, isLoading, error } = useQuery<ContributorProfile>({
    queryKey: ['contributor-profile', username],
    queryFn: () => getContributorProfile(username!),
    enabled: !!username,
  });

  if (isLoading) {
    return (
      <div data-testid="contributor-analytics-page" className="min-h-screen bg-forge-950 p-8">
        <div className="animate-pulse">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 bg-forge-800 rounded-full"></div>
            <div>
              <div className="h-8 bg-forge-800 rounded w-48 mb-2"></div>
              <div className="h-4 bg-forge-800 rounded w-32"></div>
            </div>
          </div>
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
      <div data-testid="contributor-analytics-page" className="min-h-screen bg-forge-950 p-8">
        <div role="alert" className="bg-red-900/20 border border-red-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Profile</h2>
          <p className="text-red-300">Failed to load contributor profile.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Format review score trend for chart
  const scoreTrendData = data.review_score_trend.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div data-testid="contributor-analytics-page" className="min-h-screen bg-forge-950 p-8">
      {/* Header */}
      <div className="flex items-center gap-6 mb-8">
        <div className="relative">
          <img
            src={data.avatar_url}
            alt={data.display_name}
            className="w-24 h-24 rounded-full"
          />
          {data.on_chain_verified && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">✓</span>
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-foreground">{data.display_name}</h1>
            <span className="px-3 py-1 bg-emerald-900/30 text-emerald-400 text-sm rounded-full">
              Tier {data.tier}
            </span>
            {data.on_chain_verified && (
              <span className="px-3 py-1 bg-blue-900/30 text-blue-400 text-sm rounded-full">
                On-chain Verified
              </span>
            )}
          </div>
          <p className="text-muted-foreground">@{data.username}</p>
          {data.bio && <p className="text-muted-foreground mt-2">{data.bio}</p>}
        </div>
      </div>

      {/* Skills */}
      {data.top_skills.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {data.top_skills.map((skill) => (
              <span
                key={skill}
                className="px-3 py-1 bg-forge-900 border border-forge-800 text-muted-foreground rounded-full text-sm"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      {data.badges.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">Badges</h2>
          <div className="flex flex-wrap gap-2">
            {data.badges.map((badge) => (
              <span
                key={badge}
                className="px-3 py-1 bg-yellow-900/30 text-yellow-400 rounded-full text-sm"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          label="Total Earned"
          value={data.total_earned.toLocaleString()}
          testId="metric-total-earned"
        />
        <MetricCard
          label="Bounties Completed"
          value={data.bounties_completed}
          testId="metric-bounties-done"
        />
        <MetricCard
          label="Quality Score"
          value={data.quality_score.toFixed(1)}
          testId="metric-quality-score"
        />
      </div>

      {/* Review Score Trend */}
      {scoreTrendData.length > 0 && (
        <div className="bg-forge-900 border border-forge-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Review Score Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" domain={[0, 10]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem',
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value} - ${props.payload.bounty_title}`,
                    'Score',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Completion History */}
      <div className="bg-forge-900 border border-forge-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Completion History</h2>
        {data.completion_history.length === 0 ? (
          <p className="text-muted-foreground">No completed bounties yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-forge-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Bounty</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Reward</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forge-800">
                {data.completion_history.map((item) => (
                  <tr key={item.bounty_id} className="hover:bg-forge-800/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{item.bounty_title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">Tier {item.tier}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground capitalize">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{item.reward_amount.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{item.review_score.toFixed(1)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{item.time_to_complete_hours}h</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(item.completed_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
