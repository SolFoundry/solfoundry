import { useEffect, useEffectEvent, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  ActivityEvent,
  ActivityPollResponse,
  ActivitySubscription,
  ConnectionStatus,
  defaultSubscription,
  SOCKET_EVENTS,
  ServerToClientEvents,
  ClientToServerEvents,
} from "@solfoundry/activity-shared";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15_000;
const POLLING_INTERVAL_MS = 10_000;
const MAX_ITEMS = 100;

interface FetchActivitiesOptions {
  generation?: number;
  replace?: boolean;
}

interface UseActivityFeedOptions {
  authToken?: string;
  endpoint: string;
  initialUserId: string;
}

/** Merge newest activities first while keeping a stable cap for the feed UI. */
const mergeActivities = (current: ActivityEvent[], incoming: ActivityEvent[]): ActivityEvent[] => {
  const deduped = new Map<string, ActivityEvent>();
  [...incoming, ...current].forEach((activity) => deduped.set(activity.id, activity));
  return Array.from(deduped.values())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_ITEMS);
};

const subscriptionFilterKey = (filter: ActivitySubscription["filter"]): string =>
  JSON.stringify({
    types: [...filter.types].sort(),
    userIds: [...filter.userIds].sort(),
    bountyIds: [...filter.bountyIds].sort(),
  });

const activityMatchesFilter = (activity: ActivityEvent, filter: ActivitySubscription["filter"]): boolean => {
  if (filter.types.length && !filter.types.includes(activity.type)) {
    return false;
  }
  if (filter.userIds.length && !filter.userIds.includes(activity.actor.id)) {
    return false;
  }
  if (filter.bountyIds.length) {
    const bountyId = activity.metadata.bountyId;
    if (!bountyId || !filter.bountyIds.includes(bountyId)) {
      return false;
    }
  }
  return true;
};

