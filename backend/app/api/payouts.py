"""Payout, treasury, and tokenomics API endpoints.

Provides REST endpoints for the automated payout pipeline:

- ``POST /payouts`` -- Record a new payout (with optional pre-confirmed tx).
- ``GET /payouts`` -- List payouts with filtering by recipient, status,
  bounty_id, token, and date range.
- ``POST /payouts/{id}/approve`` -- Admin approval or rejection gate.
- ``POST /payouts/{id}/execute`` -- Execute on-chain SPL transfer.
- ``GET /payouts/id/{id}`` -- Look up payout by internal UUID.
- ``GET /payouts/{tx_hash}`` -- Look up payout by transaction signature.
- ``POST /payouts/validate-wallet`` -- Validate a Solana wallet address.
- ``GET /payouts/treasury`` -- Live treasury balance and statistics.
- ``GET /payouts/tokenomics`` -- $FNDRY supply breakdown.

All reads query PostgreSQL as the primary source of truth. Writes
are awaited before returning to guarantee persistence.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

from app.exceptions import (
    DoublePayError,
    InvalidPayoutTransitionError,
    PayoutLockError,
    PayoutNotFoundError,
)
from app.models.errors import ErrorResponse
from app.models.payout import (
    AdminApprovalRequest,
    AdminApprovalResponse,
    BuybackCreate,
    BuybackListResponse,
    BuybackResponse,
    KNOWN_PROGRAM_ADDRESSES,
    PayoutCreate,
    PayoutListResponse,
    PayoutResponse,
    PayoutStatus,
    TokenomicsResponse,
    TreasuryStats,
    WalletValidationRequest,
    WalletValidationResponse,
    validate_solana_wallet,
)
from app.services.payout_service import (
    approve_payout,
    create_buyback,
    create_payout,
    get_payout_by_id,
    get_payout_by_tx_hash,
    list_buybacks,
    list_payouts,
    process_payout,
    reject_payout,
)
from app.services.treasury_service import (
    get_tokenomics,
    get_treasury_stats,
    invalidate_cache,
)
from app.services.contributor_webhook_service import ContributorWebhookService

router = APIRouter(prefix="/payouts", tags=["payouts", "treasury"])

# Relaxed pattern: accept base-58 (Solana) and hex (EVM) transaction hashes.
_TX_HASH_RE = re.compile(r"^[0-9a-fA-F]{64}$|^[1-9A-HJ-NP-Za-km-z]{64,88}$")


# ---------------------------------------------------------------------------
# List & create payouts
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=PayoutListResponse,
    summary="List payout history with filters",
)
async def get_payouts(
    recipient: Optional[str] = Query(
        None, min_length=1, max_length=100, description="Filter by recipient username"
    ),
    status: Optional[PayoutStatus] = Query(None, description="Filter by payout status"),
    bounty_id: Optional[str] = Query(None, description="Filter by bounty UUID"),
    token: Optional[str] = Query(
        None, pattern=r"^(FNDRY|SOL)$", description="Filter by token type"
    ),
    start_date: Optional[datetime] = Query(
        None, description="Include payouts created at or after this ISO 8601 datetime"
    ),
    end_date: Optional[datetime] = Query(
        None, description="Include payouts created at or before this ISO 8601 datetime"
    ),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum records per page"),
) -> PayoutListResponse:
    """Return paginated payout history with optional filters from PostgreSQL.

    Supports filtering by recipient, status, bounty_id, token type,
    and date range (``start_date`` / ``end_date``).  Results are sorted
    newest-first by ``created_at``.
    """
    return await list_payouts(
        recipient=recipient,
        status=status,
        bounty_id=bounty_id,
        token=token,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )


@router.post(
    "",
    response_model=PayoutResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a payout",
    responses={
        409: {
            "model": ErrorResponse,
            "description": "Duplicate tx_hash or double-pay for bounty",
        },
        423: {
            "model": ErrorResponse,
            "description": "Could not acquire per-bounty lock",
        },
    },
)
async def record_payout(data: PayoutCreate) -> PayoutResponse:
    """Record a new payout with per-bounty lock to prevent double-pay.

    If ``tx_hash`` is provided, the payout is immediately ``confirmed``;
    otherwise it enters the queue as ``pending`` and must be admin-approved
    before on-chain execution. Invalidates the treasury cache on success.
    """
    try:
        result = await create_payout(data)
    except (DoublePayError, ValueError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PayoutLockError as exc:
        raise HTTPException(status_code=423, detail=str(exc)) from exc
    invalidate_cache()
    return result


# ---------------------------------------------------------------------------
# Treasury & tokenomics (static prefixes must precede /{tx_hash} wildcard)
# ---------------------------------------------------------------------------


@router.get(
    "/treasury",
    response_model=TreasuryStats,
    summary="Get treasury statistics",
)
async def treasury_stats() -> TreasuryStats:
    """Live treasury balance (SOL + $FNDRY), total paid out, and total buybacks.

    Balances are cached for 60 seconds to reduce RPC load.
    """
    return await get_treasury_stats()


@router.get(
    "/treasury/buybacks",
    response_model=BuybackListResponse,
    summary="List buyback history",
)
async def treasury_buybacks(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum records per page"),
) -> BuybackListResponse:
    """Return paginated buyback history from PostgreSQL (newest first)."""
    return await list_buybacks(skip=skip, limit=limit)


@router.post(
    "/treasury/buybacks",
    response_model=BuybackResponse,
    status_code=201,
    summary="Record a buyback",
)
async def record_buyback(data: BuybackCreate) -> BuybackResponse:
    """Record a new buyback event. Invalidates the treasury cache on success.

    Rejects duplicate ``tx_hash`` values with HTTP 409.
    """
    try:
        result = await create_buyback(data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    invalidate_cache()
    return result


@router.get(
    "/tokenomics",
    response_model=TokenomicsResponse,
    summary="Get $FNDRY tokenomics",
)
async def tokenomics() -> TokenomicsResponse:
    """$FNDRY supply breakdown: circulating = total_supply - treasury_holdings.

    Includes distribution stats and fee revenue.
    """
    return await get_tokenomics()


# ---------------------------------------------------------------------------
# Wallet validation
# ---------------------------------------------------------------------------


@router.post(
    "/validate-wallet",
    response_model=WalletValidationResponse,
    summary="Validate a Solana wallet address",
)
async def validate_wallet(body: WalletValidationRequest) -> WalletValidationResponse:
    """Check base-58 format and reject known program addresses.

    Returns a structured response indicating whether the address is
    valid for receiving payouts.
    """
    address = body.wallet_address
    is_program = address in KNOWN_PROGRAM_ADDRESSES
    try:
        validate_solana_wallet(address)
        return WalletValidationResponse(
            wallet_address=address,
            valid=True,
            message="Valid Solana wallet address",
        )
    except ValueError as exc:
        return WalletValidationResponse(
            wallet_address=address,
            valid=False,
            is_program_address=is_program,
            message=str(exc),
        )


# ---------------------------------------------------------------------------
# Payout by ID (static prefix)
# ---------------------------------------------------------------------------


@router.get(
    "/id/{payout_id}",
    response_model=PayoutResponse,
    summary="Get payout by internal ID",
    responses={404: {"model": ErrorResponse, "description": "Payout not found"}},
)
async def get_payout_by_internal_id(payout_id: str) -> PayoutResponse:
    """Look up a payout by its internal UUID.

    Args:
        payout_id: The UUID of the payout.

    Returns:
        The matching payout record.

    Raises:
        HTTPException: 404 if the payout does not exist.
    """
    payout = get_payout_by_id(payout_id)
    if payout is None:
        raise HTTPException(
            status_code=404,
            detail=f"Payout '{payout_id}' not found",
        )
    return payout


# ---------------------------------------------------------------------------
# Admin approval gate
# ---------------------------------------------------------------------------


@router.post(
    "/{payout_id}/approve",
    response_model=AdminApprovalResponse,
    summary="Admin approve or reject a payout",
    responses={
        404: {"model": ErrorResponse, "description": "Payout not found"},
        409: {"model": ErrorResponse, "description": "Invalid status transition"},
    },
)
async def admin_approve_payout(
    payout_id: str, body: AdminApprovalRequest
) -> AdminApprovalResponse:
    """Approve or reject a pending payout.

    Set ``approved=True`` to advance to APPROVED, or ``approved=False``
    to reject (moves to FAILED).  Only PENDING payouts can be approved
    or rejected.
    """
    try:
        if body.approved:
            return approve_payout(payout_id, body.admin_id)
        return reject_payout(payout_id, body.admin_id, body.reason)
    except PayoutNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidPayoutTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Transfer execution
# ---------------------------------------------------------------------------


@router.post(
    "/{payout_id}/execute",
    response_model=PayoutResponse,
    summary="Execute on-chain SPL transfer",
    responses={
        404: {"model": ErrorResponse, "description": "Payout not found"},
        409: {"model": ErrorResponse, "description": "Payout not in APPROVED state"},
    },
)
async def execute_payout(
    payout_id: str, db: AsyncSession = Depends(get_db)
) -> PayoutResponse:
    """Execute the on-chain SPL token transfer for an approved payout.

    Uses the transfer service with 3 retries and exponential backoff.
    On success the payout moves to CONFIRMED with a Solscan link;
    on failure it moves to FAILED with the error reason.
    """
    try:
        result = await process_payout(payout_id)
    except PayoutNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidPayoutTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    invalidate_cache()

    # Notify contributor webhooks: bounty paid
    try:
        wh_service = ContributorWebhookService(db)
        bounty_id = result.bounty_id if hasattr(result, "bounty_id") else payout_id
        contributor_id = (
            result.contributor_id if hasattr(result, "contributor_id") else None
        )
        await wh_service.dispatch_event(
            "bounty.paid",
            str(bounty_id),
            {
                "payout_id": payout_id,
                "amount": str(result.amount) if hasattr(result, "amount") else None,
                "tx_hash": result.tx_hash if hasattr(result, "tx_hash") else None,
            },
            user_id=str(contributor_id) if contributor_id else None,
        )
    except Exception:
        pass  # webhook dispatch must never break the primary flow

    return result


# ---------------------------------------------------------------------------
# Lookup by tx hash (wildcard -- MUST be last to avoid catching other routes)
# ---------------------------------------------------------------------------


@router.get(
    "/{tx_hash}",
    response_model=PayoutResponse,
    summary="Get payout by transaction signature",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid tx_hash format"},
        404: {"model": ErrorResponse, "description": "Payout not found"},
    },
)
async def get_payout_detail(tx_hash: str) -> PayoutResponse:
    """Look up a single payout by its on-chain transaction hash.

    Accepts both Solana base-58 signatures (64-88 chars) and hex hashes
    (64 chars) for flexibility.

    Args:
        tx_hash: The transaction signature to look up.

    Returns:
        The matching payout record.

    Raises:
        HTTPException: 400 for invalid format, 404 if not found.
    """
    if not _TX_HASH_RE.match(tx_hash):
        raise HTTPException(
            status_code=400,
            detail="tx_hash must be a valid transaction signature (base-58 or hex)",
        )
    payout = get_payout_by_tx_hash(tx_hash)
    if payout is None:
        raise HTTPException(
            status_code=404,
            detail=f"Payout with tx_hash '{tx_hash}' not found",
        )
    return payout
