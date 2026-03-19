'use client';

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for the dashboard
const mockUser = {
  username: 'crypto-dev',
  walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f1234',
  totalEarned: 12450,
  pendingPayouts: 2400,
  reputation: {
    score: 847,
    rank: 'Gold',
    rankNumber: 12,
  },
};

const mockActiveBounties = [
  {
    id: 1,
    title: 'Liquidity Pool V2',
    tier: 'Silver',
    reward: 1100,
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    progress: 65,
    description: 'Upgrade the liquidity pool to version 2 with improved gas efficiency',
  },
  {
    id: 2,
    title: 'Cross-chain Bridge Security',
    tier: 'Gold',
    reward: 3500,
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    progress: 40,
    description: 'Implement security audits and fail-safes for cross-chain bridge',
  },
  {
    id: 3,
    title: 'Token Vesting Schedule',
    tier: 'Bronze',
    reward: 500,
    deadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    progress: 90,
    description: 'Create flexible token vesting schedule with cliff support',
  },
];

// Generate 30 days of earnings data
const generateEarningsData = () => {
  const data = [];
  const baseAmount = 200;
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const variance = Math.random() * 300 - 50;
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: Math.max(0, Math.round(baseAmount + variance)),
    });
  }
  return data;
};

const mockEarningsData = generateEarningsData();

const mockActivityFeed = [
  { id: 1, type: 'bounty_claimed', title: 'Claimed "Oracle Integration"', time: '2 hours ago', icon: '🎯' },
  { id: 2, type: 'pr_submitted', title: 'PR #142 merged to "DeFi Protocol"', time: '5 hours ago', icon: '📝' },
  { id: 3, type: 'review_received', title: 'Received 5-star review on "Token Swap"', time: '1 day ago', icon: '⭐' },
  { id: 4, type: 'payout', title: 'Payout received: $2,500', time: '1 day ago', icon: '💰' },
  { id: 5, type: 'bounty_claimed', title: 'Claimed "Gas Optimization"', time: '2 days ago', icon: '🎯' },
  { id: 6, type: 'pr_submitted', title: 'PR #141 merged to "NFT Marketplace"', time: '2 days ago', icon: '📝' },
  { id: 7, type: 'review_received', title: 'Received 4-star review on "Smart Contract"', time: '3 days ago', icon: '⭐' },
  { id: 8, type: 'payout', title: 'Payout received: $1,200', time: '4 days ago', icon: '💰' },
  { id: 9, type: 'bounty_claimed', title: 'Claimed "Test Coverage"', time: '5 days ago', icon: '🎯' },
  { id: 10, type: 'review_received', title: 'Received 5-star review on "Bridge"', time: '6 days ago', icon: '⭐' },
  { id: 11, type: 'pr_submitted', title: 'PR #140 merged to "DAO Module"', time: '1 week ago', icon: '📝' },
  { id: 12, type: 'payout', title: 'Payout received: $800', time: '1 week ago', icon: '💰' },
  { id: 13, type: 'bounty_claimed', title: 'Claimed "Yield Aggregator"', time: '1 week ago', icon: '🎯' },
  { id: 14, type: 'review_received', title: 'Received 5-star review on "Vesting"', time: '8 days ago', icon: '⭐' },
  { id: 15, type: 'pr_submitted', title: 'PR #139 merged to "Pool V1"', time: '10 days ago', icon: '📝' },
  { id: 16, type: 'payout', title: 'Payout received: $1,500', time: '12 days ago', icon: '💰' },
];

const mockNotifications = [
  { id: 1, title: 'New bounty matching your skills: Smart Contract Audit', time: '1 hour ago', unread: true, type: 'bounty' },
  { id: 2, title: 'Your PR #142 was merged', time: '5 hours ago', unread: true, type: 'pr' },
  { id: 3, title: 'Payout of $2,500 processed', time: '1 day ago', unread: true, type: 'payout' },
  { id: 4, title: 'Deadline reminder: Liquidity Pool V2 due in 2 days', time: '2 days ago', unread: false, type: 'reminder' },
  { id: 5, title: 'You reached Gold rank!', time: '1 week ago', unread: false, type: 'achievement' },
];

