"""Notification API endpoints.

## Overview

Notifications keep users informed about bounty-related events. Each notification has:
- **Type**: Event type (bounty_claimed, pr_submitted, etc.)
- **Title**: Short title
- **Message**: Detailed message
- **Read Status**: Whether the user has read it

## Notification Types

| Type | Description |
|------|-------------|
| bounty_claimed | Someone claimed your bounty |
| pr_submitted | A PR was submitted for your bounty |
| review_complete | Your PR review is complete |
| payout_sent | $FNDRY payout was sent to your wallet |
| bounty_expired | A bounty you're watching expired |
| rank_changed | Your leaderboard rank changed |

## Authentication Required

All notification endpoints require authentication:
- Bearer token in `Authorization` header, or
- `X-User-ID` header (development only)

## Rate Limits

- List notifications: 60 requests/minute
- Mark as read: 60 requests/minute
- Create notification: Internal only

## WebSocket Events

Real-time notifications are also available via WebSocket:

```javascript
const ws = new WebSocket('wss://api.solfoundry.org/ws/notifications');
ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  // Handle notification
};
```
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    NotificationCreate,
)
from app.services.notification_service import NotificationService
from app.database import get_db
from app.auth import get_current_user_id, get_authenticated_user, AuthenticatedUser

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List user notifications",
    description="""
Get paginated notifications for the authenticated user.

## Authentication Required

This endpoint requires authentication. Include either:
- `Authorization: Bearer <token>` header
- `X-User-ID: <uuid>` header (development only)

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| items | array | List of notification objects |
| total | integer | Total notifications |
| unread_count | integer | Number of unread notifications |
| skip | integer | Pagination offset |
| limit | integer | Results per page |

## Rate Limit

60 requests per minute.
""",
    responses={
        200: {
            "description": "List of notifications",
            "content": {
                "application/json": {
                    "example": {
                        "items": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440000",
                                "notification_type": "payout_sent",
                                "title": "Bounty Payout Received",
                                "message": "You received 500 $FNDRY for completing 'Implement wallet connection'",
                                "read": False,
                                "bounty_id": "660e8400-e29b-41d4-a716-446655440001",
                                "created_at": "2024-01-15T10:30:00Z"
                            }
                        ],
                        "total": 25,
                        "unread_count": 3,
                        "skip": 0,
                        "limit": 20
                    }
                }
            }
        },
        401: {"description": "Unauthorized - missing or invalid authentication"}
    }
)
async def list_notifications(
    unread_only: bool = Query(False, description="Only return unread notifications"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get paginated notifications for the authenticated user.

    Returns notifications sorted by creation date (newest first).

    - **unread_only**: If true, only return unread notifications
    - **skip**: Pagination offset
    - **limit**: Number of results per page

    **Authentication**: Requires valid Bearer token or X-User-ID header.
    """
    service = NotificationService(db)
    return await service.get_notifications(
        user_id=user_id,
        unread_only=unread_only,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    summary="Get unread notification count",
    description="""
Get the number of unread notifications for the authenticated user.

## Authentication Required

This endpoint requires authentication.

## Use Case

Use this endpoint to display a notification badge count in your UI.

## Rate Limit

60 requests per minute.
""",
    responses={
        200: {
            "description": "Unread count",
            "content": {
                "application/json": {
                    "example": {"unread_count": 5}
                }
            }
        },
        401: {"description": "Unauthorized"}
    }
)
async def get_unread_count(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get unread notification count for the authenticated user.

    Returns the number of unread notifications.

    **Authentication**: Requires valid Bearer token or X-User-ID header.
    """
    service = NotificationService(db)
    return await service.get_unread_count(user_id)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark notification as read",
    description="""
Mark a specific notification as read.

## Authentication Required

This endpoint requires authentication. Users can only mark their own notifications as read.

## Authorization

Users can only mark notifications that belong to them. Attempting to mark another user's notification will return 404.

## Rate Limit

60 requests per minute.
""",
    responses={
        200: {
            "description": "Notification marked as read",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "notification_type": "payout_sent",
                        "title": "Bounty Payout Received",
                        "message": "You received 500 $FNDRY",
                        "read": True,
                        "bounty_id": "660e8400-e29b-41d4-a716-446655440001",
                        "created_at": "2024-01-15T10:30:00Z"
                    }
                }
            }
        },
        401: {"description": "Unauthorized"},
        404: {"description": "Notification not found"}
    }
)
async def mark_notification_read(
    notification_id: str,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a notification as read.

    - **notification_id**: ID of the notification to mark

    Returns the updated notification.

    **Authentication**: Requires valid Bearer token or X-User-ID header.

    **Authorization**: Users can only mark their own notifications as read.

    Raises:
        404: If notification not found or not owned by user.
    """
    service = NotificationService(db)

    # Get notification to verify ownership
    notification = await service.get_notification_by_id(notification_id)

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )

    # Verify ownership
    if not user.owns_resource(str(notification.user_id)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )

    success = await service.mark_as_read(notification_id, str(notification.user_id))

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark notification as read",
        )

    return NotificationResponse.model_validate(notification)


