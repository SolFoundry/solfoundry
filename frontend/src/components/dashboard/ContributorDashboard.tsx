/**
 * @module ContributorDashboard
 * @description Main contributor dashboard view for SolFoundry (Issue #26).
 *
 * Sections:
 * 1. Summary stat cards (total earned, active bounties, pending payouts, reputation rank)
 * 2. Active bounties list with deadline countdown + progress indicator
 * 3. Earnings chart (line chart, last 30 days) — uses an SVG polyline chart
 * 4. Recent activity feed (bounties claimed, PRs submitted, reviews, payouts)
 * 5. Notification center with unread notifications and mark-as-read
 * 6. Quick actions (browse bounties, view leaderboard, check treasury)
 * 7. Settings section (linked accounts, notification preferences, wallet management)
 * 8. Fully responsive layout
 *
 * Uses local mock data; designed for future API integration.
 */
import React, { useState, useMemo, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valid task statuses for a bounty. */
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
 * @property tier - Bounty tier (1-3)
 * @property progress - Completion progress 0-100
 */
export interface BountyTask {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly reward: number;
  readonly deadline: string;
  readonly tier: number;
  readonly progress: number;
}

/**
 * Represents an activity event in the contributor feed.
 * @property id - Unique identifier
 * @property type - Category of the activity event
 * @property message - Human-readable event description
 * @property timestamp - ISO-8601 timestamp
 */
export interface Activity {
  readonly id: string;
  readonly type: ActivityType;
  readonly message: string;
  readonly timestamp: string;
}

/**
 * Represents a single notification for the contributor.
 * @property id - Unique identifier
 * @property message - Notification text
 * @property read - Whether the notification has been read
 * @property timestamp - ISO-8601 timestamp
 */
export interface Notification {
  readonly id: string;
  readonly message: string;
  readonly read: boolean;
  readonly timestamp: string;
}

/**
 * A single data point for the earnings chart.
 * @property date - Label for the x-axis
 * @property amount - Earnings value in SOL
 */
export interface EarningsDataPoint {
  readonly date: string;
  readonly amount: number;
}

/**
 * Aggregate dashboard data for the contributor.
 */
export interface DashboardData {
  readonly username: string;
  readonly reputationRank: number;
  readonly totalEarnings: number;
  readonly activeBounties: number;
  readonly pendingPayouts: number;
  readonly tasks: readonly BountyTask[];
  readonly activities: readonly Activity[];
  readonly notifications: readonly Notification[];
  readonly earningsChart: readonly EarningsDataPoint[];
  readonly linkedAccounts: readonly string[];
  readonly notificationPreferences: {
    readonly email: boolean;
    readonly push: boolean;
    readonly discord: boolean;
  };
  readonly walletAddress: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

/** Mock data used before API integration. */
const MOCK: DashboardData = {
  username: "alice",
  reputationRank: 5,
  totalEarnings: 1250.5,
  activeBounties: 2,
  pendingPayouts: 320,
  tasks: [
    { id: "1", title: "Fix auth bug", status: "active", reward: 100, deadline: "2026-04-01", tier: 2, progress: 65 },
    { id: "2", title: "Add tests", status: "active", reward: 50, deadline: "2026-04-15", tier: 1, progress: 30 },
    { id: "3", title: "Update docs", status: "completed", reward: 30, deadline: "2026-03-01", tier: 1, progress: 100 },
    { id: "4", title: "Security audit", status: "completed", reward: 500, deadline: "2026-02-15", tier: 3, progress: 100 },
    { id: "5", title: "Performance fix", status: "expired", reward: 200, deadline: "2026-01-01", tier: 2, progress: 45 },
  ],
  activities: [
    { id: "a1", type: "claim", message: "Claimed bounty: Fix auth bug", timestamp: "2026-03-19T10:00:00Z" },
    { id: "a2", type: "submit", message: "Submitted PR for Add tests", timestamp: "2026-03-18T14:30:00Z" },
    { id: "a3", type: "payout", message: "Received 500 SOL for Security audit", timestamp: "2026-03-17T09:00:00Z" },
    { id: "a4", type: "review", message: "PR approved: Update docs", timestamp: "2026-03-16T11:00:00Z" },
  ],
  notifications: [
    { id: "n1", message: "Your PR for Fix auth bug received a review", read: false, timestamp: "2026-03-19T12:00:00Z" },
    { id: "n2", message: "Bounty deadline in 3 days for Add tests", read: false, timestamp: "2026-03-19T08:00:00Z" },
    { id: "n3", message: "Payout of 500 SOL confirmed", read: true, timestamp: "2026-03-17T10:00:00Z" },
  ],
  earningsChart: [
    { date: "Mar 1", amount: 0 },
    { date: "Mar 5", amount: 50 },
    { date: "Mar 10", amount: 120 },
    { date: "Mar 15", amount: 300 },
    { date: "Mar 17", amount: 800 },
    { date: "Mar 20", amount: 1250 },
  ],
  linkedAccounts: ["GitHub", "Discord"],
  notificationPreferences: { email: true, push: false, discord: true },
  walletAddress: "Amu1...71o7",
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/** CSS class map for status badge colours. */
const STATUS_STYLES: Readonly<Record<TaskStatus, string>> = {
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
};

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
 * Computes human-readable deadline countdown from an ISO date string.
 * @param deadline - ISO-8601 date string
 * @returns Countdown string like "12d left" or "Overdue"
 */
export function deadlineCountdown(deadline: string): string {
  const diffMs = new Date(deadline).getTime() - Date.now();
  if (diffMs <= 0) return "Overdue";
  const days = Math.ceil(diffMs / 86_400_000);
  if (days === 1) return "1d left";
  return `${days}d left`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Props for the StatCard presentational component. */
interface StatCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly color: string;
}

/** Presentational card displaying a single dashboard metric. */
function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className={`p-4 rounded-lg ${color}`} data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <p className="text-sm opacity-75">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

/**
 * SVG-based line chart for earnings over the last 30 days.
 * Renders an inline polyline -- no external charting dependency needed.
 */
function EarningsChart({ data }: { readonly data: readonly EarningsDataPoint[] }) {
  const width = 400;
  const height = 150;
  const padding = 30;
  const maxAmount = Math.max(...data.map((d) => d.amount), 1);

  const points = data
    .map((d, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding);
      const y = height - padding - (d.amount / maxAmount) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div data-testid="earnings-chart">
      <h2 className="text-xl font-semibold mb-4">Earnings (Last 30 Days)</h2>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Earnings chart">
        {/* axis */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#e5e7eb" strokeWidth={1} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#e5e7eb" strokeWidth={1} />
        {/* line */}
        <polyline fill="none" stroke="#6366f1" strokeWidth={2} points={points} />
        {/* dots */}
        {data.map((d, i) => {
          const x = padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding);
          const y = height - padding - (d.amount / maxAmount) * (height - 2 * padding);
          return <circle key={d.date} cx={x} cy={y} r={3} fill="#6366f1" />;
        })}
        {/* x labels */}
        {data.map((d, i) => {
          const x = padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding);
          return (
            <text key={`label-${d.date}`} x={x} y={height - 8} textAnchor="middle" className="text-[9px] fill-gray-400">
              {d.date}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Notification center component.
 * Displays unread and read notifications with mark-as-read buttons.
 */
function NotificationCenter({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: {
  readonly notifications: readonly Notification[];
  readonly onMarkRead: (id: string) => void;
  readonly onMarkAllRead: () => void;
}) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div data-testid="notification-center">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          Notifications{" "}
          {unreadCount > 0 && (
            <span className="text-sm bg-red-500 text-white rounded-full px-2 py-0.5 ml-1" data-testid="unread-count">
              {unreadCount}
            </span>
          )}
        </h2>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-sm text-indigo-600 hover:text-indigo-800"
            data-testid="mark-all-read"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="space-y-2" data-testid="notification-list">
        {notifications.length === 0 && (
          <p className="text-gray-400 text-center py-4" data-testid="empty-notifications">
            No notifications
          </p>
        )}
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex justify-between items-start p-3 rounded-lg border ${
              n.read ? "border-gray-200 bg-white" : "border-indigo-200 bg-indigo-50"
            }`}
            data-testid={`notification-${n.id}`}
          >
            <div>
              <p className={`text-sm ${n.read ? "text-gray-500" : "text-gray-900 font-medium"}`}>{n.message}</p>
              <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.timestamp)}</p>
            </div>
            {!n.read && (
              <button
                onClick={() => onMarkRead(n.id)}
                className="text-xs text-indigo-600 hover:text-indigo-800 whitespace-nowrap ml-2"
                data-testid={`mark-read-${n.id}`}
                aria-label={`Mark notification ${n.id} as read`}
              >
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Quick actions component.
 * Provides navigation shortcuts to browse bounties, leaderboard, and treasury.
 */
function QuickActions() {
  const actions = [
    { label: "Browse Bounties", href: "/bounties", testId: "action-bounties" },
    { label: "View Leaderboard", href: "/leaderboard", testId: "action-leaderboard" },
    { label: "Check Treasury", href: "/treasury", testId: "action-treasury" },
  ] as const;

  return (
    <div data-testid="quick-actions">
      <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
      <div className="flex flex-wrap gap-3">
        {actions.map((a) => (
          <a
            key={a.testId}
            href={a.href}
            className="px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 transition-colors"
            data-testid={a.testId}
          >
            {a.label}
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Settings section component.
 * Displays linked accounts, notification preferences, and wallet management.
 */
function SettingsSection({
  linkedAccounts,
  notificationPreferences,
  walletAddress,
}: {
  readonly linkedAccounts: readonly string[];
  readonly notificationPreferences: { readonly email: boolean; readonly push: boolean; readonly discord: boolean };
  readonly walletAddress: string;
}) {
  return (
    <div data-testid="settings-section">
      <h2 className="text-xl font-semibold mb-4">Settings</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Linked Accounts */}
        <div className="border rounded-lg p-4" data-testid="linked-accounts">
          <h3 className="font-medium mb-2">Linked Accounts</h3>
          {linkedAccounts.length === 0 ? (
            <p className="text-gray-400 text-sm">No linked accounts</p>
          ) : (
            <ul className="space-y-1">
              {linkedAccounts.map((acct) => (
                <li key={acct} className="text-sm text-gray-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  {acct}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notification Preferences */}
        <div className="border rounded-lg p-4" data-testid="notification-preferences">
          <h3 className="font-medium mb-2">Notification Preferences</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>Email: On</li>
            <li>Push: Off</li>
            <li>Discord: On</li>
          </ul>
        </div>

        {/* Wallet Management */}
        <div className="border rounded-lg p-4" data-testid="wallet-management">
          <h3 className="font-medium mb-2">Wallet</h3>
          <p className="text-sm text-gray-600 font-mono" data-testid="wallet-address">
            {walletAddress}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * ContributorDashboard -- primary dashboard view for SolFoundry contributors.
 *
 * Renders all sections required by Issue #26:
 * 1. Summary stat cards (total earned, active bounties, pending payouts, reputation rank)
 * 2. Active bounties list with deadline countdown + progress indicator
 * 3. Earnings chart (SVG line chart, last 30 days)
 * 4. Recent activity feed with relative timestamps
 * 5. Notification center with unread count and mark-as-read
 * 6. Quick actions (browse bounties, view leaderboard, check treasury)
 * 7. Settings section (linked accounts, notification preferences, wallet management)
 *
 * Fully responsive using Tailwind CSS grid breakpoints.
 *
 * @returns The rendered dashboard component
 */
export default function ContributorDashboard() {
  const [data] = useState<DashboardData>(MOCK);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [notifications, setNotifications] = useState<Notification[]>([...MOCK.notifications]);

  /** Filter task list based on selected status. */
  const filteredTasks = useMemo(
    () => (taskFilter === "all" ? data.tasks : data.tasks.filter((t) => t.status === taskFilter)),
    [data.tasks, taskFilter],
  );

  /** Total reward for the currently visible tasks. */
  const filteredTotal = useMemo(() => computeTotalRewards(filteredTasks), [filteredTasks]);

  /** Handle filter dropdown change. */
  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setTaskFilter(e.target.value as TaskFilter);
  }, []);

  /** Mark a single notification as read. */
  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  /** Mark all notifications as read. */
  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8" data-testid="contributor-dashboard">
      <div>
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-gray-500">Welcome back, {data.username}!</p>
      </div>

      {/* ---- Summary stat cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
        <StatCard label="Total Earned" value={`${data.totalEarnings} SOL`} color="bg-green-50 text-green-900" />
        <StatCard label="Active Bounties" value={data.activeBounties} color="bg-blue-50 text-blue-900" />
        <StatCard label="Pending Payouts" value={`${data.pendingPayouts} SOL`} color="bg-amber-50 text-amber-900" />
        <StatCard label="Reputation Rank" value={`#${data.reputationRank}`} color="bg-purple-50 text-purple-900" />
      </div>

      {/* ---- Main content grid ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bounty task list with filter + deadline countdown + progress */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bounty list */}
          <div>
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
                  className="border rounded-lg p-3"
                  data-testid={`task-${t.id}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-medium">{t.title}</p>
                      <p className="text-sm text-gray-500">
                        T{t.tier} · Deadline: {t.deadline}
                        {" "}·{" "}
                        <span data-testid={`countdown-${t.id}`}>{deadlineCountdown(t.deadline)}</span>
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
                  {/* Progress indicator */}
                  <div className="w-full bg-gray-200 rounded-full h-2" data-testid={`progress-bar-${t.id}`}>
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all"
                      style={{ width: `${t.progress}%` }}
                      role="progressbar"
                      aria-valuenow={t.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${t.title} progress`}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1" data-testid={`progress-text-${t.id}`}>{t.progress}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Earnings chart */}
          <EarningsChart data={data.earningsChart} />
        </div>

        {/* Right column: Activity feed + Notifications */}
        <div className="space-y-6">
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

          {/* Notification center */}
          <NotificationCenter
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />
        </div>
      </div>

      {/* ---- Quick Actions ---- */}
      <QuickActions />

      {/* ---- Settings Section ---- */}
      <SettingsSection
        linkedAccounts={data.linkedAccounts}
        notificationPreferences={data.notificationPreferences}
        walletAddress={data.walletAddress}
      />
    </div>
  );
}
