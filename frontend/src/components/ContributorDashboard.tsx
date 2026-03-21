'use client';

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';

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

interface DashboardStats {
  totalEarned: number;
  activeBounties: number;
  pendingPayouts: number;
  reputationRank: number;
  totalContributors: number;
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
// Data Fetcher — Real API with empty-state fallback
// ============================================================================

interface DashboardData {
  stats: DashboardStats;
  bounties: Bounty[];
  activities: Activity[];
  notifications: Notification[];
  earnings: EarningsData[];
  linkedAccounts: { type: string; username: string; connected: boolean }[];
}
const EMPTY_STATS: DashboardStats = { totalEarned: 0, activeBounties: 0, pendingPayouts: 0, reputationRank: 0, totalContributors: 0 };
/** Fetch endpoint, logging errors instead of swallowing. */
async function safeFetch<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T | null> {
  try { return await apiClient<T>(endpoint, { params, retries: 0 }); }
  catch (error) { console.warn(`[Dashboard] ${endpoint} failed:`, error); return null; }
}
/** Fetch user-specific dashboard data from real API endpoints. */
async function fetchDashboardData(userId: string | undefined): Promise<DashboardData> {
  const data: DashboardData = { stats: { ...EMPTY_STATS }, bounties: [], activities: [], notifications: [], earnings: [], linkedAccounts: [] };
  const encodedId = userId ? encodeURIComponent(userId) : '';
  const [bountiesRaw, notificationsRaw, leaderboardRaw] = await Promise.all([
    safeFetch<{ items?: unknown[] }>('/api/bounties', { limit: 10, ...(userId ? { assignee: encodedId } : {}) }),
    safeFetch<{ items?: unknown[] }>('/api/notifications', { limit: 10 }),
    safeFetch<unknown[]>('/api/leaderboard', { range: 'all', limit: 50 }),
  ]);
  if (bountiesRaw) {
    const items = (Array.isArray(bountiesRaw) ? bountiesRaw : (bountiesRaw.items ?? [])) as Record<string, unknown>[];
    data.bounties = items.map(entry => ({
      id: String(entry.id ?? ''), title: String(entry.title ?? ''),
      reward: Number(entry.reward_amount ?? entry.reward ?? 0), deadline: String(entry.deadline ?? ''),
      status: String(entry.status ?? 'claimed') as Bounty['status'], progress: Number(entry.progress ?? 0),
    }));
  }
  if (notificationsRaw) {
    const items = (Array.isArray(notificationsRaw) ? notificationsRaw : (notificationsRaw.items ?? [])) as Record<string, unknown>[];
    data.notifications = items.map(entry => ({
      id: String(entry.id ?? ''), type: String(entry.type ?? 'info') as Notification['type'],
      title: String(entry.title ?? ''), message: String(entry.message ?? ''),
      timestamp: String(entry.created_at ?? entry.timestamp ?? ''), read: Boolean(entry.read ?? false),
    }));
  }
  if (Array.isArray(leaderboardRaw)) {
    data.stats.totalContributors = leaderboardRaw.length;
    const currentUser = (leaderboardRaw as Record<string, unknown>[]).find(
      entry => String(entry.username ?? '').toLowerCase() === (userId ?? '').toLowerCase()
    );
    if (currentUser) {
      data.stats.totalEarned = Number(currentUser.earningsFndry ?? 0);
      data.stats.reputationRank = Number(currentUser.rank ?? 0);
    }
  }
  data.stats.activeBounties = data.bounties.length;
  return data;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}K`;
  }
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
  // Parse deadline in local timezone to match user's perspective
  const [year, month, day] = deadline.split('-').map(Number);
  const deadlineDate = new Date(year, month - 1, day, 23, 59, 59);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  // Return 0 for past deadlines, actual days for future
  return Math.max(0, daysRemaining);
}

function isDeadlineUrgent(daysRemaining: number): boolean {
  return daysRemaining > 0 && daysRemaining <= 2;
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

function getActivityIcon(type: Activity['type']): React.ReactNode {
  switch (type) {
    case 'payout':
      return (
        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
        </svg>
      );
    case 'pr_submitted':
      return (
        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      );
    case 'review_received':
      return (
        <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      );
    case 'bounty_claimed':
      return (
        <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'bounty_completed':
      return (
        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

function getNotificationIcon(type: Notification['type']): React.ReactNode {
  switch (type) {
    case 'success':
      return <div className="w-2 h-2 rounded-full bg-green-400" />;
    case 'warning':
      return <div className="w-2 h-2 rounded-full bg-yellow-400" />;
    case 'error':
      return <div className="w-2 h-2 rounded-full bg-red-400" />;
    default:
      return <div className="w-2 h-2 rounded-full bg-blue-400" />;
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
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

function SummaryCard({ label, value, suffix, icon, trend, trendValue }: SummaryCardProps) {
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
        <div className={`mt-2 text-xs flex items-center gap-1 ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
          {trend === 'up' && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>}
          {trend === 'down' && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>}
          {trendValue}
        </div>
      )}
    </div>
  );
}

