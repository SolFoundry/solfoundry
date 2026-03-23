"""Bounty boost API endpoints.

Provides REST endpoints for the boost mechanism:
- POST /api/bounties/{bounty_id}/boost — Create a new boost
- GET /api/bounties/{bounty_id}/boosts — Boost history for a bounty
- GET /api/bounties/{bounty_id}/boosts/leaderboard — Top boosters
- GET /api/bounties/{bounty_id}/boosts/summary — Boost summary
- POST /api/bounties/{bounty_id}/boosts/refund — Process refunds for expired bounty

All mutation endpoints require authentication. Authorization checks
ensure only appropriate users can perform actions:
- Boost creation: any authenticated user
- Refund processing: bounty creator or admin (role-checked)
"""

import logging
import os
from decimal import Decimal
from typing import Optional

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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bounties", tags=["boosts"])

# Admin user IDs — in production, query from a roles table or JWT claims.
# Loaded from environment variable as comma-separated UUIDs.
_ADMIN_USER_IDS: Optional[set[str]] = None


def _get_admin_user_ids() -> set[str]:
    """Load admin user IDs from the BOOST_ADMIN_IDS environment variable.

    Returns:
        A set of user ID strings that have admin privileges for boost
        refund operations. Empty set if no admins are configured.
    """
    global _ADMIN_USER_IDS
    if _ADMIN_USER_IDS is None:
        raw = os.getenv("BOOST_ADMIN_IDS", "")
        _ADMIN_USER_IDS = {
            uid.strip() for uid in raw.split(",") if uid.strip()
        }
    return _ADMIN_USER_IDS


def is_admin_user(user_id: str) -> bool:
    """Check whether the given user has admin privileges.

    Checks the user ID against the configured admin list loaded from
    the ``BOOST_ADMIN_IDS`` environment variable. In production, this
    should be replaced with a database role lookup or JWT claim check.

    Args:
        user_id: The user ID to check for admin status.

    Returns:
        True if the user is an admin, False otherwise.
    """
    return user_id in _get_admin_user_ids()


def _get_bounty_or_404(bounty_id: str) -> object:
    """Retrieve a bounty by ID or raise HTTP 404.

    Calls the bounty service's synchronous ``get_bounty`` function and
    returns the ``BountyResponse`` Pydantic model. The returned object
    has ``.status``, ``.created_by``, ``.reward_amount``, and
    ``.deadline`` attributes.

    Args:
        bounty_id: The bounty ID to look up.

    Returns:
        A BountyResponse Pydantic model instance.

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
        "without completion. Restricted to admin users and the bounty "
        "creator. Transfers tokens from escrow PDA back to each "
        "booster's wallet. The bounty must have an expired deadline "
        "or be in a non-completed terminal state."
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

    Authorization is enforced with a compound check: the requesting
    user must be either the bounty creator OR an admin user (loaded
    from the ``BOOST_ADMIN_IDS`` environment variable).

    The bounty must be in a refundable state. Refunds are blocked for:
    - Completed bounties (contributors earned the boosts)
    - Paid bounties (funds already distributed)
    - Open or in_progress bounties that have NOT expired (premature)

    Args:
        bounty_id: The expired bounty to process refunds for.
        user_id: The authenticated user requesting the refund.
        db: Database session for the request.

    Returns:
        List of BoostResponse for all refunded boosts.

    Raises:
        HTTPException: 404 if bounty not found.
        HTTPException: 403 if user is not authorized (not creator or admin).
        HTTPException: 400 if bounty is not in a refundable state.
    """
    bounty = _get_bounty_or_404(bounty_id)

    # Authorization: only bounty creator OR admin can trigger refunds.
    # This is a compound check — not just authentication but authorization.
    user_is_creator = bounty.created_by == user_id
    user_is_admin = is_admin_user(user_id)

    if not user_is_creator and not user_is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the bounty creator or an admin can process refunds",
        )

    # Bounty must not be completed or paid (those earned their boosts)
    bounty_status_value = bounty.status.value
    if bounty_status_value in ("completed", "paid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot refund boosts for a {bounty_status_value} bounty. "
                "Boosts are only refunded when a bounty expires without completion."
            ),
        )

    # Fail-closed: for open or in_progress bounties, require that the
    # deadline has actually passed. This prevents premature refunds.
    if bounty_status_value in ("open", "in_progress"):
        from datetime import datetime, timezone

        if bounty.deadline is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Cannot refund boosts for a bounty without a deadline. "
                    "The bounty must expire before refunds can be processed."
                ),
            )

        now = datetime.now(timezone.utc)
        # Ensure deadline is timezone-aware for comparison
        deadline = bounty.deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)

        if now < deadline:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Cannot refund boosts before the bounty deadline. "
                    f"Deadline is {deadline.isoformat()}. "
                    "Refunds are only available after expiration."
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
