# SolFoundry Activity Feed API

## Overview

The activity feed system exposes a Socket.io channel for live delivery and an HTTP polling endpoint for resilience when WebSocket transport is unavailable.

## Socket.io

- Namespace: `/`
- Transport preference: WebSocket first, polling enabled as a secondary Socket.io transport
- Query parameters:
  - `userId`: used to seed the initial subscription identity
- Optional socket authentication: set `ACTIVITY_FEED_SOCKET_TOKEN` on the server
  and pass the same value as the Socket.io `auth.token` (the demo client reads
  `VITE_WS_AUTH_TOKEN`). When configured, unauthenticated sockets are rejected.
- Room identifiers are sanitized to alphanumerics, dashes, and underscores with
  a 64-character cap before joining user or bounty rooms.

### Server events

- `activity:connected`
  - Payload: `{ socketId, serverTime, mode }`
- `activity:batch`
  - Payload: `{ activities, deliveredAt, nextSince }`
- `preferences:updated`
  - Payload: `{ subscription }`
- `activity:error`
  - Payload: `{ message }`

### Client events

- `preferences:update`
  - Payload:
    - `userId`
    - `filter.types`
    - `filter.userIds`
    - `filter.bountyIds`
    - `notifications.enabled`
    - `notifications.inAppOnly`
    - `notifications.mutedTypes`

## HTTP endpoints

### `GET /health`

Health probe endpoint for container and uptime checks.

### `GET /api/activities`

Returns activity records for polling fallback and initial hydration.

Query parameters:

- `since`: ISO-8601 timestamp. Only activities after this point are returned.
- `limit`: max `100`.
- `types`: comma-separated activity types.
- `userIds`: comma-separated actor IDs.
- `bountyIds`: comma-separated bounty IDs.

The response includes `nextSince`, the server-selected cursor clients should use
for the next polling request.

Example:

```http
GET /api/activities?since=2026-04-04T00:00:00.000Z&types=bounty_posted,submission_created&bountyIds=b-100
```

### `POST /api/activities`

Queues a new activity for throttled broadcast.

Requests must include `x-api-key` matching `ACTIVITY_FEED_API_KEY` (or the
legacy alias `ACTIVITY_FEED_INGEST_API_KEY`). If no key is configured, ingestion
fails closed with `503` by default. Local-only demos can explicitly set
`ACTIVITY_FEED_REQUIRE_API_KEY=false`, but production deployments should replace
this shared-key gate with existing JWT/session middleware and bind actor identity
from the authenticated principal rather than trusting client input.

Example:

```json
{
  "type": "review_completed",
  "actor": {
    "id": "u-9",
    "handle": "maya",
    "displayName": "Maya T."
  },
  "metadata": {
    "title": "Review completed",
    "message": "Security review signed off for the indexing submission.",
    "bountyId": "b-100",
    "bountyTitle": "Validator Telemetry Indexer",
    "reviewId": "r-202"
  }
}
```

## Delivery model

- Activities are stored in a bounded in-memory history buffer (`MAX_ACTIVITY_HISTORY`).
- Broadcasts are throttled by `FLUSH_INTERVAL_MS`.
- User subscriptions are translated into Socket.io rooms for type, actor, and bounty affinity.
- Socket preference updates and HTTP ingestion are rate limited in-memory. HTTP rate limiting keys use Express' client IP resolution and socket remote address; set `ACTIVITY_FEED_TRUST_PROXY` only for trusted reverse proxies.
- Authentication in this reference implementation is intentionally lightweight:
  a required shared key protects event ingestion, and an optional shared key can
  protect socket connections. Full multi-tenant authorization should be enforced
  by the host application before exposing arbitrary user rooms or accepting actor
  identities.
