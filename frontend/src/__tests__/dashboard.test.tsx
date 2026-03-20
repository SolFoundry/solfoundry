/**
 * @module dashboard.test
 * @description Test suite for the SolFoundry Contributor Dashboard (Issue #26).
 * Covers rendering, filtering, stat display, activity feed, accessibility,
 * utility functions, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ContributorDashboard, {
  formatRelativeTime,
  computeTotalRewards,
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

  it("renders section headings", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText("My Bounties")).toBeTruthy();
    expect(screen.getByText("Recent Activity")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

describe("Stat cards", () => {
  it("displays all four stat cards with values", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText("Reputation")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText(/1250.5 SOL/)).toBeTruthy();
    expect(screen.getByText("Active Bounties")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("renders stats-grid container", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("stats-grid")).toBeTruthy();
  });

  it("renders stat cards with individual test-ids", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("stat-reputation")).toBeTruthy();
    expect(screen.getByTestId("stat-total-earnings")).toBeTruthy();
    expect(screen.getByTestId("stat-active-bounties")).toBeTruthy();
    expect(screen.getByTestId("stat-completed")).toBeTruthy();
  });

  it("shows correct values inside stat cards", () => {
    render(<ContributorDashboard />);
    expect(within(screen.getByTestId("stat-active-bounties")).getByText("2")).toBeTruthy();
    expect(within(screen.getByTestId("stat-completed")).getByText("15")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Task filtering
// ---------------------------------------------------------------------------

describe("Task list", () => {
  it("shows all 5 tasks by default", () => {
    render(<ContributorDashboard />);
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-/).length).toBe(5);
  });

  it("filters to active tasks (2)", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "active" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-/).length).toBe(2);
  });

  it("filters to completed tasks (2)", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "completed" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-/).length).toBe(2);
  });

  it("filters to expired tasks (1)", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "expired" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-/).length).toBe(1);
  });

  it("restores all tasks when filter reset to all", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "active" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-/).length).toBe(2);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "all" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-/).length).toBe(5);
  });

  it("displays task title and reward", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText("Fix auth bug")).toBeTruthy();
    expect(screen.getByText("100 SOL")).toBeTruthy();
  });

  it("displays tier and deadline info", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText(/T2/)).toBeTruthy();
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
// Activity feed
// ---------------------------------------------------------------------------

describe("Activity feed", () => {
  it("renders the activity feed container", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("activity-feed")).toBeTruthy();
  });

  it("shows all 4 activity items", () => {
    render(<ContributorDashboard />);
    expect(screen.getAllByTestId(/^activity-/).length).toBe(4);
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
      { id: "1", title: "A", status: "active", reward: 100, deadline: "2026-04-01", tier: 1 },
      { id: "2", title: "B", status: "completed", reward: 250, deadline: "2026-03-01", tier: 2 },
    ];
    expect(computeTotalRewards(tasks)).toBe(350);
  });

  it("returns 0 for empty array", () => {
    expect(computeTotalRewards([])).toBe(0);
  });

  it("handles single task", () => {
    expect(computeTotalRewards([{ id: "1", title: "A", status: "active", reward: 42, deadline: "2026-04-01", tier: 1 }])).toBe(42);
  });

  it("handles zero rewards", () => {
    const tasks: BountyTask[] = [
      { id: "1", title: "A", status: "active", reward: 0, deadline: "2026-04-01", tier: 1 },
      { id: "2", title: "B", status: "active", reward: 0, deadline: "2026-04-01", tier: 1 },
    ];
    expect(computeTotalRewards(tasks)).toBe(0);
  });

  it("handles decimal rewards", () => {
    const tasks: BountyTask[] = [
      { id: "1", title: "A", status: "active", reward: 10.5, deadline: "2026-04-01", tier: 1 },
      { id: "2", title: "B", status: "active", reward: 20.3, deadline: "2026-04-01", tier: 1 },
    ];
    expect(computeTotalRewards(tasks)).toBeCloseTo(30.8);
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
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-/).length).toBe(5);
  });

  it("all rewards display SOL currency", () => {
    render(<ContributorDashboard />);
    expect(screen.getAllByText(/SOL/).length).toBeGreaterThanOrEqual(5);
  });
});
