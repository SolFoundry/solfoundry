import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Zap, GitPullRequest, Star, Trophy, DollarSign, Bell, X } from 'lucide-react';

// Types
export interface ActivityEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  actor?: { username: string; user_id?: string };
  target?: Record<string, any>;
  timestamp: string;
}

export interface ActivityFeedConfig {
  wsUrl?: string;
  rooms?: string[];
  maxEvents?: number;
  onEvent?: (event: ActivityEvent) => void;
}

// Event type config
const EVENT_CONFIG: Record<string, { icon: typeof Zap; color: string; label: string }> = {
  'bounty:posted':    { icon: Zap, color: 'text-anvil-orange', label: 'New Bounty' },
  'bounty:updated':   { icon: Zap, color: 'text-tier-t2', label: 'Bounty Update' },
  'submission:created': { icon: GitPullRequest, color: 'text-emerald', label: 'New PR' },
  'submission:reviewed': { icon: Star, color: 'text-tier-t2', label: 'Reviewed' },
  'submission:merged': { icon: GitPullRequest, color: 'text-emerald', label: 'Merged!' },
  'review:completed': { icon: Star, color: 'text-anvil-orange', label: 'AI Review' },
  'leaderboard:changed': { icon: Trophy, color: 'text-tier-t2', label: 'Rank Change' },
  'payout:sent':      { icon: DollarSign, color: 'text-emerald', label: 'Payout!' },
  'user:joined':      { icon: Bell, color: 'text-text-muted', label: 'Joined' },
};

// Time ago
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Single Event
function ActivityEventItem({ event }: { event: ActivityEvent }) {
  const config = EVENT_CONFIG[event.type] || { icon: Bell, color: 'text-text-muted', label: event.type };
  const Icon = config.icon;

  // Build description based on event type
  let description = '';
  switch (event.type) {
    case 'bounty:posted':
      description = `New ${event.data.tier} bounty: "${event.data.title}" (${(event.data.reward / 1000)}K $FNDRY)`;
      break;
    case 'submission:created':
      description = `PR submitted for bounty #${event.data.bounty_id}`;
      break;
    case 'review:completed':
      description = `AI Review: Score ${event.data.score}/10 ${event.data.passed ? '✅' : '❌'}`;
      break;
    case 'leaderboard:changed':
      description = `Rank ${event.data.old_rank} → ${event.data.new_rank} ${event.data.direction === 'up' ? '↑' : '↓'}`;
      break;
    case 'payout:sent':
      description = `${(event.data.amount / 1000)}K $FNDRY for "${event.data.bounty_title}"`;
      break;
    default:
      description = event.type;
  }

  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-surface-hover transition-colors border-b border-border-primary last:border-0">
      <div className={`mt-0.5 ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
          {event.actor && (
            <span className="text-xs text-text-muted">by @{event.actor.username}</span>
          )}
        </div>
        <p className="text-sm text-text-secondary truncate">{description}</p>
      </div>
      <span className="text-xs text-text-muted whitespace-nowrap">{timeAgo(event.timestamp)}</span>
    </div>
  );
}

// Main Component
export function ActivityFeed({ config = {} }: { config?: ActivityFeedConfig }) {
  const {
    wsUrl = 'https://solfoundry.xyz',
    rooms = ['all'],
    maxEvents = 50,
    onEvent,
  } = config;

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [showFeed, setShowFeed] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const unreadRef = useRef(0);
  const [unread, setUnread] = useState(0);

  // WebSocket connection
  useEffect(() => {
    const socket = io(`${wsUrl}/ws/activity`, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('subscribe', { rooms });
    });

    socket.on('disconnect', () => setConnected(false));

    // Receive new events
    socket.on('event', (event: ActivityEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, maxEvents));
      if (onEvent) onEvent(event);
      if (!showFeed) {
        unreadRef.current += 1;
        setUnread(unreadRef.current);
      }
    });

    // Receive history on connect
    socket.on('history', (data: { events: ActivityEvent[] }) => {
      setEvents(data.events.slice(0, maxEvents));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [wsUrl, maxEvents]);

  // Reset unread when feed is shown
  useEffect(() => {
    if (showFeed) {
      unreadRef.current = 0;
      setUnread(0);
    }
  }, [showFeed]);

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setShowFeed(!showFeed)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-card border border-border-primary hover:border-border-secondary transition-colors"
      >
        <Zap className={`w-4 h-4 ${connected ? 'text-emerald' : 'text-text-muted'}`} />
        <span className="text-sm text-text-primary">Activity</span>
        {connected && (
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
        )}
        {unread > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-anvil-orange text-dark-forge text-xs font-bold">
            {unread}
          </span>
        )}
      </button>

      {/* Feed Panel */}
      {showFeed && (
        <div className="absolute top-12 right-0 w-96 max-h-[500px] overflow-y-auto bg-surface-card border border-border-primary rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">Live Activity</span>
              {connected ? (
                <span className="text-xs text-emerald">● Connected</span>
              ) : (
                <span className="text-xs text-status-error">○ Disconnected</span>
              )}
            </div>
            <button onClick={() => setShowFeed(false)} className="p-1 rounded hover:bg-surface-hover">
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>

          {/* Events List */}
          <div className="divide-y divide-border-primary">
            {events.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">
                No activity yet. Waiting for events...
              </div>
            ) : (
              events.map((event) => (
                <ActivityEventItem key={event.id} event={event} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityFeed;
