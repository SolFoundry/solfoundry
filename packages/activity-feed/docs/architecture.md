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
2. The server validates the payload, stores it in the bounded activity buffer, and places it in a throttled broadcast queue.
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

## Operational constraints

- HTTP event ingestion and socket preference updates are rate limited in memory.
- Broadcasts are throttled to reduce fan-out pressure during bursts.
- Activity history is capped in memory and intended to be replaceable with Redis or a database-backed event log in a larger deployment.
