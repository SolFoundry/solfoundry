import React from 'react';
import { motion } from 'framer-motion';

interface ActivityEvent {
  id: string;
  type: 'bounty_created' | 'pr_submitted' | 'review_completed' | 'payout_sent';
  title: string;
  user?: string;
  reward?: number;
  score?: number;
  amount?: number;
  timestamp: Date;
  bountyTitle?: string;
}

const ActivityFeed: React.FC = () => {
  const mockEvents: ActivityEvent[] = [
    {
      id: '1',
      type: 'bounty_created',
      title: 'Smart Contract Audit Tool',
      reward: 500000,
      timestamp: new Date(Date.now() - 5 * 60 * 1000)
    },
    {
      id: '2',
      type: 'pr_submitted',
      user: 'cryptodev42',
      bountyTitle: 'Token Distribution Dashboard',
      timestamp: new Date(Date.now() - 12 * 60 * 1000)
    },
    {
      id: '3',
      type: 'review_completed',
      bountyTitle: 'DeFi Yield Optimizer',
      score: 8,
      timestamp: new Date(Date.now() - 28 * 60 * 1000)
    },
    {
      id: '4',
      type: 'payout_sent',
      amount: 350000,
      user: 'solana_builder',
      timestamp: new Date(Date.now() - 45 * 60 * 1000)
    },
    {
      id: '5',
      type: 'bounty_created',
      title: 'Cross-chain Bridge Interface',
      reward: 750000,
      timestamp: new Date(Date.now() - 72 * 60 * 1000)
    },
    {
      id: '6',
      type: 'pr_submitted',
      user: 'rustdev_ninja',
      bountyTitle: 'NFT Marketplace Frontend',
      timestamp: new Date(Date.now() - 89 * 60 * 1000)
    }
  ];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'bounty_created':
        return '🟢';
      case 'pr_submitted':
        return '🔵';
      case 'review_completed':
        return '⭐';
      case 'payout_sent':
        return '💰';
      default:
        return '🔸';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'bounty_created':
        return 'border-green-500 bg-green-50';
      case 'pr_submitted':
        return 'border-blue-500 bg-blue-50';
      case 'review_completed':
        return 'border-yellow-500 bg-yellow-50';
      case 'payout_sent':
        return 'border-purple-500 bg-purple-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const formatEventText = (event: ActivityEvent) => {
    switch (event.type) {
      case 'bounty_created':
        return `New bounty: ${event.title} — ${event.reward?.toLocaleString()} $FNDRY`;
      case 'pr_submitted':
        return `${event.user} submitted PR for ${event.bountyTitle}`;
      case 'review_completed':
        return `${event.bountyTitle} scored ${event.score}/10`;
      case 'payout_sent':
        return `${event.amount?.toLocaleString()} $FNDRY sent to ${event.user}`;
      default:
        return 'Unknown event';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-blue-600">📡</span>
            Activity Feed
          </h2>
          <p className="text-gray-600 mt-1">Live updates from across the platform</p>
        </div>

        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {mockEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 border-l-4 ${getEventColor(event.type)} hover:bg-opacity-80 transition-all duration-200`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{getEventIcon(event.type)}</span>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium">
                      {formatEventText(event)}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      {formatTimeAgo(event.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {event.type === 'bounty_created' && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                      NEW
                    </span>
                  )}
                  {event.type === 'payout_sent' && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                      PAID
                    </span>
                  )}
                  {event.type === 'review_completed' && event.score && event.score >= 8 && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                      HIGH SCORE
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 rounded-b-xl">
          <div className="text-center">
            <button className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors duration-200">
              Load more activity →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityFeed;
