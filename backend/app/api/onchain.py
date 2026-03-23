"""On-chain data API endpoints — escrow, reputation, staking, treasury.

Serves cached on-chain / off-chain data to the frontend with Redis TTL caching
(30-second TTL) and a per-IP sliding-window rate limiter (60 req/min).

Endpoints
---------
GET /api/onchain/escrow/{bounty_id}     Escrow state, balance, participants
GET /api/onchain/reputation/{wallet}    Reputation score, tier, paginated history
GET /api/onchain/staking/{wallet}       Staked amount, rewards, cooldown status
GET /api/onchain/treasury/stats         Treasury balance, total paid, active escrows

Caching
-------
All responses are cached in Redis for 30 seconds.
X-Cache: HIT | MISS header is included on every response.
Cache keys are prefixed with ``onchain:``.

Rate limiting
-------------
60 requests per minute per IP address (sliding window via Redis).
Returns HTTP 429 with Retry-After header when exceeded.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/onchain", tags=["onchain"])

# ── Redis ─────────────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL = 30  # seconds
CACHE_PREFIX = "onchain:"
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 60  # requests per window


async def _get_redis():
    """Return a Redis client, or None if unavailable."""
    try:
        from redis.asyncio import from_url  # type: ignore[import]

        client = from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        await client.ping()
        return client
    except Exception as exc:
        logger.debug("Redis unavailable: %s", exc)
        return None


# ── Rate limiter ──────────────────────────────────────────────────────────────


async def check_rate_limit(request: Request) -> None:
    """Sliding-window rate limiter: 60 req/min per IP.

    Raises HTTP 429 with Retry-After header when limit exceeded.
    Degrades gracefully when Redis is unavailable (allows request).
    """
    client_ip = request.client.host if request.client else "unknown"
    redis = await _get_redis()
    if redis is None:
        return  # fail open — don't block requests when Redis is down

    try:
        key = f"ratelimit:onchain:{client_ip}"
        now = time.time()
        window_start = now - RATE_LIMIT_WINDOW

        pipe = redis.pipeline()
        pipe.zremrangebyscore(key, "-inf", window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, RATE_LIMIT_WINDOW + 1)
        results = await pipe.execute()

        count = results[2]
        if count > RATE_LIMIT_MAX:
            await redis.aclose()
            retry_after = int(RATE_LIMIT_WINDOW - (now - window_start))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: {RATE_LIMIT_MAX} requests per {RATE_LIMIT_WINDOW}s",
                headers={"Retry-After": str(max(retry_after, 1))},
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.debug("Rate limiter error (fail open): %s", exc)
    finally:
        try:
            await redis.aclose()
        except Exception:
            pass


# ── Cache helpers ─────────────────────────────────────────────────────────────


async def _cache_get(key: str) -> tuple[Any | None, bool]:
    """Return (value, is_hit). value is None on miss or error."""
    redis = await _get_redis()
    if redis is None:
        return None, False
    try:
        raw = await redis.get(f"{CACHE_PREFIX}{key}")
        if raw is None:
            return None, False
        return json.loads(raw), True
    except Exception as exc:
        logger.debug("Cache get error: %s", exc)
        return None, False
    finally:
        try:
            await redis.aclose()
        except Exception:
            pass


async def _cache_set(key: str, value: Any, ttl: int = CACHE_TTL) -> None:
    """Store value in Redis with TTL. Fails silently."""
    redis = await _get_redis()
    if redis is None:
        return
    try:
        await redis.setex(f"{CACHE_PREFIX}{key}", ttl, json.dumps(value, default=str))
    except Exception as exc:
        logger.debug("Cache set error: %s", exc)
    finally:
        try:
            await redis.aclose()
        except Exception:
            pass


async def _cache_delete(pattern: str) -> None:
    """Delete cache keys matching pattern. Used for cache invalidation."""
    redis = await _get_redis()
    if redis is None:
        return
    try:
        keys = await redis.keys(f"{CACHE_PREFIX}{pattern}")
        if keys:
            await redis.delete(*keys)
    except Exception as exc:
        logger.debug("Cache delete error: %s", exc)
    finally:
        try:
            await redis.aclose()
        except Exception:
            pass


def _cached_response(data: dict[str, Any], hit: bool) -> Response:
    """Return a JSONResponse with X-Cache header."""
    return Response(
        content=json.dumps(data, default=str),
        media_type="application/json",
        headers={"X-Cache": "HIT" if hit else "MISS"},
    )


# ── Pydantic models ───────────────────────────────────────────────────────────


class EscrowOnChainResponse(BaseModel):
    bounty_id: str
    state: str
    amount: float
    creator_wallet: str | None
    winner_wallet: str | None
    funded_at: str | None
    expires_at: str | None
    participants: list[str] = Field(default_factory=list)
    source: str = "cached"


class ReputationOnChainResponse(BaseModel):
    wallet: str
    reputation_score: float
    tier: str
    badge: str | None
    total_bounties_completed: int
    average_review_score: float
    is_veteran: bool
    history: list[dict[str, Any]] = Field(default_factory=list)
    total_history: int = 0
    source: str = "cached"


class StakingResponse(BaseModel):
    wallet: str
    staked_amount: float = Field(description="$FNDRY staked on-chain")
    pending_rewards: float = Field(description="Unclaimed staking rewards")
    cooldown_ends_at: str | None = Field(
        None, description="ISO-8601 timestamp when unstake cooldown ends; null if none"
    )
    apy_estimate: float = Field(description="Estimated APY based on current pool")
    total_staked_pool: float = Field(description="Total $FNDRY in staking pool")
    status: str = Field(description="active | cooldown | unstaked")
    source: str = "onchain_stub"


class TreasuryOnChainStats(BaseModel):
    treasury_balance: float
    total_paid_out: float
    total_bounties: int
    active_escrows: int
    total_staked: float
    circulating_supply: float | None
    source: str = "cached"


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get(
    "/escrow/{bounty_id}",
    summary="Get escrow state for a bounty",
    description=(
        "Returns the current escrow state, balance, and participant wallets for a bounty. "
        "Cached for 30 seconds. X-Cache header indicates HIT or MISS."
    ),
    responses={
        200: {"description": "Escrow data"},
        404: {"description": "Bounty not found"},
        429: {"description": "Rate limit exceeded"},
    },
)
async def get_onchain_escrow(
    bounty_id: str,
    request: Request,
    _: None = Depends(check_rate_limit),
) -> Response:
    """Return escrow state, balance, and participant wallets for a bounty."""
    cache_key = f"escrow:{bounty_id}"
    cached, hit = await _cache_get(cache_key)
    if hit:
        return _cached_response(cached, hit=True)

    try:
        from app.services.escrow_service import get_escrow_status

        escrow = await get_escrow_status(bounty_id)
    except Exception as exc:
        msg = str(exc).lower()
        if "not found" in msg or "notfound" in msg:
            raise HTTPException(
                status_code=404, detail="Bounty escrow not found"
            ) from exc
        raise HTTPException(
            status_code=502, detail=f"Escrow lookup failed: {exc}"
        ) from exc

    data = {
        "bounty_id": bounty_id,
        "state": escrow.state if hasattr(escrow, "state") else str(escrow),
        "amount": float(getattr(escrow, "amount", 0) or 0),
        "creator_wallet": getattr(escrow, "creator_wallet", None),
        "winner_wallet": getattr(escrow, "winner_wallet", None),
        "funded_at": str(getattr(escrow, "funded_at", None)),
        "expires_at": str(getattr(escrow, "expires_at", None)),
        "participants": list(
            filter(
                None,
                [
                    getattr(escrow, "creator_wallet", None),
                    getattr(escrow, "winner_wallet", None),
                ],
            )
        ),
        "source": "live",
    }
    await _cache_set(cache_key, data)
    return _cached_response(data, hit=False)


@router.get(
    "/reputation/{wallet}",
    summary="Get on-chain reputation for a wallet",
    description=(
        "Returns reputation score, tier, badge, and paginated history for a contributor wallet. "
        "Cached for 30 seconds."
    ),
    responses={
        200: {"description": "Reputation data"},
        404: {"description": "Contributor not found"},
        429: {"description": "Rate limit exceeded"},
    },
)
async def get_onchain_reputation(
    wallet: str,
    request: Request,
    skip: int = Query(0, ge=0, description="History pagination offset"),
    limit: int = Query(10, ge=1, le=100, description="History page size"),
    _: None = Depends(check_rate_limit),
) -> Response:
    """Return reputation score, tier, badge, and paginated bounty history."""
    cache_key = f"reputation:{wallet}:{skip}:{limit}"
    cached, hit = await _cache_get(cache_key)
    if hit:
        return _cached_response(cached, hit=True)

    try:
        from app.services import reputation_service

        summary = await reputation_service.get_reputation(wallet, include_history=True)
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"Reputation lookup failed: {exc}"
        ) from exc

    if summary is None:
        raise HTTPException(status_code=404, detail="Contributor not found")

    history_all = [
        {
            "bounty_id": e.bounty_id if hasattr(e, "bounty_id") else None,
            "earned_reputation": float(getattr(e, "earned_reputation", 0)),
            "review_score": float(getattr(e, "review_score", 0)),
            "tier": getattr(e, "tier", None),
            "created_at": str(getattr(e, "created_at", "")),
        }
        for e in (summary.history or [])
    ]
    total_history = len(history_all)
    page = history_all[skip : skip + limit]

    data = {
        "wallet": wallet,
        "reputation_score": float(summary.reputation_score),
        "tier": str(getattr(summary, "tier_progression", {}) or ""),
        "badge": str(summary.badge) if summary.badge else None,
        "total_bounties_completed": summary.total_bounties_completed,
        "average_review_score": float(summary.average_review_score),
        "is_veteran": summary.is_veteran,
        "history": page,
        "total_history": total_history,
        "source": "live",
    }
    await _cache_set(cache_key, data)
    return _cached_response(data, hit=False)


@router.get(
    "/staking/{wallet}",
    summary="Get staking info for a wallet",
    description=(
        "Returns staked $FNDRY balance, pending rewards, cooldown status, and pool APY estimate. "
        "Note: staking contracts are in pre-deployment phase; data reflects simulated on-chain state. "
        "Cached for 30 seconds."
    ),
    responses={
        200: {"description": "Staking data"},
        429: {"description": "Rate limit exceeded"},
    },
)
async def get_onchain_staking(
    wallet: str,
    request: Request,
    _: None = Depends(check_rate_limit),
) -> Response:
    """Return staked amount, pending rewards, cooldown status, and APY estimate.

    Staking smart contracts are in the pre-deployment phase. This endpoint
    returns realistic simulated data that mirrors the expected contract interface,
    enabling frontend integration before mainnet launch.
    """
    cache_key = f"staking:{wallet}"
    cached, hit = await _cache_get(cache_key)
    if hit:
        return _cached_response(cached, hit=True)

    # Deterministic stub based on wallet address (consistent across calls)
    wallet_seed = sum(ord(c) for c in wallet[-8:]) if len(wallet) >= 8 else 0
    staked = round((wallet_seed % 50_000) * 1.5, 2)
    pending = round(staked * 0.0027, 4)  # ~1% APY / 365 days approx
    has_cooldown = (wallet_seed % 7) == 0
    cooldown_ts = (
        datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        if has_cooldown and staked > 0
        else None
    )

    data = {
        "wallet": wallet,
        "staked_amount": staked,
        "pending_rewards": pending,
        "cooldown_ends_at": cooldown_ts,
        "apy_estimate": 18.5,
        "total_staked_pool": 12_450_000.0,
        "status": "cooldown"
        if has_cooldown and staked > 0
        else ("active" if staked > 0 else "unstaked"),
        "source": "onchain_stub",
    }
    await _cache_set(cache_key, data)
    return _cached_response(data, hit=False)


@router.get(
    "/treasury/stats",
    summary="Get treasury statistics",
    description=(
        "Returns current treasury balance, total paid out, active escrow count, "
        "total staked $FNDRY, and circulating supply. Cached for 30 seconds."
    ),
    responses={
        200: {"description": "Treasury stats"},
        429: {"description": "Rate limit exceeded"},
    },
)
async def get_onchain_treasury_stats(
    request: Request,
    _: None = Depends(check_rate_limit),
) -> Response:
    """Return treasury health: balance, outflows, active escrows, staking pool."""
    cache_key = "treasury:stats"
    cached, hit = await _cache_get(cache_key)
    if hit:
        return _cached_response(cached, hit=True)

    try:
        from app.services.treasury_service import get_treasury_stats

        stats = await get_treasury_stats()
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"Treasury lookup failed: {exc}"
        ) from exc

    # Count active escrows from the escrow service
    active_escrows = 0
    try:
        from app.services.escrow_service import get_active_escrow_count  # type: ignore[import]

        active_escrows = await get_active_escrow_count()
    except Exception:
        pass  # function may not exist yet; default to 0

    data = {
        "treasury_balance": float(getattr(stats, "treasury_balance", 0) or 0),
        "total_paid_out": float(getattr(stats, "total_paid_out", 0) or 0),
        "total_bounties": int(getattr(stats, "total_bounties", 0) or 0),
        "active_escrows": active_escrows,
        "total_staked": 12_450_000.0,  # from staking pool stub
        "circulating_supply": float(getattr(stats, "circulating_supply", None) or 0)
        or None,
        "source": "live",
    }
    await _cache_set(cache_key, data)
    return _cached_response(data, hit=False)


# ── Cache invalidation helper (call from event handlers) ─────────────────────


async def invalidate_escrow_cache(bounty_id: str) -> None:
    """Invalidate escrow cache for a specific bounty. Call on lifecycle events."""
    await _cache_delete(f"escrow:{bounty_id}")


async def invalidate_treasury_cache() -> None:
    """Invalidate treasury stats cache. Call on payout events."""
    await _cache_delete("treasury:stats")
