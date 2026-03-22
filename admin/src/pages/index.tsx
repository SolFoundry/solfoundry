/**
 * Admin Overview Page
 * Displays: pending bounties, active contributors, treasury balance, open disputes
 */

import React, { useEffect, useState } from 'react';
import { getAdminStats, type AdminStats, type TreasuryStats } from '../api/index.js';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtFND(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  alert?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, sub, accent = '#6366f1', alert = false }) => (
  <div style={{
    background: '#1e293b',
    borderRadius: 12,
    padding: '20px 24px',
    flex: '1 1 180px',
    minWidth: 160,
    borderLeft: `3px solid ${alert ? '#ef4444' : accent}`,
    position: 'relative',
  }}>
    {alert && (
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: '#ef4444', borderRadius: '50%', width: 8, height: 8,
      }} />
    )}
    <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: alert ? '#ef4444' : '#f1f5f9' }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{sub}</div>}
  </div>
);

interface TreasuryCardProps { treasury: TreasuryStats }

const TreasuryCard: React.FC<TreasuryCardProps> = ({ treasury: t }) => (
  <div style={{ background: '#1e293b', borderRadius: 12, padding: '24px', marginTop: 24 }}>
    <h2 style={{ margin: '0 0 16px', fontSize: 16, color: '#e2e8f0' }}>💰 Treasury</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
      {[
        { label: 'Total Balance',    value: `${fmtFND(t.totalBalance)} ${t.rewardToken}`,    color: '#f59e0b' },
        { label: 'Pending Payouts',  value: `${fmtFND(t.pendingPayouts)} ${t.rewardToken}`,  color: '#f97316' },
        { label: 'Locked in Escrow', value: `${fmtFND(t.lockedInEscrow)} ${t.rewardToken}`,  color: '#06b6d4' },
        { label: 'Total Paid Out',   value: `${fmtFND(t.paidOut)} ${t.rewardToken}`,         color: '#22c55e' },
      ].map((item) => (
        <div key={item.label}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{item.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>
      Last updated: {new Date(t.lastUpdatedAt).toLocaleString()}
    </div>
  </div>
);

// ── Overview Page ──────────────────────────────────────────────────────────────

export const OverviewPage: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: 40, color: '#94a3b8', textAlign: 'center' }}>Loading…</div>;
  }
  if (error || !stats) {
    return <div style={{ padding: 40, color: '#ef4444', textAlign: 'center' }}>Error: {error}</div>;
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, color: '#f1f5f9' }}>📊 Platform Overview</h1>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <StatCard icon="🏆" label="Active Bounties"     value={stats.activeBounties}     accent="#6366f1" />
        <StatCard icon="⏳" label="Pending Bounties"    value={stats.pendingBounties}    accent="#f59e0b" />
        <StatCard icon="✅" label="Completed Bounties"  value={stats.completedBounties}  accent="#22c55e" />
        <StatCard icon="👥" label="Active Contributors" value={stats.activeContributors} accent="#06b6d4" />
        <StatCard
          icon="📬"
          label="Pending Submissions"
          value={stats.pendingSubmissions}
          accent="#f97316"
          alert={stats.pendingSubmissions > 10}
        />
        <StatCard
          icon="⚖️"
          label="Open Disputes"
          value={stats.openDisputes}
          accent="#ef4444"
          alert={stats.openDisputes > 0}
          sub={stats.openDisputes > 0 ? 'Requires attention' : undefined}
        />
      </div>

      {/* Treasury */}
      <TreasuryCard treasury={stats.treasury} />

      {/* Quick actions */}
      <div style={{ marginTop: 24, background: '#1e293b', borderRadius: 12, padding: '20px 24px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, color: '#e2e8f0' }}>⚡ Quick Actions</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Create Bounty',         href: '/admin/bounties/new',                color: '#6366f1' },
            { label: 'Review Submissions',    href: '/admin/submissions',                 color: '#f59e0b' },
            { label: 'Manage Disputes',       href: '/admin/disputes',                    color: '#ef4444' },
            { label: 'View Leaderboard',      href: '/admin/contributors',                color: '#22c55e' },
          ].map((a) => (
            <a
              key={a.label}
              href={a.href}
              style={{
                display: 'inline-block',
                padding: '8px 18px',
                background: `${a.color}22`,
                color: a.color,
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
                border: `1px solid ${a.color}44`,
              }}
            >
              {a.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
