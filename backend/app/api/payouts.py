"""Payout, treasury, and tokenomics API endpoints (in-memory MVP)."""

from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.payout import (
    BuybackCreate,
    BuybackListResponse,
    BuybackResponse,
    PayoutCreate,
    PayoutListResponse,
    PayoutResponse,
    PayoutStatus,
    TokenomicsResponse,
    TreasuryStats,
)
from app.services.payout_service import (
    create_buyback,
    create_payout,
    get_payout_by_tx_hash,
    list_buybacks,
    list_payouts,
)
from app.services.treasury_service import (
    get_tokenomics,
    get_treasury_stats,
    invalidate_cache,
)

router = APIRouter(prefix="/api", tags=["payouts", "treasury"])

# Relaxed: accept base-58 (Solana) and hex (EVM) transaction hashes.
_TX_HASH_RE = re.compile(r"^[0-9a-fA-F]{64}$|^[1-9A-HJ-NP-Za-km-z]{64,88}$")

# ---------------------------------------------------------------------------
# Common response schemas
# ---------------------------------------------------------------------------

_404_payout = {
    "description": "Payout not found",
    "content": {
        "application/json": {
            "example": {"detail": "Payout with tx_hash 'abc123...' not found"}
        }
    },
}
_400_tx = {
    "description": "Invalid transaction hash format",
    "content": {
        "application/json": {
            "example": {"detail": "tx_hash must be a valid transaction signature (base-58 or hex)"}
        }
    },
}
_409 = {
    "description": "Conflict — duplicate transaction hash",
    "content": {
        "application/json": {
            "example": {"detail": "Payout with tx_hash already exists"}
        }
    },
}

_PAYOUT_EXAMPLE = {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "recipient": "alice",
    "recipient_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "amount": 750.0,
    "token": "FNDRY",
    "bounty_id": "abc123",
    "bounty_title": "Fix escrow unlock race condition",
    "tx_hash": "5UfgJ5vVZxUMezRcTvnGJB3hxs3GHuJqFcHGPi3kBanxVG2g4UwP8j4x3Rwt9YvhMrMmgP7Q",
    "status": "confirmed",
    "solscan_url": "https://solscan.io/tx/5UfgJ5vVZxUMezRc...",
    "created_at": "2024-01-20T15:30:00Z",
}


@router.get(
    "/payouts",
    response_model=PayoutListResponse,
    summary="List payouts",
    description="""
Return paginated payout history with optional filters.

Payouts represent completed on-chain transfers of $FNDRY or SOL to contributors
after a bounty submission is approved.

Each payout references an on-chain Solana transaction that can be independently
verified at [solscan.io](https://solscan.io) using the `tx_hash`.

**Status values:**
- `pending` — transaction submitted but not yet confirmed
- `confirmed` — on-chain transaction confirmed
- `failed` — transaction failed (no funds transferred)
""",
    responses={
        200: {
            "description": "Paginated payout list",
            "content": {
                "application/json": {
                    "example": {
                        "items": [_PAYOUT_EXAMPLE],
                        "total": 128,
                        "skip": 0,
                        "limit": 20,
                    }
                }
            },
        }
    },
)
async def get_payouts(
    recipient: Optional[str] = Query(
        None,
        min_length=1,
        max_length=100,
        description="Filter by recipient username",
    ),
    status: Optional[PayoutStatus] = Query(
        None,
        description="Filter by payout status: `pending`, `confirmed`, or `failed`",
    ),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page (max 100)"),
) -> PayoutListResponse:
    """Return paginated payout history with optional filters."""
    return list_payouts(recipient=recipient, status=status, skip=skip, limit=limit)


