"""Contributor webhook registration API.

Endpoints:
    POST /api/webhooks/register  - Register a new webhook URL
    GET  /api/webhooks           - List webhooks for the authenticated user
    DELETE /api/webhooks/{id}    - Unregister a webhook

All endpoints require JWT authentication.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user_id
from app.database import get_db
from app.models.contributor_webhook import (
    ContributorWebhookDB,
    WebhookCreateResponse,
    WebhookListResponse,
    WebhookRegisterRequest,
)
from app.services.contributor_webhook_service import ContributorWebhookService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post(
    "/register",
    response_model=WebhookCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a webhook",
    description=(
        "Register an HTTP endpoint to receive signed event notifications. "
        "The response includes a `secret` shown **only once** — store it securely. "
        "Maximum 10 webhooks per user."
    ),
)
async def register_webhook(
    body: WebhookRegisterRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WebhookCreateResponse:
    svc = ContributorWebhookService(db)
    try:
        return await svc.create_webhook(user_id=user_id, url=body.url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )


@router.get(
    "",
    response_model=WebhookListResponse,
    summary="List webhooks",
    description="Return all active webhooks registered for the authenticated user.",
)
async def list_webhooks(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WebhookListResponse:
    svc = ContributorWebhookService(db)
    items = await svc.list_webhooks(user_id=user_id)
    return WebhookListResponse(items=items, total=len(items))


@router.delete(
    "/{webhook_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a webhook",
    description=(
        "Unregister a webhook. Returns 404 if not found, 403 if not owned by caller."
    ),
)
async def delete_webhook(
    webhook_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(ContributorWebhookDB).where(ContributorWebhookDB.id == webhook_id)
    )
    record = result.scalar_one_or_none()

    if record is None or not record.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Webhook not found"
        )
    if record.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
        )

    svc = ContributorWebhookService(db)
    await svc.delete_webhook(webhook_id=webhook_id, user_id=user_id)
