import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GitPullRequest, DollarSign, Star, Zap } from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: 'bounty_created' | 'bounty_funded' | 'pr_submitted' | 'bounty_completed';
  user: string;
  bounty_title: string;
  amount?: string;
  timestamp: string;
}

const EVENT_CONFIG = {
  bounty_created: { icon: Zap, color: 'text-purple', label: 'created' },
  bounty_funded: { icon: DollarSign, color: 'text-emerald', label: 'funded' },
  pr_submitted: { icon: GitPullRequest, color: 'text-status-info', label: 'submitted PR for' },
  bounty_completed: { icon: Star, color: 'text-magenta', label: 'completed' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('/api/activity');
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch {
        // Use mock data for demo
        setEvents([
          { id: '1', type: 'bounty_created', user: 'alice', bounty_title: 'Build DAO Governance Module', timestamp: new Date(Date.now() - 300000).toISOString() },
          { id: '2', type: 'bounty_funded', user: 'bob', bounty_title: 'Add NFT Staking Contract', amount: '500 FNDRY', timestamp: new Date(Date.now() - 1800000).toISOString() },
          { id: '3', type: 'pr_submitted', user: 'charlie', bounty_title: 'Merkle Tree Implementation', timestamp: new Date(Date.now() - 3600000).toISOString() },
          { id: '4', type: 'bounty_completed', user: 'dave', bounty_title: 'Token Vesting Schedule', amount: '1000 FNDRY', timestamp: new Date(Date.now() - 7200000).toISOString() },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-forge-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event, idx) => {
        const config = EVENT_CONFIG[event.type];
        const Icon = config.icon;
        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-3 py-2 px-3 rounded-lg bg-forge-900/50 hover:bg-forge-800/50 transition-colors"
          >
            <Icon className={'w-4 h-4 flex-shrink-0 ' + config.color} />
            <div className="flex-1 min-w-0 text-sm">
              <span className="text-text-primary font-medium">@{event.user}</span>
              <span className="text-text-muted mx-1">{config.label}</span>
              <span className="text-text-secondary truncate">{event.bounty_title}</span>
              {event.amount && <span className="ml-2 text-emerald font-mono text-xs">{event.amount}</span>}
            </div>
            <span className="text-xs text-text-muted flex-shrink-0">{timeAgo(event.timestamp)}</span>
          </motion.div>
        );
      })}
    </div>
  );
}