interface BountyCardProps {
  bounty: Bounty;
}

function BountyCard({ bounty }: BountyCardProps) {
  const daysRemaining = getDaysRemaining(bounty.deadline);
  const isUrgent = isDeadlineUrgent(daysRemaining);
  
  return (
    <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/5 hover:border-[#9945FF]/30 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium truncate">{bounty.title}</h3>
          <p className="text-sm text-gray-400 mt-1">
            <span className={`font-medium ${getStatusColor(bounty.status)}`}>
              {formatStatus(bounty.status)}
            </span>
            {' • '}
            <span className={isUrgent ? 'text-red-400' : ''}>
              {daysRemaining} days left
            </span>
          </p>
        </div>
        <div className="text-right ml-4">
          <span className="text-[#14F195] font-bold">{formatNumber(bounty.reward)}</span>
          <span className="text-gray-400 text-sm ml-1">$FNDRY</span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Progress</span>
          <span>{bounty.progress}%</span>
        </div>
        <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#9945FF] to-[#14F195] transition-all duration-300"
            style={{ width: `${bounty.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface ActivityItemProps {
  activity: Activity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="flex-shrink-0 mt-0.5">
        {getActivityIcon(activity.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{activity.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{activity.description}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        {activity.amount && (
          <p className="text-sm text-[#14F195] font-medium">+{formatNumber(activity.amount)}</p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">{formatRelativeTime(activity.timestamp)}</p>
      </div>
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}

function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  return (
    <div 
      className={`flex items-start gap-3 py-3 px-2 rounded-lg transition-colors cursor-pointer
                  ${notification.read ? 'opacity-60' : 'bg-white/5 hover:bg-white/10'}`}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!notification.read) onMarkAsRead(notification.id);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${notification.title}: ${notification.message}. ${notification.read ? 'Read' : 'Unread - click to mark as read'}`}
      aria-pressed={notification.read}
    >
      <div className="flex-shrink-0 mt-1.5" aria-hidden="true">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{notification.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{notification.message}</p>
      </div>
      <span className="text-xs text-gray-500" aria-label={formatRelativeTime(notification.timestamp)}>
        {formatRelativeTime(notification.timestamp)}
      </span>
    </div>
  );
}

// Simple Line Chart Component
interface SimpleLineChartProps {
  data: EarningsData[];
}

function SimpleLineChart({ data }: SimpleLineChartProps) {
  // Handle empty or insufficient data
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Earnings (Last 30 Days)</h3>
          <span className="text-gray-400 text-lg">0 $FNDRY</span>
        </div>
        <div className="h-[120px] flex items-center justify-center text-gray-400">
          No earnings data available
        </div>
      </div>
    );
  }

  // For single data point, show a simple display
  if (data.length === 1) {
    return (
      <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Earnings (Last 30 Days)</h3>
          <span className="text-[#14F195] text-lg font-bold">{formatNumber(data[0].amount)} $FNDRY</span>
        </div>
        <div className="h-[120px] flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-[#14F195]" />
        </div>
      </div>
    );
  }

  const maxAmount = Math.max(...data.map(d => d.amount), 1);
  const chartHeight = 120;
  const chartWidth = 300;
  const padding = 20;
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - (d.amount / maxAmount) * (chartHeight - 2 * padding);
    return { x, y, amount: d.amount, date: d.date };
  });
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding} L ${padding} ${chartHeight - padding} Z`;

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">Earnings (Last 30 Days)</h3>
        <span className="text-[#14F195] text-lg font-bold">{formatNumber(data[data.length - 1].amount)} $FNDRY</span>
      </div>
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
        {/* Grid lines */}
        <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#333" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke="#333" strokeWidth="1" />
        
        {/* Area fill */}
        <path d={areaD} fill="url(#gradient)" opacity="0.3" />
        
        {/* Line */}
        <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Points */}
        {points.map((p, i) => (
          <circle 
            key={i} 
            cx={p.x} 
            cy={p.y} 
            r="4" 
            fill="#14F195" 
            stroke="#0a0a0a" 
            strokeWidth="2"
            className="hover:scale-125 transition-transform cursor-pointer"
          >
            <title>{`${formatNumber(p.amount)} $FNDRY - ${p.date}`}</title>
          </circle>
        ))}
        
        {/* Gradient definitions */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#14F195" />
            <stop offset="100%" stopColor="#9945FF" />
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9945FF" />
            <stop offset="100%" stopColor="#14F195" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Quick Actions Component
interface QuickActionsProps {
  onBrowseBounties?: () => void;
  onViewLeaderboard?: () => void;
  onCheckTreasury?: () => void;
}

function QuickActions({ onBrowseBounties, onViewLeaderboard, onCheckTreasury }: QuickActionsProps) {
  const actions = [
    { label: 'Browse Bounties', icon: '🔍', onClick: onBrowseBounties, color: 'from-[#9945FF] to-[#9945FF]' },
    { label: 'View Leaderboard', icon: '🏆', onClick: onViewLeaderboard, color: 'from-[#14F195] to-[#14F195]' },
    { label: 'Check Treasury', icon: '💰', onClick: onCheckTreasury, color: 'from-yellow-500 to-yellow-500' },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r ${action.color} text-white text-sm font-medium hover:opacity-90 transition-opacity`}
        >
          <span>{action.icon}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}

