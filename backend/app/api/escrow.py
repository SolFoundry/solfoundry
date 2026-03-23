"""Escrow API endpoints for custodial $FNDRY bounty staking.

Provides REST endpoints for the escrow lifecycle:

- ``POST /escrow/fund`` -- Lock $FNDRY when a bounty is created.
- ``POST /escrow/release`` -- Send $FNDRY to bounty winner on approval.
- ``POST /escrow/refund`` -- Return $FNDRY to creator (timeout/cancel).
- ``GET /escrow/{bounty_id}`` -- Current state, balance, and audit ledger.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.exceptions import (
    EscrowAlreadyExistsError,
    EscrowDoubleSpendError,
    EscrowFundingError,
    EscrowNotFoundError,
    InvalidEscrowTransitionError,
)
from app.models.errors import ErrorResponse
from app.models.escrow import (
    EscrowFundRequest,
    EscrowReleaseRequest,
    EscrowRefundRequest,
    EscrowResponse,
    EscrowStatusResponse,
)
from app.services.escrow_service import (
    activate_escrow,
    create_escrow,
    get_escrow_status,
    refund_escrow,
    release_escrow,
)
from app.services.onchain_cache import cache_get, cache_invalidate, cache_set

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/escrow", tags=["escrow"])


@router.post(
    "/fund",
    response_model=EscrowResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Fund a bounty escrow",
    responses={
        409: {
            "model": ErrorResponse,
            "description": "Escrow already exists or double-spend detected",
        },
        502: {"model": ErrorResponse, "description": "On-chain transfer failed"},
    },
)
async def fund_escrow(body: EscrowFundRequest) -> EscrowResponse:
    """Lock $FNDRY in escrow when a bounty is created.

    Transfers tokens from the creator's wallet to the treasury,
    verifies the transaction on-chain, and creates the escrow in
    FUNDED state. Automatically activates the escrow after funding.
    """
    try:
        escrow = await create_escrow(
            bounty_id=body.bounty_id,
            creator_wallet=body.creator_wallet,
            amount=body.amount,
            expires_at=body.expires_at,
        )
        # Auto-activate after successful funding
        escrow = await activate_escrow(body.bounty_id)
        await cache_invalidate("escrow", body.bounty_id)
        return escrow
    except EscrowAlreadyExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except EscrowDoubleSpendError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except EscrowFundingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/release",
    response_model=EscrowResponse,
    summary="Release escrow to bounty winner",
    responses={
        404: {"model": ErrorResponse, "description": "Escrow not found"},
        409: {
            "model": ErrorResponse,
            "description": "Invalid state transition or double-spend",
        },
        502: {"model": ErrorResponse, "description": "On-chain transfer failed"},
    },
)
async def release_escrow_endpoint(body: EscrowReleaseRequest) -> EscrowResponse:
    """Release escrowed $FNDRY to the approved bounty winner.

    Transfers tokens from the treasury to the winner's wallet and
    moves the escrow to COMPLETED state.
    """
    try:
        result = await release_escrow(
            bounty_id=body.bounty_id,
            winner_wallet=body.winner_wallet,
        )
        await cache_invalidate("escrow", body.bounty_id)
        return result
    except EscrowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidEscrowTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except EscrowDoubleSpendError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except EscrowFundingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/refund",
    response_model=EscrowResponse,
    summary="Refund escrow to bounty creator",
    responses={
        404: {"model": ErrorResponse, "description": "Escrow not found"},
        409: {"model": ErrorResponse, "description": "Invalid state transition"},
        502: {"model": ErrorResponse, "description": "On-chain transfer failed"},
    },
)
async def refund_escrow_endpoint(body: EscrowRefundRequest) -> EscrowResponse:
    """Return escrowed $FNDRY to the bounty creator on timeout or cancellation."""
    try:
        result = await refund_escrow(bounty_id=body.bounty_id)
        await cache_invalidate("escrow", body.bounty_id)
        return result
    except EscrowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidEscrowTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except EscrowFundingError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get(
    "/{bounty_id}",
    response_model=EscrowStatusResponse,
    summary="Get escrow status and audit ledger",
    responses={
        404: {"model": ErrorResponse, "description": "Escrow not found"},
    },
)
async def get_escrow(bounty_id: str) -> EscrowStatusResponse:
    """Return the current escrow state, locked balance, and full audit trail.

    Results are cached in Redis for 30 seconds to reduce database load.
    """
    cached = await cache_get("escrow", bounty_id)
    if cached is not None:
        return EscrowStatusResponse.model_validate(cached)

    try:
        result = await get_escrow_status(bounty_id=bounty_id)
    except EscrowNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    await cache_set("escrow", bounty_id, result.model_dump(mode="json"))
    return result
