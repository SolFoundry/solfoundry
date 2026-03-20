"""Notification API endpoints.

This module provides REST endpoints for the notification system.
All endpoints require authentication to ensure users can only access
their own notifications.
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

router = APIRouter(prefix="/notifications", tags=["notifications"])

# ---------------------------------------------------------------------------
# Common response schemas
# ---------------------------------------------------------------------------

_401 = {
    "description": "Missing or invalid authentication token",
    "content": {"application/json": {"example": {"detail": "Token has expired"}}},
}
_404 = {
    "description": "Notification not found or not owned by the authenticated user",
    "content": {"application/json": {"example": {"detail": "Notification not found"}}},
}

_NOTIFICATION_EXAMPLE = {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "660e8400-e29b-41d4-a716-446655440000",
    "notification_type": "payout_sent",
    "title": "Payout confirmed!",
    "message": "750 FNDRY has been sent to your wallet for 'Fix escrow unlock race condition'",
    "read": False,
    "bounty_id": "abc123",
    "created_at": "2024-01-20T15:30:00Z",
    "extra_data": {"tx_hash": "5UfgJ5vVZx...", "amount": 750, "token": "FNDRY"},
}


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List notifications",
    description="""
Returns paginated notifications for the authenticated user, sorted by creation date (newest first).

**Notification types:**

| type | Trigger |
|------|---------|
| `bounty_claimed` | Someone claimed a bounty you created |
| `pr_submitted` | A PR was submitted on your bounty |
| `review_complete` | Your submission was reviewed |
| `payout_sent` | On-chain payout confirmed to your wallet |
| `bounty_expired` | A bounty you were working on has expired |
| `rank_changed` | Your leaderboard rank changed |

Set `unread_only=true` to poll for new notifications.
""",
    responses={
        200: {
            "description": "Paginated notification list",
            "content": {
                "application/json": {
                    "example": {
                        "items": [_NOTIFICATION_EXAMPLE],
                        "total": 5,
                        "unread_count": 2,
                        "skip": 0,
                        "limit": 20,
                    }
                }
            },
        },
        401: _401,
    },
)
async def list_notifications(
    unread_only: bool = Query(
        False,
        description="If `true`, return only unread notifications",
    ),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page (max 100)"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get paginated notifications for the authenticated user.
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
Returns the number of unread notifications for the authenticated user.

Poll this endpoint periodically (or use WebSocket `user:<id>` channel) to
display a notification badge in your UI.
""",
    responses={
        200: {
            "description": "Unread notification count",
            "content": {
                "application/json": {
                    "example": {"count": 3}
                }
            },
        },
        401: _401,
    },
)
async def get_unread_count(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get unread notification count for the authenticated user."""
    service = NotificationService(db)
    return await service.get_unread_count(user_id)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a notification as read",
    description="""
Mark a single notification as read. Returns the updated notification.

Users can only mark their **own** notifications as read.
Attempts to access another user's notification return **404** (not 403)
to avoid leaking notification existence.
""",
    responses={
        200: {
            "description": "Notification marked as read",
            "content": {"application/json": {"example": {**_NOTIFICATION_EXAMPLE, "read": True}}},
        },
        401: _401,
        404: _404,
    },
)
async def mark_notification_read(
    notification_id: str,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
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
Mark all unread notifications as read for the authenticated user.

Returns the number of notifications that were marked.
""",
    responses={
        200: {
            "description": "All notifications marked as read",
            "content": {
                "application/json": {
                    "example": {"message": "Marked 3 notifications as read", "count": 3}
                }
            },
        },
        401: _401,
    },
)
async def mark_all_notifications_read(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for the authenticated user."""
    service = NotificationService(db)
    count = await service.mark_all_as_read(user_id)

    return {"message": f"Marked {count} notifications as read", "count": count}


@router.post(
    "",
    response_model=NotificationResponse,
    status_code=201,
    summary="Create a notification (internal)",
    description="""
Create a new notification for a user. This endpoint is intended for internal
backend services (e.g., the payout processor, webhook handler) and should be
protected by network-level controls or API key auth in production.

**Notification types:** `bounty_claimed`, `pr_submitted`, `review_complete`,
`payout_sent`, `bounty_expired`, `rank_changed`

The `extra_data` field accepts arbitrary JSON for type-specific context
(e.g., `tx_hash` for `payout_sent`, `rank` for `rank_changed`).
""",
    responses={
        201: {
            "description": "Notification created",
            "content": {"application/json": {"example": _NOTIFICATION_EXAMPLE}},
        },
        400: {
            "description": "Validation error",
            "content": {
                "application/json": {
                    "example": {"detail": "Invalid notification_type"}
                }
            },
        },
        401: _401,
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "user_id": "660e8400-e29b-41d4-a716-446655440000",
                        "notification_type": "payout_sent",
                        "title": "Payout confirmed!",
                        "message": "750 FNDRY has been sent to your wallet for 'Fix escrow unlock race condition'",
                        "bounty_id": "abc123",
                        "extra_data": {"tx_hash": "5UfgJ5vVZx...", "amount": 750, "token": "FNDRY"},
                    }
                }
            }
        }
    },
)
async def create_notification(
    notification: NotificationCreate,
    _user: AuthenticatedUser = Depends(get_authenticated_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new notification (internal use by backend services)."""
    service = NotificationService(db)

    try:
        notification_db = await service.create_notification(notification)

        # Refresh to get generated fields
        await db.refresh(notification_db)

        return NotificationResponse.model_validate(notification_db)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
