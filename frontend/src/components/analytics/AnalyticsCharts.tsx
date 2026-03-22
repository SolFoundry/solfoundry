/**
 * AnalyticsCharts - Recharts-based chart components for analytics pages.
 *
 * Provides reusable chart components:
 * - GrowthTrendChart: Line chart for platform growth over time
 * - TierCompletionChart: Bar chart for bounty completions by tier
 * - CategoryBreakdownChart: Bar chart for completions by category
 * - ReviewScoreTrendChart: Line chart for individual review score trends
 * - ActivityHeatmap: Grid heatmap for contributor activity patterns
 *
 * All charts are responsive, theme-aware (dark background), and
 * include proper ARIA labels for accessibility.
 * @module components/analytics/AnalyticsCharts
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type {
  GrowthDataPoint,
  TierCompletionStats,
  CategoryCompletionStats,
  ReviewScoreDataPoint,
} from '../../types/analytics';

// ---------------------------------------------------------------------------
// Theme constants
// ---------------------------------------------------------------------------

const COLORS = {
  purple: '#9945FF',
  green: '#14F195',
  blue: '#00D2FF',
  orange: '#FF6B35',
  red: '#FF4444',
  gray: '#6B7280',
  gridLine: '#1F2937',
  tooltipBackground: '#1A1A2E',
  tooltipBorder: '#374151',
};

const TIER_COLORS: Record<number, string> = {
  1: COLORS.green,
  2: COLORS.purple,
  3: COLORS.orange,
};

// ---------------------------------------------------------------------------
// Growth Trend Chart
// ---------------------------------------------------------------------------

export interface GrowthTrendChartProps {
  /** Array of daily growth data points */
  data: GrowthDataPoint[];
  /** Chart height in pixels */
  height?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Line chart showing platform growth trends over time.
 *
 * Displays bounties created, bounties completed, and new contributors
 * as separate colored lines on a shared time axis.
 */
