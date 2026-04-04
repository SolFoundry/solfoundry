export const SOCKET_EVENTS = {
  CONNECTED: "activity:connected",
  BATCH: "activity:batch",
  PREFERENCES_UPDATED: "preferences:updated",
  UPDATE_PREFERENCES: "preferences:update",
  ERROR: "activity:error",
} as const;

export const ACTIVITY_TYPES = [
  "bounty_posted",
  "submission_created",
  "review_completed",
  "leaderboard_changed",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type ConnectionMode = "websocket" | "polling";
export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "polling" | "disconnected" | "error";

export interface ActivityActor {
  id: string;
  handle: string;
  displayName: string;
}

export interface ActivityMetadata {
  title: string;
  message: string;
  bountyId?: string;
  bountyTitle?: string;
  scoreDelta?: number;
  submissionId?: string;
  reviewId?: string;
  leaderboardRank?: number;
}

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  createdAt: string;
  actor: ActivityActor;
  metadata: ActivityMetadata;
}

export interface ActivityFilter {
  types: ActivityType[];
  userIds: string[];
  bountyIds: string[];
}

export interface NotificationPreferences {
  enabled: boolean;
  inAppOnly: boolean;
  mutedTypes: ActivityType[];
}

export interface ActivitySubscription {
  userId: string;
  filter: ActivityFilter;
  notifications: NotificationPreferences;
}

export interface ActivityBatchPayload {
  activities: ActivityEvent[];
  deliveredAt: string;
}

export interface ConnectedPayload {
  socketId: string;
  serverTime: string;
  mode: ConnectionMode;
}

export interface PreferencesUpdatedPayload {
  subscription: ActivitySubscription;
}

export interface ActivityQuery {
  since?: string;
  limit?: number;
  types?: ActivityType[];
  userIds?: string[];
  bountyIds?: string[];
}

export interface ActivityPollResponse {
  activities: ActivityEvent[];
  serverTime: string;
  nextSince: string | null;
}

export interface ServerToClientEvents {
  [SOCKET_EVENTS.CONNECTED]: (payload: ConnectedPayload) => void;
  [SOCKET_EVENTS.BATCH]: (payload: ActivityBatchPayload) => void;
  [SOCKET_EVENTS.PREFERENCES_UPDATED]: (payload: PreferencesUpdatedPayload) => void;
  [SOCKET_EVENTS.ERROR]: (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  [SOCKET_EVENTS.UPDATE_PREFERENCES]: (
    payload: ActivitySubscription,
    acknowledgement?: (payload: PreferencesUpdatedPayload) => void
  ) => void;
}

export const defaultFilter: ActivityFilter = {
  types: [...ACTIVITY_TYPES],
  userIds: [],
  bountyIds: [],
};

export const defaultNotificationPreferences: NotificationPreferences = {
  enabled: true,
  inAppOnly: true,
  mutedTypes: [],
};

export const defaultSubscription = (userId = "anonymous"): ActivitySubscription => ({
  userId,
  filter: defaultFilter,
  notifications: defaultNotificationPreferences,
});

export const isActivityType = (value: string): value is ActivityType =>
  ACTIVITY_TYPES.includes(value as ActivityType);
