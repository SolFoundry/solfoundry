"""Contributor webhook API endpoints.

Contributors may register HTTPS endpoints that SolFoundry will POST to
when bounty lifecycle events occur (e.g. bounty.claimed, bounty.paid).
Each webhook is signed with HMAC-SHA256 so the recipient can verify
the payload's authenticity.
"""

import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.models.contributor_webhook import (
    ContributorWebhookCreate,
    ContributorWebhookList,
    ContributorWebhookRegistrationResponse,
)
from app.models.errors import ErrorResponse
from app.services.contributor_webhook_service import ContributorWebhookService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["contributor-webhooks"])


@router.get(
    "",
    response_model=ContributorWebhookList,
    summary="List registered webhooks",
    description=(
        "Return all active webhooks registered by the authenticated contributor. "
        "Secrets are never included in responses."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def list_webhooks(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ContributorWebhookList:
    """List all active webhooks for the authenticated user.

    Args:
        user_id: Injected by the auth dependency.
        db: Async database session.

    Returns:
        ContributorWebhookList: All active webhooks with total count.
    """
    service = ContributorWebhookService(db)
    return await service.list_webhooks(user_id)


@router.post(
    "/register",
    response_model=ContributorWebhookRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a webhook",
    description=(
        "Register a new webhook URL (HTTPS only). A unique HMAC secret is generated "
        "per webhook and returned **once** in this response — store it securely. "
        "All outbound payloads are signed via the ``X-SolFoundry-Signature`` header. "
        "Maximum 10 active webhooks per user."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid event type(s) or non-HTTPS URL"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        429: {"model": ErrorResponse, "description": "Webhook limit reached (max 10)"},
    },
)
async def register_webhook(
    payload: ContributorWebhookCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ContributorWebhookRegistrationResponse:
    """Register a webhook endpoint for the authenticated user.

    Args:
        payload: HTTPS URL and optional event-type filter.
        user_id: Injected by the auth dependency.
        db: Async database session.

    Returns:
        ContributorWebhookRegistrationResponse: The newly created webhook
            record including the one-time HMAC secret.

    Raises:
        HTTPException 400: If unknown event names or a non-HTTPS URL is supplied.
        HTTPException 429: If the user has reached the 10-webhook limit.
    """
    service = ContributorWebhookService(db)
    return await service.register_webhook(user_id, payload)


@router.delete(
    "/{webhook_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unregister a webhook",
    description="Deactivate a webhook by ID. Only the owning user can delete their webhooks.",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Webhook not found"},
    },
)
async def delete_webhook(
    webhook_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete (deactivate) a webhook belonging to the authenticated user.

    Args:
        webhook_id: UUID string of the webhook to remove.
        user_id: Injected by the auth dependency.
        db: Async database session.

    Raises:
        HTTPException 404: If the webhook does not exist or belongs to another user.
    """
    service = ContributorWebhookService(db)
    await service.delete_webhook(user_id, webhook_id)
