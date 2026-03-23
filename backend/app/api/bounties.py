"""Bounty CRUD, submission, review, approval, and search API router.

Endpoints: create, list, get, update, delete, submit solution, list submissions,
review scores, approve, dispute, lifecycle log,
search, autocomplete, hot bounties, recommended bounties.
"""

from typing import Optional

from pydantic import BaseModel, Field as PydanticField
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.exceptions import BoostBelowMinimumError, BoostInvalidBountyError
from app.models.boost import (
    BoostRequest,
    BoostResponse,
    BoostListResponse,
    BoostLeaderboardResponse,
)
from app.models.errors import ErrorResponse
from app.services import boost_service
from app.services.bounty_lifecycle_service import (
    LifecycleError,
    publish_bounty as _publish_bounty,
    claim_bounty as _claim_bounty,
    unclaim_bounty as _unclaim_bounty,
    transition_status as _transition_status,
)
from app.models.bounty import (
    AutocompleteResponse,
    BountyCreate,
    BountyListResponse,
    BountyResponse,
    BountySearchParams,
    BountySearchResponse,
    BountySearchResult,
    BountyStatus,
    BountyTier,
    BountyUpdate,
    SubmissionCreate,
    SubmissionResponse,
    SubmissionStatusUpdate,
)
from app.models.review import (
    ReviewScoreCreate,
    ReviewScoreResponse,
    AggregatedReviewScore,
)
from app.models.lifecycle import LifecycleLogResponse, LifecycleEventType
from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.services import bounty_service
from app.services import review_service
from app.services import lifecycle_service
from app.services.bounty_search_service import BountySearchService
from app.services.contributor_webhook_service import ContributorWebhookService


async def _verify_bounty_ownership(bounty_id: str, user: UserResponse):
    """Check that the authenticated user owns the bounty before modification.

    Args:
        bounty_id: The UUID string of the bounty to verify.
        user: The authenticated user from the JWT token.

    Returns:
        The BountyResponse if ownership is confirmed.

    Raises:
        HTTPException 404: Bounty not found.
        HTTPException 403: User is not the bounty owner.
    """
    bounty = await bounty_service.get_bounty(bounty_id)
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    if bounty.created_by not in (str(user.id), user.wallet_address):
        raise HTTPException(
            status_code=403, detail="Not authorized to modify this bounty"
        )
    return bounty


router = APIRouter(prefix="/bounties", tags=["bounties"])


@router.post(
    "",
    response_model=BountyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new bounty",
    description="""
    Register a new bounty task in the marketplace.

    The requesting user will be recorded as the `created_by` owner.
    Funds must be available in the user's linked wallet (if using web3 auth).
    """,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid bounty data"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def create_bounty(
    data: BountyCreate, user: UserResponse = Depends(get_current_user)
) -> BountyResponse:
    """Validate input and create a new bounty owned by the authenticated user."""
    data.created_by = user.wallet_address or str(user.id)
    return await bounty_service.create_bounty(data)


