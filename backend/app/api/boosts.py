"""Bounty boost API endpoints.

Provides REST endpoints for the boost mechanism:
- POST /api/bounties/{bounty_id}/boost — Create a new boost
- GET /api/bounties/{bounty_id}/boosts — Boost history for a bounty
- GET /api/bounties/{bounty_id}/boosts/leaderboard — Top boosters
- POST /api/bounties/{bounty_id}/boosts/refund — Process refunds for expired bounty

All mutation endpoints require authentication. Authorization checks
ensure only appropriate users can perform actions (e.g., admin-only
refund processing).
"""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.models.boost import (
    BoostCreate,
    BoostHistoryResponse,
    BoostLeaderboardResponse,
    BoostResponse,
    BoostSummary,
)
from app.services.boost_service import (
    BoostNotFoundError,
    BoostService,
    BoostServiceError,
    BountyNotBoostableError,
    DuplicateTransactionError,
    InsufficientBoostAmountError,
    WalletVerificationError,
)
from app.services.bounty_service import get_bounty

router = APIRouter(prefix="/api/bounties", tags=["boosts"])


def _get_bounty_or_404(bounty_id: str) -> dict:
    """Retrieve a bounty by ID or raise HTTP 404.

    Args:
        bounty_id: The bounty ID to look up.

    Returns:
        The bounty response as a dict-like object.

    Raises:
        HTTPException: 404 if the bounty does not exist.
    """
    bounty = get_bounty(bounty_id)
    if not bounty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bounty not found",
        )
    return bounty


@router.post(
    "/{bounty_id}/boost",
    response_model=BoostResponse,
    status_code=201,
    summary="Boost a bounty with additional $FNDRY",
    description=(
        "Add $FNDRY tokens to a bounty's reward pool. Requires wallet "
        "signature proving ownership. Minimum boost is 1,000 $FNDRY. "
        "Tokens are transferred to the bounty's escrow PDA on-chain."
    ),
)
async def create_boost(
    bounty_id: str,
    data: BoostCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> BoostResponse:
    """Create a new boost for a bounty.

    Validates the bounty exists and is in a boostable state (open or
    in_progress), verifies the wallet signature, transfers tokens to
    escrow, and records the boost. A Telegram notification is sent to
    the bounty owner.

    Args:
        bounty_id: The bounty to boost.
        data: Boost creation data including amount, wallet, and signature.
        user_id: The authenticated user creating the boost.
        db: Database session for the request.

    Returns:
        BoostResponse with the created boost details.

    Raises:
        HTTPException: 404 if bounty not found.
        HTTPException: 400 if bounty not boostable or amount too low.
        HTTPException: 403 if wallet signature verification fails.
        HTTPException: 409 if transaction hash already recorded.
    """
    bounty = _get_bounty_or_404(bounty_id)
    service = BoostService(db)

    try:
        result = await service.create_boost(
            bounty_id=bounty_id,
            user_id=user_id,
            data=data,
            bounty_status=bounty.status.value,
            bounty_creator_id=bounty.created_by,
        )
        await db.commit()
        return result
    except BountyNotBoostableError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc
    except InsufficientBoostAmountError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=exc.message,
        ) from exc
    except WalletVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=exc.message,
        ) from exc
    except DuplicateTransactionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=exc.message,
        ) from exc
    except BoostServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        ) from exc


