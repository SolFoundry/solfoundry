import cors from "cors";
import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { z } from "zod";
import {
  ACTIVITY_TYPES,
  ClientToServerEvents,
  ConnectedPayload,
  defaultFilter,
  defaultSubscription,
  ActivityEvent,
  ActivityQuery,
  ActivitySubscription,
  ActivityType,
  PreferencesUpdatedPayload,
  ServerToClientEvents,
  SOCKET_EVENTS,
  isActivityType,
} from "@solfoundry/activity-shared";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const MAX_ACTIVITY_HISTORY = Number(process.env.MAX_ACTIVITY_HISTORY ?? 500);
const FLUSH_INTERVAL_MS = Number(process.env.FLUSH_INTERVAL_MS ?? 500);
const SOCKET_RATE_LIMIT_WINDOW_MS = 10_000;
const SOCKET_RATE_LIMIT_MAX = 25;
const API_RATE_LIMIT_WINDOW_MS = 60_000;
const API_RATE_LIMIT_MAX = 120;

const activitySchema = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(ACTIVITY_TYPES),
  createdAt: z.string().datetime().optional(),
  actor: z.object({
    id: z.string().min(1),
    handle: z.string().min(1),
    displayName: z.string().min(1),
  }),
  metadata: z.object({
    title: z.string().min(1),
    message: z.string().min(1),
    bountyId: z.string().min(1).optional(),
    bountyTitle: z.string().min(1).optional(),
    scoreDelta: z.number().optional(),
    submissionId: z.string().min(1).optional(),
    reviewId: z.string().min(1).optional(),
    leaderboardRank: z.number().optional(),
  }),
});

const subscriptionSchema = z.object({
  userId: z.string().min(1),
  filter: z.object({
    types: z.array(z.enum(ACTIVITY_TYPES)).default(defaultFilter.types),
    userIds: z.array(z.string()).default([]),
    bountyIds: z.array(z.string()).default([]),
  }),
  notifications: z.object({
    enabled: z.boolean().default(true),
    inAppOnly: z.boolean().default(true),
    mutedTypes: z.array(z.enum(ACTIVITY_TYPES)).default([]),
  }),
});

class SlidingWindowLimiter {
  private readonly buckets = new Map<string, number[]>();
  private consumeCount = 0;

  constructor(private readonly windowMs: number, private readonly maxEvents: number) {}

  private pruneOldEntries(): void {
    const start = Date.now() - this.windowMs;
    for (const [key, values] of this.buckets) {
      const current = values.filter((value) => value >= start);
      if (!current.length) {
        this.buckets.delete(key);
        continue;
      }
      this.buckets.set(key, current);
    }
  }

  consume(key: string): boolean {
    this.consumeCount += 1;
    if (this.consumeCount % 100 === 0) {
      this.pruneOldEntries();
    }

    const now = Date.now();
    const start = now - this.windowMs;
    const current = (this.buckets.get(key) ?? []).filter((value) => value >= start);
    if (current.length >= this.maxEvents) {
      this.buckets.set(key, current);
      return false;
    }
    current.push(now);
    this.buckets.set(key, current);
    return true;
  }
}

class ActivityStore {
  private readonly items: ActivityEvent[] = [];

  add(activity: ActivityEvent): void {
    this.items.unshift(activity);
    if (this.items.length > MAX_ACTIVITY_HISTORY) {
      this.items.length = MAX_ACTIVITY_HISTORY;
    }
  }

  list(query: ActivityQuery): ActivityEvent[] {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const sinceEpoch = query.since ? Date.parse(query.since) : null;

    return this.items
      .filter((activity) => {
        if (sinceEpoch && Date.parse(activity.createdAt) <= sinceEpoch) {
          return false;
        }
        if (query.types?.length && !query.types.includes(activity.type)) {
          return false;
        }
        if (query.userIds?.length && !query.userIds.includes(activity.actor.id)) {
          return false;
        }
        if (query.bountyIds?.length) {
          const bountyId = activity.metadata.bountyId;
          if (!bountyId || !query.bountyIds.includes(bountyId)) {
            return false;
          }
        }
        return true;
      })
      .slice(0, limit)
      .reverse();
  }
}

const activityStore = new ActivityStore();
const socketLimiter = new SlidingWindowLimiter(SOCKET_RATE_LIMIT_WINDOW_MS, SOCKET_RATE_LIMIT_MAX);
const apiLimiter = new SlidingWindowLimiter(API_RATE_LIMIT_WINDOW_MS, API_RATE_LIMIT_MAX);
const pendingActivities: ActivityEvent[] = [];

const app = express();
app.set("trust proxy", true);
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "128kb" }));

app.use((req, res, next) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];
  const key =
    req.ip ??
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]?.trim()) ??
    (Array.isArray(realIp) ? realIp[0] : realIp) ??
    req.socket.remoteAddress ??
    "unknown";
  if (!apiLimiter.consume(key)) {
    res.status(429).json({ message: "API rate limit exceeded" });
    return;
  }
  next();
});

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true,
  },
});

const sampleActivities: ActivityEvent[] = [
  {
    id: "seed-1",
    type: "bounty_posted",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    actor: { id: "u-1", handle: "solfoundry", displayName: "SolFoundry" },
    metadata: {
      title: "New Rust bounty",
      message: "Low-latency indexing bounty opened for validator telemetry.",
      bountyId: "b-100",
      bountyTitle: "Validator Telemetry Indexer",
    },
  },
  {
    id: "seed-2",
    type: "submission_created",
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    actor: { id: "u-2", handle: "lina", displayName: "Lina W." },
    metadata: {
      title: "Submission received",
      message: "Initial implementation uploaded for the telemetry indexer bounty.",
      bountyId: "b-100",
      bountyTitle: "Validator Telemetry Indexer",
      submissionId: "s-404",
    },
  },
  {
    id: "seed-3",
    type: "leaderboard_changed",
    createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    actor: { id: "u-3", handle: "akira", displayName: "Akira N." },
    metadata: {
      title: "Leaderboard shift",
      message: "Akira moved into the top 3 after review completion.",
      scoreDelta: 45,
      leaderboardRank: 3,
    },
  },
];