@router.get(
    "",
    response_model=BountyListResponse,
    summary="List bounties with filters and sorting",
    description="""
    Retrieve a paginated list of bounties with optional filters and sort.
    Supports filtering by status, tier, skills, creator, creator_type,
    and reward range. Sort by newest, highest/lowest reward, deadline, or submissions.
    For full-text search, use the `/search` endpoint.
    """,
)
async def list_bounties(
    status: Optional[BountyStatus] = Query(
        None, description="Filter by current lifecycle status"
    ),
    tier: Optional[BountyTier] = Query(
        None, description="Filter by difficulty tier (1, 2, or 3)"
    ),
    skills: Optional[str] = Query(
        None, description="Comma-separated list of skills (e.g., 'python,rust')"
    ),
    created_by: Optional[str] = Query(
        None, description="Filter by creator's username or wallet"
    ),
    creator_type: Optional[str] = Query(
        None,
        pattern=r"^(platform|community)$",
        description="Filter by 'platform' (official) or 'community' (user-created)",
    ),
    reward_min: Optional[float] = Query(
        None, ge=0, description="Minimum reward amount"
    ),
    reward_max: Optional[float] = Query(
        None, ge=0, description="Maximum reward amount"
    ),
    sort: str = Query(
        "newest",
        description="Sort: newest, oldest, reward_high, reward_low, tier_high, deadline, submissions, best_match",
    ),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(
        20, ge=1, le=100, description="Maximum number of items to return"
    ),
) -> BountyListResponse:
    """Return a filtered, sorted, paginated list of bounties from the database."""
    skill_list = (
        [s.strip().lower() for s in skills.split(",") if s.strip()] if skills else None
    )
    return await bounty_service.list_bounties(
        status=status,
        tier=tier,
        skills=skill_list,
        created_by=created_by,
        creator_type=creator_type,
        reward_min=reward_min,
        reward_max=reward_max,
        sort=sort,
        skip=skip,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# Search endpoints (placed before /{bounty_id} to avoid route conflicts)
# ---------------------------------------------------------------------------


async def _get_search_service(
    session: AsyncSession = Depends(get_db),
) -> BountySearchService:
    """FastAPI dependency that provides a BountySearchService bound to the request session."""
    return BountySearchService(session)


@router.get(
    "/search",
    response_model=BountySearchResponse,
    summary="Full-text search",
    description="""
    Perform a high-performance full-text search across bounty titles and descriptions.
    Supports PostgreSQL-backed indexing for speed and relevance.
    """,
    responses={
        200: {
            "description": "Search results (ordered by relevance unless sort provided)"
        },
    },
)
async def search_bounties(
    q: str = Query("", max_length=200, description="Keyword search query"),
    status: Optional[BountyStatus] = Query(None),
    tier: Optional[int] = Query(None, ge=1, le=3),
    skills: Optional[str] = Query(None, description="Comma-separated skills"),
    category: Optional[str] = Query(None),
    creator_type: Optional[str] = Query(None, pattern=r"^(platform|community)$"),
    creator_id: Optional[str] = Query(None, description="Filter by creator ID/wallet"),
    reward_min: Optional[float] = Query(None, ge=0),
    reward_max: Optional[float] = Query(None, ge=0),
    deadline_before: Optional[str] = Query(None, description="ISO datetime"),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    skills_logic: str = Query("any", description="Logic for multiple skills: any (OR) or all (AND)"),
    svc: BountySearchService = Depends(_get_search_service),
) -> BountySearchResponse:
    """Execute a full-text search with filters and return ranked results."""
    skill_list = (
        [s.strip().lower() for s in skills.split(",") if s.strip()] if skills else []
    )
    params = BountySearchParams(
        q=q,
        status=status,
        tier=tier,
        skills=skill_list,
        skills_logic=skills_logic,
        category=category,
        creator_type=creator_type,
        creator_id=creator_id,
        reward_min=reward_min,
        reward_max=reward_max,
        deadline_before=deadline_before,
        sort=sort,
        page=page,
        per_page=per_page,
    )
    return await svc.search(params)


@router.get(
    "/autocomplete",
    response_model=AutocompleteResponse,
    summary="Search autocomplete suggestions",
)
async def autocomplete(
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(8, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> AutocompleteResponse:
    """Return title and skill autocomplete suggestions for the query prefix."""
    return await svc.autocomplete(q, limit)


@router.get(
    "/hot",
    response_model=list[BountySearchResult],
    summary="Hot bounties -- highest activity in last 24h",
)
async def hot_bounties(
    limit: int = Query(6, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> list[BountySearchResult]:
    """Return trending bounties from recent activity."""
    return await svc.hot_bounties(limit)


@router.get(
    "/recommended",
    response_model=list[BountySearchResult],
    summary="Recommended bounties based on user skills",
)
async def recommended_bounties(
    skills: str = Query(..., description="Comma-separated user skills"),
    exclude: Optional[str] = Query(
        None, description="Comma-separated bounty IDs to exclude"
    ),
    limit: int = Query(6, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> list[BountySearchResult]:
    """Return bounties matching the user's skills, excluding completed ones."""
    skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()]
    excluded = [e.strip() for e in exclude.split(",") if e.strip()] if exclude else []
    return await svc.recommended(skill_list, excluded, limit)


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/creator/{wallet_address}/stats",
    summary="Get escrow stats for a creator",
)
async def get_creator_stats(wallet_address: str):
    """Aggregate escrow statistics (staked, paid, refunded) for a creator."""
    bounties_resp = await bounty_service.list_bounties(
        created_by=wallet_address, limit=1000
    )
    staked, paid, refunded = 0, 0, 0
    for b in bounties_resp.items:
        if b.status in (
            BountyStatus.OPEN,
            BountyStatus.IN_PROGRESS,
            BountyStatus.UNDER_REVIEW,
            BountyStatus.DISPUTED,
            BountyStatus.COMPLETED,
        ):
            staked += b.reward_amount
        elif b.status == BountyStatus.PAID:
            paid += b.reward_amount
        elif b.status == BountyStatus.CANCELLED:
            refunded += b.reward_amount
    return {"staked": staked, "paid": paid, "refunded": refunded}


@router.get(
    "/{bounty_id}",
    response_model=BountyResponse,
    summary="Get bounty details",
    description="Retrieve comprehensive information about a specific bounty, including its status and submissions.",
    responses={
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def get_bounty_detail(bounty_id: str) -> BountyResponse:
    """Fetch a single bounty from PostgreSQL by its UUID."""
    bounty = await bounty_service.get_bounty(bounty_id)
    if not bounty:
        raise HTTPException(status_code=404, detail=f"Bounty '{bounty_id}' not found")
    return bounty


@router.patch(
    "/{bounty_id}",
    response_model=BountyResponse,
    summary="Partially update a bounty",
)
async def update_bounty(
    bounty_id: str, data: BountyUpdate, user: UserResponse = Depends(get_current_user)
) -> BountyResponse:
    """Apply partial updates to a bounty after verifying ownership."""
    await _verify_bounty_ownership(bounty_id, user)
    result, error = await bounty_service.update_bounty(bounty_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.delete(
    "/{bounty_id}",
    status_code=204,
    summary="Delete a bounty",
)
async def delete_bounty(
    bounty_id: str, user: UserResponse = Depends(get_current_user)
) -> None:
    """Delete a bounty by ID after verifying ownership."""
    await _verify_bounty_ownership(bounty_id, user)
    if not await bounty_service.delete_bounty(bounty_id):
        raise HTTPException(status_code=404, detail="Bounty not found")


@router.post(
    "/{bounty_id}/submit", include_in_schema=False, status_code=status.HTTP_201_CREATED
)
@router.post(
    "/{bounty_id}/submissions",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a solution",
    description="""
    Submit a Pull Request link as a solution for an open bounty.
    The status must be 'open' or 'in_progress'.
    Submitting a solution moves the bounty to 'under_review'.
    Include your Solana wallet address for payout.
    """,
    responses={
        400: {
            "model": ErrorResponse,
            "description": "Bounty is not accepting submissions",
        },
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def submit_solution(
    bounty_id: str,
    data: SubmissionCreate,
    user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubmissionResponse:
    """Attach a PR submission to an open bounty for review."""
    data.submitted_by = user.wallet_address or str(user.id)
    if not data.contributor_wallet and user.wallet_address:
        data.contributor_wallet = user.wallet_address
    result, error = await bounty_service.submit_solution(bounty_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)

    lifecycle_service.log_event(
        bounty_id=bounty_id,
        event_type=LifecycleEventType.SUBMISSION_CREATED,
        submission_id=result.id,
        new_state="under_review",
        actor_id=data.submitted_by,
        actor_type="user",
        details={"pr_url": data.pr_url, "contributor_wallet": data.contributor_wallet},
    )

    # Notify contributor webhooks: review started
    try:
        wh_service = ContributorWebhookService(db)
        await wh_service.dispatch_event(
            "review.started",
            bounty_id,
            {"pr_url": data.pr_url, "submission_id": result.id},
            user_id=data.submitted_by,
        )
    except Exception:
        pass  # webhook dispatch must never break the primary flow

    return result


@router.get(
    "/{bounty_id}/submissions",
    response_model=list[SubmissionResponse],
    summary="List submissions for a bounty",
    description="Retrieve all solutions submitted for a specific bounty.",
    responses={
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def get_submissions(bounty_id: str) -> list[SubmissionResponse]:
    """Return all PR submissions attached to a bounty."""
    result = await bounty_service.get_submissions(bounty_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result


# ---------------------------------------------------------------------------
# Review score endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/{bounty_id}/submissions/{submission_id}/reviews",
    response_model=ReviewScoreResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record AI review score",
    description="""
    Record an AI model's review score for a submission.
    Called by the GitHub Actions AI review pipeline after each model completes.
    When all three models (GPT, Gemini, Grok) have scored, the submission's
    aggregate score is computed and auto-approve eligibility is set.
    """,
)
async def record_review_score(
    bounty_id: str,
    submission_id: str,
    data: ReviewScoreCreate,
    db: AsyncSession = Depends(get_db),
) -> ReviewScoreResponse:
    sub = bounty_service.get_submission(bounty_id, submission_id)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    data.submission_id = submission_id
    data.bounty_id = bounty_id
    score_resp = review_service.record_review_score(data)

    lifecycle_service.log_event(
        bounty_id=bounty_id,
        event_type=LifecycleEventType.AI_REVIEW_COMPLETED,
        submission_id=submission_id,
        actor_type="system",
        details={
            "model": data.model_name,
            "overall_score": data.overall_score,
        },
    )

    aggregated = review_service.get_aggregated_score(submission_id, bounty_id)
    scores_by_model = review_service.get_scores_by_model(submission_id)
    bounty_service.update_submission_review_scores(
        submission_id=submission_id,
        ai_scores_by_model=scores_by_model,
        overall_score=aggregated.overall_score,
        review_complete=aggregated.review_complete,
        meets_threshold=aggregated.meets_threshold,
    )

    # Notify contributor webhooks when review is complete
    if aggregated.review_complete:
        event = "review.passed" if aggregated.meets_threshold else "review.failed"
        try:
            wh_service = ContributorWebhookService(db)
            contributor_id = sub.submitted_by if hasattr(sub, "submitted_by") else None
            await wh_service.dispatch_event(
                event,
                bounty_id,
                {
                    "submission_id": submission_id,
                    "overall_score": aggregated.overall_score,
                    "meets_threshold": aggregated.meets_threshold,
                },
                user_id=contributor_id,
            )
        except Exception:
            pass  # webhook dispatch must never break the primary flow

    return score_resp


@router.get(
    "/{bounty_id}/submissions/{submission_id}/reviews",
    response_model=AggregatedReviewScore,
    summary="Get aggregated review scores",
    description="Get per-model and aggregate AI review scores for a submission.",
)
async def get_review_scores(
    bounty_id: str,
    submission_id: str,
) -> AggregatedReviewScore:
    sub = bounty_service.get_submission(bounty_id, submission_id)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return review_service.get_aggregated_score(submission_id, bounty_id)


# ---------------------------------------------------------------------------
# Approval / Dispute endpoints
# ---------------------------------------------------------------------------


class ApprovalRequest(BaseModel):
    """Request body for approving a submission."""

    notes: Optional[str] = None


class DisputeRequest(BaseModel):
    """Request body for disputing a submission."""

    reason: str = PydanticField(..., min_length=5, max_length=2000)


@router.post(
    "/{bounty_id}/submissions/{submission_id}/approve",
    response_model=SubmissionResponse,
    summary="Approve a submission",
    description="""
    Bounty creator approves a submission. This triggers:
    1. Submission marked as approved
    2. Bounty marked as completed
    3. Escrow releases $FNDRY to the winner's wallet
    4. Winner shown on bounty page
    """,
    responses={
        403: {"model": ErrorResponse, "description": "Not the bounty creator"},
        404: {"model": ErrorResponse, "description": "Bounty or submission not found"},
    },
)
async def approve_submission(
    bounty_id: str,
    submission_id: str,
    user: UserResponse = Depends(get_current_user),
) -> SubmissionResponse:
    await _verify_bounty_ownership(bounty_id, user)
    approved_by = user.wallet_address or str(user.id)

    result, error = bounty_service.approve_submission(
        bounty_id=bounty_id,
        submission_id=submission_id,
        approved_by=approved_by,
    )
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)

    lifecycle_service.log_event(
        bounty_id=bounty_id,
        event_type=LifecycleEventType.CREATOR_APPROVED,
        submission_id=submission_id,
        previous_state="pending",
        new_state="approved",
        actor_id=approved_by,
        actor_type="user",
    )

    return result


@router.post(
    "/{bounty_id}/submissions/{submission_id}/dispute",
    response_model=SubmissionResponse,
    summary="Dispute a submission",
    description="""
    Bounty creator disputes a submission. This blocks auto-approve and
    escalates for manual review.
    """,
    responses={
        403: {"model": ErrorResponse, "description": "Not the bounty creator"},
        404: {"model": ErrorResponse, "description": "Bounty or submission not found"},
    },
)
async def dispute_submission(
    bounty_id: str,
    submission_id: str,
    body: DisputeRequest,
    user: UserResponse = Depends(get_current_user),
) -> SubmissionResponse:
    await _verify_bounty_ownership(bounty_id, user)
    disputed_by = user.wallet_address or str(user.id)

    result, error = bounty_service.dispute_submission(
        bounty_id=bounty_id,
        submission_id=submission_id,
        disputed_by=disputed_by,
        reason=body.reason,
    )
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)

    lifecycle_service.log_event(
        bounty_id=bounty_id,
        event_type=LifecycleEventType.CREATOR_DISPUTED,
        submission_id=submission_id,
        previous_state="pending",
        new_state="disputed",
        actor_id=disputed_by,
        actor_type="user",
        details={"reason": body.reason},
    )

    return result


# ---------------------------------------------------------------------------
# Lifecycle log endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/{bounty_id}/lifecycle",
    response_model=LifecycleLogResponse,
    summary="Get bounty lifecycle log",
    description="Full audit trail of all state transitions for a bounty.",
)
async def get_lifecycle_log(bounty_id: str) -> LifecycleLogResponse:
    bounty = bounty_service.get_bounty(bounty_id)
    if not bounty:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return lifecycle_service.get_lifecycle_log(bounty_id)


@router.patch(
    "/{bounty_id}/submissions/{submission_id}",
    response_model=SubmissionResponse,
    summary="Update a submission's status",
    description="Approve, reject, or request changes on a submission. Approving triggers the payout flow.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid status transition"},
        403: {
            "model": ErrorResponse,
            "description": "Not authorized (not the bounty creator)",
        },
        404: {"model": ErrorResponse, "description": "Bounty or submission not found"},
    },
)
async def update_submission(
    bounty_id: str,
    submission_id: str,
    data: SubmissionStatusUpdate,
    user: UserResponse = Depends(get_current_user),
) -> SubmissionResponse:
    """Transition a submission's status after verifying bounty ownership."""
    await _verify_bounty_ownership(bounty_id, user)
    result, error = await bounty_service.update_submission(
        bounty_id, submission_id, data.status
    )
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.post(
    "/{bounty_id}/cancel",
    response_model=BountyResponse,
    summary="Cancel a bounty and trigger refund",
    description="Withdraw a bounty from the marketplace. Only possible if there are no approved submissions.",
    responses={
        400: {
            "model": ErrorResponse,
            "description": "Cannot cancel (e.g., already paid)",
        },
        403: {"model": ErrorResponse, "description": "Not authorized"},
    },
)
async def cancel_bounty(
    bounty_id: str, user: UserResponse = Depends(get_current_user)
) -> BountyResponse:
    """Cancel a bounty and trigger a refund to the creator's wallet."""
    await _verify_bounty_ownership(bounty_id, user)
    result, error = await bounty_service.update_bounty(
        bounty_id, BountyUpdate(status=BountyStatus.CANCELLED)
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


# ---------------------------------------------------------------------------
# Lifecycle engine endpoints
# ---------------------------------------------------------------------------


class ClaimRequest(BaseModel):
    """Optional claim duration override."""

    claim_duration_hours: int = PydanticField(
        default=168,
        ge=1,
        le=720,
        description="How many hours the claim lock lasts (default 168 = 7 days)",
    )


class TransitionRequest(BaseModel):
    """Request body for a generic status transition."""

    target_status: str = PydanticField(..., description="Target bounty status")


@router.post(
    "/{bounty_id}/publish",
    response_model=BountyResponse,
    summary="Publish a draft bounty",
    description="Move a bounty from `draft` → `open`, making it visible in the marketplace.",
    responses={
        400: {
            "model": ErrorResponse,
            "description": "Not in draft state or invalid transition",
        },
        403: {"model": ErrorResponse, "description": "Not the bounty creator"},
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def publish_bounty(
    bounty_id: str,
    user: UserResponse = Depends(get_current_user),
) -> BountyResponse:
    await _verify_bounty_ownership(bounty_id, user)
    actor_id = user.wallet_address or str(user.id)
    try:
        return _publish_bounty(bounty_id, actor_id=actor_id)
    except LifecycleError as exc:
        code = 404 if exc.code == "NOT_FOUND" else 400
        raise HTTPException(status_code=code, detail=exc.message)


@router.post(
    "/{bounty_id}/claim",
    response_model=BountyResponse,
    summary="Claim a T2/T3 bounty",
    description="""
    Lock a T2/T3 bounty for the requesting contributor. T1 bounties use
    open-race and cannot be claimed. The bounty moves to `in_progress`
    and a deadline timer starts.
    """,
    responses={
        400: {
            "model": ErrorResponse,
            "description": "Cannot claim (wrong tier, state, or already claimed)",
        },
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def claim_bounty(
    bounty_id: str,
    body: Optional[ClaimRequest] = None,
    user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BountyResponse:
    claimer_id = user.wallet_address or str(user.id)
    duration = body.claim_duration_hours if body else 168
    try:
        result = _claim_bounty(bounty_id, claimer_id, claim_duration_hours=duration)
    except LifecycleError as exc:
        code = 404 if exc.code == "NOT_FOUND" else 400
        raise HTTPException(status_code=code, detail=exc.message)

    # Notify contributor webhooks: bounty claimed
    try:
        wh_service = ContributorWebhookService(db)
        await wh_service.dispatch_event(
            "bounty.claimed",
            bounty_id,
            {"claimer_id": claimer_id, "claim_duration_hours": duration},
            user_id=claimer_id,
        )
    except Exception:
        pass  # webhook dispatch must never break the primary flow

    return result


@router.post(
    "/{bounty_id}/unclaim",
    response_model=BountyResponse,
    summary="Release a bounty claim",
    description="Release your claim on a bounty. The bounty returns to `open`.",
    responses={
        400: {"model": ErrorResponse, "description": "Not claimed"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def unclaim_bounty(
    bounty_id: str,
    user: UserResponse = Depends(get_current_user),
) -> BountyResponse:
    actor_id = user.wallet_address or str(user.id)
    try:
        return _unclaim_bounty(bounty_id, actor_id=actor_id, reason="manual")
    except LifecycleError as exc:
        code = 404 if exc.code == "NOT_FOUND" else 400
        raise HTTPException(status_code=code, detail=exc.message)


@router.post(
    "/{bounty_id}/transition",
    response_model=BountyResponse,
    summary="Perform a generic state transition",
    description="Move a bounty to a new status if the transition is valid per the state machine.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid transition"},
        403: {"model": ErrorResponse, "description": "Not authorized"},
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def transition_bounty(
    bounty_id: str,
    body: TransitionRequest,
    user: UserResponse = Depends(get_current_user),
) -> BountyResponse:
    await _verify_bounty_ownership(bounty_id, user)
    actor_id = user.wallet_address or str(user.id)
    try:
        target = BountyStatus(body.target_status)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid status: {body.target_status}"
        )
    try:
        return _transition_status(
            bounty_id, target, actor_id=actor_id, actor_type="user"
        )
    except LifecycleError as exc:
        code = 404 if exc.code == "NOT_FOUND" else 400
        raise HTTPException(status_code=code, detail=exc.message)


# ---------------------------------------------------------------------------
# Boost endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/{bounty_id}/boost",
    response_model=BoostResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Boost a bounty reward",
    responses={
        400: {"model": ErrorResponse, "description": "Below minimum or invalid bounty"},
        404: {"model": ErrorResponse, "description": "Bounty not found"},
    },
)
async def boost_bounty(bounty_id: str, body: BoostRequest):
    """Add $FNDRY to a bounty's prize pool.

    The boosted amount goes into escrow alongside the original reward.
    Minimum contribution is 1,000 $FNDRY. The bounty must be OPEN or
    IN_PROGRESS. A Telegram notification is sent to the bounty owner.
    """
    try:
        return await boost_service.create_boost(
            bounty_id=bounty_id,
            booster_wallet=body.booster_wallet,
            amount=body.amount,
            tx_hash=body.tx_hash,
        )
    except BoostBelowMinimumError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except BoostInvalidBountyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get(
    "/{bounty_id}/boosts",
    response_model=BoostListResponse,
    summary="List boosts for a bounty",
)
async def list_bounty_boosts(
    bounty_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """Return paginated boost history for a bounty (newest first)."""
    return await boost_service.get_boosts(bounty_id, skip=skip, limit=limit)


@router.get(
    "/{bounty_id}/boost-leaderboard",
    response_model=BoostLeaderboardResponse,
    summary="Top boosters for a bounty",
)
async def bounty_boost_leaderboard(bounty_id: str):
    """Return the top 20 boosters ranked by total $FNDRY contributed."""
    return await boost_service.get_boost_leaderboard(bounty_id)