export function useActivityFeed({ authToken, endpoint, initialUserId }: UseActivityFeedOptions) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<ActivitySubscription>(defaultSubscription(initialUserId));

  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const latestSinceRef = useRef<string | null>(null);
  const filterGenerationRef = useRef(0);
  const previousFilterKeyRef = useRef(subscriptionFilterKey(subscription.filter));
  const subscriptionRef = useRef(subscription);

  const advanceCursor = (nextSince: string | null | undefined) => {
    if (!nextSince) {
      return;
    }
    const nextEpoch = Date.parse(nextSince);
    const currentEpoch = latestSinceRef.current ? Date.parse(latestSinceRef.current) : Number.NEGATIVE_INFINITY;
    if (Number.isFinite(nextEpoch) && nextEpoch > currentEpoch) {
      latestSinceRef.current = nextSince;
    }
  };

  subscriptionRef.current = subscription;

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (latestSinceRef.current) {
      params.set("since", latestSinceRef.current);
    }
    if (subscription.filter.types.length) {
      params.set("types", subscription.filter.types.join(","));
    }
    if (subscription.filter.userIds.length) {
      params.set("userIds", subscription.filter.userIds.join(","));
    }
    if (subscription.filter.bountyIds.length) {
      params.set("bountyIds", subscription.filter.bountyIds.join(","));
    }
    params.set("limit", "50");
    return params.toString();
  };

  const stopPolling = useEffectEvent(() => {
    if (pollingTimerRef.current) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  });

  const fetchActivities = useEffectEvent(async (options: FetchActivitiesOptions = {}) => {
    const generation = options.generation ?? filterGenerationRef.current;
    try {
      const response = await fetch(`${endpoint}/api/activities?${buildQueryString()}`);
      if (!response.ok) {
        throw new Error(`Polling failed with ${response.status}`);
      }
      const payload = (await response.json()) as ActivityPollResponse;
      if (generation !== filterGenerationRef.current) {
        return;
      }
      setActivities((current) =>
        options.replace ? mergeActivities([], payload.activities) : mergeActivities(current, payload.activities)
      );
      advanceCursor(payload.nextSince);
      setLastUpdatedAt(payload.serverTime);
      setError(null);
    } catch (pollError) {
      if (generation !== filterGenerationRef.current) {
        return;
      }
      setError(pollError instanceof Error ? pollError.message : "Polling failed");
      setStatus("error");
    }
  });

  const startPolling = useEffectEvent(() => {
    stopPolling();
    setStatus("polling");
    void fetchActivities();
    pollingTimerRef.current = window.setInterval(() => {
      void fetchActivities();
    }, POLLING_INTERVAL_MS);
  });

  const scheduleReconnect = useEffectEvent(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
    }
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      startPolling();
      return;
    }

    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttemptsRef.current,
      MAX_RECONNECT_DELAY_MS
    );
    reconnectAttemptsRef.current += 1;
    setStatus("reconnecting");
    reconnectTimerRef.current = window.setTimeout(() => {
      socketRef.current?.connect();
    }, delay);
  });

  const connectSocket = useEffectEvent(() => {
    const socket = io(endpoint, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: false,
      auth: authToken ? { token: authToken } : undefined,
      query: { userId: subscription.userId },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      reconnectAttemptsRef.current = 0;
      stopPolling();
      setStatus("connected");
      setError(null);
      void fetchActivities();
      socket.emit(SOCKET_EVENTS.UPDATE_PREFERENCES, subscription);
    });

    socket.on(SOCKET_EVENTS.CONNECTED, (payload) => {
      setLastUpdatedAt(payload.serverTime);
    });

    socket.on(SOCKET_EVENTS.BATCH, (payload) => {
      const filteredActivities = payload.activities.filter((activity: ActivityEvent) =>
        activityMatchesFilter(activity, subscriptionRef.current.filter)
      );
      setActivities((current) => mergeActivities(current, filteredActivities));
      if (filteredActivities.length && payload.nextSince) {
        advanceCursor(payload.nextSince);
      } else if (filteredActivities.length) {
        const [firstActivity, ...remainingActivities] = filteredActivities as ActivityEvent[];
        const newestActivity = remainingActivities.reduce(
          (latest: ActivityEvent, activity: ActivityEvent) =>
            Date.parse(activity.createdAt) > Date.parse(latest.createdAt) ? activity : latest,
          firstActivity
        );
        advanceCursor(newestActivity.createdAt);
      }
      setLastUpdatedAt(payload.deliveredAt);
    });

    socket.on(SOCKET_EVENTS.PREFERENCES_UPDATED, (payload) => {
      setSubscription(payload.subscription);
    });

    socket.on(SOCKET_EVENTS.ERROR, (payload) => {
      setError(payload.message);
    });

    socket.on("disconnect", (reason) => {
      if (reason === "io client disconnect") {
        setStatus("disconnected");
        return;
      }
      scheduleReconnect();
    });

    socket.on("connect_error", (connectError) => {
      setError(connectError.message);
      scheduleReconnect();
    });

    setStatus("connecting");
    socket.connect();
  });

  useEffect(() => {
    connectSocket();
    return () => {
      stopPolling();
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connectSocket, stopPolling]);

  useEffect(() => {
    const nextFilterKey = subscriptionFilterKey(subscription.filter);
    const filterChanged = previousFilterKeyRef.current !== nextFilterKey;
    if (filterChanged) {
      previousFilterKeyRef.current = nextFilterKey;
      filterGenerationRef.current += 1;
      latestSinceRef.current = null;
      setActivities([]);
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit(SOCKET_EVENTS.UPDATE_PREFERENCES, subscription);
    }
    if (filterChanged || status === "polling") {
      void fetchActivities({ generation: filterGenerationRef.current, replace: filterChanged });
    }
  }, [fetchActivities, status, subscription]);

  return {
    activities,
    error,
    lastUpdatedAt,
    status,
    subscription,
    updateSubscription: setSubscription,
    retryConnection: () => {
      setStatus("connecting");
      reconnectAttemptsRef.current = 0;
      stopPolling();
      socketRef.current?.connect();
    },
  };
}
