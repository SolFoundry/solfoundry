/**
 * @module ContributorDashboard
 * @description Main contributor dashboard view for SolFoundry (Issue #26).
 * Displays stats summary, filterable bounty task list, and activity feed.
 * Uses local mock data; designed for future API integration.
 */
import React, { useState, useMemo, useCallback } from "react";

/**
 * Valid task statuses for a bounty.
 * - "active": contributor is currently working on the bounty
 * - "completed": bounty has been completed and merged
 * - "expired": bounty deadline has passed without completion
 */
export type TaskStatus = "active" | "completed" | "expired";

/** Valid activity event types logged in the feed. */
export type ActivityType = "claim" | "submit" | "payout" | "review";

/** Filter options for the task list (includes "all" meta-filter). */
export type TaskFilter = "all" | TaskStatus;

/**
 * Represents a single bounty task assigned to the contributor.
 * @property id - Unique identifier for the task
 * @property title - Human-readable task title
 * @property status - Current lifecycle status
 * @property reward - SOL reward amount for completion
 * @property deadline - ISO-8601 date string for the deadline
 * @property tier - Bounty tier (1-3), determines review requirements
 */
export interface BountyTask {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly reward: number;
  readonly deadline: string;
  readonly tier: number;
}

/**
 * Represents an activity event in the contributor feed.
 * @property id - Unique identifier
 * @property type - Category of the activity event
 * @property message - Human-readable event description
 * @property timestamp - ISO-8601 timestamp of when the event occurred
 */
export interface Activity {
  readonly id: string;
  readonly type: ActivityType;
  readonly message: string;
  readonly timestamp: string;
}

/**
 * Aggregate dashboard data for the contributor.
 * @property username - Contributor display name
 * @property reputation - Numeric reputation score
 * @property totalEarnings - Lifetime earnings in SOL
 * @property activeBounties - Count of in-progress bounties
 * @property completedBounties - Count of completed bounties
 * @property tasks - List of bounty tasks
 * @property activities - Chronological activity feed
 */
export interface DashboardData {
  readonly username: string;
  readonly reputation: number;
  readonly totalEarnings: number;
  readonly activeBounties: number;
  readonly completedBounties: number;
  readonly tasks: readonly BountyTask[];
  readonly activities: readonly Activity[];
}

/** Mock data used before API integration. */
const MOCK: DashboardData = {
  username: "alice",
  reputation: 42,
  totalEarnings: 1250.5,
  activeBounties: 2,
  completedBounties: 15,
  tasks: [
    { id: "1", title: "Fix auth bug", status: "active", reward: 100, deadline: "2026-04-01", tier: 2 },
    { id: "2", title: "Add tests", status: "active", reward: 50, deadline: "2026-04-15", tier: 1 },
    { id: "3", title: "Update docs", status: "completed", reward: 30, deadline: "2026-03-01", tier: 1 },
    { id: "4", title: "Security audit", status: "completed", reward: 500, deadline: "2026-02-15", tier: 3 },
    { id: "5", title: "Performance fix", status: "expired", reward: 200, deadline: "2026-01-01", tier: 2 },
  ],
  activities: [
    { id: "a1", type: "claim", message: "Claimed bounty: Fix auth bug", timestamp: "2026-03-19T10:00:00Z" },
    { id: "a2", type: "submit", message: "Submitted PR for Add tests", timestamp: "2026-03-18T14:30:00Z" },
    { id: "a3", type: "payout", message: "Received 500 SOL for Security audit", timestamp: "2026-03-17T09:00:00Z" },
    { id: "a4", type: "review", message: "PR approved: Update docs", timestamp: "2026-03-16T11:00:00Z" },
  ],
};

/** CSS class map for status badge colours. */
const STATUS_STYLES: Readonly<Record<TaskStatus, string>> = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
};

/**
 * Props for the StatCard presentational component.
 * @property label - Metric label shown above the value
 * @property value - Metric value (number or formatted string)
 * @property color - Tailwind background/text colour classes
 */
interface StatCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly color: string;
}

/**
 * Presentational card displaying a single dashboard metric.
 * Used inside the stats grid at the top of the dashboard.
 */
function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className={`p-4 rounded-lg ${color}`} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <p className="text-sm opacity-75">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

/**
 * Formats an ISO-8601 timestamp into a human-readable relative string.
 * @param isoString - ISO-8601 timestamp
 * @returns Relative time string such as "2h ago" or "3d ago"
 */
export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

/**
 * Computes total reward value for a list of tasks.
 * @param tasks - Array of bounty tasks
 * @returns Sum of all task rewards
 */
export function computeTotalRewards(tasks: readonly BountyTask[]): number {
  return tasks.reduce((sum, t) => sum + t.reward, 0);
}

/**
 * ContributorDashboard -- primary dashboard view for SolFoundry contributors.
 *
 * Renders three main sections:
 * 1. Summary stat cards (reputation, earnings, active/completed bounties)
 * 2. Filterable bounty task list with tier badges and status indicators
 * 3. Chronological activity feed with relative timestamps
 *
 * @returns The rendered dashboard component
 */
export default function ContributorDashboard() {
  const [data] = useState<DashboardData>(MOCK);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");

  /** Filter task list based on selected status. */
  const filteredTasks = useMemo(
    () => (taskFilter === "all" ? data.tasks : data.tasks.filter((t) => t.status === taskFilter)),
    [data.tasks, taskFilter],
  );

  /** Total reward for the currently visible tasks. */
  const filteredTotal = useMemo(() => computeTotalRewards(filteredTasks), [filteredTasks]);

  /** Handle filter dropdown change with type narrowing. */
  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setTaskFilter(e.target.value as TaskFilter);
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6" data-testid="contributor-dashboard">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-500 mb-6">Welcome back, {data.username}!</p>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="stats-grid">
        <StatCard label="Reputation" value={data.reputation} color="bg-purple-50 text-purple-900" />
        <StatCard label="Total Earnings" value={`${data.totalEarnings} SOL`} color="bg-green-50 text-green-900" />
        <StatCard label="Active Bounties" value={data.activeBounties} color="bg-blue-50 text-blue-900" />
        <StatCard label="Completed" value={data.completedBounties} color="bg-amber-50 text-amber-900" />
      </div>

      {/* Main content grid: task list + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bounty task list with filter */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">My Bounties</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500" data-testid="filtered-total">
                {filteredTotal} SOL
              </span>
              <select
                value={taskFilter}
                onChange={handleFilterChange}
                className="border rounded px-2 py-1"
                data-testid="task-filter"
                aria-label="Filter tasks by status"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
          <div className="space-y-3" data-testid="task-list">
            {filteredTasks.length === 0 && (
              <p className="text-gray-400 py-4 text-center" data-testid="empty-tasks">
                No bounties found
              </p>
            )}
            {filteredTasks.map((t) => (
              <div
                key={t.id}
                className="border rounded-lg p-3 flex justify-between items-center"
                data-testid={`task-${t.id}`}
              >
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-gray-500">
                    T{t.tier} &middot; Deadline: {t.deadline}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{t.reward} SOL</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[t.status]}`}
                    data-testid={`status-badge-${t.id}`}
                  >
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3" data-testid="activity-feed">
            {data.activities.length === 0 && (
              <p className="text-gray-400 text-center" data-testid="empty-activities">
                No recent activity
              </p>
            )}
            {data.activities.map((a) => (
              <div
                key={a.id}
                className="border-l-4 border-indigo-400 pl-3 py-1"
                data-testid={`activity-${a.id}`}
              >
                <p className="text-sm">{a.message}</p>
                <p className="text-xs text-gray-400">{formatRelativeTime(a.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
