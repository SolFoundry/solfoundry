/**
 * ContributorDashboard - Main workspace for contributors to track their
 * active work, earnings, and system notifications.
 */
'use client';

import React, { useState, useCallback } from 'react';
import { useContributorDashboard } from '../hooks/useContributor';
import { Skeleton, SkeletonCard, SkeletonActivityFeed } from './common/Skeleton';

// ============================================================================
// Types
// ============================================================================

interface Bounty {
  id: string;
  title: string;
  reward: number;
  deadline: string;
  status: 'claimed' | 'in_progress' | 'submitted' | 'reviewing';
  progress: number;
}

interface Activity {
  id: string;
  type: 'bounty_claimed' | 'pr_submitted' | 'review_received' | 'payout' | 'bounty_completed';
  title: string;
  description: string;
  timestamp: string;
  amount?: number;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface EarningsData {
  date: string;
  amount: number;
}

interface ContributorDashboardProps {
  userId?: string;
  walletAddress?: string;
  onBrowseBounties?: () => void;
  onViewLeaderboard?: () => void;
  onCheckTreasury?: () => void;
  onConnectAccount?: (accountType: string) => void;
  onDisconnectAccount?: (accountType: string) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getDaysRemaining(deadline: string): number {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function getStatusColor(status: Bounty['status']): string {
  switch (status) {
    case 'claimed': return 'text-yellow-400';
    case 'in_progress': return 'text-blue-400';
    case 'submitted': return 'text-purple-400';
    case 'reviewing': return 'text-orange-400';
    default: return 'text-gray-400';
  }
}

function formatStatus(status: Bounty['status']): string {
  return status.replace(/_/g, ' ').toUpperCase();
}

// ============================================================================
// Sub-Components
// ============================================================================

function SummaryCard({ label, value, suffix, icon, trend, trendValue }: any) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm">{label}</span>
        <div className="w-10 h-10 rounded-lg bg-[#14F195]/10 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {suffix && <span className="text-sm text-gray-400 mb-1">{suffix}</span>}
      </div>
      {trend && trendValue && (
        <div className={`mt-2 text-xs flex items-center gap-1 ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
           {trendValue}
        </div>
      )}
    </div>
  );
}

function BountyCard({ bounty }: { bounty: Bounty }) {
  const daysRemaining = getDaysRemaining(bounty.deadline);
  return (
    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/5 hover:border-[#9945FF]/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{bounty.title}</h3>
          <p className="text-sm text-gray-400 mt-1">
            <span className={`font-medium ${getStatusColor(bounty.status)}`}>{formatStatus(bounty.status)}</span>
            {' • '}{daysRemaining} days left
          </p>
        </div>
        <div className="text-right ml-4">
          <span className="text-[#14F195] font-bold">{formatNumber(bounty.reward)}</span>
        </div>
      </div>
      <div className="mt-3">
        <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#9945FF] to-[#14F195]" style={{ width: `${bounty.progress}%` }} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContributorDashboard({
  walletAddress,
  onBrowseBounties,
  onViewLeaderboard,
  onCheckTreasury,
  onConnectAccount,
  onDisconnectAccount,
}: ContributorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'notifications' | 'settings'>('overview');
  const { data, isLoading, error, refetch } = useContributorDashboard();
  
  const [notificationPrefs, setNotificationPrefs] = useState([
    { type: 'Payout Alerts', enabled: true },
    { type: 'Review Updates', enabled: true },
    { type: 'Deadline Reminders', enabled: true },
    { type: 'New Bounties', enabled: false },
  ]);

  const stats = data?.stats;
  const bounties = data?.bounties || [];
  const activities = data?.activities || [];
  const notifications = data?.notifications || [];
  const earnings = data?.earnings || [];
  const linkedAccounts = data?.linkedAccounts || [];

  const unreadNotifications = notifications.filter((n: any) => !n.read).length;

  const handleMarkAsRead = useCallback((id: string) => {
    console.log('Mark as read:', id);
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    console.log('Mark all as read');
  }, []);

  const handleToggleNotification = useCallback((type: string) => {
    setNotificationPrefs(prev => prev.map(p => p.type === type ? { ...p, enabled: !p.enabled } : p));
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
           <Skeleton height="3rem" width="300px" />
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
             <Skeleton height="120px" count={4} />
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                 <Skeleton height="200px" />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SkeletonCard count={2} />
                 </div>
              </div>
              <SkeletonActivityFeed count={5} />
           </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-white">
        <p className="text-red-400 mb-4">Error loading dashboard data.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-solana-purple rounded-lg">Retry</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Contributor Dashboard</h1>
          <p className="text-gray-400">Track your progress, earnings, and active work</p>
        </div>

        <div className="flex gap-1 mb-6 bg-[#1a1a1a] rounded-lg p-1 w-fit">
          {['overview', 'notifications', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'notifications' && unreadNotifications > 0 && (
                <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadNotifications}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <SummaryCard label="Total Earned" value={formatNumber(stats.totalEarned)} suffix="$FNDRY" icon="💰" />
              <SummaryCard label="Active Bounties" value={stats.activeBounties} icon="🛠️" />
              <SummaryCard label="Pending Payouts" value={formatNumber(stats.pendingPayouts)} suffix="$FNDRY" icon="⏳" />
              <SummaryCard label="Reputation Rank" value={`#${stats.reputationRank}`} suffix={`of ${stats.totalContributors}`} icon="🏆" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 space-y-8">
                  <div className="flex flex-wrap gap-3">
                    <button onClick={onBrowseBounties} className="px-4 py-2 bg-[#9945FF] rounded-lg text-sm font-medium">Browse Bounties</button>
                    <button onClick={onViewLeaderboard} className="px-4 py-2 bg-[#14F195] rounded-lg text-sm font-medium text-black">Leaderboard</button>
                    <button onClick={onCheckTreasury} className="px-4 py-2 bg-surface-100 border border-gray-700 rounded-lg text-sm font-medium">Treasury</button>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold mb-4">Active Bounties</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {bounties.map((b: any) => <BountyCard key={b.id} bounty={b} />)}
                      {bounties.length === 0 && <p className="text-gray-500 italic">No active bounties. Go claim some!</p>}
                    </div>
                  </div>
               </div>

               <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 h-fit">
                  <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    {activities.map((a: any) => (
                      <div key={a.id} className="flex gap-3 py-2 border-b border-white/5 last:border-0">
                        <div className="text-xl">{'✨'}</div>
                        <div>
                          <p className="text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-gray-400">{a.description}</p>
                          <p className="text-[10px] text-gray-500 mt-1">{formatRelativeTime(a.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="font-bold">Notifications</h3>
              <button onClick={handleMarkAllAsRead} className="text-xs text-[#14F195] hover:underline">Mark all as read</button>
            </div>
            <div className="divide-y divide-white/5">
               {notifications.map((n: any) => (
                 <div key={n.id} className={`p-4 flex gap-3 ${n.read ? 'opacity-50' : 'bg-white/5'}`} onClick={() => handleMarkAsRead(n.id)}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${n.type === 'success' ? 'bg-green-400' : 'bg-blue-400'}`} />
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-gray-400">{n.message}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{formatRelativeTime(n.timestamp)}</p>
                    </div>
                 </div>
               ))}
               {notifications.length === 0 && <div className="p-8 text-center text-gray-500">No notifications.</div>}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5">
              <h3 className="font-bold mb-4">Linked Accounts</h3>
              <div className="space-y-3">
                {linkedAccounts.map((account: any) => (
                  <div key={account.type} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{account.type === 'github' ? '🐙' : '🐦'}</span>
                      <div>
                         <p className="text-sm font-medium capitalize">{account.type}</p>
                         <p className="text-xs text-gray-400">{account.connected ? account.username : 'Not connected'}</p>
                      </div>
                    </div>
                    <button className="text-xs text-gray-400 hover:text-white underline">
                      {account.connected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {walletAddress && (
              <div className="bg-[#1a1a1a] rounded-xl p-6 border border-white/5">
                <h3 className="font-bold mb-2">Connected Wallet</h3>
                <code className="text-xs text-[#14F195]">{walletAddress}</code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}