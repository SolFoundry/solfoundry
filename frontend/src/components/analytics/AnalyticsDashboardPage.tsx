import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PageLayout } from '../layout/PageLayout';
import { pageTransition } from '../../lib/animations';
import { BountyAnalyticsPage } from './BountyAnalyticsPage';
import { PlatformHealthPage } from './PlatformHealthPage';
import { AnalyticsLeaderboardPage } from './AnalyticsLeaderboardPage';

type Tab = 'overview' | 'bounties' | 'contributors' | 'platform';

export function AnalyticsDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'bounties', label: 'Bounty Analytics' },
    { id: 'contributors', label: 'Contributors' },
    { id: 'platform', label: 'Platform Health' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'bounties':
        return <BountyAnalyticsPage />;
      case 'contributors':
        return <AnalyticsLeaderboardPage />;
      case 'platform':
        return <PlatformHealthPage />;
      case 'overview':
      default:
        return <OverviewTab />;
    }
  };

  return (
    <PageLayout>
      <motion.div
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className="pt-16"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">Analytics Dashboard</h1>
          
          {/* Tabs */}
          <div className="flex border-b border-forge-800 mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400"
                  />
                )}
              </button>
            ))}
          </div>
          
          {/* Tab Content */}
          {renderTabContent()}
        </div>
      </motion.div>
    </PageLayout>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <QuickStat
          label="Total Bounties"
          value="170"
          change="+12%"
          changePositive
        />
        <QuickStat
          label="Active Contributors"
          value="45"
          change="+8%"
          changePositive
        />
        <QuickStat
          label="Completion Rate"
          value="50.0%"
          change="+5%"
          changePositive
        />
        <QuickStat
          label="Total Rewards Paid"
          value="24M FNDRY"
          change="+15%"
          changePositive
        />
      </div>
      
      {/* Recent Activity */}
      <div className="bg-forge-900 border border-forge-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <ActivityItem
            icon="🎯"
            title="New bounty created"
            description="Bounty Analytics Dashboard (Tier 3)"
            time="2 hours ago"
          />
          <ActivityItem
            icon="✅"
            title="Bounty completed"
            description="Toast notification system (Tier 2)"
            time="4 hours ago"
          />
          <ActivityItem
            icon="👤"
            title="New contributor joined"
            description="alice_dev joined the platform"
            time="6 hours ago"
          />
          <ActivityItem
            icon="💰"
            title="Reward paid"
            description="150,000 FNDRY paid to bob_builder"
            time="8 hours ago"
          />
        </div>
      </div>
      
      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickLink
          title="Bounty Analytics"
          description="View detailed bounty statistics and trends"
          icon="📊"
          onClick={() => {}}
        />
        <QuickLink
          title="Contributor Leaderboard"
          description="See top contributors and their performance"
          icon="🏆"
          onClick={() => {}}
        />
        <QuickLink
          title="Platform Health"
          description="Monitor platform metrics and growth"
          icon="📈"
          onClick={() => {}}
        />
      </div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  change,
  changePositive,
}: {
  label: string;
  value: string;
  change?: string;
  changePositive?: boolean;
}) {
  return (
    <div className="bg-forge-900 border border-forge-800 rounded-xl p-6">
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {change && (
        <div
          className={`text-sm mt-1 ${
            changePositive ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {change}
        </div>
      )}
    </div>
  );
}

function ActivityItem({
  icon,
  title,
  description,
  time,
}: {
  icon: string;
  title: string;
  description: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="text-2xl">{icon}</div>
      <div className="flex-1">
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="text-sm text-muted-foreground">{time}</div>
    </div>
  );
}

function QuickLink({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-forge-900 border border-forge-800 rounded-xl p-6 text-left hover:bg-forge-800/50 transition-colors"
    >
      <div className="text-3xl mb-3">{icon}</div>
      <div className="font-semibold text-foreground mb-1">{title}</div>
      <div className="text-sm text-muted-foreground">{description}</div>
    </button>
  );
}
