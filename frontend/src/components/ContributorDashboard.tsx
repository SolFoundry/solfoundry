import React, { useState, useMemo } from 'react';
import type {
  DashboardData,
  DashboardTab,
  ActiveBounty,
  Activity,
  Notification,
  LinkedAccount,
  NotificationPreferences,
  DailyEarning,
} from '../types/dashboard';
import { DASHBOARD_TABS } from '../types/dashboard';
import { mockDashboardData } from '../data/mockDashboard';

export interface ContributorDashboardProps {
  data?: DashboardData;
  username?: string;
  avatarUrl?: string;
  onNavigate?: (path: string) => void;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onUpdateNotificationPreferences?: (prefs: NotificationPreferences) => void;
  onConnectAccount?: (platform: LinkedAccount['platform']) => void;
  onDisconnectAccount?: (platform: LinkedAccount['platform']) => void;
}

export const ContributorDashboard: React.FC<ContributorDashboardProps> = ({
  data = mockDashboardData,
  username = 'HuiNeng6',
  avatarUrl,
  onNavigate,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onUpdateNotificationPreferences,
  onConnectAccount,
  onDisconnectAccount,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [notifications, setNotifications] = useState<Notification[]>(data.notifications);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const handleMarkRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    onMarkNotificationRead?.(id);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    onMarkAllNotificationsRead?.();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      <DashboardHeader username={username} avatarUrl={avatarUrl} summary={data.summary} />
      <TabNavigation tabs={DASHBOARD_TABS} activeTab={activeTab} onTabChange={setActiveTab} unreadCount={unreadCount} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && <OverviewTab data={data} onNavigate={onNavigate} />}
        {activeTab === 'bounties' && <BountiesTab bounties={data.activeBounties} onNavigate={onNavigate} />}
        {activeTab === 'earnings' && <EarningsTab earnings={data.earnings} />}
        {activeTab === 'activity' && <ActivityTab activities={data.recentActivity} />}
        {activeTab === 'notifications' && (
          <NotificationsTab notifications={notifications} onMarkRead={handleMarkRead} onMarkAllRead={handleMarkAllRead} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            settings={data.settings}
            onUpdateNotificationPreferences={onUpdateNotificationPreferences}
            onConnectAccount={onConnectAccount}
            onDisconnectAccount={onDisconnectAccount}
          />
        )}
      </div>
    </div>
  );
};

