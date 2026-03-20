"""$FNDRY custodial escrow API endpoints.

Prefix /api/escrow (main.py). POST /fund, /{id}/activate|release|confirm|refund,
GET /{id}, GET /, GET /{id}/ledger, GET /stats/total-escrowed, POST /expire-check.
"""
from __future__ import annotations
import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.escrow import (
    EscrowFundRequest, EscrowLedgerEntry, EscrowListResponse,
    EscrowReleaseRequest, EscrowResponse, EscrowState,
)
from app.services.escrow_service import (
    activate_escrow, confirm_release, create_escrow,
    get_escrow_by_bounty, get_ledger_entries, get_total_escrowed,
    list_escrows, process_expired_escrows, refund_escrow, release_escrow,
)

router = APIRouter(tags=["escrow"])
_B58 = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
_TX = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,88}$")


def _err(error: ValueError) -> HTTPException:
    """Map ValueError to 404 or 409."""
    s = 404 if "No" in str(error) and "escrow" in str(error) else 409
    return HTTPException(status_code=s, detail=str(error))


@router.post("/fund", response_model=EscrowResponse, status_code=201)
async def fund_escrow(data: EscrowFundRequest) -> EscrowResponse:
    """Create and fund a new escrow."""
    try:
        return create_escrow(data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.get("/", response_model=EscrowListResponse)
async def get_escrows(
    creator_wallet: Optional[str] = Query(None, min_length=32, max_length=44),
    state: Optional[EscrowState] = Query(None),
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
) -> EscrowListResponse:
    """Paginated escrows with filters."""
    if creator_wallet and not _B58.match(creator_wallet):
        raise HTTPException(status_code=400, detail="Invalid address")
    return list_escrows(creator_wallet=creator_wallet, state=state, skip=skip, limit=limit)


@router.get("/stats/total-escrowed")
async def total_escrowed() -> dict[str, float]:
    """Total $FNDRY locked."""
    return {"total_escrowed_fndry": get_total_escrowed()}


@router.post("/expire-check", response_model=list[EscrowResponse])
async def check_expired() -> list[EscrowResponse]:
    """Auto-refund expired escrows."""
    return process_expired_escrows()


@router.get("/{bounty_id}", response_model=EscrowResponse)
async def get_status(bounty_id: str) -> EscrowResponse:
    """Get escrow status."""
    esc = get_escrow_by_bounty(bounty_id)
    if not esc:
        raise HTTPException(status_code=404, detail=f"No escrow for '{bounty_id}'")
    return esc


@router.post("/{bounty_id}/activate", response_model=EscrowResponse)
async def activate(bounty_id: str) -> EscrowResponse:
    """Activate funded escrow."""
    try:
        return activate_escrow(bounty_id)
    except ValueError as e:
        raise _err(e) from e


@router.post("/{bounty_id}/release", response_model=EscrowResponse)
async def release(bounty_id: str, data: EscrowReleaseRequest) -> EscrowResponse:
    """Release to winner."""
    try:
        return release_escrow(bounty_id, data)
    except ValueError as e:
        raise _err(e) from e


@router.post("/{bounty_id}/confirm", response_model=EscrowResponse)
async def confirm(bounty_id: str, tx_hash: str = Query(..., min_length=64, max_length=88)) -> EscrowResponse:
    """Confirm on-chain release."""
    if not _TX.match(tx_hash):
        raise HTTPException(status_code=400, detail="Invalid tx")
    try:
        return confirm_release(bounty_id, tx_hash)
    except ValueError as e:
        raise _err(e) from e


@router.post("/{bounty_id}/refund", response_model=EscrowResponse)
async def refund(bounty_id: str) -> EscrowResponse:
    """Refund to creator."""
    try:
        return refund_escrow(bounty_id)
    except ValueError as e:
        raise _err(e) from e


@router.get("/{bounty_id}/ledger", response_model=list[EscrowLedgerEntry])
async def ledger(bounty_id: str) -> list[EscrowLedgerEntry]:
    """Audit trail for escrow."""
    esc = get_escrow_by_bounty(bounty_id)
    if not esc:
        raise HTTPException(status_code=404, detail=f"No escrow for '{bounty_id}'")
    return get_ledger_entries(esc.id)
