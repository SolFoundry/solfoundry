"""On-chain webhook API endpoints (Issue #508).

Exposes REST endpoints for contributors to subscribe to on-chain events
(escrow locks/releases, reputation updates, stake deposits/withdrawals).
Events are batched in 5-second windows and delivered with HMAC-SHA256 signing.

Endpoints
---------
POST   /api/onchain-webhooks/register          Register a new subscription
DELETE /api/onchain-webhooks/{id}              Unregister a subscription
GET    /api/onchain-webhooks                   List active subscriptions
GET    /api/onchain-webhooks/{id}/dashboard    Delivery stats & retry history
POST   /api/onchain-webhooks/{id}/test         Send a test event
GET    /api/onchain-webhooks/catalog           Event catalog with payload schemas
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.models.errors import ErrorResponse
from app.models.onchain_webhook import (
    EVENT_CATALOG,
    ON_CHAIN_EVENT_TYPES,
    OnChainWebhookRegisterRequest,
    OnChainWebhookResponse,
    TestEventRequest,
    TestEventResponse,
    WebhookDashboardResponse,
)
from app.services.onchain_webhook_service import (
    OnChainWebhookService,
    SubscriptionLimitExceededError,
    SubscriptionNotFoundError,
    UnsupportedEventTypeError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/onchain-webhooks", tags=["onchain-webhooks"])


# ── register ───────────────────────────────────────────────────────────────────


@router.post(
    "/register",
    response_model=OnChainWebhookResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register an on-chain webhook subscription",
    description=(
        "Register an HTTPS URL to receive batched on-chain event notifications. "
        "Supported events: ``escrow.locked``, ``escrow.released``, "
        "``reputation.updated``, ``stake.deposited``, ``stake.withdrawn``. "
        "Events are grouped in 5-second windows. Each batch is signed with "
        "HMAC-SHA256 (header: ``X-SolFoundry-Signature: sha256=<hex>``)."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request or limit exceeded"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def register_onchain_webhook(
    req: OnChainWebhookRegisterRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> OnChainWebhookResponse:
    """Register a new on-chain webhook subscription for the authenticated user."""
    service = OnChainWebhookService(db)
    try:
        return await service.register(user_id, req)
    except (SubscriptionLimitExceededError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


# ── unregister ────────────────────────────────────────────────────────────────


@router.delete(
    "/{subscription_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unregister an on-chain webhook subscription",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Subscription not found"},
    },
)
async def unregister_onchain_webhook(
    subscription_id: str = Path(..., description="Subscription UUID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Unregister (soft-delete) an on-chain webhook subscription."""
    service = OnChainWebhookService(db)
    try:
        await service.unregister(user_id, subscription_id)
    except SubscriptionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription not found: {subscription_id}",
        ) from exc


# ── list ──────────────────────────────────────────────────────────────────────


@router.get(
    "",
    response_model=list[OnChainWebhookResponse],
    summary="List on-chain webhook subscriptions",
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def list_onchain_webhooks(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[OnChainWebhookResponse]:
    """Return all active on-chain webhook subscriptions for the authenticated user."""
    service = OnChainWebhookService(db)
    return await service.list_for_user(user_id)


# ── dashboard ─────────────────────────────────────────────────────────────────


@router.get(
    "/{subscription_id}/dashboard",
    response_model=WebhookDashboardResponse,
    summary="Webhook delivery dashboard",
    description=(
        "Returns delivery statistics including total/success/failure counts, "
        "success rate, and the last 50 delivery attempts with retry history."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Subscription not found"},
    },
)
async def get_webhook_dashboard(
    subscription_id: str = Path(..., description="Subscription UUID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WebhookDashboardResponse:
    """Return delivery stats and retry history for a specific subscription."""
    service = OnChainWebhookService(db)
    try:
        return await service.get_dashboard(user_id, subscription_id)
    except SubscriptionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription not found: {subscription_id}",
        ) from exc


# ── test event ────────────────────────────────────────────────────────────────


@router.post(
    "/{subscription_id}/test",
    response_model=TestEventResponse,
    summary="Send a test event to verify webhook integration",
    description=(
        "Delivers a synthetic on-chain event to the subscription URL so you can "
        "verify your endpoint is reachable, the signature validates correctly, and "
        "your handler processes the payload. The test event has ``data.test=true``."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Unsupported event type"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Subscription not found"},
    },
)
async def test_onchain_webhook(
    req: TestEventRequest,
    subscription_id: str = Path(..., description="Subscription UUID"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TestEventResponse:
    """Send a test event to the subscription endpoint."""
    service = OnChainWebhookService(db)
    try:
        return await service.send_test_event(user_id, subscription_id, req.event_type)
    except SubscriptionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription not found: {subscription_id}",
        ) from exc
    except UnsupportedEventTypeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


# ── catalog ───────────────────────────────────────────────────────────────────


@router.get(
    "/catalog",
    summary="Event catalog with payload schemas",
    description=(
        "Returns the full documentation for all supported on-chain event types, "
        "including field descriptions and example payloads."
    ),
)
async def get_event_catalog() -> dict:
    """Return the on-chain event catalog with payload schema documentation."""
    return {
        "supported_event_types": list(ON_CHAIN_EVENT_TYPES),
        "events": {
            event_type: {
                "description": info["description"],
                "payload_fields": info["fields"],
                "example": _build_catalog_example(event_type),
            }
            for event_type, info in EVENT_CATALOG.items()
        },
        "delivery": {
            "method": "HTTP POST",
            "content_type": "application/json",
            "signing_header": "X-SolFoundry-Signature",
            "signing_algorithm": "HMAC-SHA256 (sha256=<hex>)",
            "event_types_header": "X-SolFoundry-Event-Types",
            "batching": "Events are grouped in 5-second windows per subscription",
            "retries": "Up to 3 attempts with exponential backoff (2s, 4s, 8s)",
        },
    }


def _build_catalog_example(event_type: str) -> dict:
    """Build an illustrative example payload for the catalog."""
    base = {
        "event": event_type,
        "tx_signature": "5j7s8K2mXyz...base58truncated",
        "slot": 285491234,
        "block_time": 1710000000,
        "timestamp": "2024-03-09T12:00:00Z",
    }
    if event_type == "escrow.locked":
        base["data"] = {
            "escrow_id": "550e8400-e29b-41d4-a716-446655440000",
            "bounty_id": "123e4567-e89b-12d3-a456-426614174000",
            "creator_wallet": "3xRT...Wallet",
            "amount_lamports": 275000000000,
        }
    elif event_type == "escrow.released":
        base["data"] = {
            "escrow_id": "550e8400-e29b-41d4-a716-446655440000",
            "bounty_id": "123e4567-e89b-12d3-a456-426614174000",
            "winner_wallet": "HZV6YPdTeJPjPujWjzsFLLKja91K2Ze78XeY8MeFhfK8",
            "amount_lamports": 275000000000,
        }
    elif event_type == "reputation.updated":
        base["data"] = {
            "contributor_id": "abc12345-e89b-12d3-a456-426614174000",
            "wallet": "3xRT...Wallet",
            "old_score": 42.5,
            "new_score": 45.1,
            "delta": 2.6,
            "tier": "T2",
        }
    elif event_type == "stake.deposited":
        base["data"] = {
            "wallet": "3xRT...Wallet",
            "amount_lamports": 50000000000,
            "stake_account": "StakeAcc...pubkey",
        }
    elif event_type == "stake.withdrawn":
        base["data"] = {
            "wallet": "3xRT...Wallet",
            "amount_lamports": 50000000000,
            "stake_account": "StakeAcc...pubkey",
        }
    return base
