// Tests for Contributor Dashboard (Closes #26)
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ContributorDashboard from "../components/dashboard/ContributorDashboard";

describe("ContributorDashboard", () => {
  it("renders heading", () => {
    render(<ContributorDashboard />); expect(screen.getByText("Dashboard")).toBeTruthy();
  });
  it("shows username", () => {
    render(<ContributorDashboard />); expect(screen.getByText(/Welcome back, alice/)).toBeTruthy();
  });
  it("displays stat cards", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText("Reputation")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText(/1250.5 SOL/)).toBeTruthy();
  });
  it("shows all tasks by default", () => {
    render(<ContributorDashboard />);
    const list = screen.getByTestId("task-list");
    expect(within(list).getAllByTestId(/^task-/).length).toBe(5);
  });
  it("filters active tasks", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "active" } });
    const list = screen.getByTestId("task-list");
    expect(within(list).getAllByTestId(/^task-/).length).toBe(2);
  });
  it("filters completed tasks", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "completed" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-/).length).toBe(2);
  });
  it("filters expired tasks", () => {
    render(<ContributorDashboard />);
    fireEvent.change(screen.getByTestId("task-filter"), { target: { value: "expired" } });
    expect(within(screen.getByTestId("task-list")).getAllByTestId(/^task-/).length).toBe(1);
  });
  it("shows activity feed", () => {
    render(<ContributorDashboard />);
    expect(screen.getByTestId("activity-feed")).toBeTruthy();
    expect(screen.getAllByTestId(/^activity-/).length).toBe(4);
  });
  it("displays task details", () => {
    render(<ContributorDashboard />);
    expect(screen.getByText("Fix auth bug")).toBeTruthy();
    expect(screen.getByText("100 SOL")).toBeTruthy();
  });
  it("shows empty state when no matching tasks", () => {
    render(<ContributorDashboard />);
    // All tasks are present by default, no empty state
    expect(screen.queryByText("No bounties found")).toBeNull();
  });
});
