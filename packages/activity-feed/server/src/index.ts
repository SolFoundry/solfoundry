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
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5174";
const TRUST_PROXY = process.env.ACTIVITY_FEED_TRUST_PROXY;
const MAX_ACTIVITY_HISTORY = Number(process.env.MAX_ACTIVITY_HISTORY ?? 500);
const FLUSH_INTERVAL_MS = Number(process.env.FLUSH_INTERVAL_MS ?? 500);
const SOCKET_RATE_LIMIT_WINDOW_MS = 10_000;
const SOCKET_RATE_LIMIT_MAX = 25;
const API_RATE_LIMIT_WINDOW_MS = 60_000;
const API_RATE_LIMIT_MAX = 120;
const INGEST_API_KEY = process.env.ACTIVITY_FEED_API_KEY ?? process.env.ACTIVITY_FEED_INGEST_API_KEY;
const REQUIRE_INGEST_API_KEY = process.env.ACTIVITY_FEED_REQUIRE_API_KEY !== "false";
const SOCKET_AUTH_TOKEN = process.env.ACTIVITY_FEED_SOCKET_TOKEN;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const safeIdSchema = z.string().trim().regex(SAFE_ID_PATTERN).max(64);

const activitySchema = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(ACTIVITY_TYPES),
  createdAt: z.string().datetime().optional(),
  actor: z.object({
    id: safeIdSchema,
    handle: z.string().min(1),
    displayName: z.string().min(1),
  }),
  metadata: z.object({
    title: z.string().min(1),
    message: z.string().min(1),
    bountyId: safeIdSchema.optional(),
    bountyTitle: z.string().min(1).optional(),
    scoreDelta: z.number().optional(),
    submissionId: z.string().min(1).optional(),
    reviewId: z.string().min(1).optional(),
    leaderboardRank: z.number().optional(),
  }),
});