// Helper functions
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function getTimeRemaining(deadline: Date): string {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return '< 1h';
}

function getTierColor(tier: string): string {
  switch (tier) {
    case 'Gold': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Silver': return 'bg-gray-400/20 text-gray-300 border-gray-400/30';
    case 'Bronze': return 'bg-amber-700/20 text-amber-600 border-amber-700/30';
    default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

function getActivityIcon(type: string): string {
  switch (type) {
    case 'bounty_claimed': return '🎯';
    case 'pr_submitted': return '📝';
    case 'review_received': return '⭐';
    case 'payout': return '💰';
    default: return '📌';
  }
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'bounty': return '🎯';
    case 'pr': return '📝';
    case 'payout': return '💰';
    case 'reminder': return '⏰';
    case 'achievement': return '🏆';
    default: return '📌';
  }
}

export default function DashboardPage() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => n.unread).length;

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, unread: false } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, unread: false })));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      {/* Header */}
      <div className="bg-[#111] border-b border-[#9945FF]/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Contributor Dashboard</h1>
              <p className="text-gray-400 text-sm">Welcome back, {mockUser.username}</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Notification Center */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#9945FF] rounded-full text-xs flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                
                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-[#111] border border-[#9945FF]/30 rounded-lg shadow-xl z-50">
                    <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                      <h3 className="font-bold">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs text-[#9945FF] hover:text-[#7c3aed]"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-gray-800/50 hover:bg-white/5 cursor-pointer ${
                            notification.unread ? 'bg-[#9945FF]/10' : ''
                          }`}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                            <div className="flex-1">
                              <p className={`text-sm ${notification.unread ? 'font-semibold' : ''}`}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">{notification.time}</p>
                            </div>
                            {notification.unread && (
                              <span className="w-2 h-2 bg-[#9945FF] rounded-full" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Profile */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#9945FF] flex items-center justify-center font-bold">
                  {mockUser.username[0].toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#14F195]">💰</span>
              <p className="text-gray-400 text-sm">Total Earned</p>
            </div>
            <p className="text-2xl font-bold text-[#14F195]">{formatCurrency(mockUser.totalEarned)}</p>
          </div>
          
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#9945FF]">🎯</span>
              <p className="text-gray-400 text-sm">Active Bounties</p>
            </div>
            <p className="text-2xl font-bold text-[#9945FF]">{mockActiveBounties.length}</p>
          </div>
          
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-400">⏳</span>
              <p className="text-gray-400 text-sm">Pending Payouts</p>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{formatCurrency(mockUser.pendingPayouts)}</p>
          </div>
          
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-yellow-400">🏆</span>
              <p className="text-gray-400 text-sm">Reputation Rank</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-yellow-400">{mockUser.reputation.rank}</p>
              <span className="text-gray-500 text-sm">#{mockUser.reputation.rankNumber}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Earnings Chart */}
          <div className="lg:col-span-2 bg-[#111] border border-[#9945FF]/20 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-6">Earnings (Last 30 Days)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockEarningsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#666" 
                    tick={{ fill: '#666', fontSize: 12 }}
                    tickLine={{ stroke: '#333' }}
                  />
                  <YAxis 
                    stroke="#666" 
                    tick={{ fill: '#666', fontSize: 12 }}
                    tickLine={{ stroke: '#333' }}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111',
                      border: '1px solid #9945FF',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                    }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value) => [formatCurrency(Number(value)), 'Earnings']}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#9945FF"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: '#14F195' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-6">Quick Actions</h2>
            <div className="space-y-3">
              <a
                href="/bounties"
                className="flex items-center gap-3 p-4 bg-[#0a0a0a] hover:bg-[#9945FF]/20 rounded-lg transition-colors group"
              >
                <span className="text-2xl">🎯</span>
                <div>
                  <p className="font-semibold group-hover:text-[#9945FF] transition-colors">Browse Bounties</p>
                  <p className="text-gray-500 text-sm">Find new opportunities</p>
                </div>
              </a>
              <a
                href="/leaderboard"
                className="flex items-center gap-3 p-4 bg-[#0a0a0a] hover:bg-[#9945FF]/20 rounded-lg transition-colors group"
              >
                <span className="text-2xl">🏆</span>
                <div>
                  <p className="font-semibold group-hover:text-[#9945FF] transition-colors">View Leaderboard</p>
                  <p className="text-gray-500 text-sm">See top contributors</p>
                </div>
              </a>
              <button className="w-full flex items-center gap-3 p-4 bg-[#0a0a0a] hover:bg-[#9945FF]/20 rounded-lg transition-colors group">
                <span className="text-2xl">💰</span>
                <div className="text-left">
                  <p className="font-semibold group-hover:text-[#9945FF] transition-colors">Check Treasury</p>
                  <p className="text-gray-500 text-sm">View fund status</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Active Bounties */}
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-6">Active Bounties</h2>
            <div className="space-y-4">
              {mockActiveBounties.map((bounty) => (
                <div
                  key={bounty.id}
                  className="p-4 bg-[#0a0a0a] border border-gray-800 rounded-lg hover:border-[#9945FF]/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{bounty.title}</h3>
                      <p className="text-gray-500 text-sm mt-1">{bounty.description}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs border ${getTierColor(bounty.tier)}`}>
                      {bounty.tier}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-[#14F195]">{bounty.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-[#9945FF] to-[#14F195] h-2 rounded-full transition-all"
                        style={{ width: `${bounty.progress}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[#14F195] font-semibold">{formatCurrency(bounty.reward)}</span>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <span>⏰</span>
                      <span>{getTimeRemaining(bounty.deadline)} remaining</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-6">Recent Activity</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {mockActivityFeed.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <span className="text-xl">{getActivityIcon(activity.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{activity.title}</p>
                    <p className="text-gray-500 text-xs">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Settings Section */}
        <div className="bg-[#111] border border-[#9945FF]/20 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-6">Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Linked Accounts */}
            <div className="p-4 bg-[#0a0a0a] rounded-lg">
              <h3 className="font-semibold mb-4">Linked Accounts</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[#111] rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🐙</span>
                    <span className="text-sm">GitHub</span>
                  </div>
                  <span className="text-[#14F195] text-sm">Connected</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#111] rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🐦</span>
                    <span className="text-sm">Twitter</span>
                  </div>
                  <span className="text-gray-500 text-sm">Connect</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#111] rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📧</span>
                    <span className="text-sm">Email</span>
                  </div>
                  <span className="text-[#14F195] text-sm">Connected</span>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="p-4 bg-[#0a0a0a] rounded-lg">
              <h3 className="font-semibold mb-4">Notification Preferences</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">New Bounties</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-[#9945FF]" />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">PR Updates</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-[#9945FF]" />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Payouts</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-[#9945FF]" />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Deadlines</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-[#9945FF]" />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm">Weekly Digest</span>
                  <input type="checkbox" className="w-5 h-5 accent-[#9945FF]" />
                </label>
              </div>
            </div>

            {/* Wallet Management */}
            <div className="p-4 bg-[#0a0a0a] rounded-lg">
              <h3 className="font-semibold mb-4">Wallet Management</h3>
              <div className="space-y-3">
                <div className="p-3 bg-[#111] rounded-lg">
                  <p className="text-gray-500 text-xs mb-1">Connected Wallet</p>
                  <p className="text-sm font-mono">{mockUser.walletAddress.slice(0, 6)}...{mockUser.walletAddress.slice(-4)}</p>
                </div>
                <button className="w-full py-2 bg-[#9945FF] hover:bg-[#7c3aed] rounded-lg text-sm font-semibold transition-colors">
                  Disconnect Wallet
                </button>
                <button className="w-full py-2 border border-[#9945FF] text-[#9945FF] hover:bg-[#9945FF]/10 rounded-lg text-sm font-semibold transition-colors">
                  View on Explorer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