// Settings Section Component
interface SettingsSectionProps {
  linkedAccounts: { type: string; username: string; connected: boolean }[];
  notificationPreferences: { type: string; enabled: boolean }[];
  walletAddress?: string;
  onToggleNotification: (type: string) => void;
  onConnectAccount?: (accountType: string) => void;
  onDisconnectAccount?: (accountType: string) => void;
}

function SettingsSection({ 
  linkedAccounts, 
  notificationPreferences, 
  walletAddress, 
  onToggleNotification,
  onConnectAccount,
  onDisconnectAccount 
}: SettingsSectionProps) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
      <h3 className="text-white font-medium mb-4">Settings</h3>
      
      {/* Linked Accounts */}
      <div className="mb-6">
        <h4 className="text-sm text-gray-400 mb-3">Linked Accounts</h4>
        <div className="space-y-2">
          {linkedAccounts.map((account) => (
            <div key={account.type} className="flex items-center justify-between py-2 px-3 bg-[#0a0a0a] rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-lg">{account.type === 'github' ? '🐙' : account.type === 'twitter' ? '🐦' : '🔐'}</span>
                <div>
                  <p className="text-sm text-white">{account.type.charAt(0).toUpperCase() + account.type.slice(1)}</p>
                  <p className="text-xs text-gray-400">{account.connected ? account.username : 'Not connected'}</p>
                </div>
              </div>
              <button 
                onClick={() => account.connected 
                  ? onDisconnectAccount?.(account.type) 
                  : onConnectAccount?.(account.type)
                }
                aria-label={account.connected ? `Disconnect ${account.type}` : `Connect ${account.type}`}
                aria-pressed={account.connected}
                className={`text-xs px-3 py-1 rounded transition-colors ${
                  account.connected 
                    ? 'text-gray-400 bg-gray-700 hover:bg-gray-600' 
                    : 'text-[#14F195] bg-[#14F195]/10 hover:bg-[#14F195]/20'
                }`}
              >
                {account.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Notification Preferences */}
      <div>
        <h4 className="text-sm text-gray-400 mb-3">Notifications</h4>
        <div className="space-y-2">
          {notificationPreferences.map((pref) => (
            <div key={pref.type} className="flex items-center justify-between py-2 px-3 bg-[#0a0a0a] rounded-lg">
              <span className="text-sm text-white">{pref.type}</span>
              <button 
                onClick={() => onToggleNotification(pref.type)}
                aria-label={`Toggle ${pref.type} notifications`}
                aria-checked={pref.enabled}
                role="switch"
                className={`w-10 h-5 rounded-full transition-colors ${pref.enabled ? 'bg-[#14F195]' : 'bg-gray-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${pref.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Wallet */}
      {walletAddress && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <h4 className="text-sm text-gray-400 mb-3">Wallet</h4>
          <div className="py-2 px-3 bg-[#0a0a0a] rounded-lg">
            <p className="text-xs text-gray-400">Connected Wallet</p>
            <p className="text-sm text-[#14F195] font-mono mt-1">
              {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContributorDashboard({
  userId,
  walletAddress,
  onBrowseBounties,
  onViewLeaderboard,
  onCheckTreasury,
  onConnectAccount,
  onDisconnectAccount,
}: ContributorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'notifications' | 'settings'>('overview');

  // React Query handles fetching, caching, and retry for dashboard data
  const { data: dashboardData, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => fetchDashboardData(userId),
    staleTime: 30_000,
  });

  const stats = dashboardData?.stats ?? null;
  const bounties = dashboardData?.bounties ?? [];
  const activities = dashboardData?.activities ?? [];
  const rawNotifications = dashboardData?.notifications ?? [];
  const earnings = dashboardData?.earnings ?? [];
  const linkedAccounts = dashboardData?.linkedAccounts?.length
    ? dashboardData.linkedAccounts
    : [
        { type: 'github', username: userId ?? walletAddress ?? '', connected: Boolean(userId || walletAddress) },
        { type: 'twitter', username: '', connected: false },
      ];
  const error = isError ? (queryError instanceof Error ? queryError.message : 'Failed to load dashboard data') : null;

  // Local read-state overlay for notifications (mark-as-read without mutating query cache)
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const notifications = rawNotifications.map(notification => readIds.has(notification.id) ? { ...notification, read: true } : notification);
  const unreadNotifications = notifications.filter(notification => !notification.read).length;

  const [notificationPrefs, setNotificationPrefs] = useState([
    { type: 'Payout Alerts', enabled: true },
    { type: 'Review Updates', enabled: true },
    { type: 'Deadline Reminders', enabled: true },
    { type: 'New Bounties', enabled: false },
  ]);

  const handleMarkAsRead = useCallback((id: string) => {
    setReadIds(prev => new Set(prev).add(id));
  }, []);

  const handleMarkAllAsRead = useCallback(() => {
    setReadIds(new Set(rawNotifications.map(notification => notification.id)));
  }, [rawNotifications]);

  const handleToggleNotification = useCallback((type: string) => {
    setNotificationPrefs(prev => prev.map(pref => pref.type === type ? { ...pref, enabled: !pref.enabled } : pref));
  }, []);

  const handleRetry = useCallback(() => { refetch(); }, [refetch]);

  // Loading state UI
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Contributor Dashboard</h1>
            <p className="text-gray-400">Track your progress, earnings, and active work</p>
          </div>
          <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-[#9945FF] border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400">Loading dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state UI
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Contributor Dashboard</h1>
            <p className="text-gray-400">Track your progress, earnings, and active work</p>
          </div>
          <div className="flex items-center justify-center py-20" role="alert" aria-live="assertive">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Failed to Load Dashboard</h2>
                <p className="text-gray-400 mb-4">{error}</p>
                <button 
                  onClick={handleRetry}
                  className="px-4 py-2 bg-[#9945FF] text-white rounded-lg hover:bg-[#9945FF]/80 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Contributor Dashboard</h1>
          <p className="text-gray-400">Track your progress, earnings, and active work</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-[#1a1a1a] rounded-lg p-1 w-fit">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'notifications', label: 'Notifications', badge: unreadNotifications },
            { id: 'settings', label: 'Settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative
                ${activeTab === tab.id 
                  ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs bg-red-500 text-white rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                label="Total Earned"
                value={formatNumber(stats.totalEarned)}
                suffix="$FNDRY"
                trend="up"
                trendValue="+15% this month"
                icon={
                  <svg className="w-5 h-5 text-[#14F195]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                }
              />
              <SummaryCard
                label="Active Bounties"
                value={stats.activeBounties}
                icon={
                  <svg className="w-5 h-5 text-[#9945FF]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                  </svg>
                }
              />
              <SummaryCard
                label="Pending Payouts"
                value={formatNumber(stats.pendingPayouts)}
                suffix="$FNDRY"
                icon={
                  <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <SummaryCard
                label="Reputation Rank"
                value={`#${stats.reputationRank}`}
                suffix={`of ${stats.totalContributors}`}
                trend="up"
                trendValue="Top 20%"
                icon={
                  <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                  </svg>
                }
              />
            </div>

            {/* Quick Actions */}
            <QuickActions
              onBrowseBounties={onBrowseBounties}
              onViewLeaderboard={onViewLeaderboard}
              onCheckTreasury={onCheckTreasury}
            />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Active Bounties */}
                <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-medium">Active Bounties</h3>
                    <span className="text-xs text-gray-400">{bounties.length} active</span>
                  </div>
                  {bounties.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No active bounties</p>
                  ) : (
                    <div className="space-y-3">
                      {bounties.map((bounty) => (
                        <BountyCard key={bounty.id} bounty={bounty} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Earnings Chart */}
                <SimpleLineChart data={earnings} />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Recent Activity */}
                <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-medium">Recent Activity</h3>
                    <button className="text-xs text-[#14F195] hover:text-[#14F195]/80">View All</button>
                  </div>
                  {activities.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No recent activity</p>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {activities.map((activity) => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Notifications</h3>
              {unreadNotifications > 0 && (
                <button 
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-[#14F195] hover:text-[#14F195]/80"
                >
                  Mark all as read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No notifications</p>
            ) : (
              <div className="space-y-1">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id} 
                    notification={notification} 
                    onMarkAsRead={handleMarkAsRead}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <SettingsSection
            linkedAccounts={linkedAccounts}
            notificationPreferences={notificationPrefs}
            walletAddress={walletAddress}
            onToggleNotification={handleToggleNotification}
            onConnectAccount={onConnectAccount}
            onDisconnectAccount={onDisconnectAccount}
          />
        )}
      </div>
    </div>
  );
}

export default ContributorDashboard;