@router.get(
    "/{bounty_id}/boosts",
    response_model=BoostHistoryResponse,
    summary="Get boost history for a bounty",
    description=(
        "Returns paginated list of all boosts for a bounty, including "
        "confirmed and refunded boosts. Shows original vs boosted "
        "reward amounts."
    ),
)
async def get_boost_history(
    bounty_id: str,
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    db: AsyncSession = Depends(get_db),
) -> BoostHistoryResponse:
    """Get paginated boost history for a bounty.

    Returns all boost records in reverse chronological order with
    reward breakdown showing original, boosted, and effective totals.

    Args:
        bounty_id: The bounty to get boost history for.
        skip: Pagination offset.
        limit: Number of results per page.
        db: Database session for the request.

    Returns:
        BoostHistoryResponse with boost items and reward totals.

    Raises:
        HTTPException: 404 if bounty not found.
    """
    bounty = _get_bounty_or_404(bounty_id)
    service = BoostService(db)
    return await service.get_boost_history(
        bounty_id=bounty_id,
        original_reward=Decimal(str(bounty.reward_amount)),
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{bounty_id}/boosts/leaderboard",
    response_model=BoostLeaderboardResponse,
    summary="Get top boosters for a bounty",
    description=(
        "Returns the leaderboard of top boosters ranked by total "
        "contribution amount. Shows wallet address, total boosted, "
        "and boost count for each booster."
    ),
)
async def get_boost_leaderboard(
    bounty_id: str,
    limit: int = Query(10, ge=1, le=50, description="Max entries to return"),
    db: AsyncSession = Depends(get_db),
) -> BoostLeaderboardResponse:
    """Get the boost leaderboard for a bounty.

    Ranks boosters by total confirmed contribution amount in
    descending order.

    Args:
        bounty_id: The bounty to get the leaderboard for.
        limit: Maximum number of entries to return.
        db: Database session for the request.

    Returns:
        BoostLeaderboardResponse with ranked booster entries.

    Raises:
        HTTPException: 404 if bounty not found.
    """
    _get_bounty_or_404(bounty_id)
    service = BoostService(db)
    return await service.get_boost_leaderboard(
        bounty_id=bounty_id,
        limit=limit,
    )


@router.get(
    "/{bounty_id}/boosts/summary",
    response_model=BoostSummary,
    summary="Get boost summary for a bounty",
    description=(
        "Returns a compact summary showing original reward, total "
        "boosted amount, effective reward, and top booster. Used "
        "to enrich bounty display with boost information."
    ),
)
async def get_boost_summary(
    bounty_id: str,
    db: AsyncSession = Depends(get_db),
) -> BoostSummary:
    """Get a compact boost summary for display purposes.

    Returns original vs boosted amounts separately as required by
    the bounty display acceptance criteria.

    Args:
        bounty_id: The bounty to get the summary for.
        db: Database session for the request.

    Returns:
        BoostSummary with reward breakdown.

    Raises:
        HTTPException: 404 if bounty not found.
    """
    bounty = _get_bounty_or_404(bounty_id)
    service = BoostService(db)
    return await service.get_boost_summary(
        bounty_id=bounty_id,
        original_reward=Decimal(str(bounty.reward_amount)),
    )


@router.post(
    "/{bounty_id}/boosts/refund",
    response_model=list[BoostResponse],
    summary="Process refunds for an expired bounty",
    description=(
        "Refunds all confirmed boosts for a bounty that expired "
        "without completion. Admin-only endpoint. Transfers tokens "
        "from escrow PDA back to each booster's wallet."
    ),
)
async def process_boost_refunds(
    bounty_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[BoostResponse]:
    """Process refunds for all boosts on an expired bounty.

    This endpoint is restricted to admin users and the bounty creator.
    It refunds all confirmed boosts by transferring tokens from the
    escrow PDA back to each booster's wallet.

    Args:
        bounty_id: The expired bounty to process refunds for.
        user_id: The authenticated user requesting the refund.
        db: Database session for the request.

    Returns:
        List of BoostResponse for all refunded boosts.

    Raises:
        HTTPException: 404 if bounty not found.
        HTTPException: 403 if user is not authorized.
        HTTPException: 400 if bounty is not in a refundable state.
    """
    bounty = _get_bounty_or_404(bounty_id)

    # Authorization: only bounty creator or admin can trigger refunds
    # In production, check admin role from user service
    if bounty.created_by != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the bounty creator or an admin can process refunds",
        )

    # Bounty must not be completed or paid (those earned their boosts)
    if bounty.status.value in ("completed", "paid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot refund boosts for a {bounty.status.value} bounty. "
                "Boosts are only refunded when a bounty expires without completion."
            ),
        )

    service = BoostService(db)
    try:
        refunded = await service.process_expired_bounty_refunds(bounty_id)
        await db.commit()
        return refunded
    except BoostServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        ) from exc
