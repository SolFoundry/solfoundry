"""$FNDRY Staking & Custodial Escrow API. All mutations require auth."""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth import get_current_user_id
from app.exceptions import (EscrowAlreadyExistsError, EscrowDoubleSpendError,
    EscrowInvalidStateError, EscrowNotFoundError)
from app.models.escrow import (EscrowCreateRequest, EscrowListResponse, EscrowRefundRequest,
    EscrowReleaseRequest, EscrowResponse, EscrowState)
from app.services.escrow_service import (create_escrow, get_escrow_status, list_escrows,
    refund_escrow, release_escrow, verify_transaction_confirmed)

router = APIRouter(prefix="/escrow", tags=["escrow"])

@router.post("/fund", response_model=EscrowResponse, status_code=status.HTTP_201_CREATED, summary="Fund bounty escrow")
async def fund_escrow(data: EscrowCreateRequest, user_id: str = Depends(get_current_user_id)) -> EscrowResponse:
    """Lock $FNDRY in custodial escrow.  Verifies tx on-chain if provided."""
    if data.tx_hash and not await verify_transaction_confirmed(data.tx_hash):
        raise HTTPException(400, f"Transaction {data.tx_hash} is not confirmed on Solana")
    try: return create_escrow(data)
    except (EscrowAlreadyExistsError, EscrowDoubleSpendError) as e:
        raise HTTPException(409, str(e)) from e

@router.post("/release", response_model=EscrowResponse, summary="Release escrow to winner")
async def release_escrow_endpoint(data: EscrowReleaseRequest, user_id: str = Depends(get_current_user_id)) -> EscrowResponse:
    """Send escrowed $FNDRY to bounty winner."""
    try: return release_escrow(data)
    except EscrowNotFoundError as e: raise HTTPException(404, str(e)) from e
    except (EscrowInvalidStateError, EscrowDoubleSpendError) as e: raise HTTPException(409, str(e)) from e

@router.post("/refund", response_model=EscrowResponse, summary="Refund escrow to creator")
async def refund_escrow_endpoint(data: EscrowRefundRequest, user_id: str = Depends(get_current_user_id)) -> EscrowResponse:
    """Return escrowed $FNDRY to creator on timeout/cancellation."""
    try: return refund_escrow(data)
    except EscrowNotFoundError as e: raise HTTPException(404, str(e)) from e
    except (EscrowInvalidStateError, EscrowDoubleSpendError) as e: raise HTTPException(409, str(e)) from e

@router.get("/{bounty_id}", response_model=EscrowResponse, summary="Get escrow status")
async def get_escrow_status_endpoint(bounty_id: str) -> EscrowResponse:
    """Current escrow state and ledger for a bounty."""
    try: return get_escrow_status(bounty_id)
    except EscrowNotFoundError as e: raise HTTPException(404, str(e)) from e

@router.get("", response_model=EscrowListResponse, summary="List escrow accounts")
async def list_escrows_endpoint(
    state: Optional[EscrowState]=Query(None), creator_wallet: Optional[str]=Query(None, min_length=32, max_length=44),
    skip: int=Query(0, ge=0), limit: int=Query(20, ge=1, le=100)) -> EscrowListResponse:
    """Paginated escrow list with optional state/wallet filters."""
    return list_escrows(state=state, creator_wallet=creator_wallet, skip=skip, limit=limit)
