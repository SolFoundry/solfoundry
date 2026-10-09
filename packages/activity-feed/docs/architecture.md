# Activity Feed Architecture

## Topology

- `shared/` defines the canonical event, filter, and Socket.io payload types.
- `server/` exposes:
  - Express REST endpoints for health checks, polling fallback, and event ingestion
  - Socket.io for live delivery and preference synchronization
- `client/` consumes both:
  - Socket.io as the primary transport
  - HTTP polling as the resilience layer after repeated socket failures

## Event flow

1. Producers `POST /api/activities`.
2. The server rate-limits the request, verifies `x-api-key` against `ACTIVITY_FEED_API_KEY` (or `ACTIVITY_FEED_INGEST_API_KEY`), validates the payload, stores it in the bounded activity buffer, and places it in a throttled broadcast queue.
3. Every flush interval, the server emits activity batches to:
   - `feed:all`
   - type rooms
   - actor rooms
   - bounty rooms
4. The client merges batches into a local de-duplicated stream and preserves the latest cursor for polling fallback.

## Resilience strategy

- Socket reconnect attempts use exponential backoff.
- After the retry budget is exhausted, the client transitions to polling mode.
- Manual retry allows the UI to reattempt live sync without a full reload.
- Polling requests keep using the active filter so transport fallback preserves user intent.
- Socket connections can be guarded with `ACTIVITY_FEED_SOCKET_TOKEN`; when set,
  clients must send the matching Socket.io auth token before they can subscribe
  to rooms.

## Operational constraints

- HTTP event ingestion and socket preference updates are rate limited in memory, so limits apply per instance rather than globally across a cluster.
- Broadcasts are throttled to reduce fan-out pressure during bursts, but each node throttles independently in a multi-instance deployment.
- Activity history is currently provided by the `ActivityStore` interface's in-memory implementation and is capped per process. Swap this implementation for Redis, Postgres, or a durable event log before relying on restart-safe history or horizontal scaling.
- For consistent delivery, abuse protection, and history across multiple nodes, centralize state with a shared store such as Redis or a durable event log, and pair it with a distributed rate limiter.
- The built-in authentication hooks are shared-key guardrails for the reference
  package, not a full identity system. Event ingestion fails closed unless an API
  key is configured or the local-demo override is explicitly enabled. Production
  deployments should inject existing JWT/session validation, derive actor
  identity server-side, and enforce authorization before joining user-specific
  rooms.
