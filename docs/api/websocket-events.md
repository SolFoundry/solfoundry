# WebSocket Events

Real-time updates via WebSocket connections.

## Overview

SolFoundry provides WebSocket connections for real-time updates without polling. This is ideal for:

- Live notification updates
- Bounty status changes
- Leaderboard updates
- Real-time PR tracking

## Connection

### Endpoint

```
wss://api.solfoundry.org/ws
```

### Connection Example

```javascript
const ws = new WebSocket('wss://api.solfoundry.org/ws');

ws.onopen = () => {
  console.log('Connected to SolFoundry WebSocket');
  
  // Subscribe to channels
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['notifications', 'bounties']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from WebSocket');
};
```

## Authentication

### Token-based Authentication

```javascript
const ws = new WebSocket('wss://api.solfoundry.org/ws?token=your-jwt-token');
```

### Subscribe After Connection

```javascript
ws.send(JSON.stringify({
  type: 'authenticate',
  token: 'your-jwt-token'
}));
```

## Channels

Subscribe to specific channels to receive relevant updates.

| Channel | Description |
|---------|-------------|
| `notifications` | User notifications |
| `bounties` | Bounty status changes |
| `leaderboard` | Top contributor changes |
| `pr:{id}` | Specific PR updates |
| `bounty:{id}` | Specific bounty updates |

## Message Types

### Subscribe

Subscribe to channels:

```json
{
  "type": "subscribe",
  "channels": ["notifications", "bounties"]
}
```

Response:
```json
{
  "type": "subscribed",
  "channels": ["notifications", "bounties"]
}
```

### Unsubscribe

Unsubscribe from channels:

```json
{
  "type": "unsubscribe",
  "channels": ["leaderboard"]
}
```

### Ping/Pong

Keep connection alive:

```json
{
  "type": "ping"
}
```

Response:
```json
{
  "type": "pong",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Event Types

### Bounty Events

#### bounty:created

New bounty posted:

```json
{
  "type": "event",
  "channel": "bounties",
  "event": "bounty:created",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Implement wallet connection",
    "tier": 1,
    "reward_amount": 200.0,
    "category": "frontend"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### bounty:claimed

Bounty claimed by contributor:

```json
{
  "type": "event",
  "channel": "bounties",
  "event": "bounty:claimed",
  "data": {
    "bounty_id": "550e8400-...",
    "claimant_id": "660e8400-...",
    "claimant_username": "developer",
    "claimed_at": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### bounty:completed

Bounty completed and merged:

```json
{
  "type": "event",
  "channel": "bounties",
  "event": "bounty:completed",
  "data": {
    "bounty_id": "550e8400-...",
    "winner_id": "660e8400-...",
    "winner_username": "developer",
    "pr_number": 42,
    "reward": 200.0
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### bounty:cancelled

Bounty cancelled:

```json
{
  "type": "event",
  "channel": "bounties",
  "event": "bounty:cancelled",
  "data": {
    "bounty_id": "550e8400-...",
    "reason": "Requirements changed"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Notification Events

#### notification:new

New notification received:

```json
{
  "type": "event",
  "channel": "notifications",
  "event": "notification:new",
  "data": {
    "id": "550e8400-...",
    "notification_type": "payout_sent",
    "title": "Bounty Payout Received",
    "message": "You received 500 $FNDRY",
    "bounty_id": "660e8400-...",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### PR Events

#### pr:opened

New PR submitted:

```json
{
  "type": "event",
  "channel": "pr:42",
  "event": "pr:opened",
  "data": {
    "pr_number": 42,
    "bounty_id": "550e8400-...",
    "author": "developer",
    "title": "Implement wallet connection"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### pr:review_started

Review pipeline started:

```json
{
  "type": "event",
  "channel": "pr:42",
  "event": "pr:review_started",
  "data": {
    "pr_number": 42,
    "stage": "ci_check"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### pr:review_complete

Review finished:

```json
{
  "type": "event",
  "channel": "pr:42",
  "event": "pr:review_complete",
  "data": {
    "pr_number": 42,
    "score": 8.5,
    "verdict": "approved",
    "feedback": "Great implementation with good test coverage."
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### pr:merged

PR merged successfully:

```json
{
  "type": "event",
  "channel": "pr:42",
  "event": "pr:merged",
  "data": {
    "pr_number": 42,
    "bounty_id": "550e8400-...",
    "reward": 500.0,
    "merged_at": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Leaderboard Events

#### leaderboard:changed

Top 10 changed:

```json
{
  "type": "event",
  "channel": "leaderboard",
  "event": "leaderboard:changed",
  "data": {
    "period": "week",
    "changes": [
      {
        "username": "developer",
        "old_rank": 3,
        "new_rank": 2
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Reconnection

Handle disconnections gracefully:

```javascript
let ws;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 1000;

function connect() {
  ws = new WebSocket('wss://api.solfoundry.org/ws');
  
  ws.onopen = () => {
    reconnectAttempts = 0;
    console.log('Connected');
  };
  
  ws.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      setTimeout(connect, reconnectDelay * reconnectAttempts);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

connect();
```

## Error Handling

### Error Messages

```json
{
  "type": "error",
  "code": "AUTHENTICATION_FAILED",
  "message": "Invalid or expired token"
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_FAILED` | Invalid or expired token |
| `SUBSCRIPTION_DENIED` | Not authorized for channel |
| `RATE_LIMITED` | Too many messages |
| `INVALID_MESSAGE` | Malformed message |
| `CHANNEL_NOT_FOUND` | Channel doesn't exist |

## Rate Limits

| Action | Limit |
|--------|-------|
| Messages sent | 100/minute |
| Subscriptions | 20/channels |
| Connection duration | 24 hours |

## Best Practices

1. **Use heartbeats** - Send ping every 30 seconds
2. **Handle reconnection** - Implement exponential backoff
3. **Subscribe selectively** - Only subscribe to needed channels
4. **Process messages async** - Don't block message handler
5. **Validate messages** - Check message type before processing
6. **Store state locally** - Don't re-request data on reconnect