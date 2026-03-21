# Notification API

Complete reference for notification-related endpoints.

## Overview

Notifications keep users informed about bounty-related events. The Notification API allows you to:

- List and filter notifications
- Mark notifications as read
- Get unread counts
- Create notifications (internal)

## Authentication Required

All notification endpoints require authentication:

```bash
curl -H "Authorization: Bearer your-token" \
  https://api.solfoundry.org/api/notifications
```

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications |
| GET | `/api/notifications/unread-count` | Get unread count |
| PATCH | `/api/notifications/{id}/read` | Mark as read |
| POST | `/api/notifications/read-all` | Mark all as read |
| POST | `/api/notifications` | Create notification |

## Notification Types

| Type | Description |
|------|-------------|
| `bounty_claimed` | Someone claimed your bounty |
| `pr_submitted` | A PR was submitted for your bounty |
| `review_complete` | Your PR review is complete |
| `payout_sent` | $FNDRY payout was sent to your wallet |
| `bounty_expired` | A bounty you're watching expired |
| `rank_changed` | Your leaderboard rank changed |

## List Notifications

Get paginated notifications for the authenticated user.

### Request

```http
GET /api/notifications?unread_only=false&limit=20
Authorization: Bearer your-token
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `unread_only` | boolean | No | Only return unread (default: false) |
| `skip` | integer | No | Pagination offset (default: 0) |
| `limit` | integer | No | Results per page (default: 20, max: 100) |

### Response

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "notification_type": "payout_sent",
      "title": "Bounty Payout Received",
      "message": "You received 500 $FNDRY for completing 'Implement wallet connection component'",
      "read": false,
      "bounty_id": "660e8400-e29b-41d4-a716-446655440001",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 25,
  "unread_count": 3,
  "skip": 0,
  "limit": 20
}
```

### Example

```bash
# Get all notifications
curl -H "Authorization: Bearer token" \
  "https://api.solfoundry.org/api/notifications"

# Get only unread notifications
curl -H "Authorization: Bearer token" \
  "https://api.solfoundry.org/api/notifications?unread_only=true"
```

## Get Unread Count

Get the number of unread notifications.

### Request

```http
GET /api/notifications/unread-count
Authorization: Bearer your-token
```

### Response

```json
{
  "unread_count": 5
}
```

### Use Case

Use this endpoint to display a notification badge in your UI:

```javascript
async function updateBadge() {
  const response = await fetch('/api/notifications/unread-count', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { unread_count } = await response.json();
  
  // Update badge
  document.getElementById('notification-badge').textContent = unread_count;
  document.getElementById('notification-badge').hidden = unread_count === 0;
}
```

## Mark as Read

Mark a specific notification as read.

### Request

```http
PATCH /api/notifications/550e8400-e29b-41d4-a716-446655440000/read
Authorization: Bearer your-token
```

### Response

Returns the updated notification:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "notification_type": "payout_sent",
  "title": "Bounty Payout Received",
  "message": "You received 500 $FNDRY",
  "read": true,
  "bounty_id": "660e8400-e29b-41d4-a716-446655440001",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Authorization

Users can only mark their own notifications as read. Attempting to mark another user's notification returns `404 Not Found`.

## Mark All as Read

Mark all notifications as read for the authenticated user.

### Request

```http
POST /api/notifications/read-all
Authorization: Bearer your-token
```

### Response

```json
{
  "message": "Marked 5 notifications as read",
  "count": 5
}
```

## Create Notification

Create a new notification (internal use).

> **Note**: This endpoint is for internal services. It should be protected by API key in production.

### Request

```http
POST /api/notifications
Content-Type: application/json

{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "notification_type": "payout_sent",
  "title": "Bounty Payout",
  "message": "You received 500 $FNDRY for completing the bounty",
  "bounty_id": "660e8400-e29b-41d4-a716-446655440001",
  "metadata": {
    "amount": 500,
    "tx_signature": "abc123..."
  }
}
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | User to notify (UUID) |
| `notification_type` | string | Yes | Type of notification |
| `title` | string | Yes | Short title (max 255 chars) |
| `message` | string | Yes | Detailed message |
| `bounty_id` | string | No | Related bounty ID |
| `metadata` | object | No | Additional context |

### Response

Returns `201 Created` with the created notification.

## Notification Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (UUID) |
| `notification_type` | string | Type of notification |
| `title` | string | Short title |
| `message` | string | Detailed message |
| `read` | boolean | Whether read by user |
| `bounty_id` | string | Related bounty ID (optional) |
| `created_at` | datetime | Creation timestamp |

## Real-time Updates

For real-time notifications, use WebSocket:

```javascript
const ws = new WebSocket('wss://api.solfoundry.org/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['notifications']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.event === 'notification:new') {
    const notification = message.data;
    console.log('New notification:', notification);
    // Update UI
  }
};
```

## Rate Limit

| Endpoint | Rate Limit |
|----------|------------|
| GET /api/notifications | 60 requests/minute |
| GET /api/notifications/unread-count | 60 requests/minute |
| PATCH /api/notifications/{id}/read | 60 requests/minute |
| POST /api/notifications/read-all | 60 requests/minute |

## Best Practices

1. **Use WebSocket** - For real-time updates instead of polling
2. **Batch mark as read** - Use read-all instead of individual marks
3. **Cache unread count** - Don't refresh too frequently
4. **Handle pagination** - For users with many notifications

## Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized - missing or invalid token |
| 404 | Notification not found |
| 500 | Failed to mark as read |