@router.get(
    "/payouts/{tx_hash}",
    response_model=PayoutResponse,
    summary="Get payout by transaction hash",
    description="""
Retrieve a single payout record using its Solana transaction signature.

The `tx_hash` must be either:
- A **base-58 encoded** Solana transaction signature (64–88 characters)
- A **hex-encoded** transaction hash (exactly 64 hex characters)

Use the `solscan_url` in the response to view the transaction on Solscan.
""",
    responses={
        200: {
            "description": "Payout details",
            "content": {"application/json": {"example": _PAYOUT_EXAMPLE}},
        },
        400: _400_tx,
        404: _404_payout,
    },
)
async def get_payout_detail(tx_hash: str) -> PayoutResponse:
    """Single payout by tx hash; 400 for bad format, 404 if missing."""
    if not _TX_HASH_RE.match(tx_hash):
        raise HTTPException(
            status_code=400,
            detail="tx_hash must be a valid transaction signature (base-58 or hex)",
        )
    payout = get_payout_by_tx_hash(tx_hash)
    if payout is None:
        raise HTTPException(
            status_code=404, detail=f"Payout with tx_hash '{tx_hash}' not found"
        )
    return payout


@router.post(
    "/payouts",
    response_model=PayoutResponse,
    status_code=201,
    summary="Record a payout",
    description="""
Record a new on-chain payout after a bounty submission has been approved and
the Solana transaction has been broadcast.

**Flow:**
1. Bounty submission is approved off-chain
2. On-chain escrow release transaction is created and signed
3. Transaction is submitted to the Solana network
4. Once broadcast, call this endpoint with the `tx_hash`
5. Treasury stats are invalidated and refreshed automatically

**Token values:** `FNDRY` or `SOL`

**`tx_hash`** must be a valid Solana base-58 transaction signature (64–88 chars).
Duplicate `tx_hash` values return HTTP **409**.
""",
    responses={
        201: {
            "description": "Payout recorded",
            "content": {"application/json": {"example": _PAYOUT_EXAMPLE}},
        },
        409: _409,
        422: {
            "description": "Validation error (invalid wallet address, tx hash, or amount)",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["body", "recipient_wallet"],
                                "msg": "recipient_wallet must be a valid Solana base-58 address",
                                "type": "value_error",
                            }
                        ]
                    }
                }
            },
        },
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "recipient": "alice",
                        "recipient_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                        "amount": 750.0,
                        "token": "FNDRY",
                        "bounty_id": "abc123",
                        "bounty_title": "Fix escrow unlock race condition",
                        "tx_hash": "5UfgJ5vVZxUMezRcTvnGJB3hxs3GHuJqFcHGPi3kBanxVG2g4UwP8j4x3Rwt9YvhMrMmgP7Q",
                    }
                }
            }
        }
    },
)
async def record_payout(data: PayoutCreate) -> PayoutResponse:
    """Record a new payout. Invalidates the treasury cache on success."""
    try:
        result = create_payout(data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    invalidate_cache()
    return result


@router.get(
    "/treasury",
    response_model=TreasuryStats,
    summary="Get treasury stats",
    description="""
Returns live treasury balances and aggregate statistics.

Balances are fetched from the Solana RPC in real time and cached briefly.
Use this endpoint to display current treasury health on your dashboard.

**Fields:**
- `sol_balance` / `fndry_balance` — current wallet balances
- `total_paid_out_fndry` / `total_paid_out_sol` — cumulative payouts
- `total_buyback_amount` — total FNDRY repurchased from the market
- `treasury_wallet` — the Solana address of the treasury wallet
""",
    responses={
        200: {
            "description": "Live treasury statistics",
            "content": {
                "application/json": {
                    "example": {
                        "sol_balance": 142.5,
                        "fndry_balance": 45_000_000.0,
                        "treasury_wallet": "TrEaSuRy1111111111111111111111111111111111",
                        "total_paid_out_fndry": 850_000.0,
                        "total_paid_out_sol": 12.3,
                        "total_payouts": 128,
                        "total_buyback_amount": 2_500_000.0,
                        "total_buybacks": 5,
                        "last_updated": "2024-01-20T16:00:00Z",
                    }
                }
            },
        }
    },
    tags=["treasury"],
)
async def treasury_stats() -> TreasuryStats:
    """Live treasury balance (SOL + $FNDRY), total paid out, total buybacks."""
    return await get_treasury_stats()


@router.get(
    "/treasury/buybacks",
    response_model=BuybackListResponse,
    summary="List buyback events",
    description="""
Returns paginated history of $FNDRY buyback events.

Buybacks occur when the protocol uses fee revenue to repurchase $FNDRY from
the open market, reducing circulating supply and supporting token price.

Each record includes the SOL spent, FNDRY acquired, and the price per token at time of buyback.
""",
    responses={
        200: {
            "description": "Paginated buyback history",
            "content": {
                "application/json": {
                    "example": {
                        "items": [
                            {
                                "id": "550e8400-e29b-41d4-a716-446655440001",
                                "amount_sol": 5.0,
                                "amount_fndry": 500_000.0,
                                "price_per_fndry": 0.000010,
                                "tx_hash": "4VfgJ5vVZxUMezRcTvnGJB3hxs3GHuJqFcHGPi3kBanx...",
                                "solscan_url": "https://solscan.io/tx/4Vfg...",
                                "created_at": "2024-01-18T12:00:00Z",
                            }
                        ],
                        "total": 5,
                        "skip": 0,
                        "limit": 20,
                    }
                }
            },
        }
    },
    tags=["treasury"],
)
async def treasury_buybacks(
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page (max 100)"),
) -> BuybackListResponse:
    """Return paginated buyback history."""
    return list_buybacks(skip=skip, limit=limit)


@router.post(
    "/treasury/buybacks",
    response_model=BuybackResponse,
    status_code=201,
    summary="Record a buyback event",
    description="""
Record a new $FNDRY buyback event after the on-chain purchase transaction has been confirmed.

All amounts must be positive. Duplicate `tx_hash` values return HTTP **409**.
""",
    responses={
        201: {
            "description": "Buyback recorded",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440001",
                        "amount_sol": 5.0,
                        "amount_fndry": 500_000.0,
                        "price_per_fndry": 0.000010,
                        "tx_hash": "4VfgJ5vVZxUMezRcTvnGJB3hxs3GHuJqFcHGPi3kBanx...",
                        "solscan_url": "https://solscan.io/tx/4Vfg...",
                        "created_at": "2024-01-18T12:00:00Z",
                    }
                }
            },
        },
        409: _409,
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "amount_sol": 5.0,
                        "amount_fndry": 500000.0,
                        "price_per_fndry": 0.000010,
                        "tx_hash": "4VfgJ5vVZxUMezRcTvnGJB3hxs3GHuJqFcHGPi3kBanxVG2g4UwP8j4x3Rwt9YvhMrMmgP7Q",
                    }
                }
            }
        }
    },
    tags=["treasury"],
)
async def record_buyback(data: BuybackCreate) -> BuybackResponse:
    """Record a new buyback event. Invalidates the treasury cache on success."""
    try:
        result = create_buyback(data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    invalidate_cache()
    return result


@router.get(
    "/tokenomics",
    response_model=TokenomicsResponse,
    summary="Get $FNDRY tokenomics",
    description="""
Returns the live $FNDRY token supply breakdown and distribution statistics.

**Key metrics:**
- `total_supply` — fixed at 1,000,000,000 FNDRY
- `circulating_supply` — `total_supply` minus treasury holdings
- `treasury_holdings` — tokens held by the protocol treasury
- `total_distributed` — cumulative contributor rewards paid
- `total_buybacks` — tokens repurchased from the market
- `total_burned` — tokens permanently removed from supply
- `fee_revenue_sol` — cumulative SOL fees collected by the protocol

The token contract address (`token_ca`) can be used to verify the token on
Solscan or any Solana explorer.
""",
    responses={
        200: {
            "description": "FNDRY tokenomics breakdown",
            "content": {
                "application/json": {
                    "example": {
                        "token_name": "FNDRY",
                        "token_ca": "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS",
                        "total_supply": 1_000_000_000.0,
                        "circulating_supply": 954_150_000.0,
                        "treasury_holdings": 45_000_000.0,
                        "total_distributed": 850_000.0,
                        "total_buybacks": 2_500_000.0,
                        "total_burned": 0.0,
                        "fee_revenue_sol": 12.3,
                        "distribution_breakdown": {
                            "contributor_rewards": 850_000.0,
                            "treasury_reserve": 45_000_000.0,
                            "buybacks": 2_500_000.0,
                            "burned": 0.0,
                        },
                        "last_updated": "2024-01-20T16:00:00Z",
                    }
                }
            },
        }
    },
    tags=["treasury"],
)
async def tokenomics() -> TokenomicsResponse:
    """$FNDRY supply breakdown, distribution stats, and fee revenue."""
    return await get_tokenomics()
