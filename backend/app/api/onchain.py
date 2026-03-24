"""On-chain data REST API endpoints with Redis caching.

Provides read-only endpoints that aggregate on-chain Solana state with a
30-second Redis TTL cache to limit RPC calls.

Endpoints:
- ``GET /reputation/{wallet}``  -- Reputation summary for a wallet address.
- ``GET /staking/{wallet}``     -- Staking info (SOL + FNDRY balance) for wallet.
- ``GET /treasury/stats``       -- Treasury SOL/FNDRY balance and aggregate stats.
- ``POST /webhooks/helius``     -- Cache invalidation webhook for Helius/Shyft.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
from typing import Annotated, Any

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.models.payout import TreasuryStats
from app.models.reputation import ReputationSummary
from app.services import reputation_service
from app.services.onchain_cache import (
    cache_get,
    cache_invalidate,
    cache_invalidate_prefix,
    cache_set,
)
from app.services.solana_client import (
    SolanaRPCError,
    get_sol_balance,
    get_token_balance,
)
from app.services.treasury_service import get_treasury_stats

logger = logging.getLogger(__name__)

router = APIRouter(tags=["onchain"])

_HELIUS_WEBHOOK_SECRET = os.getenv("HELIUS_WEBHOOK_SECRET", "")


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class StakingInfo(BaseModel):
    """On-chain balances for a given wallet address."""

    wallet: str
    sol_balance: float = Field(..., description="Native SOL balance")
    fndry_balance: float = Field(..., description="$FNDRY SPL token balance")
    cached: bool = Field(False, description="True when served from cache")


class HeliusWebhookPayload(BaseModel):
    """Minimal Helius / Shyft webhook payload."""

    type: str = Field("", description="Transaction type or event name")
    accounts: list[str] = Field(default_factory=list)


class CacheInvalidationResponse(BaseModel):
    keys_removed: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_reputation_by_wallet(wallet: str) -> ReputationSummary | None:
    """Look up reputation for the contributor whose wallet matches *wallet*.

    Returns ``None`` when no contributor has verified the given wallet.
    """
    from app.database import async_session_factory
    from app.models.user import User
    from sqlalchemy import select

    try:
        async with async_session_factory() as session:
            result = await session.execute(
                select(User).where(
                    User.wallet_address == wallet,
                    User.wallet_verified.is_(True),
                )
            )
            user = result.scalars().first()
            if user is None:
                return None
            # contributor_id == username for the reputation store
            return await reputation_service.get_reputation(user.username)
    except Exception as exc:
        logger.warning("wallet→reputation lookup failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/reputation/{wallet}",
    response_model=ReputationSummary,
    summary="Get reputation for a wallet address",
    responses={
        404: {"description": "No verified contributor found for this wallet"},
        503: {"description": "Upstream RPC or DB unavailable"},
    },
)
async def get_reputation_by_wallet(
    wallet: str,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
) -> ReputationSummary:
    """Return the reputation profile of the contributor who owns *wallet*.

    Results are cached for 30 seconds in Redis.  The ``skip``/``limit``
    parameters paginate the embedded history entries.
    """
    cached: Any = await cache_get("reputation", wallet)
    if cached is not None:
        summary = ReputationSummary.model_validate(cached)
        summary.history = summary.history[skip : skip + limit]
        return summary

    summary = await _get_reputation_by_wallet(wallet)
    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No verified contributor found for wallet {wallet}",
        )

    await cache_set("reputation", wallet, summary.model_dump(mode="json"))

    summary.history = summary.history[skip : skip + limit]
    return summary


@router.get(
    "/staking/{wallet}",
    response_model=StakingInfo,
    summary="Get on-chain staking balances for a wallet",
    responses={
        502: {"description": "Solana RPC request failed"},
    },
)
async def get_staking_info(wallet: str) -> StakingInfo:
    """Return native SOL and $FNDRY balances held by *wallet*.

    Results are cached for 30 seconds in Redis.
    """
    cached: Any = await cache_get("staking", wallet)
    if cached is not None:
        return StakingInfo(**cached, cached=True)

    try:
        sol = await get_sol_balance(wallet)
        fndry = await get_token_balance(wallet)
    except SolanaRPCError as exc:
        logger.error("Solana RPC error for staking/%s: %s", wallet, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Solana RPC error: {exc}",
        ) from exc

    payload = {"wallet": wallet, "sol_balance": sol, "fndry_balance": fndry}
    await cache_set("staking", wallet, payload)
    return StakingInfo(**payload)


@router.get(
    "/treasury/stats",
    response_model=TreasuryStats,
    summary="Get live treasury statistics",
    responses={
        503: {"description": "Treasury data unavailable"},
    },
)
async def get_treasury_stats_endpoint() -> TreasuryStats:
    """Return treasury SOL/FNDRY balances and aggregate payout totals.

    Results are cached for 30 seconds in Redis (the treasury service also
    maintains its own 60-second in-memory cache as a secondary layer).
    """
    cached: Any = await cache_get("treasury", "stats")
    if cached is not None:
        return TreasuryStats.model_validate(cached)

    try:
        stats = await get_treasury_stats()
    except Exception as exc:
        logger.error("Failed to fetch treasury stats: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Treasury data temporarily unavailable",
        ) from exc

    await cache_set("treasury", "stats", stats.model_dump(mode="json"))
    return stats


@router.post(
    "/webhooks/helius",
    response_model=CacheInvalidationResponse,
    summary="Helius / Shyft webhook for cache invalidation",
    status_code=status.HTTP_200_OK,
)
async def helius_webhook(
    payload: HeliusWebhookPayload,
    x_helius_signature: Annotated[str | None, Header()] = None,
) -> CacheInvalidationResponse:
    """Invalidate on-chain cache entries when Helius reports new transactions.

    If ``HELIUS_WEBHOOK_SECRET`` is set, the ``X-Helius-Signature`` header
    is verified with HMAC-SHA256.  Requests with invalid signatures are
    rejected with 401.

    The affected cache namespaces are derived from the ``accounts`` list in
    the payload: staking entries for each account are purged, and the
    treasury stats key is always cleared.
    """
    if _HELIUS_WEBHOOK_SECRET:
        if not x_helius_signature:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature"
            )
        expected = hmac.new(
            _HELIUS_WEBHOOK_SECRET.encode(),
            msg=payload.model_dump_json().encode(),
            digestmod=hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, x_helius_signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature"
            )

    removed = 0
    for account in payload.accounts:
        await cache_invalidate("staking", account)
        await cache_invalidate("reputation", account)
        removed += 1

    # Always bust the treasury cache on any relevant transaction
    removed += await cache_invalidate_prefix("treasury")

    logger.info(
        "Helius webhook processed: type=%s accounts=%d removed=%d",
        payload.type,
        len(payload.accounts),
        removed,
    )
    return CacheInvalidationResponse(keys_removed=removed)
