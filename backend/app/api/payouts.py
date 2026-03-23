"""Payout, treasury, and tokenomics API endpoints.

Provides REST endpoints for the automated payout pipeline:

- ``POST /payouts`` -- Record a new payout (with optional pre-confirmed tx).
- ``GET /payouts`` -- List payouts with filtering by recipient, status, bounty_id, token, and date range.
- ``POST /payouts/id/{id}/approve`` -- Admin approval or rejection gate.
- ``POST /payouts/id/{id}/execute`` -- Execute on-chain SPL transfer.
- ``GET /payouts/id/{payout_id}`` -- Look up payout by internal UUID.
- ``GET /payouts/{tx_hash}`` -- Look up payout by transaction signature.
- ``POST /payouts/validate-wallet`` -- Validate a Solana wallet address.
- ``GET /payouts/treasury`` -- Live treasury balance and statistics.
- ``GET /payouts/tokenomics`` -- $FNDRY supply breakdown.
"""

from __future__ import annotations

import re
import logging
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
from app.api.admin import _resolve_role

logger = logging.getLogger(__name__)
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
    recipient: Optional[str] = Query(None, min_length=1, max_length=100),
    status: Optional[PayoutStatus] = Query(None),
    bounty_id: Optional[str] = Query(None),
    token: Optional[str] = Query(None, pattern=r"^(FNDRY|SOL)$"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> PayoutListResponse:
    """Return paginated payout history with optional filters from PostgreSQL."""
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
)
async def record_payout(
    data: PayoutCreate,
    admin: tuple[str, AdminRole] = Depends(_resolve_role),
) -> PayoutResponse:
    """Record a new payout with per-bounty lock to prevent double-pay."""
    if admin[1] != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    try:
        result = await create_payout(data)
    except (DoublePayError, ValueError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PayoutLockError as exc:
        raise HTTPException(status_code=423, detail=str(exc)) from exc
    invalidate_cache()
    return result


# ---------------------------------------------------------------------------
# Treasury & tokenomics
# ---------------------------------------------------------------------------


@router.get("/treasury", response_model=TreasuryStats)
async def treasury_stats() -> TreasuryStats:
    return await get_treasury_stats()


@router.get("/treasury/buybacks", response_model=BuybackListResponse)
async def treasury_buybacks(
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100)
) -> BuybackListResponse:
    return await list_buybacks(skip=skip, limit=limit)


@router.post("/treasury/buybacks", response_model=BuybackResponse, status_code=201)
async def record_buyback(
    data: BuybackCreate,
    admin: tuple[str, AdminRole] = Depends(_resolve_role),
) -> BuybackResponse:
    if admin[1] != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    try:
        result = await create_buyback(data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    invalidate_cache()
    return result


@router.get("/tokenomics", response_model=TokenomicsResponse)
async def tokenomics_api() -> TokenomicsResponse:
    return await get_tokenomics()


# ---------------------------------------------------------------------------
# Wallet validation
# ---------------------------------------------------------------------------


@router.post("/validate-wallet", response_model=WalletValidationResponse)
async def validate_wallet(body: WalletValidationRequest) -> WalletValidationResponse:
    address = body.wallet_address
    is_program = address in KNOWN_PROGRAM_ADDRESSES
    try:
        validate_solana_wallet(address)
        return WalletValidationResponse(
            wallet_address=address, valid=True, message="Valid Solana wallet address"
        )
    except ValueError as exc:
        return WalletValidationResponse(
            wallet_address=address,
            valid=False,
            is_program_address=is_program,
            message=str(exc),
        )


# ---------------------------------------------------------------------------
# Payout Management (using /id prefix to avoid tx_hash capture)
# ---------------------------------------------------------------------------


@router.get("/id/{payout_id}", response_model=PayoutResponse)
async def get_payout_by_internal_id(payout_id: str) -> PayoutResponse:
    payout = await get_payout_by_id(payout_id)
    if payout is None:
        raise HTTPException(status_code=404, detail=f"Payout '{payout_id}' not found")
    return payout


@router.post("/{payout_id}/approve", response_model=AdminApprovalResponse)
async def admin_approve_payout(
    payout_id: str,
    body: AdminApprovalRequest,
    admin: tuple[str, AdminRole] = Depends(_resolve_role),
) -> AdminApprovalResponse:
    if admin[1] not in ("admin", "reviewer"):
        raise HTTPException(status_code=403, detail="Reviewer privileges required")
    try:
        if body.approved:
            return await approve_payout(payout_id, body.admin_id)
        return await reject_payout(payout_id, body.admin_id, body.reason)
    except PayoutNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidPayoutTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{payout_id}/execute", response_model=PayoutResponse)
async def execute_payout(
    payout_id: str,
    db: AsyncSession = Depends(get_db),
    admin: tuple[str, AdminRole] = Depends(_resolve_role),
) -> PayoutResponse:
    if admin[1] != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    try:
        result = await process_payout(payout_id)
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
        except Exception as e:
            logger.error("Failed to dispatch payout webhook: %s", e)

        return result

    except PayoutNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidPayoutTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Lookup by tx hash (wildcard -- MUST be last)
# ---------------------------------------------------------------------------


@router.get("/{tx_hash}", response_model=PayoutResponse)
async def get_payout_detail(tx_hash: str) -> PayoutResponse:
    if not _TX_HASH_RE.match(tx_hash):
        raise HTTPException(status_code=400, detail="Invalid tx_hash format")
    payout = await get_payout_by_tx_hash(tx_hash)
    if payout is None:
        raise HTTPException(
            status_code=404, detail=f"Payout with tx_hash '{tx_hash}' not found"
        )
    return payout
