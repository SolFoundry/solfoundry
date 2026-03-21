"""$FNDRY staking and custodial escrow API endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth import get_current_user_id
from app.database import get_db
from app.exceptions import (EscrowAlreadyExistsError, EscrowAuthorizationError,
    EscrowDoubleSpendError, EscrowInvalidStateError, EscrowNotFoundError)
from app.models.escrow import (EscrowCreateRequest, EscrowListResponse, EscrowReleaseRequest,
    EscrowRefundRequest, EscrowResponse, EscrowState)
from app.services.escrow_service import (create_escrow, get_escrow_status, list_escrows,
    refund_escrow, release_escrow, verify_transaction_confirmed)
router = APIRouter(prefix="/escrow", tags=["escrow"])
_E = {EscrowNotFoundError: 404, EscrowAuthorizationError: 403,
    EscrowInvalidStateError: 409, EscrowDoubleSpendError: 409}
async def _handle(coro):
    """Run escrow service call with standard HTTP error mapping."""
    try: return await coro
    except tuple(_E) as e: raise HTTPException(_E[type(e)], str(e)) from e
@router.post("/fund", response_model=EscrowResponse, status_code=status.HTTP_201_CREATED)
async def fund_escrow_endpoint(data: EscrowCreateRequest, user_id: str = Depends(get_current_user_id),
                               session: AsyncSession = Depends(get_db)) -> EscrowResponse:
    """Lock $FNDRY in custodial escrow."""
    if data.tx_hash and not await verify_transaction_confirmed(data.tx_hash):
        raise HTTPException(400, f"Transaction {data.tx_hash} not confirmed on Solana")
    try: return await create_escrow(session, data, user_id)
    except (EscrowAlreadyExistsError, EscrowDoubleSpendError) as e:
        raise HTTPException(409, str(e)) from e
@router.post("/release", response_model=EscrowResponse)
async def release_escrow_endpoint(data: EscrowReleaseRequest, user_id: str = Depends(get_current_user_id),
                                  session: AsyncSession = Depends(get_db)) -> EscrowResponse:
    """Release escrowed $FNDRY to bounty winner."""
    return await _handle(release_escrow(session, data, user_id))
@router.post("/refund", response_model=EscrowResponse)
async def refund_escrow_endpoint(data: EscrowRefundRequest, user_id: str = Depends(get_current_user_id),
                                 session: AsyncSession = Depends(get_db)) -> EscrowResponse:
    """Return escrowed $FNDRY to creator."""
    return await _handle(refund_escrow(session, data, user_id))
@router.get("/{bounty_id}", response_model=EscrowResponse)
async def get_escrow_status_endpoint(bounty_id: str, session: AsyncSession = Depends(get_db)) -> EscrowResponse:
    """Escrow state and ledger for a bounty."""
    return await _handle(get_escrow_status(session, bounty_id))
@router.get("", response_model=EscrowListResponse)
async def list_escrows_endpoint(
    state: Optional[EscrowState] = Query(None), creator_wallet: Optional[str] = Query(None, min_length=32, max_length=44),
    skip: int = Query(0, ge=0), limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_db)) -> EscrowListResponse:
    """Paginated escrow list with optional filters."""
    return await list_escrows(session, state=state, creator_wallet=creator_wallet, skip=skip, limit=limit)
