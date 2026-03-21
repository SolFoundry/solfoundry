"""Payout, treasury, and tokenomics API endpoints (in-memory MVP)."""

from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status
from app.models.errors import ErrorResponse
from app.exceptions import DoublePayError, InvalidPayoutTransitionError, PayoutLockError, PayoutNotFoundError

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

router = APIRouter(prefix="/payouts", tags=["payouts", "treasury"])

# Relaxed: accept base-58 (Solana) and hex (EVM) transaction hashes.
_TX_HASH_RE = re.compile(r"^[0-9a-fA-F]{64}$|^[1-9A-HJ-NP-Za-km-z]{64,88}$")


@router.get("", response_model=PayoutListResponse, summary="List payout history")
async def get_payouts(
    recipient: Optional[str] = Query(None, min_length=1, max_length=100),
    status: Optional[PayoutStatus] = Query(None),
    bounty_id: Optional[str] = Query(None, description="Filter by bounty UUID"),
    token: Optional[str] = Query(None, pattern=r"^(FNDRY|SOL)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> PayoutListResponse:
    """Return paginated payout history with optional filters."""
    return list_payouts(recipient=recipient, status=status, bounty_id=bounty_id, token=token, skip=skip, limit=limit)


@router.post("", response_model=PayoutResponse, status_code=status.HTTP_201_CREATED, summary="Record a payout",
             responses={409: {"model": ErrorResponse}, 423: {"model": ErrorResponse}})
async def record_payout(data: PayoutCreate) -> PayoutResponse:
    """Record a new payout with per-bounty lock to prevent double-pay."""
    try:
        result = create_payout(data)
    except (DoublePayError, ValueError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PayoutLockError as exc:
        raise HTTPException(status_code=423, detail=str(exc)) from exc
    invalidate_cache()
    return result


# --- Treasury & tokenomics (static prefixes must precede /{tx_hash} wildcard) ---

@router.get("/treasury", response_model=TreasuryStats, summary="Get treasury statistics")
async def treasury_stats() -> TreasuryStats:
    """Live treasury balance (SOL + $FNDRY), total paid out, total buybacks."""
    return await get_treasury_stats()


@router.get("/treasury/buybacks", response_model=BuybackListResponse)
async def treasury_buybacks(
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
) -> BuybackListResponse:
    """Return paginated buyback history."""
    return list_buybacks(skip=skip, limit=limit)


@router.post("/treasury/buybacks", response_model=BuybackResponse, status_code=201)
async def record_buyback(data: BuybackCreate) -> BuybackResponse:
    """Record a new buyback event.  Invalidates the treasury cache on success."""
    try:
        result = create_buyback(data)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    invalidate_cache()
    return result


@router.get("/tokenomics", response_model=TokenomicsResponse)
async def tokenomics() -> TokenomicsResponse:
    """$FNDRY supply breakdown, distribution stats, and fee revenue."""
    return await get_tokenomics()


# --- Wallet validation ---

@router.post("/validate-wallet", response_model=WalletValidationResponse, summary="Validate a Solana wallet")
async def validate_wallet(body: WalletValidationRequest) -> WalletValidationResponse:
    """Check base-58 format and reject known program addresses."""
    address = body.wallet_address
    is_program = address in KNOWN_PROGRAM_ADDRESSES
    try:
        validate_solana_wallet(address)
        return WalletValidationResponse(wallet_address=address, valid=True, message="Valid")
    except ValueError as exc:
        return WalletValidationResponse(wallet_address=address, valid=False, is_program_address=is_program, message=str(exc))


# --- Payout by ID (static prefix) ---

@router.get("/id/{payout_id}", response_model=PayoutResponse, summary="Get payout by internal ID",
            responses={404: {"model": ErrorResponse}})
async def get_payout_by_internal_id(payout_id: str) -> PayoutResponse:
    """Look up a payout by its internal UUID."""
    payout = get_payout_by_id(payout_id)
    if payout is None:
        raise HTTPException(status_code=404, detail=f"Payout '{payout_id}' not found")
    return payout


# --- Admin approval gate ---

@router.post("/{payout_id}/approve", response_model=AdminApprovalResponse, summary="Admin approve/reject payout",
             responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}})
async def admin_approve_payout(payout_id: str, body: AdminApprovalRequest) -> AdminApprovalResponse:
    """Approve or reject a pending payout."""
    try:
        return approve_payout(payout_id, body.admin_id) if body.approved else reject_payout(payout_id, body.admin_id, body.reason)
    except PayoutNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidPayoutTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


# --- Transfer execution ---

@router.post("/{payout_id}/execute", response_model=PayoutResponse, summary="Execute on-chain transfer",
             responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}})
async def execute_payout(payout_id: str) -> PayoutResponse:
    """Execute SPL transfer for an approved payout (3 retries, exponential backoff)."""
    try:
        result = await process_payout(payout_id)
    except PayoutNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidPayoutTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    invalidate_cache()
    return result


# --- Lookup by tx hash (wildcard — MUST be last) ---

@router.get("/{tx_hash}", response_model=PayoutResponse, summary="Get payout by transaction",
            responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
async def get_payout_detail(tx_hash: str) -> PayoutResponse:
    """Single payout by tx hash; 400 for bad format, 404 if missing."""
    if not _TX_HASH_RE.match(tx_hash):
        raise HTTPException(status_code=400, detail="tx_hash must be a valid transaction signature (base-58 or hex)")
    payout = get_payout_by_tx_hash(tx_hash)
    if payout is None:
        raise HTTPException(status_code=404, detail=f"Payout with tx_hash '{tx_hash}' not found")
    return payout