@router.post(
    "/read-all",
    summary="Mark all notifications as read",
    description="""
Mark all notifications as read for the authenticated user.

## Authentication Required

This endpoint requires authentication.

## Response

Returns the count of notifications marked as read.

## Rate Limit

60 requests per minute.
""",
    responses={
        200: {
            "description": "All notifications marked as read",
            "content": {
                "application/json": {
                    "example": {"message": "Marked 5 notifications as read", "count": 5}
                }
            }
        },
        401: {"description": "Unauthorized"}
    }
)
async def mark_all_notifications_read(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark all notifications as read for the authenticated user.

    Returns the number of notifications marked as read.

    **Authentication**: Requires valid Bearer token or X-User-ID header.
    """
    service = NotificationService(db)
    count = await service.mark_all_as_read(user_id)

    return {"message": f"Marked {count} notifications as read", "count": count}


@router.post(
    "",
    response_model=NotificationResponse,
    status_code=201,
    summary="Create a notification",
    description="""
Create a new notification for a user.

## Internal Use Only

This endpoint is typically called by backend services internally.
It should be protected by API key or restricted to internal access in production.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_id | string | Yes | User to notify (UUID) |
| notification_type | string | Yes | Type of notification |
| title | string | Yes | Short title (max 255 chars) |
| message | string | Yes | Detailed message |
| bounty_id | string | No | Related bounty ID |
| metadata | object | No | Additional context |

## Notification Types

- `bounty_claimed`: Someone claimed a bounty
- `pr_submitted`: PR submitted for bounty
- `review_complete`: Review finished
- `payout_sent`: $FNDRY payout sent
- `bounty_expired`: Bounty expired
- `rank_changed`: Leaderboard rank changed

## Rate Limit

This endpoint has special rate limiting for internal services.
""",
    responses={
        201: {
            "description": "Notification created",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "user_id": "660e8400-e29b-41d4-a716-446655440001",
                        "notification_type": "payout_sent",
                        "title": "Bounty Payout",
                        "message": "You received 500 $FNDRY",
                        "read": False,
                        "bounty_id": "770e8400-e29b-41d4-a716-446655440002",
                        "created_at": "2024-01-15T10:30:00Z"
                    }
                }
            }
        },
        400: {"description": "Invalid notification data"}
    }
)
async def create_notification(
    notification: NotificationCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new notification.

    This endpoint is typically called by other services internally.
    It does not require authentication as it's used by backend services.

    - **user_id**: User to notify
    - **notification_type**: Type of notification (bounty_claimed, pr_submitted, etc.)
    - **title**: Short title
    - **message**: Detailed message
    - **bounty_id**: Related bounty ID (optional)
    - **metadata**: Additional context (optional)

    Note: This endpoint should be protected by API key or internal-only access
    in production.
    """
    service = NotificationService(db)

    try:
        notification_db = await service.create_notification(notification)

        # Refresh to get generated fields
        await db.refresh(notification_db)

        return NotificationResponse.model_validate(notification_db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))