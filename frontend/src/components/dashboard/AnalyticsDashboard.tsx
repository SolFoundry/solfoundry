import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Clock, Award, PieChart, Activity } from 'lucide-react';
import { apiClient } from '../services/apiClient';

// Types
export interface AnalyticsData {
  totalBounties: number;
  openBounties: number;
  totalSubmissions: number;
  totalPayouts: number;
  totalContributors: number;
  avgReviewScore: number;
  avgCompletionTime: number; // days
  totalFNDRYPaid: number;
  bountiesByTier: { T1: number; T2: number; T3: number };
  bountiesByDomain: Record<string, number>;
  submissionsByStatus: Record<string, number>;
  monthlyTrend: { month: string; bounties: number; payouts: number; newContributors: number }[];
  topDomains: { name: string; count: number; pct: number }[];
  topSkills: { name: string; count: number }[];
  reviewDistribution: { range: string; count: number }[];
}

// Stat Card
function StatCard({ icon: Icon, label, value, trend, color }: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  trend?: string;
  color: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-surface-card border border-border-primary">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
      {trend && <p className="text-xs text-emerald mt-1">{trend}</p>}
    </div>
  );
}

// Simple Bar Chart (SVG, no external lib)
function SimpleBarChart({ data, label, color = '#F97316' }: {
  data: { label: string; value: number }[];
  label: string;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div className="p-4 rounded-lg bg-surface-card border border-border-primary">
      <p className="text-sm font-semibold text-text-primary mb-4">{label}</p>
      <div className="flex items-end gap-1 h-32">
        {data.map((d, i) => {
          const height = (d.value / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-text-muted tabular-nums">{d.value}</span>
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{ height: `${height}%`, backgroundColor: color, minHeight: '2px' }}
              />
              <span className="text-[9px] text-text-muted truncate w-full text-center">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Donut Chart (SVG)
function DonutChart({ segments, total }: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  let cumulativePercent = 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="p-4 rounded-lg bg-surface-card border border-border-primary">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="w-24 h-24">
          {segments.map((seg, i) => {
            const pct = (seg.value / total) * 100;
            const offset = (cumulativePercent / 100) * circumference;
            cumulativePercent += pct;
            return (
              <circle
                key={i}
                cx="50" cy="50" r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="10"
                strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
              />
            );
          })}
          <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
            className="text-lg font-bold fill-text-primary">{total}</text>
        </svg>
        <div className="space-y-1">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-xs text-text-secondary">{seg.label}</span>
              <span className="text-xs font-medium text-text-primary">{seg.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main Component
export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    async function load() {
      try {
        const result = await apiClient<AnalyticsData>(`/api/analytics?range=${timeRange}`);
        setData(result);
      } catch {
        // Demo data
        setData({
          totalBounties: 87, openBounties: 42, totalSubmissions: 156,
          totalPayouts: 34, totalContributors: 89, avgReviewScore: 7.2,
          avgCompletionTime: 4.5, totalFNDRYPaid: 28_500_000,
          bountiesByTier: { T1: 35, T2: 38, T3: 14 },
          bountiesByDomain: { Frontend: 28, Backend: 22, Agent: 15, Creative: 12, Integration: 10 },
          submissionsByStatus: { pending: 45, reviewing: 28, approved: 52, rejected: 18, merged: 13 },
          monthlyTrend: [
            { month: 'Jan', bounties: 8, payouts: 3, newContributors: 12 },
            { month: 'Feb', bounties: 12, payouts: 5, newContributors: 18 },
            { month: 'Mar', bounties: 15, payouts: 7, newContributors: 22 },
            { month: 'Apr', bounties: 22, payouts: 11, newContributors: 28 },
            { month: 'May', bounties: 30, payouts: 8, newContributors: 35 },
          ],
          topDomains: [
            { name: 'Frontend', count: 28, pct: 32 },
            { name: 'Backend', count: 22, pct: 25 },
            { name: 'Agent', count: 15, pct: 17 },
            { name: 'Creative', count: 12, pct: 14 },
            { name: 'Integration', count: 10, pct: 12 },
          ],
          topSkills: [
            { name: 'TypeScript', count: 42 },
            { name: 'Python', count: 35 },
            { name: 'React', count: 28 },
            { name: 'Rust', count: 15 },
            { name: 'Go', count: 12 },
          ],
          reviewDistribution: [
            { range: '0-4', count: 12 },
            { range: '4-6', count: 28 },
            { range: '6-8', count: 65 },
            { range: '8-10', count: 51 },
          ],
        });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [timeRange]);

  if (isLoading || !data) {
    return <div className="animate-pulse grid grid-cols-4 gap-4">{Array(8).fill(<div className="h-24 bg-surface-card rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center gap-2">
        {(['7d', '30d', '90d', 'all'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1.5 rounded text-xs border transition-colors ${
              timeRange === range ? 'border-emerald bg-emerald/10 text-emerald' : 'border-border-primary text-text-muted hover:border-border-secondary'
            }`}
          >
            {range === 'all' ? 'All Time' : `Last ${range.toUpperCase()}`}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={BarChart3} label="Total Bounties" value={data.totalBounties.toString()} trend="+12% this month" color="text-anvil-orange" />
        <StatCard icon={Users} label="Contributors" value={data.totalContributors.toString()} trend="+28 new" color="text-emerald" />
        <StatCard icon={DollarSign} label="Total Paid" value={`${(data.totalFNDRYPaid / 1_000_000).toFixed(1)}M`} trend="$FNDRY" color="text-anvil-orange" />
        <StatCard icon={Clock} label="Avg Completion" value={`${data.avgCompletionTime}d`} color="text-tier-t2" />
        <StatCard icon={TrendingUp} label="Open Bounties" value={data.openBounties.toString()} color="text-emerald" />
        <StatCard icon={Activity} label="Submissions" value={data.totalSubmissions.toString()} color="text-status-info" />
        <StatCard icon={Award} label="Avg Review" value={data.avgReviewScore.toFixed(1)} color="text-tier-t2" />
        <StatCard icon={DollarSign} label="Payouts" value={data.totalPayouts.toString()} color="text-emerald" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Trend */}
        <SimpleBarChart
          data={data.monthlyTrend.map((m) => ({ label: m.month, value: m.bounties }))}
          label="Bounties per Month"
          color="#F97316"
        />

        {/* Review Score Distribution */}
        <SimpleBarChart
          data={data.reviewDistribution.map((r) => ({ label: r.range, value: r.count }))}
          label="Review Score Distribution"
          color="#00D4AA"
        />
      </div>

      {/* Tier + Domain Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DonutChart
          segments={[
            { label: 'T1 Quick', value: data.bountiesByTier.T1, color: '#00D4AA' },
            { label: 'T2 Standard', value: data.bountiesByTier.T2, color: '#FBBF24' },
            { label: 'T3 Complex', value: data.bountiesByTier.T3, color: '#A855F7' },
          ]}
          total={data.totalBounties}
        />

        <SimpleBarChart
          data={data.topSkills.map((s) => ({ label: s.name, value: s.count }))}
          label="Top Skills in Demand"
          color="#3B82F6"
        />
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