sampleActivities.forEach((activity) => activityStore.add(activity));

const roomName = {
  all: "feed:all",
  type: (type: ActivityType) => `type:${type}`,
  user: (userId: string) => `user:${userId}`,
  bounty: (bountyId: string) => `bounty:${bountyId}`,
};

const detachFromDynamicRooms = (socket: Socket<ClientToServerEvents, ServerToClientEvents>): void => {
  for (const joinedRoom of socket.rooms) {
    if (joinedRoom === socket.id) {
      continue;
    }
    if (joinedRoom.startsWith("type:") || joinedRoom.startsWith("user:") || joinedRoom.startsWith("bounty:") || joinedRoom === roomName.all) {
      socket.leave(joinedRoom);
    }
  }
};

const applySubscriptionRooms = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  subscription: ActivitySubscription
): void => {
  detachFromDynamicRooms(socket);
  if (!subscription.notifications.enabled) {
    return;
  }
  const { filter, notifications } = subscription;
  const activeTypes = filter.types.filter((type) => !notifications.mutedTypes.includes(type));
  if (!activeTypes.length && filter.userIds.length === 0 && filter.bountyIds.length === 0) {
    return;
  }
  if (!filter.types.length && !filter.userIds.length && !filter.bountyIds.length && !notifications.mutedTypes.length) {
    socket.join(roomName.all);
    return;
  }
  for (const type of activeTypes) {
    socket.join(roomName.type(type));
  }
  for (const userId of filter.userIds) {
    socket.join(roomName.user(userId));
  }
  for (const bountyId of filter.bountyIds) {
    socket.join(roomName.bounty(bountyId));
  }
};

const queueActivity = (activity: ActivityEvent): void => {
  activityStore.add(activity);
  pendingActivities.push(activity);
};

setInterval(() => {
  if (!pendingActivities.length) {
    return;
  }

  const batch = pendingActivities.splice(0, pendingActivities.length);
  const deliveredAt = new Date().toISOString();
  io.to(roomName.all).emit(SOCKET_EVENTS.BATCH, { activities: batch, deliveredAt });

  for (const activity of batch) {
    let broadcaster = io.except(roomName.all).to(roomName.type(activity.type)).to(roomName.user(activity.actor.id));
    if (activity.metadata.bountyId) {
      broadcaster = broadcaster.to(roomName.bounty(activity.metadata.bountyId));
    }
    broadcaster.emit(SOCKET_EVENTS.BATCH, { activities: [activity], deliveredAt });
  }
}, FLUSH_INTERVAL_MS);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", now: new Date().toISOString() });
});

app.get("/api/activities", (req, res) => {
  const query: ActivityQuery = {
    since: typeof req.query.since === "string" ? req.query.since : undefined,
    limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    types:
      typeof req.query.types === "string"
        ? req.query.types.split(",").filter(isActivityType)
        : undefined,
    userIds:
      typeof req.query.userIds === "string" && req.query.userIds.length
        ? req.query.userIds.split(",")
        : undefined,
    bountyIds:
      typeof req.query.bountyIds === "string" && req.query.bountyIds.length
        ? req.query.bountyIds.split(",")
        : undefined,
  };

  const activities = activityStore.list(query);
  res.json({
    activities,
    serverTime: new Date().toISOString(),
    nextSince: activities.length ? activities[activities.length - 1]?.createdAt ?? null : query.since ?? null,
  });
});

app.post("/api/activities", (req, res) => {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid activity payload", errors: parsed.error.flatten() });
    return;
  }

  const activity: ActivityEvent = {
    ...parsed.data,
    id: parsed.data.id ?? crypto.randomUUID(),
    createdAt: parsed.data.createdAt ?? new Date().toISOString(),
  };

  queueActivity(activity);
  res.status(202).json({ queued: true, activity });
});

io.on("connection", (socket) => {
  const requestedUserId = socket.handshake.query.userId?.toString() ?? "anonymous";
  const sanitizedUserId = requestedUserId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anonymous";
  const initialSubscription = defaultSubscription(sanitizedUserId);
  socket.data.subscription = initialSubscription;
  applySubscriptionRooms(socket, initialSubscription);

  const payload: ConnectedPayload = {
    socketId: socket.id,
    serverTime: new Date().toISOString(),
    mode: "websocket",
  };
  socket.emit(SOCKET_EVENTS.CONNECTED, payload);

  socket.on(SOCKET_EVENTS.UPDATE_PREFERENCES, (incoming, acknowledgement) => {
    if (!socketLimiter.consume(socket.id)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Preference update rate limit exceeded" });
      return;
    }

    const parsed = subscriptionSchema.safeParse(incoming);
    if (!parsed.success) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: "Invalid preference payload" });
      return;
    }

    socket.data.subscription = parsed.data;
    applySubscriptionRooms(socket, parsed.data);
    const response: PreferencesUpdatedPayload = { subscription: parsed.data };
    acknowledgement?.(response);
    socket.emit(SOCKET_EVENTS.PREFERENCES_UPDATED, response);
  });
});

server.listen(PORT, () => {
  console.log(`SolFoundry activity feed server listening on :${PORT}`);
});
