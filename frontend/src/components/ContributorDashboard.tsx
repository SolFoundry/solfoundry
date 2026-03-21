'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { 
  Trophy, 
  Wallet, 
  Clock, 
  Hammer, 
  Plus, 
  BarChart3, 
  Bell, 
  Settings as SettingsIcon,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';

import { useContributorDashboard } from '../hooks/useContributor';
import { Skeleton, SkeletonCard, SkeletonActivityFeed } from './common/Skeleton';
import { SimpleLineChart } from './common/SimpleLineChart';
import { ErrorBoundary } from './common/ErrorBoundary';
import { 
  DashboardData, 
  Bounty, 
  DashboardActivity, 
  DashboardNotification,
  DashboardLinkedAccount
} from '../types/api';

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
}

function formatRelativeTime(timestamp: string): string {
  try {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recent';
  }
}

function getDaysRemaining(deadline?: string): number {
  if (!deadline) return 0;
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'claimed': return 'text-yellow-400';
    case 'in_progress': return 'text-blue-400';
    case 'submitted': return 'text-purple-400';
    case 'reviewing': return 'text-orange-400';
    default: return 'text-gray-400';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SummaryCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  trendValue?: string;
}

function SummaryCard({ label, value, suffix, icon, trend, trendValue }: SummaryCardProps) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-gray-400 text-sm font-medium">{label}</span>
        <div className="w-10 h-10 rounded-lg bg-[#14F195]/10 flex items-center justify-center text-[#14F195]">
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
        {suffix && <span className="text-sm text-gray-400 mb-1 font-medium">{suffix}</span>}
      </div>
      {trend && trendValue && (
        <div className={`mt-2 text-xs flex items-center gap-1 font-medium ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
           {trend === 'up' ? '↑' : '↓'} {trendValue} vs last week
        </div>
      )}
    </div>
  );
}

function BountyCard({ bounty }: { bounty: Bounty }) {
  const daysRemaining = getDaysRemaining(bounty.deadline);
  return (
    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/5 hover:border-[#9945FF]/30 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate group-hover:text-[#9945FF] transition-colors">{bounty.title}</h3>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
            <span className={`font-bold px-1.5 py-0.5 bg-black/40 rounded ${getStatusColor(bounty.status)}`}>
                {(bounty.status || 'OPEN').toUpperCase()}
            </span>
            <span className="flex items-center gap-1"><Clock size={12} /> {daysRemaining} days left</span>
          </p>
        </div>
        <div className="text-right ml-4">
          <span className="text-[#14F195] font-black text-lg">{formatNumber(bounty.reward_amount || 0)}</span>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">$FNDRY</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">
            <span>PROGRESS</span>
            <span>{bounty.progress || 0}%</span>
        </div>
        <div className="h-1.5 bg-[#0a0a0a] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#9945FF] to-[#14F195] transition-all duration-500" 
            style={{ width: `${bounty.progress || 0}%` }} 
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface ContributorDashboardProps {
  userId?: string;
  walletAddress?: string;
  onBrowseBounties?: () => void;
  onViewLeaderboard?: () => void;
  onCheckTreasury?: () => void;
  onConnectAccount?: (accountType: string) => void;
  onDisconnectAccount?: (accountType: string) => void;
}

export function ContributorDashboard(props: ContributorDashboardProps) {
  const {
    walletAddress,
    onBrowseBounties,
    onViewLeaderboard,
    onCheckTreasury,
    onConnectAccount,
    onDisconnectAccount,
  } = props;
  const [activeTab, setActiveTab] = useState<'overview' | 'notifications' | 'settings'>('overview');
  const { data, isLoading, error, refetch } = useContributorDashboard();
  
  const [notificationPrefs, setNotificationPrefs] = useState([
    { type: 'Payout Alerts', enabled: true },
    { type: 'Review Updates', enabled: true },
    { type: 'Deadline Reminders', enabled: true },
    { type: 'New Bounties', enabled: false },
  ]);

  const dashboardData = data as DashboardData;

  const earningsChartData = useMemo(() => {
    if (!dashboardData?.earnings) return [];
    return dashboardData.earnings.map(e => ({
      label: new Date(e.date).toLocaleDateString(undefined, { weekday: 'short' }),
      value: e.amount
    }));
  }, [dashboardData?.earnings]);

  const unreadNotifications = useMemo(() => {
    return dashboardData?.notifications?.filter(n => !n.read).length || 0;
  }, [dashboardData?.notifications]);

  const handleMarkAsRead = useCallback((id: string) => {
    // In a real app, fire API call
    console.log('Marking notification as read:', id);
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    console.log('Marking all notifications as read');
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8" role="status" aria-label="Loading dashboard...">
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

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-white text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
           <Zap size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2">Sync Failed</h2>
        <p className="text-gray-400 mb-6 max-w-sm">We couldn't retrieve your latest dashboard data from the neural net. Check your uplink.</p>
        <button 
          onClick={() => refetch()} 
          className="px-6 py-2 bg-gradient-to-r from-solana-purple to-solana-green rounded-lg font-bold hover:scale-105 transition-transform"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary onReset={refetch}>
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">Contributor Dashboard</h1>
              <p className="text-gray-400 font-medium">Elevate your rank through high-impact contributions.</p>
            </div>
            {walletAddress && (
              <div className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-white/5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <code className="text-xs text-gray-300 font-mono">
                  {walletAddress.slice(0, 8)}...{walletAddress.slice(-4)}
                </code>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mb-8 bg-[#1a1a1a] rounded-xl p-1 w-full sm:w-fit border border-white/5 shadow-inner" role="tablist">
            {(['overview', 'notifications', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`tab-panel-${tab}`}
                id={`tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all relative ${
                  activeTab === tab 
                    ? 'bg-gradient-to-br from-[#9945FF] to-[#14F195] text-white shadow-lg' 
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                <span className="flex items-center justify-center gap-2 capitalize">
                  {tab === 'overview' && <BarChart3 size={16} />}
                  {tab === 'notifications' && <Bell size={16} />}
                  {tab === 'settings' && <SettingsIcon size={16} />}
                  {tab}
                </span>
                {tab === 'notifications' && unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black border-2 border-[#0a0a0a]">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div id={`tab-panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="outline-none">
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <SummaryCard 
                    label="Total Earned" 
                    value={formatNumber(dashboardData.stats.totalEarned)} 
                    suffix="$FNDRY" 
                    icon={<Wallet size={20} />}
                    trend="up"
                    trendValue="12.5%"
                  />
                  <SummaryCard 
                    label="Active Bounties" 
                    value={dashboardData.stats.activeBounties} 
                    icon={<Hammer size={20} />} 
                  />
                  <SummaryCard 
                    label="Pending Payouts" 
                    value={formatNumber(dashboardData.stats.pendingPayouts)} 
                    suffix="$FNDRY" 
                    icon={<Clock size={20} />} 
                  />
                  <SummaryCard 
                    label="Reputation Rank" 
                    value={`#${dashboardData.stats.reputationRank}`} 
                    suffix={`of ${dashboardData.stats.totalContributors}`} 
                    icon={<Trophy size={20} />} 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-nowrap gap-3">
                      <button onClick={onBrowseBounties} className="flex-1 sm:flex-none px-6 py-3 bg-[#9945FF] hover:bg-[#8033E6] rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg group">
                        <Plus size={18} className="group-hover:rotate-90 transition-transform" /> Browse Bounties
                      </button>
                      <button onClick={onViewLeaderboard} className="flex-1 sm:flex-none px-6 py-3 bg-[#14F195] hover:bg-[#10D684] text-black rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg">
                        <Trophy size={18} /> Leaderboard
                      </button>
                      <button onClick={onCheckTreasury} className="col-span-2 sm:flex-none px-6 py-3 bg-[#1a1a1a] border border-white/5 hover:border-white/20 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md">
                        <ShieldCheck size={18} /> Treasury
                      </button>
                    </div>

                    {/* Earnings Chart Card */}
                    <div className="bg-[#1a1a1a]/50 border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <BarChart3 size={20} className="text-[#14F195]" /> 
                          Earnings Velocity
                        </h3>
                        <span className="text-xs text-gray-500 font-bold tracking-widest uppercase">Last 14 Days</span>
                      </div>
                      <SimpleLineChart 
                         data={earningsChartData} 
                         height={200} 
                         color="#14F195" 
                      />
                    </div>
                    
                    {/* Active BountiesSection */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold">Active Bounties</h3>
                        <button onClick={onBrowseBounties} className="text-xs text-[#9945FF] hover:underline font-bold">View all</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dashboardData.bounties.map((b) => <BountyCard key={b.id} bounty={b} />)}
                        {dashboardData.bounties.length === 0 && (
                          <div className="col-span-full py-12 text-center border-2 border-dashed border-white/5 rounded-2xl">
                             <p className="text-gray-500 italic mb-4">No active missions detected.</p>
                             <button onClick={onBrowseBounties} className="text-[#14F195] font-bold text-sm">Initiate first bounty →</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Activity Sidebar */}
                  <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5 h-fit shadow-2xl">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                       <Zap size={20} className="text-solana-purple" />
                       Recent Activity
                    </h3>
                    <div className="space-y-6">
                      {dashboardData.activities.map((a) => (
                        <div key={a.id} className="flex gap-4 group transition-transform hover:translate-x-1">
                          <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-black/40 border border-white/5 text-xs ${a.type === 'payout' ? 'text-green-400' : 'text-solana-purple'}`}>
                              {a.type === 'payout' ? '$' : '◈'}
                            </div>
                            <div className="w-px flex-1 bg-white/5 mt-2 min-h-[20px] group-last:hidden" />
                          </div>
                          <div className="flex-1 pb-6 group-last:pb-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-bold text-gray-200">{a.title}</p>
                              {a.amount && <span className="text-xs font-black text-[#14F195]">+{formatNumber(a.amount)}</span>}
                            </div>
                            <p className="text-xs text-gray-500 font-medium mb-1">{a.description}</p>
                            <p className="text-[10px] text-gray-600 font-bold uppercase">{formatRelativeTime(a.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                      {dashboardData.activities.length === 0 && (
                        <div className="text-center py-8">
                           <p className="text-gray-600 text-xs italic">Awaiting neural activity...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500 shadow-2xl">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1f1f1f]/50">
                  <h3 className="font-bold flex items-center gap-2">
                    <Bell size={20} className="text-[#9945FF]" /> 
                    System Notifications
                  </h3>
                  <button 
                    onClick={handleMarkAllAsRead} 
                    className="text-xs text-[#14F195] hover:underline font-bold"
                    disabled={unreadNotifications === 0}
                  >
                    Mark all as read
                  </button>
                </div>
                <div className="divide-y divide-white/5">
                   {dashboardData.notifications.map((n) => (
                     <button 
                        key={n.id} 
                        onClick={() => handleMarkAsRead(n.id)}
                        aria-label={`${n.title} - ${n.read ? 'Read' : 'Unread - click to mark as read'}`}
                        className={`w-full p-6 flex gap-4 transition-colors text-left group hover:bg-white/[0.02] ${n.read ? 'opacity-60' : 'bg-white/[0.04]'}`}
                     >
                        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
                          n.type === 'success' ? 'bg-green-400' : 
                          n.type === 'warning' ? 'bg-yellow-400' : 
                          n.type === 'error' ? 'bg-red-400' : 'bg-[#9945FF]'
                        } ${!n.read && 'animate-pulse'}`} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-bold group-hover:text-white transition-colors">{n.title}</p>
                            <span className="text-[10px] text-gray-600 font-bold uppercase">{formatRelativeTime(n.timestamp)}</span>
                          </div>
                          <p className="text-xs text-gray-400 font-medium leading-relaxed">{n.message}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-700 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                     </button>
                   ))}
                   {dashboardData.notifications.length === 0 && (
                      <div className="p-16 text-center">
                         <Bell size={48} className="mx-auto text-gray-800 mb-4" />
                         <p className="text-gray-500 font-medium">All systems quiet. No new alerts.</p>
                      </div>
                   )}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Linked Accounts */}
                <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5 shadow-xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                       <ExternalLink size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold">Identity Links</h3>
                      <p className="text-xs text-gray-500">Connect your profiles to build reputation.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {dashboardData.linkedAccounts.map((account) => (
                      <div key={account.type} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center font-bold shadow-md ${
                            account.type === 'github' ? 'from-gray-700 to-gray-900' : 
                            account.type === 'solana' ? 'from-solana-purple to-solana-green' : 'from-blue-400 to-blue-600'
                          }`}>
                            {account.type === 'github' ? '🐙' : '◎'}
                          </div>
                          <div>
                             <p className="text-sm font-bold capitalize">{account.type}</p>
                             <p className="text-xs text-gray-500 font-medium">
                               {account.connected ? account.username : 'Disconnected'}
                             </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => account.connected ? onDisconnectAccount?.(account.type) : onConnectAccount?.(account.type)}
                          aria-pressed={account.connected}
                          className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                            account.connected 
                              ? 'text-gray-400 border-white/10 hover:text-white hover:border-white/20' 
                              : 'text-black bg-[#14F195] border-[#14F195] hover:scale-105 active:scale-95'
                          }`}
                        >
                          {account.connected ? 'Unlink' : 'Link Account'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notifications Preferences */}
                <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5 shadow-xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                       <Bell size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold">Neural Alerts</h3>
                      <p className="text-xs text-gray-500">Fine-tune your notification frequency.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {notificationPrefs.map((pref) => (
                      <div key={pref.type} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                        <span className="text-sm font-medium text-gray-300">{pref.type}</span>
                        <button
                          role="switch"
                          aria-checked={pref.enabled}
                          onClick={() => setNotificationPrefs(prev => prev.map(p => p.type === pref.type ? { ...p, enabled: !p.enabled } : p))}
                          className={`w-10 h-5 rounded-full relative transition-colors ${pref.enabled ? 'bg-[#14F195]' : 'bg-gray-700'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${pref.enabled ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security Section (Example) */}
                <div className="bg-[#1a1a1a] rounded-2xl p-8 border border-solana-purple/20 shadow-[0_0_30px_rgba(153,69,255,0.05)] text-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-solana-purple/10 blur-3xl -mr-16 -mt-16 group-hover:bg-solana-purple/20 transition-colors" />
                  <ShieldCheck size={48} className="mx-auto text-solana-purple mb-4" />
                  <h3 className="text-xl font-bold mb-2">Reputation Protected</h3>
                  <p className="text-sm text-gray-400 mb-6">Your contributor profile and reputational tier 3 are verified by a decentralized merit proof.</p>
                  <button className="px-6 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors">
                    Review Trust Score
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}