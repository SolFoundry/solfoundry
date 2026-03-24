"""Outbound contributor webhook API endpoints.

Allows contributors to register, list, and remove webhook subscriptions
that receive HTTP POST notifications on bounty lifecycle events.

Endpoints
---------
POST   /api/webhooks/register       Register a new webhook URL
DELETE /api/webhooks/{id}           Unregister a webhook
GET    /api/webhooks                List registered webhooks for the caller
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.models.contributor_webhook import (
    WebhookListResponse,
    WebhookRegisterRequest,
    WebhookResponse,
)
from app.models.errors import ErrorResponse
from app.services.contributor_webhook_service import (
    ContributorWebhookService,
    WebhookLimitExceededError,
    WebhookNotFoundError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["contributor-webhooks"])


# ── register ───────────────────────────────────────────────────────────────────


@router.post(
    "/register",
    response_model=WebhookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a contributor webhook",
    description=(
        "Register an HTTPS URL to receive POST notifications for bounty lifecycle "
        "events. Maximum 10 active webhooks per user. "
        "Each delivery is signed with HMAC-SHA256 using the provided secret "
        "(header: ``X-SolFoundry-Signature: sha256=<hex>``)."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid URL or limit exceeded"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def register_webhook(
    req: WebhookRegisterRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WebhookResponse:
    """Register a new webhook subscription."""
    service = ContributorWebhookService(db)
    try:
        return await service.register(user_id, req)
    except WebhookLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


# ── unregister ────────────────────────────────────────────────────────────────


@router.delete(
    "/{webhook_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unregister a contributor webhook",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Webhook not found"},
    },
)
async def unregister_webhook(
    webhook_id: str = Path(..., description="Webhook UUID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Unregister (soft-delete) an existing webhook."""
    service = ContributorWebhookService(db)
    try:
        await service.unregister(user_id, webhook_id)
    except WebhookNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webhook not found",
        )


# ── list ──────────────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=WebhookListResponse,
    summary="List contributor webhooks",
    description="Return all active webhook subscriptions for the authenticated user.",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def list_webhooks(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WebhookListResponse:
    """List all active webhooks for the current user."""
    service = ContributorWebhookService(db)
    items = await service.list_for_user(user_id)
    return WebhookListResponse(items=items, total=len(items))