function DashboardHeader({ username, avatarUrl, summary }: { username: string; avatarUrl?: string; summary: DashboardData['summary'] }) {
  return (
    <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shrink-0">
            {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full rounded-full" /> : <span className="text-2xl sm:text-3xl font-bold">{username.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold">{username}</h1>
            <p className="text-gray-400 text-sm">Rank #{summary.reputationRank} of {summary.totalContributors} contributors</p>
          </div>
          <div className="flex gap-4 sm:gap-6">
            <div className="text-center sm:text-right">
              <p className="text-gray-400 text-xs">Earned</p>
              <p className="text-lg font-bold text-[#14F195]">{(summary.totalEarned / 1000).toFixed(0)}K<span className="text-xs text-gray-400 ml-1">$FNDRY</span></p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-gray-400 text-xs">Completed</p>
              <p className="text-lg font-bold text-[#9945FF]">{summary.bountiesCompleted}<span className="text-xs text-gray-400 ml-1">bounties</span></p>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-gray-400 text-xs">Reputation</p>
              <p className="text-lg font-bold text-yellow-400">{summary.reputationScore}<span className="text-xs text-gray-400 ml-1">pts</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabNavigation({ tabs, activeTab, onTabChange, unreadCount }: { tabs: typeof DASHBOARD_TABS; activeTab: DashboardTab; onTabChange: (tab: DashboardTab) => void; unreadCount: number }) {
  return (
    <div className="border-b border-white/10 bg-[#0a0a0a] sticky top-16 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1 overflow-x-auto -mb-px" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'text-[#14F195] border-b-2 border-[#14F195]' : 'text-gray-400 hover:text-white'}`}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
              {tab.id === 'notifications' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function OverviewTab({ data, onNavigate }: { data: DashboardData; onNavigate?: (path: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
          <span className="text-2xl">💰</span>
          <p className="text-gray-400 text-xs mb-1">Total Earned</p>
          <p className="text-xl font-bold">{data.summary.totalEarned.toLocaleString()}<span className="text-sm text-gray-400 ml-1">$FNDRY</span></p>
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
          <span className="text-2xl">🎯</span>
          <p className="text-gray-400 text-xs mb-1">Active Bounties</p>
          <p className="text-xl font-bold">{data.summary.activeBounties}</p>
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
          <span className="text-2xl">⏳</span>
          <p className="text-gray-400 text-xs mb-1">Pending Payouts</p>
          <p className="text-xl font-bold">{data.summary.pendingPayouts.toLocaleString()}<span className="text-sm text-gray-400 ml-1">$FNDRY</span></p>
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
          <span className="text-2xl">✅</span>
          <p className="text-gray-400 text-xs mb-1">Success Rate</p>
          <p className="text-xl font-bold">{data.summary.successRate}%</p>
        </div>
      </div>
      <QuickActions onNavigate={onNavigate} />
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
          <h3 className="text-lg font-bold mb-4">🎯 Active Bounties ({data.activeBounties.length})</h3>
          <div className="space-y-3">
            {data.activeBounties.slice(0, 3).map((bounty) => (
              <div key={bounty.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bounty.title}</p>
                  <p className="text-xs text-gray-400">{bounty.tier} • {(bounty.reward / 1000).toFixed(0)}K $FNDRY</p>
                </div>
                <span className="text-xs text-gray-400">{bounty.progressPercent}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
          <h3 className="text-lg font-bold mb-4">📜 Recent Activity</h3>
          <div className="space-y-3">
            {data.recentActivity.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
                <span>{getActivityIcon(activity.type)}</span>
                <p className="text-sm truncate flex-1">{activity.title}</p>
                <span className="text-xs text-gray-500">{getTimeAgo(new Date(activity.timestamp))}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActions({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const actions = [
    { label: 'Browse Bounties', icon: '🔍', path: '/bounties' },
    { label: 'View Leaderboard', icon: '🏆', path: '/leaderboard' },
    { label: 'Check Treasury', icon: '💰', path: '/tokenomics' },
    { label: 'View Profile', icon: '👤', path: '/profile' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map((action) => (
        <button key={action.path} onClick={() => onNavigate?.(action.path)} className="flex items-center gap-3 px-4 py-3 bg-[#1a1a1a] rounded-lg border border-white/10 hover:border-[#9945FF]/50 transition-colors text-left">
          <span className="text-xl">{action.icon}</span>
          <span className="text-sm font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

function BountiesTab({ bounties, onNavigate }: { bounties: ActiveBounty[]; onNavigate?: (path: string) => void }) {
  if (bounties.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No active bounties</p>
        <button onClick={() => onNavigate?.('/bounties')} className="px-4 py-2 bg-[#9945FF] rounded-lg hover:bg-[#9945FF]/80 transition-colors">Browse Bounties</button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {bounties.map((bounty) => (
        <div key={bounty.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${bounty.tier === 'T1' ? 'bg-yellow-500/20 text-yellow-400' : bounty.tier === 'T2' ? 'bg-[#9945FF]/20 text-[#9945FF]' : 'bg-red-500/20 text-red-400'}`}>{bounty.tier}</span>
                <h4 className="font-medium truncate">{bounty.title}</h4>
              </div>
              <p className="text-sm text-[#14F195]">{(bounty.reward / 1000).toFixed(0)}K $FNDRY reward</p>
            </div>
            <div className="w-32">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>{bounty.progressPercent}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-[#9945FF] transition-all" style={{ width: `${bounty.progressPercent}%` }} />
              </div>
            </div>
            <button onClick={() => onNavigate?.(`/bounties/${bounty.id}`)} className="px-4 py-2 bg-[#9945FF] rounded-lg hover:bg-[#9945FF]/80 transition-colors text-sm font-medium">View</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EarningsTab({ earnings }: { earnings: DashboardData['earnings'] }) {
  const total30Days = earnings.last30Days.reduce((sum, d) => sum + d.amount, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
          <p className="text-gray-400 text-sm">Total Earned</p>
          <p className="text-2xl font-bold text-[#14F195]">{earnings.totalEarned.toLocaleString()} <span className="text-sm">$FNDRY</span></p>
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
          <p className="text-gray-400 text-sm">Last 30 Days</p>
          <p className="text-2xl font-bold text-white">{total30Days.toLocaleString()} <span className="text-sm">$FNDRY</span></p>
        </div>
        <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
          <p className="text-gray-400 text-sm">Pending Payouts</p>
          <p className="text-2xl font-bold text-yellow-400">{earnings.pendingPayouts.toLocaleString()} <span className="text-sm">$FNDRY</span></p>
        </div>
      </div>
      <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
        <h3 className="text-lg font-bold mb-4">Earnings Over Time</h3>
        <EarningsChart earnings={earnings.last30Days} />
      </div>
    </div>
  );
}

function EarningsChart({ earnings }: { earnings: DailyEarning[] }) {
  const maxAmount = Math.max(...earnings.map((e) => e.amount), 1);
  const height = 200, width = 600, padding = 20;
  const points = earnings.map((e, i) => ({
    x: padding + (i * (width - 2 * padding)) / (earnings.length - 1),
    y: height - padding - (e.amount / maxAmount) * (height - 2 * padding),
    amount: e.amount,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <path d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`} fill="url(#grad)" opacity="0.3" />
      <path d={pathD} fill="none" stroke="#14F195" strokeWidth="2" />
      <defs><linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#14F195" /><stop offset="100%" stopColor="#14F195" stopOpacity="0" /></linearGradient></defs>
      {points.filter((p) => p.amount > 0).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#14F195" />)}
    </svg>
  );
}

function ActivityTab({ activities }: { activities: Activity[] }) {
  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div key={activity.id} className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
          <div className="flex items-start gap-3">
            <span className="text-2xl">{getActivityIcon(activity.type)}</span>
            <div className="flex-1">
              <p className="font-medium">{activity.title}</p>
              {activity.description && <p className="text-sm text-gray-400 mt-1">{activity.description}</p>}
              {activity.metadata?.amount && <p className="text-sm text-[#14F195] mt-1">+{activity.metadata.amount.toLocaleString()} $FNDRY</p>}
            </div>
            <span className="text-xs text-gray-500">{getTimeAgo(new Date(activity.timestamp))}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationsTab({ notifications, onMarkRead, onMarkAllRead }: { notifications: Notification[]; onMarkRead: (id: string) => void; onMarkAllRead: () => void }) {
  const unread = notifications.filter((n) => !n.read);
  return (
    <div className="space-y-4">
      {unread.length > 0 && (
        <div className="flex justify-end">
          <button onClick={onMarkAllRead} className="text-sm text-[#9945FF] hover:text-[#9945FF]/80 transition-colors">Mark all as read</button>
        </div>
      )}
      {notifications.map((notification) => (
        <div key={notification.id} className={`${notification.read ? 'bg-[#1a1a1a]' : 'bg-[#1a1a1a] border-l-2 border-l-[#9945FF]'} rounded-lg p-4 border border-white/10`}>
          <div className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-2 ${notification.type === 'success' ? 'bg-[#14F195]' : notification.type === 'warning' ? 'bg-yellow-400' : notification.type === 'error' ? 'bg-red-400' : 'bg-blue-400'}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className={`font-medium ${notification.type === 'success' ? 'text-[#14F195]' : notification.type === 'warning' ? 'text-yellow-400' : notification.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>{notification.title}</p>
                <span className="text-xs text-gray-500">{getTimeAgo(new Date(notification.timestamp))}</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">{notification.message}</p>
              {!notification.read && <button onClick={() => onMarkRead(notification.id)} className="text-xs text-[#9945FF] mt-2 hover:underline">Mark as read</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ settings, onUpdateNotificationPreferences, onConnectAccount, onDisconnectAccount }: { settings: DashboardData['settings']; onUpdateNotificationPreferences?: (prefs: NotificationPreferences) => void; onConnectAccount?: (platform: LinkedAccount['platform']) => void; onDisconnectAccount?: (platform: LinkedAccount['platform']) => void }) {
  const [prefs, setPrefs] = useState(settings.notificationPreferences);
  const handleToggle = (key: keyof NotificationPreferences) => { const newPrefs = { ...prefs, [key]: !prefs[key] }; setPrefs(newPrefs); onUpdateNotificationPreferences?.(newPrefs); };
  return (
    <div className="space-y-6">
      <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
        <h3 className="text-lg font-bold mb-4">💳 Wallet</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Connected Wallet</p>
            <p className="font-mono text-[#14F195]">{settings.wallet.address.slice(0, 8)}...{settings.wallet.address.slice(-8)}</p>
          </div>
          <span className="px-3 py-1 bg-[#14F195]/20 text-[#14F195] rounded text-sm">Connected</span>
        </div>
      </div>
      <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
        <h3 className="text-lg font-bold mb-4">🔗 Linked Accounts</h3>
        <div className="space-y-3">
          {settings.linkedAccounts.map((account) => (
            <div key={account.platform} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="text-xl">{account.platform === 'github' ? '🐙' : account.platform === 'twitter' ? '🐦' : account.platform === 'discord' ? '💬' : '✈️'}</span>
                <div>
                  <p className="font-medium capitalize">{account.platform}</p>
                  {account.connected && <p className="text-sm text-gray-400">{account.username}</p>}
                </div>
              </div>
              {account.connected ? (
                <button onClick={() => onDisconnectAccount?.(account.platform)} className="text-sm text-red-400 hover:text-red-300">Disconnect</button>
              ) : (
                <button onClick={() => onConnectAccount?.(account.platform)} className="px-3 py-1 bg-[#9945FF] rounded text-sm hover:bg-[#9945FF]/80">Connect</button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#1a1a1a] rounded-lg p-4 border border-white/10">
        <h3 className="text-lg font-bold mb-4">🔔 Notification Preferences</h3>
        <div className="space-y-3">
          {(['email', 'push', 'bountyUpdates', 'payoutAlerts', 'reviewNotifications'] as const).map((key) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</p>
              </div>
              <button onClick={() => handleToggle(key)} className={`w-12 h-6 rounded-full transition-colors ${prefs[key] ? 'bg-[#14F195]' : 'bg-gray-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${prefs[key] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getActivityIcon(type: Activity['type']): string {
  const icons: Record<Activity['type'], string> = { bounty_claimed: '🎯', pr_submitted: '📤', review_received: '✅', payout: '💰', bounty_completed: '🏆', bounty_cancelled: '❌', tier_unlocked: '🔓', reputation_change: '⭐' };
  return icons[type] || '📋';
}

function getTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default ContributorDashboard;