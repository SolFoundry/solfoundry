# SolFoundry Activity Feed API

## Overview

The activity feed system exposes a Socket.io channel for live delivery and an HTTP polling endpoint for resilience when WebSocket transport is unavailable.

## Socket.io

- Namespace: `/`
- Transport preference: WebSocket first, polling enabled as a secondary Socket.io transport
- Query parameters:
  - `userId`: used to seed the initial subscription identity

### Server events

- `activity:connected`
  - Payload: `{ socketId, serverTime, mode }`
- `activity:batch`
  - Payload: `{ activities, deliveredAt }`
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

Example:

```http
GET /api/activities?since=2026-04-04T00:00:00.000Z&types=bounty_posted,submission_created&bountyIds=b-100
```

### `POST /api/activities`

Queues a new activity for throttled broadcast.

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
- Socket preference updates and HTTP ingestion are rate limited in-memory.
