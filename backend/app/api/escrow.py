"""$FNDRY custodial escrow API endpoints.

Mounted at /api/escrow via app.main. All mutation endpoints (POST)
require authentication. Read endpoints (GET) are public.
"""
from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_user_id
from app.models.escrow import (
    EscrowConflictError, EscrowFundRequest, EscrowLedgerEntry,
    EscrowListResponse, EscrowNotFoundError, EscrowReleaseRequest,
    EscrowResponse, EscrowState, EscrowStateError,
    SOLANA_BASE58_PATTERN, SOLANA_TX_PATTERN,
)
from app.services.escrow_service import (
    activate_escrow, confirm_release, create_escrow,
    get_escrow_by_bounty, get_ledger_entries, get_total_escrowed,
    list_escrows, process_expired_escrows, refund_escrow, release_escrow,
)

router = APIRouter(tags=["escrow"])


@router.post("/fund", response_model=EscrowResponse, status_code=201)
async def fund_escrow(
    data: EscrowFundRequest, _user_id: str = Depends(get_current_user_id),
) -> EscrowResponse:
    """Create and fund a new escrow. Requires authentication."""
    try:
        return await asyncio.to_thread(create_escrow, data)
    except EscrowConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/", response_model=EscrowListResponse)
async def get_escrows(
    creator_wallet: Optional[str] = Query(None, min_length=32, max_length=44),
    state: Optional[EscrowState] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
) -> EscrowListResponse:
    """List escrows with optional filters and pagination (public)."""
    if creator_wallet and not SOLANA_BASE58_PATTERN.match(creator_wallet):
        raise HTTPException(status_code=400, detail="Invalid Solana wallet address format")
    return await asyncio.to_thread(list_escrows, creator_wallet=creator_wallet, state=state, skip=skip, limit=limit)


@router.get("/stats/total-escrowed")
async def total_escrowed() -> dict[str, float]:
    """Total $FNDRY currently locked in escrow (public)."""
    return {"total_escrowed_fndry": await asyncio.to_thread(get_total_escrowed)}


@router.post("/expire-check", response_model=list[EscrowResponse])
async def check_expired(
    _user_id: str = Depends(get_current_user_id),
) -> list[EscrowResponse]:
    """Auto-refund expired escrows. Requires authentication."""
    return await asyncio.to_thread(process_expired_escrows)


@router.get("/{bounty_id}", response_model=EscrowResponse)
async def get_status(bounty_id: str) -> EscrowResponse:
    """Get escrow status for a bounty (public)."""
    esc = await asyncio.to_thread(get_escrow_by_bounty, bounty_id)
    if not esc:
        raise HTTPException(status_code=404, detail=f"No escrow for '{bounty_id}'")
    return esc


@router.post("/{bounty_id}/activate", response_model=EscrowResponse)
async def activate(
    bounty_id: str, _user_id: str = Depends(get_current_user_id),
) -> EscrowResponse:
    """Activate funded escrow (FUNDED->ACTIVE). Requires authentication."""
    try:
        return await asyncio.to_thread(activate_escrow, bounty_id)
    except EscrowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{bounty_id}/release", response_model=EscrowResponse)
async def release(
    bounty_id: str, data: EscrowReleaseRequest,
    _user_id: str = Depends(get_current_user_id),
) -> EscrowResponse:
    """Release to winner (ACTIVE->RELEASING). Requires authentication."""
    try:
        return await asyncio.to_thread(release_escrow, bounty_id, data)
    except EscrowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EscrowStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{bounty_id}/confirm", response_model=EscrowResponse)
async def confirm(
    bounty_id: str, tx_hash: str = Query(..., min_length=64, max_length=88),
    _user_id: str = Depends(get_current_user_id),
) -> EscrowResponse:
    """Confirm on-chain release (RELEASING->COMPLETED). Requires authentication."""
    if not SOLANA_TX_PATTERN.match(tx_hash):
        raise HTTPException(status_code=400, detail="Invalid Solana transaction signature format")
    try:
        return await asyncio.to_thread(confirm_release, bounty_id, tx_hash)
    except EscrowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EscrowConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/{bounty_id}/refund", response_model=EscrowResponse)
async def refund(
    bounty_id: str, _user_id: str = Depends(get_current_user_id),
) -> EscrowResponse:
    """Refund escrowed $FNDRY to creator. Requires authentication."""
    try:
        return await asyncio.to_thread(refund_escrow, bounty_id)
    except EscrowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EscrowStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/{bounty_id}/ledger", response_model=list[EscrowLedgerEntry])
async def ledger(bounty_id: str) -> list[EscrowLedgerEntry]:
    """Immutable audit trail for an escrow (public)."""
    esc = await asyncio.to_thread(get_escrow_by_bounty, bounty_id)
    if not esc:
        raise HTTPException(status_code=404, detail=f"No escrow for '{bounty_id}'")
    return await asyncio.to_thread(get_ledger_entries, esc.id)
