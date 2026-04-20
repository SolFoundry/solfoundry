import { io, Socket } from 'socket.io-client';

export type ActivityType = 
  | 'bounty_created'
  | 'bounty_submitted'
  | 'bounty_merged'
  | 'review_completed'
  | 'leaderboard_changed'
  | 'submission_approved'
  | 'submission_rejected';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  username: string;
  avatarUrl?: string;
  timestamp: number;
  metadata?: Record<string, string | number>;
  bountyId?: string;
  bountyTitle?: string;
  amount?: string;
  token?: string;
}

export interface ActivityFilters {
  types?: ActivityType[];
  username?: string;
  bountyId?: string;
}

export interface ActivityFeedOptions {
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  fallbackPollingInterval?: number;
}

const DEFAULT_OPTIONS: Required<ActivityFeedOptions> = {
  reconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  fallbackPollingInterval: 10000,
};

class ActivityFeedService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(activity: Activity) => void>> = new Map();
  private options: Required<ActivityFeedOptions>;
  private reconnectAttempts = 0;
  private useFallback = false;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private wsUrl: string;
  private filters: ActivityFilters = {};

  constructor(wsUrl: string = 'wss://solfoundry.org/ws', options: ActivityFeedOptions = {}) {
    this.wsUrl = wsUrl;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  connect(): void {
    if (this.socket?.connected) return;

    try {
      this.socket = io(this.wsUrl, {
        path: '/ws/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: this.options.reconnect,
        reconnectionDelay: this.options.reconnectInterval,
        reconnectionAttempts: this.options.maxReconnectAttempts,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        console.log('[ActivityFeed] Connected via WebSocket');
        this.reconnectAttempts = 0;
        this.useFallback = false;
        this.stopPollingFallback();
        // Send current filters to server
        this.socket?.emit('subscribe', this.filters);
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('[ActivityFeed] Disconnected:', reason);
        if (this.options.reconnect && !this.useFallback) {
          this.scheduleFallback();
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('[ActivityFeed] Connection error:', error.message);
        if (!this.useFallback) {
          this.scheduleFallback();
        }
      });

      this.socket.on('activity', (activity: Activity) => {
        this.notifyListeners(activity);
      });

      this.socket.on('activities_batch', (activities: Activity[]) => {
        activities.forEach(activity => this.notifyListeners(activity));
      });

      this.socket.on('error', (error: { message: string }) => {
        console.error('[ActivityFeed] Server error:', error.message);
      });

    } catch (error) {
      console.error('[ActivityFeed] Failed to initialize WebSocket:', error);
      this.scheduleFallback();
    }
  }

  disconnect(): void {
    this.stopPollingFallback();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  setFilters(filters: ActivityFilters): void {
    this.filters = filters;
    if (this.socket?.connected) {
      this.socket.emit('update_filters', filters);
    }
  }

  subscribe(callback: (activity: Activity) => void): () => void {
    const id = Math.random().toString(36).substring(2);
    if (!this.listeners.has('activity')) {
      this.listeners.set('activity', new Set());
    }
    this.listeners.get('activity')!.add(callback);
    return () => {
      this.listeners.get('activity')?.delete(callback);
    };
  }

  private notifyListeners(activity: Activity): void {
    const callbacks = this.listeners.get('activity');
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(activity);
        } catch (error) {
          console.error('[ActivityFeed] Listener error:', error);
        }
      });
    }
  }

  private scheduleFallback(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts && !this.useFallback) {
      console.log('[ActivityFeed] Switching to polling fallback');
      this.useFallback = true;
      this.startPollingFallback();
    }
    this.reconnectAttempts++;
  }

  private startPollingFallback(): void {
    if (this.pollingTimer) return;
    console.log('[ActivityFeed] Starting polling fallback');
    this.pollingTimer = setInterval(async () => {
      try {
        const response = await fetch('https://solfoundry.org/api/activities?limit=20');
        if (response.ok) {
          const data = await response.json() as { activities?: Activity[] };
          (data.activities || []).forEach(activity => this.notifyListeners(activity));
        }
      } catch (error) {
        console.warn('[ActivityFeed] Polling fallback error:', error);
      }
    }, this.options.fallbackPollingInterval);
  }

  private stopPollingFallback(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  getConnectionState(): 'connected' | 'disconnected' | 'fallback' | 'connecting' {
    if (!this.socket) return 'disconnected';
    if (this.useFallback) return 'fallback';
    if (this.socket.connected) return 'connected';
    return 'disconnected';
  }
}

export const activityFeed = new ActivityFeedService();

export default ActivityFeedService;
