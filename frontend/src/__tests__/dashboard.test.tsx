/**
 * @module dashboard.test
 * @description Integration test suite for the SolFoundry Contributor Dashboard (Issue #26).
 * Covers all spec requirements: summary stat cards, bounty list with deadline
 * countdown and progress indicators, earnings chart, activity feed, notification
 * center with mark-as-read, quick actions, settings section, accessibility,
 * utility functions, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ContributorDashboard, {
  formatRelativeTime,
  computeTotalRewards,
  deadlineCountdown,
  type BountyTask,
} from "../components/dashboard/ContributorDashboard";

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("ContributorDashboard rendering", () => {
  it("renders the dashboard heading", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });

  it("shows username in welcome message", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText(/Welcome back, alice/)).toBeTruthy();
  });

  it("has contributor-dashboard data-testid", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("contributor-dashboard")).toBeTruthy();
  });

  it("renders all section headings", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText("My Bounties")).toBeTruthy();
    expect(screen.getByText("Recent Activity")).toBeTruthy();
    expect(screen.getByText("Notifications")).toBeTruthy();
    expect(screen.getByText("Quick Actions")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Earnings (Last 30 Days)")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Summary stat cards (total earned, active bounties, pending payouts, reputation rank)
// ---------------------------------------------------------------------------

describe("Stat cards", () => {
  it("displays all four required stat cards", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("stat-total-earned")).toBeTruthy();
    expect(screen.getByTestId("stat-active-bounties")).toBeTruthy();
    expect(screen.getByTestId("stat-pending-payouts")).toBeTruthy();
    expect(screen.getByTestId("stat-reputation-rank")).toBeTruthy();
  });

  it("renders stats-grid container", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("stats-grid")).toBeTruthy();
  });

  it("shows correct stat card values", () => {
    render(<ContributorDashboard />);
    expect(within(screen.getByTestId("stat-total-earned")).getByText(/1250.5 SOL/)).toBeTruthy();
    expect(within(screen.getByTestId("stat-active-bounties")).getByText("2")).toBeTruthy();
    expect(within(screen.getByTestId("stat-pending-payouts")).getByText(/320 SOL/)).toBeTruthy();
    expect(within(screen.getByTestId("stat-reputation-rank")).getByText("#5")).toBeTruthy();
  });

  it("uses a responsive grid layout", () => {
    render(<ContributorDashboard />);
    const grid = screen.getByTestId("stats-grid");
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("grid-cols-2");
    expect(grid.className).toContain("md:grid-cols-4");
  });
});

// ---------------------------------------------------------------------------
// Active bounties list with deadline countdown + progress indicator
// ---------------------------------------------------------------------------

describe("Task list with deadline countdown and progress", () => {
  it("shows all 5 tasks by default", () => {
    render(<ContributorDashboard />);
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-\d/).length).toBe(5);
  });

  it("shows deadline countdown for each task", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("countdown-1")).toBeTruthy();
    expect(screen.getByTestId("countdown-5")).toBeTruthy();
  });

  it("shows progress bar for each task", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("progress-bar-1")).toBeTruthy();
    expect(screen.getByTestId("progress-bar-2")).toBeTruthy();
  });

  it("shows progress percentage text", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("progress-text-1").textContent).toBe("65%");
    expect(screen.getByTestId("progress-text-2").textContent).toBe("30%");
  });

  it("renders progress bar with correct ARIA attributes", () => {
    render(<ContributorDashboard />);
    const bar = screen.getByTestId("progress-bar-1").firstElementChild as HTMLElement;
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("65");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  it("displays task title and reward", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText("Fix auth bug")).toBeTruthy();
    expect(screen.getByText("100 SOL")).toBeTruthy();
  });

  it("displays tier and deadline info", () => {
    render(<ContributorDashboard />);
    expect(screen.getAllByText(/T2/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2026-04-01/)).toBeTruthy();
  });

  it("renders status badges with correct text", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("status-badge-1").textContent).toBe("active");
    expect(screen.getByTestId("status-badge-3").textContent).toBe("completed");
    expect(screen.getByTestId("status-badge-5").textContent).toBe("expired");
  });
});

// ---------------------------------------------------------------------------
// Task filtering
// ---------------------------------------------------------------------------

describe("Task filtering", () => {
  it("filters to active tasks (2)", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "active" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-\d/).length).toBe(2);
  });

  it("filters to completed tasks (2)", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "completed" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-\d/).length).toBe(2);
  });

  it("filters to expired tasks (1)", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "expired" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-\d/).length).toBe(1);
  });

  it("restores all tasks when filter reset to all", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "active" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-\d/).length).toBe(2);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "all" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-\d/).length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Filtered total
// ---------------------------------------------------------------------------

describe("Filtered total", () => {
  it("shows 880 SOL total for all tasks", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("filtered-total").textContent).toContain("880");
  });

  it("shows 150 SOL for active filter", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "active" } });
    expect(screen.getByTestId("filtered-total").textContent).toContain("150");
  });

  it("shows 530 SOL for completed filter", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "completed" } });
    expect(screen.getByTestId("filtered-total").textContent).toContain("530");
  });

  it("shows 200 SOL for expired filter", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "expired" } });
    expect(screen.getByTestId("filtered-total").textContent).toContain("200");
  });
});

// ---------------------------------------------------------------------------
// Earnings chart (line chart, last 30 days)
// ---------------------------------------------------------------------------

describe("Earnings chart", () => {
  it("renders the earnings chart container", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("earnings-chart")).toBeTruthy();
  });

  it("renders an SVG element inside the chart", () => {
    render(<ContributorDashboard />);
    const chart = screen.getByTestId("earnings-chart");
    expect(chart.querySelector("svg")).toBeTruthy();
  });

  it("SVG has accessible role and label", () => {
    render(<ContributorDashboard />);
    const svg = screen.getByTestId("earnings-chart").querySelector("svg") as SVGElement;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Earnings chart");
  });

  it("renders a polyline for the data", () => {
    render(<ContributorDashboard />);
    const svg = screen.getByTestId("earnings-chart").querySelector("svg") as SVGElement;
    expect(svg.querySelector("polyline")).toBeTruthy();
  });

  it("renders data point circles", () => {
    render(<ContributorDashboard />);
    const svg = screen.getByTestId("earnings-chart").querySelector("svg") as SVGElement;
    // 6 data points in mock data
    expect(svg.querySelectorAll("circle").length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

describe("Activity feed", () => {
  it("renders the activity feed container", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("activity-feed")).toBeTruthy();
  });

  it("shows all 4 activity items", () => {
    render(<ContributorDashboard />);
    expect(screen.getAllByTestId(/^activity-a/).length).toBe(4);
  });

  it("displays activity messages", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText(/Claimed bounty: Fix auth bug/)).toBeTruthy();
    expect(screen.getByText(/Submitted PR for Add tests/)).toBeTruthy();
    expect(screen.getByText(/Received 500 SOL/)).toBeTruthy();
    expect(screen.getByText(/PR approved: Update docs/)).toBeTruthy();
  });

  it("has unique test-ids per activity", () => {
    render(<ContributorDashboard />);
    ["a1", "a2", "a3", "a4"].forEach((id) => {
      expect(screen.getByTestId(`activity-${id}`)).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Notification center with mark-as-read
// ---------------------------------------------------------------------------

describe("Notification center", () => {
  it("renders the notification center", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("notification-center")).toBeTruthy();
  });

  it("shows notification list", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("notification-list")).toBeTruthy();
  });

  it("renders all 3 notifications", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("notification-n1")).toBeTruthy();
    expect(screen.getByTestId("notification-n2")).toBeTruthy();
    expect(screen.getByTestId("notification-n3")).toBeTruthy();
  });

  it("shows unread count badge", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("unread-count").textContent).toBe("2");
  });

  it("shows mark-read buttons for unread notifications", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("mark-read-n1")).toBeTruthy();
    expect(screen.getByTestId("mark-read-n2")).toBeTruthy();
    // n3 is already read, should not have mark-read button
    expect(screen.queryByTestId("mark-read-n3")).toBeNull();
  });

  it("marks single notification as read", () => {
    render(<ContributorDashboard />);
    fireEvent.click(screen.getByTestId("mark-read-n1"));
    // unread count should drop to 1
    expect(screen.getByTestId("unread-count").textContent).toBe("1");
    // mark-read button should disappear for n1
    expect(screen.queryByTestId("mark-read-n1")).toBeNull();
  });

  it("marks all notifications as read", () => {
    render(<ContributorDashboard />);
    fireEvent.click(screen.getByTestId("mark-all-read"));
    // unread count badge should disappear
    expect(screen.queryByTestId("unread-count")).toBeNull();
    // mark-all-read button should disappear
    expect(screen.queryByTestId("mark-all-read")).toBeNull();
  });

  it("shows mark-all-read button only when unread exist", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("mark-all-read")).toBeTruthy();
    fireEvent.click(screen.getByTestId("mark-all-read"));
    expect(screen.queryByTestId("mark-all-read")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Quick actions (browse bounties, view leaderboard, check treasury)
// ---------------------------------------------------------------------------

describe("Quick actions", () => {
  it("renders the quick actions section", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("quick-actions")).toBeTruthy();
  });

  it("shows all three quick action links", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("action-bounties")).toBeTruthy();
    expect(screen.getByTestId("action-leaderboard")).toBeTruthy();
    expect(screen.getByTestId("action-treasury")).toBeTruthy();
  });

  it("quick action links have correct hrefs", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("action-bounties").getAttribute("href")).toBe("/bounties");
    expect(screen.getByTestId("action-leaderboard").getAttribute("href")).toBe("/leaderboard");
    expect(screen.getByTestId("action-treasury").getAttribute("href")).toBe("/treasury");
  });

  it("quick action links have readable labels", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText("Browse Bounties")).toBeTruthy();
    expect(screen.getByText("View Leaderboard")).toBeTruthy();
    expect(screen.getByText("Check Treasury")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Settings section (linked accounts, notification prefs, wallet)
// ---------------------------------------------------------------------------

describe("Settings section", () => {
  it("renders the settings section", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("settings-section")).toBeTruthy();
  });

  it("shows linked accounts subsection", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("linked-accounts")).toBeTruthy();
    expect(screen.getByText("Linked Accounts")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
    expect(screen.getByText("Discord")).toBeTruthy();
  });

  it("shows notification preferences subsection", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("notification-preferences")).toBeTruthy();
    expect(screen.getByText("Notification Preferences")).toBeTruthy();
    expect(screen.getByText("Email: On")).toBeTruthy();
    expect(screen.getByText("Push: Off")).toBeTruthy();
    expect(screen.getByText("Discord: On")).toBeTruthy();
  });

  it("shows wallet management subsection", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("wallet-management")).toBeTruthy();
    expect(screen.getByTestId("wallet-address")).toBeTruthy();
    expect(screen.getByTestId("wallet-address").textContent).toContain("Amu1");
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe("Accessibility", () => {
  it("task filter has aria-label", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("task-filter").getAttribute("aria-label")).toBe("Filter tasks by status");
  });

  it("filter select contains all expected options", () => {
    render(<ContributorDashboard />);
    const options = Array.from((screen.getByTestId("task-filter") as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(["all", "active", "completed", "expired"]);
  });

  it("mark-read buttons have aria-labels", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("mark-read-n1").getAttribute("aria-label")).toBe("Mark notification n1 as read");
  });

  it("earnings chart SVG has role=img and aria-label", () => {
    render(<ContributorDashboard />);
    const svg = screen.getByTestId("earnings-chart").querySelector("svg") as SVGElement;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Responsive layout
// ---------------------------------------------------------------------------

describe("Responsive layout", () => {
  it("uses responsive grid classes on stats grid", () => {
    render(<ContributorDashboard />);
    const grid = screen.getByTestId("stats-grid");
    expect(grid.className).toContain("grid-cols-2");
    expect(grid.className).toContain("md:grid-cols-4");
  });

  it("uses responsive padding on main container", () => {
    render(<ContributorDashboard />);
    const container = screen.getByTestId("contributor-dashboard");
    expect(container.className).toContain("p-4");
    expect(container.className).toContain("sm:p-6");
  });

  it("uses responsive grid on main content area", () => {
    render(<ContributorDashboard />);
    const container = screen.getByTestId("contributor-dashboard");
    // Main content grid should have lg:grid-cols-3
    const grids = container.querySelectorAll(".grid.grid-cols-1.lg\\:grid-cols-3");
    expect(grids.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe("formatRelativeTime", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-20T12:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });

  it("returns just now for < 1 min", () => {
    expect(formatRelativeTime("2026-03-20T11:59:35Z")).toBe("just now");
  });

  it("returns Xm ago for < 1 hour", () => {
    expect(formatRelativeTime("2026-03-20T11:55:00Z")).toBe("5m ago");
  });

  it("returns Xh ago for < 24 hours", () => {
    expect(formatRelativeTime("2026-03-20T09:00:00Z")).toBe("3h ago");
  });

  it("returns Xd ago for < 30 days", () => {
    expect(formatRelativeTime("2026-03-15T12:00:00Z")).toBe("5d ago");
  });

  it("returns locale date for > 30 days", () => {
    const result = formatRelativeTime("2026-01-19T12:00:00Z");
    expect(result).not.toContain("d ago");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles exact current time", () => {
    expect(formatRelativeTime("2026-03-20T12:00:00Z")).toBe("just now");
  });
});

// ---------------------------------------------------------------------------
// computeTotalRewards
// ---------------------------------------------------------------------------

describe("computeTotalRewards", () => {
  it("sums rewards from multiple tasks", () => {
    const tasks: BountyTask[] = [
      { id: "1", title: "A", status: "active", reward: 100, deadline: "2026-04-01", tier: 1, progress: 50 },
      { id: "2", title: "B", status: "completed", reward: 250, deadline: "2026-03-01", tier: 2, progress: 100 },
    ];
    expect(computeTotalRewards(tasks)).toBe(350);
  });

  it("returns 0 for empty array", () => {
    expect(computeTotalRewards([])).toBe(0);
  });

  it("handles single task", () => {
    expect(computeTotalRewards([{ id: "1", title: "A", status: "active", reward: 42, deadline: "2026-04-01", tier: 1, progress: 0 }])).toBe(42);
  });

  it("handles zero rewards", () => {
    const tasks: BountyTask[] = [
      { id: "1", title: "A", status: "active", reward: 0, deadline: "2026-04-01", tier: 1, progress: 0 },
      { id: "2", title: "B", status: "active", reward: 0, deadline: "2026-04-01", tier: 1, progress: 0 },
    ];
    expect(computeTotalRewards(tasks)).toBe(0);
  });

  it("handles decimal rewards", () => {
    const tasks: BountyTask[] = [
      { id: "1", title: "A", status: "active", reward: 10.5, deadline: "2026-04-01", tier: 1, progress: 0 },
      { id: "2", title: "B", status: "active", reward: 20.3, deadline: "2026-04-01", tier: 1, progress: 0 },
    ];
    expect(computeTotalRewards(tasks)).toBeCloseTo(30.8);
  });
});

// ---------------------------------------------------------------------------
// deadlineCountdown
// ---------------------------------------------------------------------------

describe("deadlineCountdown", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-20T12:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });

  it("returns days left for future deadline", () => {
    expect(deadlineCountdown("2026-04-01")).toContain("d left");
  });

  it("returns Overdue for past deadline", () => {
    expect(deadlineCountdown("2026-01-01")).toBe("Overdue");
  });

  it("returns 1d left for deadline tomorrow", () => {
    expect(deadlineCountdown("2026-03-21")).toBe("1d left");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("Edge cases", () => {
  it("does not show empty-tasks when tasks exist", () => {
    render(<ContributorDashboard />);
    expect(screen.queryByTestId("empty-tasks")).toBeNull();
  });

  it("default filter is all", () => {
    render(<ContributorDashboard />);
    expect((screen.getByTestId("task-filter") as HTMLSelectElement).value).toBe("all");
  });

  it("handles rapid filter changes", () => {
    render(<ContributorDashboard />);
    const f = screen.getByTestId("task-filter");
    fireEvent.change(f, { target: { value: "active" } });
    fireEvent.change(f, { target: { value: "completed" } });
    fireEvent.change(f, { target: { value: "expired" } });
    fireEvent.change(f, { target: { value: "all" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-\d/).length).toBe(5);
  });

  it("all rewards display SOL currency", () => {
    render(<ContributorDashboard />);
    expect(screen.getAllByText(/SOL/).length).toBeGreaterThanOrEqual(5);
  });

  it("notification count updates correctly after multiple mark-reads", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("unread-count").textContent).toBe("2");
    fireEvent.click(screen.getByTestId("mark-read-n1"));
    expect(screen.getByTestId("unread-count").textContent).toBe("1");
    fireEvent.click(screen.getByTestId("mark-read-n2"));
    expect(screen.queryByTestId("unread-count")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration: Full dashboard render
// ---------------------------------------------------------------------------

describe("Integration: full dashboard render", () => {
  it("renders all dashboard sections in a single mount", () => {
    render(<ContributorDashboard />);
    // Stat cards
    expect(screen.getByTestId("stats-grid")).toBeTruthy();
    expect(screen.getByTestId("stat-total-earned")).toBeTruthy();
    expect(screen.getByTestId("stat-active-bounties")).toBeTruthy();
    expect(screen.getByTestId("stat-pending-payouts")).toBeTruthy();
    expect(screen.getByTestId("stat-reputation-rank")).toBeTruthy();
    // Task list
    expect(screen.getByTestId("task-list")).toBeTruthy();
    // Earnings chart
    expect(screen.getByTestId("earnings-chart")).toBeTruthy();
    // Activity feed
    expect(screen.getByTestId("activity-feed")).toBeTruthy();
    // Notification center
    expect(screen.getByTestId("notification-center")).toBeTruthy();
    // Quick actions
    expect(screen.getByTestId("quick-actions")).toBeTruthy();
    // Settings
    expect(screen.getByTestId("settings-section")).toBeTruthy();
    expect(screen.getByTestId("linked-accounts")).toBeTruthy();
    expect(screen.getByTestId("notification-preferences")).toBeTruthy();
    expect(screen.getByTestId("wallet-management")).toBeTruthy();
  });

  it("can interact with filter and notification in one render", () => {
    render(<ContributorDashboard />);
    // Filter to active
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "active" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-\d/).length).toBe(2);
    // Mark notification read
    fireEvent.click(screen.getByTestId("mark-read-n1"));
    expect(screen.getByTestId("unread-count").textContent).toBe("1");
    // Filter back
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "all" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-\d/).length).toBe(5);
  });
});
