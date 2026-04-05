import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { MetricCard } from './MetricCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompletionRecord {
  bounty_id: string;
  bounty_title: string;
  tier: number;
  category: string;
  reward_amount: number;
  review_score: number;
  completed_at: string;
  time_to_complete_hours: number;
  on_chain_tx_hash: string | null;
}

interface TierProgression {
  tier: number;
  achieved_at: string | null;
  qualifying_bounties: number;
  average_score_at_achievement: number;
}

interface ScoreTrendPoint {
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
  wallet_address: string | null;
  tier: number;
  total_earned: number;
  bounties_completed: number;
  quality_score: number;
  reputation_score: number;
  on_chain_verified: boolean;
  top_skills: string[];
  badges: string[];
  completion_history: CompletionRecord[];
  tier_progression: TierProgression[];
  review_score_trend: ScoreTrendPoint[];
  joined_at: string;
  last_active_at: string;
  streak_days: number;
  completions_by_tier: Record<string, number>;
  completions_by_category: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function exportCSV(profile: ContributorProfile) {
  const rows = profile.completion_history.map((c) =>
    `${c.bounty_title},Tier ${c.tier},${c.category},${c.reward_amount},${c.review_score},${c.completed_at}`,
  );
  const csv = ['Bounty,Tier,Category,Reward,Score,Completed At', ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${profile.username}-history.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchContributorProfile(username: string): Promise<ContributorProfile> {
  const res = await fetch(`/api/analytics/contributors/${username}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Contributor not found');
  }
  return res.json();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContributorAnalyticsPage() {
  const { username } = useParams<{ username: string }>();

  const { data, isLoading, error } = useQuery<ContributorProfile, Error>({
    queryKey: ['contributor-profile', username],
    queryFn: () => fetchContributorProfile(username!),
    enabled: !!username,
    staleTime: 30_000,
  });

  if (error) {
    return (
      <div
        data-testid="contributor-analytics-page"
        role="alert"
        className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm"
      >
        {error.message}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div data-testid="contributor-analytics-page" className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-white/5 rounded-xl h-24" />
        ))}
      </div>
    );
  }

  return (
    <div data-testid="contributor-analytics-page" className="space-y-6">
      {/* Profile header */}
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <img
            src={data.avatar_url}
            alt={data.display_name}
            className="w-20 h-20 rounded-full border-2 border-white/10"
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">{data.display_name}</h1>
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                Tier {data.tier}
              </span>
              {data.on_chain_verified && (
                <span className="text-xs bg-[#14F195]/20 text-[#14F195] px-2 py-0.5 rounded-full">
                  On-chain Verified
                </span>
              )}
            </div>
            <p className="text-white/50 text-sm mb-2">@{data.username}</p>
            {data.bio && <p className="text-white/60 text-sm">{data.bio}</p>}

            {/* Skills */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {data.top_skills.map((skill) => (
                <span key={skill} className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => exportCSV(data)}
              className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white/60 rounded-lg hover:bg-white/10"
            >
              Export CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white/60 rounded-lg hover:bg-white/10"
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          testId="metric-total-earned"
          label="Total Earned"
          value={data.total_earned}
          icon="💰"
        />
        <MetricCard
          testId="metric-bounties-done"
          label="Bounties Completed"
          value={data.bounties_completed}
          icon="✅"
        />
        <MetricCard
          testId="metric-quality-score"
          label="Quality Score"
          value={data.quality_score.toFixed(1)}
          icon="⭐"
        />
        <MetricCard
          label="Streak"
          value={`${data.streak_days}d`}
          icon="🔥"
        />
      </div>

      {/* Review score trend chart */}
      {data.review_score_trend.length > 0 && (
        <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Review Score Trend</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.review_score_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
              <Line type="monotone" dataKey="score" stroke="#14F195" strokeWidth={2} dot={{ fill: '#14F195', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Badges */}
      {data.badges.length > 0 && (
        <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-3">Badges</h2>
          <div className="flex flex-wrap gap-2">
            {data.badges.map((badge) => (
              <span
                key={badge}
                className="text-xs bg-[#9945FF]/20 text-purple-300 px-3 py-1 rounded-full border border-purple-500/20"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Completion history */}
      {data.completion_history.length > 0 && (
        <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5 overflow-x-auto">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Completion History</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/40 text-xs">
                <th className="text-left pb-3 pr-4">Bounty</th>
                <th className="text-left pb-3 pr-4">Tier</th>
                <th className="text-left pb-3 pr-4">Category</th>
                <th className="text-right pb-3 pr-4">Reward</th>
                <th className="text-right pb-3 pr-4">Score</th>
                <th className="text-right pb-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {data.completion_history.map((c) => (
                <tr key={c.bounty_id} className="border-b border-white/5">
                  <td className="py-3 pr-4 text-white font-medium">{c.bounty_title}</td>
                  <td className="py-3 pr-4 text-white/60">Tier {c.tier}</td>
                  <td className="py-3 pr-4 text-white/60 capitalize">{c.category}</td>
                  <td className="py-3 pr-4 text-right text-[#14F195]">{c.reward_amount.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right text-white">{c.review_score}</td>
                  <td className="py-3 text-right text-white/40">{fmtDate(c.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
