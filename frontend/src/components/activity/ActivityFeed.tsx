import { useState, useEffect, useCallback, useRef } from 'react';
import { activityFeed, Activity, ActivityType } from './activityFeedService';
import { 
  Zap, GitPullRequest, GitMerge, CheckCircle2, 
  XCircle, Trophy, Bell, Filter, RefreshCw, Wifi, WifiOff
} from 'lucide-react';

interface ActivityFeedProps {
  initialActivities?: Activity[];
  maxVisible?: number;
  showFilters?: boolean;
  className?: string;
}

const ACTIVITY_CONFIG: Record<ActivityType, { icon: typeof Zap; color: string; label: string }> = {
  bounty_created:      { icon: Zap,           color: 'text-yellow-400',  label: 'New Bounty' },
  bounty_submitted:    { icon: GitPullRequest, color: 'text-blue-400',    label: 'Submission' },
  bounty_merged:       { icon: GitMerge,       color: 'text-green-400',   label: 'Merged' },
  review_completed:    { icon: CheckCircle2,   color: 'text-purple-400', label: 'Review' },
  leaderboard_changed: { icon: Trophy,         color: 'text-amber-400',   label: 'Leaderboard' },
  submission_approved:  { icon: CheckCircle2,  color: 'text-emerald-400', label: 'Approved' },
  submission_rejected:  { icon: XCircle,       color: 'text-red-400',     label: 'Rejected' },
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ActivityFeedItem({ activity }: { activity: Activity }) {
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.bounty_created;
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group">
      <div className={`flex-shrink-0 mt-0.5 ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded bg-white/10 ${config.color}`}>
            {config.label}
          </span>
          {activity.bountyId && (
            <a 
              href={`/bounties/${activity.bountyId}`}
              className="text-sm font-medium text-white/80 hover:text-white truncate"
            >
              {activity.bountyTitle || `#${activity.bountyId}`}
            </a>
          )}
        </div>
        <p className="text-sm text-white/60 mt-0.5 line-clamp-2">
          {activity.description}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-white/40">
            {activity.username && <span>by <span className="text-white/60">{activity.username}</span></span>}
          </span>
          <span className="text-xs text-white/30">•</span>
          <span className="text-xs text-white/40">{formatTimeAgo(activity.timestamp)}</span>
          {activity.amount && activity.token && (
            <>
              <span className="text-xs text-white/30">•</span>
              <span className="text-xs font-medium text-green-400">
                {activity.amount} {activity.token}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivityFeed({ 
  initialActivities = [], 
  maxVisible = 50,
  showFilters = true,
  className = ''
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [connectionState, setConnectionState] = useState(activityFeed.getConnectionState());
  const [filter, setFilter] = useState<ActivityType[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isFilterActive, setIsFilterActive] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    activityFeed.connect();

    const unsubscribe = activityFeed.subscribe((activity: Activity) => {
      setActivities(prev => {
        const exists = prev.some(a => a.id === activity.id);
        if (exists) return prev;
        return [activity, ...prev].slice(0, maxVisible);
      });
    });
    unsubscribeRef.current = unsubscribe;

    // Poll connection state
    const stateInterval = setInterval(() => {
      setConnectionState(activityFeed.getConnectionState());
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(stateInterval);
    };
  }, [maxVisible]);

  const handleFilterToggle = useCallback((type: ActivityType) => {
    setFilter(prev => {
      const newFilter = prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type];
      setIsFilterActive(newFilter.length > 0);
      activityFeed.setFilters({ types: newFilter.length > 0 ? newFilter : undefined });
      return newFilter;
    });
  }, []);

  const handleReconnect = useCallback(() => {
    activityFeed.disconnect();
    setActivities([]);
    activityFeed.connect();
  }, []);

  const filteredActivities = filter.length > 0
    ? activities.filter(a => filter.includes(a.type))
    : activities;

  const ConnectionIndicator = () => {
    switch (connectionState) {
      case 'connected':
        return <Wifi className="w-3.5 h-3.5 text-green-400" />;
      case 'fallback':
        return <WifiOff className="w-3.5 h-3.5 text-yellow-400" />;
      default:
        return <WifiOff className="w-3.5 h-3.5 text-red-400" />;
    }
  };

  return (
    <div className={`bg-white/5 rounded-xl border border-white/10 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-white/60" />
          <h3 className="font-semibold text-white">Activity Feed</h3>
          <ConnectionIndicator />
        </div>
        <div className="flex items-center gap-1.5">
          {connectionState !== 'connected' && (
            <button
              onClick={handleReconnect}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Reconnect"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {showFilters && (
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isFilterActive 
                    ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                    : 'hover:bg-white/10 text-white/60 hover:text-white'
                }`}
                title="Filter activities"
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-50 py-1">
                  {(Object.keys(ACTIVITY_CONFIG) as ActivityType[]).map(type => {
                    const config = ACTIVITY_CONFIG[type];
                    return (
                      <button
                        key={type}
                        onClick={() => handleFilterToggle(type)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-left"
                      >
                        <div className={`w-2 h-2 rounded-full ${filter.includes(type) ? 'bg-blue-400' : 'bg-white/20'}`} />
                        <span className={config.color}><config.icon className="w-3 h-3 inline mr-1" /></span>
                        <span className="text-white/80">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Activity List */}
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="w-8 h-8 text-white/20 mb-2" />
            <p className="text-sm text-white/40">No activities yet</p>
            <p className="text-xs text-white/25 mt-1">
              {connectionState === 'connected' 
                ? 'Waiting for live updates...' 
                : connectionState === 'fallback'
                ? 'Connected via polling fallback'
                : 'Reconnecting...'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredActivities.map(activity => (
              <ActivityFeedItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