export function GrowthTrendChart({
  data,
  height = 300,
  className = '',
}: GrowthTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[${height}px] text-gray-500 ${className}`}>
        No growth data available
      </div>
    );
  }

  return (
    <div
      className={className}
      role="img"
      aria-label="Platform growth trend chart showing bounties created, completed, and new contributors over time"
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={(value: string) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: COLORS.tooltipBackground,
              border: `1px solid ${COLORS.tooltipBorder}`,
              borderRadius: '8px',
              color: '#E5E7EB',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }} />
          <Line
            type="monotone"
            dataKey="bountiesCreated"
            stroke={COLORS.purple}
            strokeWidth={2}
            dot={false}
            name="Created"
          />
          <Line
            type="monotone"
            dataKey="bountiesCompleted"
            stroke={COLORS.green}
            strokeWidth={2}
            dot={false}
            name="Completed"
          />
          <Line
            type="monotone"
            dataKey="newContributors"
            stroke={COLORS.blue}
            strokeWidth={2}
            dot={false}
            name="New Contributors"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier Completion Chart
// ---------------------------------------------------------------------------

export interface TierCompletionChartProps {
  /** Array of tier completion stats */
  data: TierCompletionStats[];
  /** Chart height in pixels */
  height?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Bar chart showing bounty completion statistics per tier.
 *
 * Displays completed, in-progress, and open bounty counts as
 * stacked bars for each tier (T1, T2, T3).
 */
export function TierCompletionChart({
  data,
  height = 300,
  className = '',
}: TierCompletionChartProps) {
  const chartData = data.map((tier) => ({
    name: `Tier ${tier.tier}`,
    Completed: tier.completed,
    'In Progress': tier.inProgress,
    Open: tier.open,
    tier: tier.tier,
  }));

  return (
    <div
      className={className}
      role="img"
      aria-label="Bounty completion statistics by tier bar chart"
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} />
          <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: COLORS.tooltipBackground,
              border: `1px solid ${COLORS.tooltipBorder}`,
              borderRadius: '8px',
              color: '#E5E7EB',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }} />
          <Bar dataKey="Completed" fill={COLORS.green} radius={[4, 4, 0, 0]} />
          <Bar dataKey="In Progress" fill={COLORS.purple} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Open" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Breakdown Chart
// ---------------------------------------------------------------------------

export interface CategoryBreakdownChartProps {
  /** Array of category completion stats */
  data: CategoryCompletionStats[];
  /** Chart height in pixels */
  height?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Horizontal bar chart showing bounty completions by category.
 *
 * Displays total bounties and completed count for each category
 * (backend, frontend, security, etc.).
 */
export function CategoryBreakdownChart({
  data,
  height = 300,
  className = '',
}: CategoryBreakdownChartProps) {
  const chartData = data.map((cat) => ({
    name: cat.category.charAt(0).toUpperCase() + cat.category.slice(1),
    Total: cat.totalBounties,
    Completed: cat.completed,
  }));

  return (
    <div
      className={className}
      role="img"
      aria-label="Bounty completion statistics by category bar chart"
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} />
          <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: COLORS.tooltipBackground,
              border: `1px solid ${COLORS.tooltipBorder}`,
              borderRadius: '8px',
              color: '#E5E7EB',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px', color: '#9CA3AF' }} />
          <Bar dataKey="Total" fill={COLORS.gray} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Completed" fill={COLORS.green} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review Score Trend Chart
// ---------------------------------------------------------------------------

export interface ReviewScoreTrendChartProps {
  /** Array of review score data points */
  data: ReviewScoreDataPoint[];
  /** Chart height in pixels */
  height?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Line chart showing a contributor's review score trend over time.
 *
 * Plots review scores on the Y-axis (0-10) against submission dates
 * with a reference line at the passing threshold (7.0).
 */
export function ReviewScoreTrendChart({
  data,
  height = 250,
  className = '',
}: ReviewScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[${height}px] text-gray-500 ${className}`}>
        No review score data available
      </div>
    );
  }

  return (
    <div
      className={className}
      role="img"
      aria-label="Review score trend chart showing scores over time"
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={(value: string) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            ticks={[0, 2, 4, 6, 8, 10]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: COLORS.tooltipBackground,
              border: `1px solid ${COLORS.tooltipBorder}`,
              borderRadius: '8px',
              color: '#E5E7EB',
              fontSize: '12px',
            }}
            formatter={(value: number) => [value.toFixed(1), 'Score']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke={COLORS.purple}
            strokeWidth={2}
            dot={{ fill: COLORS.purple, r: 4 }}
            activeDot={{ r: 6 }}
            name="Review Score"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Heatmap
// ---------------------------------------------------------------------------

export interface ActivityHeatmapProps {
  /** Map of date strings to activity counts */
  activityData: Record<string, number>;
  /** Number of weeks to display */
  weeks?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Grid-based heatmap showing contributor activity patterns.
 *
 * Renders a GitHub-style contribution heatmap with color intensity
 * proportional to activity count per day.
 */
export function ActivityHeatmap({
  activityData,
  weeks = 12,
  className = '',
}: ActivityHeatmapProps) {
  const today = new Date();
  const cells: { date: string; count: number; dayOfWeek: number }[] = [];

  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    cells.push({
      date: dateStr,
      count: activityData[dateStr] || 0,
      dayOfWeek: date.getDay(),
    });
  }

  const maxCount = Math.max(1, ...cells.map((cell) => cell.count));

  function getColor(count: number): string {
    if (count === 0) return 'bg-gray-800';
    const intensity = count / maxCount;
    if (intensity < 0.25) return 'bg-[#14F195]/20';
    if (intensity < 0.5) return 'bg-[#14F195]/40';
    if (intensity < 0.75) return 'bg-[#14F195]/60';
    return 'bg-[#14F195]/80';
  }

  // Group by weeks
  const weekGroups: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weekGroups.push(cells.slice(i, i + 7));
  }

  return (
    <div
      className={`${className}`}
      role="img"
      aria-label={`Activity heatmap showing ${weeks} weeks of contribution activity`}
    >
      <div className="flex gap-[3px]">
        {weekGroups.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[3px]">
            {week.map((cell) => (
              <div
                key={cell.date}
                className={`w-3 h-3 rounded-sm ${getColor(cell.count)}`}
                title={`${cell.date}: ${cell.count} contributions`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-500">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-gray-800" />
        <div className="w-3 h-3 rounded-sm bg-[#14F195]/20" />
        <div className="w-3 h-3 rounded-sm bg-[#14F195]/40" />
        <div className="w-3 h-3 rounded-sm bg-[#14F195]/60" />
        <div className="w-3 h-3 rounded-sm bg-[#14F195]/80" />
        <span>More</span>
      </div>
    </div>
  );
}
