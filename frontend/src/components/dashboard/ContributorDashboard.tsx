// Contributor Dashboard (Closes #26)
import React, { useState, useMemo } from "react";

export interface BountyTask { id: string; title: string; status: "active" | "completed" | "expired"; reward: number; deadline: string; tier: number; }
export interface Activity { id: string; type: "claim" | "submit" | "payout" | "review"; message: string; timestamp: string; }
export interface DashboardData {
  username: string; reputation: number; totalEarnings: number; activeBounties: number; completedBounties: number;
  tasks: BountyTask[]; activities: Activity[];
}

const MOCK: DashboardData = {
  username: "alice", reputation: 42, totalEarnings: 1250.5, activeBounties: 2, completedBounties: 15,
  tasks: [
    {id: "1", title: "Fix auth bug", status: "active", reward: 100, deadline: "2026-04-01", tier: 2},
    {id: "2", title: "Add tests", status: "active", reward: 50, deadline: "2026-04-15", tier: 1},
    {id: "3", title: "Update docs", status: "completed", reward: 30, deadline: "2026-03-01", tier: 1},
    {id: "4", title: "Security audit", status: "completed", reward: 500, deadline: "2026-02-15", tier: 3},
    {id: "5", title: "Performance fix", status: "expired", reward: 200, deadline: "2026-01-01", tier: 2},
  ],
  activities: [
    {id: "a1", type: "claim", message: "Claimed bounty: Fix auth bug", timestamp: "2026-03-19T10:00:00Z"},
    {id: "a2", type: "submit", message: "Submitted PR for Add tests", timestamp: "2026-03-18T14:30:00Z"},
    {id: "a3", type: "payout", message: "Received 500 SOL for Security audit", timestamp: "2026-03-17T09:00:00Z"},
    {id: "a4", type: "review", message: "PR approved: Update docs", timestamp: "2026-03-16T11:00:00Z"},
  ],
};

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return <div className={`p-4 rounded-lg ${color}`}><p className="text-sm opacity-75">{label}</p><p className="text-2xl font-bold">{value}</p></div>;
}

export default function ContributorDashboard() {
  const [data] = useState<DashboardData>(MOCK);
  const [taskFilter, setTaskFilter] = useState<"all" | "active" | "completed" | "expired">("all");

  const filteredTasks = useMemo(() =>
    taskFilter === "all" ? data.tasks : data.tasks.filter(t => t.status === taskFilter),
  [data.tasks, taskFilter]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-500 mb-6">Welcome back, {data.username}!</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="stats-grid">
        <StatCard label="Reputation" value={data.reputation} color="bg-purple-50 text-purple-900" />
        <StatCard label="Total Earnings" value={`${data.totalEarnings} SOL`} color="bg-green-50 text-green-900" />
        <StatCard label="Active Bounties" value={data.activeBounties} color="bg-blue-50 text-blue-900" />
        <StatCard label="Completed" value={data.completedBounties} color="bg-amber-50 text-amber-900" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">My Bounties</h2>
            <select value={taskFilter} onChange={e => setTaskFilter(e.target.value as any)} className="border rounded px-2 py-1" data-testid="task-filter">
              <option value="all">All</option><option value="active">Active</option>
              <option value="completed">Completed</option><option value="expired">Expired</option>
            </select>
          </div>
          <div className="space-y-3" data-testid="task-list">
            {filteredTasks.length === 0 && <p className="text-gray-400">No bounties found</p>}
            {filteredTasks.map(t => (
              <div key={t.id} className="border rounded-lg p-3 flex justify-between items-center" data-testid={`task-${t.id}`}>
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-gray-500">T{t.tier} - Deadline: {t.deadline}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{t.reward} SOL</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${t.status === "active" ? "bg-blue-100 text-blue-800" : t.status === "completed" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3" data-testid="activity-feed">
            {data.activities.map(a => (
              <div key={a.id} className="border-l-4 border-indigo-400 pl-3 py-1" data-testid={`activity-${a.id}`}>
                <p className="text-sm">{a.message}</p>
                <p className="text-xs text-gray-400">{new Date(a.timestamp).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