const subscriptionSchema = z.object({
  userId: safeIdSchema,
  filter: z.object({
    types: z.array(z.enum(ACTIVITY_TYPES)).default(defaultFilter.types),
    userIds: z.array(safeIdSchema).default([]),
    bountyIds: z.array(safeIdSchema).default([]),
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

interface ActivityStore {
  add(activity: ActivityEvent): void;
  list(query: ActivityQuery): ActivityEvent[];
}

class InMemoryActivityStore implements ActivityStore {
  private readonly items: ActivityEvent[] = [];

  add(activity: ActivityEvent): void {
    this.items.unshift(activity);
    if (this.items.length > MAX_ACTIVITY_HISTORY) {
      this.items.length = MAX_ACTIVITY_HISTORY;
    }
  }

  /** Return retained activities using polling cursor semantics without skipping buffered events. */
  list(query: ActivityQuery): ActivityEvent[] {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const sinceEpoch = query.since ? Date.parse(query.since) : null;
    const matches = this.items.filter((activity) => matchesActivityQuery(activity, query, sinceEpoch));
    if (!sinceEpoch) {
      return matches.slice(0, limit);
    }

    return matches.slice(-limit);
  }
}

const matchesActivityQuery = (
  activity: ActivityEvent,
  query: ActivityQuery,
  sinceEpoch: number | null = query.since ? Date.parse(query.since) : null
): boolean => {
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
};

const matchesSubscription = (activity: ActivityEvent, subscription?: ActivitySubscription): boolean => {
  if (!subscription?.notifications.enabled) {
    return false;
  }
  if (subscription.notifications.mutedTypes.includes(activity.type)) {
    return false;
  }
  return matchesActivityQuery(activity, {
    types: subscription.filter.types,
    userIds: subscription.filter.userIds,
    bountyIds: subscription.filter.bountyIds,
  });
};

const activityStore: ActivityStore = new InMemoryActivityStore();
const socketLimiter = new SlidingWindowLimiter(SOCKET_RATE_LIMIT_WINDOW_MS, SOCKET_RATE_LIMIT_MAX);
const apiLimiter = new SlidingWindowLimiter(API_RATE_LIMIT_WINDOW_MS, API_RATE_LIMIT_MAX);
const pendingActivities: ActivityEvent[] = [];

const sanitizeRoomId = (value: unknown, fallback = "anonymous"): string => {
  const candidate = String(value ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return candidate || fallback;
};

const parseSafeIdList = (value: unknown): string[] | undefined => {
  if (typeof value !== "string" || !value.length) {
    return undefined;
  }
  const ids = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => SAFE_ID_PATTERN.test(entry));
  return ids.length ? ids : undefined;
};

const resolveClientKey = (req: express.Request): string | null =>
  req.ip ?? req.socket.remoteAddress ?? null;

const isAuthorizedSocket = (socket: Socket<ClientToServerEvents, ServerToClientEvents>): boolean => {
  if (!SOCKET_AUTH_TOKEN) {
    return true;
  }
  return socket.handshake.auth?.token === SOCKET_AUTH_TOKEN;
};

const requireIngestApiKey: express.RequestHandler = (req, res, next) => {
  if (!INGEST_API_KEY) {
    if (REQUIRE_INGEST_API_KEY) {
      res.status(503).json({ message: "Activity ingestion is disabled until ACTIVITY_FEED_API_KEY is configured" });
      return;
    }
    next();
    return;
  }

  if (req.header("x-api-key") !== INGEST_API_KEY) {
    res.status(401).json({ message: "Missing or invalid API key" });
    return;
  }

  next();
};

const app = express();
if (TRUST_PROXY) {
  app.set("trust proxy", TRUST_PROXY === "true" ? true : TRUST_PROXY === "false" ? false : TRUST_PROXY);
}
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "128kb" }));

app.use((req, res, next) => {
  const key = resolveClientKey(req);
  if (!key) {
    res.status(400).json({ message: "Unable to determine client identity" });
    return;
  }
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
  if (!filter.types.length && !filter.userIds.length && !filter.bountyIds.length && !notifications.mutedTypes.length) {
    socket.join(roomName.all);
    return;
  }
  if (filter.types.length && !activeTypes.length) {
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
  const nextSince = batch.reduce<string | null>((latest, activity) => {
    if (!latest || Date.parse(activity.createdAt) > Date.parse(latest)) {
      return activity.createdAt;
    }
    return latest;
  }, null);
  for (const socket of io.sockets.sockets.values()) {
    const subscription = socket.data.subscription as ActivitySubscription | undefined;
    const activities = batch.filter((activity) => matchesSubscription(activity, subscription));
    if (!activities.length) {
      continue;
    }
    const socketNextSince = activities.reduce<string | null>((latest, activity) => {
      if (!latest || Date.parse(activity.createdAt) > Date.parse(latest)) {
        return activity.createdAt;
      }
      return latest;
    }, null);
    socket.emit(SOCKET_EVENTS.BATCH, { activities, deliveredAt, nextSince: socketNextSince ?? nextSince });
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
    userIds: parseSafeIdList(req.query.userIds),
    bountyIds: parseSafeIdList(req.query.bountyIds),
  };

  const activities = activityStore.list(query);
  res.json({
    activities,
    serverTime: new Date().toISOString(),
    nextSince: activities.reduce<string | null>((latest, activity) => {
      if (!latest || Date.parse(activity.createdAt) > Date.parse(latest)) {
        return activity.createdAt;
      }
      return latest;
    }, query.since ?? null),
  });
});

app.post("/api/activities", requireIngestApiKey, (req, res) => {
  const parsed = activitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid activity payload", errors: parsed.error.flatten() });
    return;
  }

  const activity: ActivityEvent = {
    ...parsed.data,
    id: parsed.data.id ?? crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  queueActivity(activity);
  res.status(202).json({ queued: true, activity });
});

io.on("connection", (socket) => {
  if (!isAuthorizedSocket(socket)) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: "Unauthorized socket connection" });
    socket.disconnect(true);
    return;
  }

  const sanitizedUserId = sanitizeRoomId(socket.handshake.query.userId);
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

    const sanitizedSubscription: ActivitySubscription = {
      ...parsed.data,
      userId: sanitizedUserId,
      filter: {
        ...parsed.data.filter,
        userIds: parsed.data.filter.userIds.map((userId) => sanitizeRoomId(userId)),
        bountyIds: parsed.data.filter.bountyIds.map((bountyId) => sanitizeRoomId(bountyId, "bounty")),
      },
    };

    socket.data.subscription = sanitizedSubscription;
    applySubscriptionRooms(socket, sanitizedSubscription);
    const response: PreferencesUpdatedPayload = { subscription: sanitizedSubscription };
    acknowledgement?.(response);
    socket.emit(SOCKET_EVENTS.PREFERENCES_UPDATED, response);
  });
});

server.listen(PORT, () => {
  console.log(`SolFoundry activity feed server listening on :${PORT}`);
});
