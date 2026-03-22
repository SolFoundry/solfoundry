"""Anti-gaming and sybil protection API endpoints.

Provides REST endpoints for:
    - Evaluating users against all anti-gaming heuristics.
    - Querying the sybil audit log for transparency and debugging.
    - Managing admin alerts for suspicious patterns.
    - Processing user appeals for false-positive recovery.
    - Viewing current configuration thresholds.

All mutation endpoints require authentication. Admin-level endpoints
(alert resolution, appeal review, audit log queries) require admin auth.
User endpoints (submit appeal, view own audit history) require standard auth.

Route prefix: /api/sybil
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.models.sybil import (
    AlertListResponse,
    AlertResolveRequest,
    AlertResponse,
    AppealCreateRequest,
    AppealListResponse,
    AppealResponse,
    AppealReviewRequest,
    SybilAuditLogListResponse,
    SybilConfigResponse,
    SybilEvaluationResponse,
)
from app.models.errors import ErrorResponse
from app.services import sybil_service

router = APIRouter(prefix="/sybil", tags=["sybil-protection"])


# ---------------------------------------------------------------------------
# User evaluation
# ---------------------------------------------------------------------------


class EvaluateUserRequest:
    """Dependency class for collecting evaluation parameters from query params.

    Structured as a FastAPI dependency so that evaluation parameters can
    be supplied as query parameters on the GET endpoint without requiring
    a request body.

    Args:
        github_created_at: ISO-8601 timestamp of GitHub account creation.
        public_repos: Number of public GitHub repositories.
        total_commits: Total GitHub commit contributions.
        wallet_address: User's Solana wallet address.
        funding_source: Address that funded the wallet.
        active_claims_count: Number of currently active bounty claims.
        last_t1_completion: ISO-8601 timestamp of last T1 completion.
        ip_address: Client IP override (defaults to request IP).
        accounts_from_ip: Number of accounts observed from this IP.
    """

    def __init__(
        self,
        github_created_at: Optional[str] = Query(
            None, description="ISO-8601 timestamp of GitHub account creation"
        ),
        public_repos: int = Query(0, ge=0, description="Public GitHub repos"),
        total_commits: int = Query(0, ge=0, description="Total GitHub commits"),
        wallet_address: Optional[str] = Query(None, description="Solana wallet"),
        funding_source: Optional[str] = Query(
            None, description="Wallet funding source address"
        ),
        active_claims_count: int = Query(
            0, ge=0, description="Current active bounty claims"
        ),
        last_t1_completion: Optional[str] = Query(
            None, description="ISO-8601 timestamp of last T1 completion"
        ),
        ip_address: Optional[str] = Query(
            None, description="Client IP (overrides request IP)"
        ),
        accounts_from_ip: int = Query(
            1, ge=1, description="Accounts observed from this IP"
        ),
    ):
        """Initialize evaluation parameters from query string."""
        self.github_created_at = github_created_at
        self.public_repos = public_repos
        self.total_commits = total_commits
        self.wallet_address = wallet_address
        self.funding_source = funding_source
        self.active_claims_count = active_claims_count
        self.last_t1_completion = last_t1_completion
        self.ip_address = ip_address
        self.accounts_from_ip = accounts_from_ip


@router.get(
    "/evaluate/{user_id}",
    response_model=SybilEvaluationResponse,
    summary="Evaluate a user against all anti-gaming heuristics",
    description="""
    Runs all sybil detection checks against the specified user and returns
    the aggregate decision (allow, flag, or block) plus per-check breakdowns.

    Each check is independently evaluated and recorded in the audit log.
    The overall decision is the most restrictive individual result.
    """,
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def evaluate_user(
    user_id: str,
    params: EvaluateUserRequest = Depends(),
    session: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> SybilEvaluationResponse:
    """Run all anti-gaming checks against a user and return the aggregate result."""
    from datetime import datetime, timezone

    github_created_at = None
    if params.github_created_at:
        try:
            github_created_at = datetime.fromisoformat(
                params.github_created_at.replace("Z", "+00:00")
            )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid github_created_at format. Use ISO-8601.",
            )

    last_t1_completion = None
    if params.last_t1_completion:
        try:
            last_t1_completion = datetime.fromisoformat(
                params.last_t1_completion.replace("Z", "+00:00")
            )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid last_t1_completion format. Use ISO-8601.",
            )

    result = await sybil_service.evaluate_user(
        session=session,
        user_id=user_id,
        github_created_at=github_created_at,
        public_repos=params.public_repos,
        total_commits=params.total_commits,
        wallet_address=params.wallet_address,
        funding_source=params.funding_source,
        active_claims_count=params.active_claims_count,
        last_t1_completion=last_t1_completion,
        ip_address=params.ip_address,
        accounts_from_ip=params.accounts_from_ip,
    )

    await session.commit()
    return result


# ---------------------------------------------------------------------------
# Audit log endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/audit-logs",
    response_model=SybilAuditLogListResponse,
    summary="List sybil audit log entries",
    description="""
    Query the immutable audit trail of all anti-gaming decisions.
    Supports filtering by user, check type, and decision outcome.
    Results are ordered newest first.
    """,
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def list_audit_logs(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    check_type: Optional[str] = Query(None, description="Filter by check type"),
    decision: Optional[str] = Query(None, description="Filter by decision"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> SybilAuditLogListResponse:
    """Retrieve paginated audit log entries with optional filters."""
    result = await sybil_service.get_audit_logs(
        session, user_id=user_id, check_type=check_type,
        decision=decision, page=page, per_page=per_page,
    )
    return SybilAuditLogListResponse(**result)


# ---------------------------------------------------------------------------
# Admin alert endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/alerts",
    response_model=AlertListResponse,
    summary="List admin alerts for suspicious patterns",
    description="""
    Query alerts generated by the anti-gaming system. Alerts are created
    automatically when suspicious patterns are detected (IP overlap,
    wallet clustering, low GitHub activity).
    """,
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def list_alerts(
    alert_status: Optional[str] = Query(None, alias="status", description="Filter by alert status"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    user_id: Optional[str] = Query(None, description="Filter by flagged user"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> AlertListResponse:
    """Retrieve paginated admin alerts with optional filters."""
    result = await sybil_service.get_alerts(
        session, status=alert_status, severity=severity,
        user_id=user_id, page=page, per_page=per_page,
    )
    return AlertListResponse(**result)


@router.patch(
    "/alerts/{alert_id}",
    response_model=AlertResponse,
    summary="Resolve or dismiss an admin alert",
    description="""
    Mark an alert as resolved or dismissed after admin investigation.
    Records which admin took the action and when.
    """,
    responses={
        400: {"model": ErrorResponse, "description": "Alert already resolved"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Alert not found"},
    },
)
async def resolve_alert(
    alert_id: str,
    body: AlertResolveRequest,
    session: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> AlertResponse:
    """Resolve or dismiss an admin alert after investigation."""
    try:
        result = await sybil_service.resolve_alert(
            session,
            alert_id=alert_id,
            admin_user_id=current_user_id,
            status=body.status,
            notes=body.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if result is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    await session.commit()
    return result


# ---------------------------------------------------------------------------
# Appeal endpoints (user-facing)
# ---------------------------------------------------------------------------


@router.post(
    "/appeals",
    response_model=AppealResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a false-positive appeal",
    description="""
    Users who believe they were incorrectly flagged or blocked can submit
    an appeal explaining why the detection was a false positive. Each user
    may only have one pending appeal at a time.
    """,
    responses={
        400: {"model": ErrorResponse, "description": "Already has pending appeal"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def submit_appeal(
    body: AppealCreateRequest,
    session: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> AppealResponse:
    """Submit a false-positive appeal for the authenticated user."""
    try:
        result = await sybil_service.create_appeal(
            session,
            user_id=current_user_id,
            reason=body.reason,
            audit_log_id=body.audit_log_id,
            evidence=body.evidence,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await session.commit()
    return result


@router.get(
    "/appeals",
    response_model=AppealListResponse,
    summary="List appeals",
    description="""
    Query appeal records. Users see their own appeals; admins can filter
    by user or status.
    """,
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def list_appeals(
    user_id: Optional[str] = Query(None, description="Filter by user"),
    appeal_status: Optional[str] = Query(None, alias="status", description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    session: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> AppealListResponse:
    """Retrieve paginated appeal records with optional filters."""
    result = await sybil_service.get_appeals(
        session, user_id=user_id, status=appeal_status,
        page=page, per_page=per_page,
    )
    return AppealListResponse(**result)


@router.patch(
    "/appeals/{appeal_id}",
    response_model=AppealResponse,
    summary="Review (approve or reject) an appeal",
    description="""
    Admin reviews a pending appeal. Approved appeals lift restrictions;
    rejected appeals maintain them.
    """,
    responses={
        400: {"model": ErrorResponse, "description": "Appeal not in pending status"},
        401: {"model": ErrorResponse, "description": "Authentication required"},
        404: {"model": ErrorResponse, "description": "Appeal not found"},
    },
)
async def review_appeal(
    appeal_id: str,
    body: AppealReviewRequest,
    session: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> AppealResponse:
    """Admin approves or rejects a pending appeal."""
    try:
        result = await sybil_service.review_appeal(
            session,
            appeal_id=appeal_id,
            admin_user_id=current_user_id,
            status=body.status,
            notes=body.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if result is None:
        raise HTTPException(status_code=404, detail="Appeal not found")

    await session.commit()
    return result


# ---------------------------------------------------------------------------
# Configuration endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/config",
    response_model=SybilConfigResponse,
    summary="View current anti-gaming thresholds",
    description="""
    Returns the current configuration for all anti-gaming heuristic
    thresholds. All values are configurable via environment variables.
    """,
    responses={
        401: {"model": ErrorResponse, "description": "Authentication required"},
    },
)
async def get_config(
    current_user_id: str = Depends(get_current_user_id),
) -> SybilConfigResponse:
    """Return current anti-gaming configuration thresholds."""
    return sybil_service.get_sybil_config()
