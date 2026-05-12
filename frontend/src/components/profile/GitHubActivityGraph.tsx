import React, { useMemo } from 'react';
import { GitCommit, GitPullRequest, AlertCircle, MessageSquare } from 'lucide-react';
import type { DailyActivity, GitHubActivity } from '../../api/github';

const CELL_PX = 12;
const CELL_GAP_PX = 3;

const LEVELS = [
  { min: 0, fill: 'rgba(160,160,184,0.08)' },
  { min: 1, fill: 'rgba(0,230,118,0.25)' },
  { min: 3, fill: 'rgba(0,230,118,0.45)' },
  { min: 6, fill: 'rgba(0,230,118,0.7)' },
  { min: 12, fill: '#00E676' },
];

function bucket(count: number): string {
  let fill = LEVELS[0].fill;
  for (const l of LEVELS) {
    if (count >= l.min) fill = l.fill;
  }
  return fill;
}

function chunkIntoWeeks(daily: DailyActivity[]): DailyActivity[][] {
  if (daily.length === 0) return [];
  const weeks: DailyActivity[][] = [];
  // Pad the leading week so columns align to Sunday=0 per GitHub convention.
  const first = new Date(daily[0].date + 'T00:00:00Z');
  const leadingPad = first.getUTCDay();
  let cur: DailyActivity[] = [];
  for (let i = 0; i < leadingPad; i++) {
    cur.push({ date: '', count: -1 });
  }
  for (const d of daily) {
    cur.push(d);
    if (cur.length === 7) {
      weeks.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) {
    while (cur.length < 7) cur.push({ date: '', count: -1 });
    weeks.push(cur);
  }
  return weeks;
}

interface Props {
  activity: GitHubActivity | undefined;
  loading: boolean;
  username: string | null | undefined;
}

const TYPE_BREAKDOWN: Array<{
  key: 'commits' | 'pullRequests' | 'issues' | 'reviews';
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { key: 'commits', label: 'Commits', Icon: GitCommit, color: 'text-emerald' },
  { key: 'pullRequests', label: 'Pull requests', Icon: GitPullRequest, color: 'text-status-info' },
  { key: 'issues', label: 'Issues', Icon: AlertCircle, color: 'text-magenta' },
  { key: 'reviews', label: 'Reviews', Icon: MessageSquare, color: 'text-purple' },
];

export function GitHubActivityGraph({ activity, loading, username }: Props) {
  const weeks = useMemo(() => (activity ? chunkIntoWeeks(activity.daily) : []), [activity]);

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="font-sans text-base font-semibold text-text-primary">GitHub activity</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {activity
              ? `${activity.counts.total} events in the last ${activity.rangeDays} days`
              : username
                ? 'Loading…'
                : 'Sign in with GitHub to see your activity'}
          </p>
        </div>
        {activity && (
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span>Less</span>
            {LEVELS.map((l) => (
              <span
                key={l.min}
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: l.fill }}
              />
            ))}
            <span>More</span>
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto pb-1">
        {loading && !activity ? (
          <div className="h-[112px] w-full rounded-md bg-forge-800 animate-pulse" />
        ) : weeks.length === 0 ? (
          <div className="h-[112px] flex items-center justify-center text-sm text-text-muted">
            No public activity in this window.
          </div>
        ) : (
          <svg
            role="img"
            aria-label={`GitHub activity heatmap for ${username ?? 'user'}`}
            width={weeks.length * (CELL_PX + CELL_GAP_PX)}
            height={7 * (CELL_PX + CELL_GAP_PX)}
          >
            {weeks.map((week, wi) =>
              week.map((day, di) => {
                if (day.count < 0) return null;
                return (
                  <rect
                    key={`${wi}-${di}`}
                    x={wi * (CELL_PX + CELL_GAP_PX)}
                    y={di * (CELL_PX + CELL_GAP_PX)}
                    width={CELL_PX}
                    height={CELL_PX}
                    rx={2}
                    ry={2}
                    fill={bucket(day.count)}
                  >
                    <title>
                      {day.date} — {day.count} event{day.count === 1 ? '' : 's'}
                    </title>
                  </rect>
                );
              }),
            )}
          </svg>
        )}
      </div>

      {/* Type breakdown */}
      {activity && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {TYPE_BREAKDOWN.map(({ key, label, Icon, color }) => (
            <div key={key} className="flex items-center gap-2.5 rounded-lg bg-forge-800 px-3 py-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <div className="min-w-0">
                <p className="text-xs text-text-muted leading-none">{label}</p>
                <p className="font-mono text-sm font-semibold text-text-primary mt-1">
                  {activity.counts[key]}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
