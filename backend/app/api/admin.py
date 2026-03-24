"""Admin dashboard API — management endpoints for bounties, contributors,
reviews, financials, system health, and audit log.

Authentication: Accepts either a GitHub OAuth JWT (sub = GitHub username,
checked against ADMIN_GITHUB_USERS / REVIEWER_GITHUB_USERS / VIEWER_GITHUB_USERS
env vars) or a legacy ADMIN_API_KEY for backward compatibility.

Roles:
  admin    — full access (GitHub username in ADMIN_GITHUB_USERS, or API key)
  reviewer — read + approve/reject reviews (REVIEWER_GITHUB_USERS)
  viewer   — read-only (VIEWER_GITHUB_USERS)

Environment variables:
  ADMIN_API_KEY          Legacy shared secret; grants admin role.
  ADMIN_GITHUB_USERS     Comma-separated GitHub usernames with admin role.
  REVIEWER_GITHUB_USERS  Comma-separated GitHub usernames with reviewer role.
  VIEWER_GITHUB_USERS    Comma-separated GitHub usernames with viewer role.
"""

import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.core.audit import audit_event
from app.database import get_db_session
from app.models.tables import AdminAuditLogTable
from app.services.bounty_service import _bounty_store
from app.services.contributor_service import _store as _contributor_store
from app.models.bounty import BountyStatus, BountyCreate, VALID_STATUS_TRANSITIONS
from app.constants import START_TIME
from app.services.treasury_service import get_treasury_stats

# ---------------------------------------------------------------------------
# Configuration — captured at import time so tests can patch at the module level
# ---------------------------------------------------------------------------

_ADMIN_API_KEY: str = os.getenv("ADMIN_API_KEY", "")


def _csv_env(key: str) -> set[str]:
    """Return a set of lowercased usernames from a comma-separated env var."""
    raw = os.getenv(key, "")
    return {u.strip().lower() for u in raw.split(",") if u.strip()}


_security = HTTPBearer(auto_error=False)

AdminRole = Literal["admin", "reviewer", "viewer"]

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# RBAC auth dependency
# ---------------------------------------------------------------------------


async def _resolve_role(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> tuple[str, AdminRole]:
    """Resolve (actor, role) from a Bearer token."""
    from app.core.config import AUTH_ENABLED

    if not AUTH_ENABLED:
        return "test_admin", "admin"

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # ── Try JWT first ────────────────────────────────────────────────────────
    try:
        from app.services.auth_service import decode_token

        username: str = decode_token(token, token_type="access").lower()

        admin_users = _csv_env("ADMIN_GITHUB_USERS")
        reviewer_users = _csv_env("REVIEWER_GITHUB_USERS")
        viewer_users = _csv_env("VIEWER_GITHUB_USERS")

        if username in admin_users:
            return username, "admin"
        if username in reviewer_users:
            return username, "reviewer"
        if username in viewer_users:
            return username, "viewer"

        # GitHub users that are authenticated but not in any role set are denied.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"GitHub user '{username}' does not have admin dashboard access",
        )

    except HTTPException:
        raise
    except Exception:
        # Not a valid JWT — fall through to API key check
        pass

    # ── Fall back to legacy ADMIN_API_KEY ────────────────────────────────────
    if not _ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin authentication is not configured on this server",
        )
    if token != _ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid admin credentials",
        )
    return "admin", "admin"


async def require_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> str:
    """Require admin role; return actor string."""
    actor, role = await _resolve_role(credentials)
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{role}' is insufficient — admin required",
        )
    return actor


async def require_reviewer(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> tuple[str, AdminRole]:
    """Require reviewer or admin role; return (actor, role)."""
    actor, role = await _resolve_role(credentials)
    if role not in ("admin", "reviewer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{role}' is insufficient — reviewer or admin required",
        )
    return actor, role


async def require_any(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> tuple[str, AdminRole]:
    """Require any valid admin role; return (actor, role)."""
    return await _resolve_role(credentials)


# ---------------------------------------------------------------------------
# Persistent audit log
# ---------------------------------------------------------------------------


async def _log(event: str, actor: str, role: str = "admin", **details: Any) -> None:
    """Insert an audit entry into PostgreSQL and emit to structlog."""
    import logging as _logging

    audit_event(event, actor=actor, **details)
    try:
        async with get_db_session() as session:
            row = AdminAuditLogTable(
                id=uuid.uuid4(),
                event=event,
                actor=actor,
                role=role,
                details=details,
                created_at=datetime.now(timezone.utc),
            )
            session.add(row)
            await session.commit()
    except Exception as exc:
        # Log the failure so missing audit records are distinguishable from empty results
        _logging.getLogger(__name__).error(
            "audit_log_write_failed event=%r actor=%r error=%r", event, actor, exc
        )


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------


def _bounty_to_dict(b: Any) -> Dict[str, Any]:
    return {
        "id": b.id,
        "title": b.title,
        "status": b.status,
        "tier": b.tier,
        "reward_amount": b.reward_amount,
        "created_by": b.created_by,
        "deadline": b.deadline.isoformat()
        if hasattr(b.deadline, "isoformat")
        else str(b.deadline),
        "submission_count": len(b.submissions) if b.submissions else 0,
        "created_at": b.created_at.isoformat()
        if hasattr(b.created_at, "isoformat")
        else str(b.created_at),
    }


def _contributor_to_dict(c: Any) -> Dict[str, Any]:
    return {
        "id": c.id,
        "username": c.username,
        "display_name": getattr(c, "display_name", c.username),
        "tier": getattr(c, "current_tier", "T1"),
        "reputation_score": getattr(c, "reputation_score", 0.0),
        "quality_score": _calculate_quality_score(c),
        "total_bounties_completed": getattr(c, "total_bounties_completed", 0),
        "total_earnings": float(getattr(c, "total_earnings", 0)),
        "is_banned": getattr(c, "is_banned", False),
        "skills": getattr(c, "skills", []),
        "created_at": (
            c.created_at.isoformat()
            if hasattr(c, "created_at")
            and c.created_at
            and hasattr(c.created_at, "isoformat")
            else str(getattr(c, "created_at", ""))
        ),
    }


def _calculate_quality_score(c: Any) -> float:
    """Derive a 0–100 quality score from reputation + completion rate."""
    from app.core.config import (
        QUALITY_SCORE_MIN_BASE,
        QUALITY_SCORE_THRESHOLD,
        QUALITY_SCORE_WEIGHT_BOOST,
        QUALITY_SCORE_REPUTATION_WEIGHT,
    )

    rep = float(getattr(c, "reputation_score", 0.0))
    completed = int(getattr(c, "total_bounties_completed", 0))
    # Simple formula: blend reputation (max ~500) and completion volume
    rep_component = min(rep / QUALITY_SCORE_MIN_BASE, QUALITY_SCORE_THRESHOLD)
    volume_component = min(completed * QUALITY_SCORE_WEIGHT_BOOST, QUALITY_SCORE_REPUTATION_WEIGHT)
    return round(rep_component + volume_component, 1)


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class AdminOverview(BaseModel):
    total_bounties: int
    open_bounties: int
    completed_bounties: int
    cancelled_bounties: int
    total_contributors: int
    active_contributors: int
    banned_contributors: int
    total_fndry_paid: float
    total_submissions: int
    pending_reviews: int
    uptime_seconds: int
    timestamp: str


class BountyAdminItem(BaseModel):
    id: str
    title: str
    status: str
    tier: Any
    reward_amount: float
    created_by: str
    deadline: str
    submission_count: int
    created_at: str


class BountyListAdminResponse(BaseModel):
    items: List[BountyAdminItem]
    total: int
    page: int
    per_page: int


class BountyAdminUpdate(BaseModel):
    """Fields an admin can update on a bounty."""

    status: Optional[str] = Field(None, description="New lifecycle status")
    reward_amount: Optional[float] = Field(None, gt=0)
    title: Optional[str] = Field(None, min_length=3, max_length=200)


class BountyAdminCreate(BaseModel):
    """Payload for admin-created bounties."""

    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10, max_length=5000)
    tier: int = Field(..., ge=1, le=3)
    reward_amount: float = Field(..., gt=0)
    deadline: Optional[str] = Field(None, description="ISO-8601 deadline")
    tags: List[str] = Field(default_factory=list)


class ContributorAdminItem(BaseModel):
    id: str
    username: str
    display_name: str
    tier: str
    reputation_score: float
    quality_score: float
    total_bounties_completed: int
    total_earnings: float
    is_banned: bool
    skills: List[str]
    created_at: str


class ContributorListAdminResponse(BaseModel):
    items: List[ContributorAdminItem]
    total: int
    page: int
    per_page: int


class TierHistoryItem(BaseModel):
    tier: str
    reputation_score: float
    bounty_id: Optional[str]
    bounty_title: Optional[str]
    earned_reputation: float
    created_at: str


class TierHistoryResponse(BaseModel):
    contributor_id: str
    items: List[TierHistoryItem]
    total: int


class BanRequest(BaseModel):
    reason: str = Field(..., min_length=5, max_length=500)


class ReviewPipelineItem(BaseModel):
    bounty_id: str
    bounty_title: str
    submission_id: str
    pr_url: str
    submitted_by: str
    ai_score: float
    review_complete: bool
    meets_threshold: bool
    submitted_at: str


class ReviewPipelineResponse(BaseModel):
    active: List[ReviewPipelineItem]
    total_active: int
    pass_rate: float
    avg_score: float


class FinancialOverview(BaseModel):
    total_fndry_distributed: float
    total_paid_bounties: int
    pending_payout_count: int
    pending_payout_amount: float
    avg_reward: float
    highest_reward: float


class PayoutHistoryItem(BaseModel):
    bounty_id: str
    bounty_title: str
    winner: str
    amount: float
    status: str
    completed_at: Optional[str]


class PayoutHistoryResponse(BaseModel):
    items: List[PayoutHistoryItem]
    total: int


class SystemHealthResponse(BaseModel):
    status: str
    uptime_seconds: int
    bot_uptime_seconds: int
    timestamp: str
    services: Dict[str, str]
    queue_depth: int
    webhook_events_processed: int
    github_webhook_status: str
    active_websocket_connections: int


class AuditLogEntry(BaseModel):
    event: str
    actor: str
    role: str = "admin"
    timestamp: str
    details: Dict[str, Any] = Field(default_factory=dict)


class AuditLogResponse(BaseModel):
    entries: List[AuditLogEntry]
    total: int


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------


@router.get(
    "/overview", response_model=AdminOverview, summary="Platform overview statistics"
)
async def get_overview(auth: tuple = Depends(require_any)) -> AdminOverview:
    bounties = list(_bounty_store.values())
    contributors = list(_contributor_store.values())

    total_fndry = sum(
        b.reward_amount for b in bounties if b.status == BountyStatus.PAID
    )
    total_submissions = sum(len(b.submissions) for b in bounties if b.submissions)
    pending_reviews = sum(
        1
        for b in bounties
        for s in (b.submissions or [])
        if not getattr(s, "review_complete", False) and s.status == "pending"
    )

    return AdminOverview(
        total_bounties=len(bounties),
        open_bounties=sum(1 for b in bounties if b.status == BountyStatus.OPEN),
        completed_bounties=sum(
            1 for b in bounties if b.status == BountyStatus.COMPLETED
        ),
        cancelled_bounties=sum(
            1 for b in bounties if b.status == BountyStatus.CANCELLED
        ),
        total_contributors=len(contributors),
        active_contributors=sum(
            1 for c in contributors if not getattr(c, "is_banned", False)
        ),
        banned_contributors=sum(
            1 for c in contributors if getattr(c, "is_banned", False)
        ),
        total_fndry_paid=total_fndry,
        total_submissions=total_submissions,
        pending_reviews=pending_reviews,
        uptime_seconds=round(time.monotonic() - START_TIME),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ---------------------------------------------------------------------------
# Bounty management
# ---------------------------------------------------------------------------


@router.get(
    "/bounties", response_model=BountyListAdminResponse, summary="List all bounties"
)
async def list_bounties_admin(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    tier: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _auth: tuple = Depends(require_any),
) -> BountyListAdminResponse:
    items = list(_bounty_store.values())

    if search:
        q = search.lower()
        items = [
            b
            for b in items
            if q in b.title.lower() or q in getattr(b, "description", "").lower()
        ]
    if status_filter:
        items = [b for b in items if b.status == status_filter]
    if tier is not None:
        items = [b for b in items if b.tier == tier]

    items.sort(key=lambda b: getattr(b, "created_at", datetime.min), reverse=True)
    total = len(items)
    offset = (page - 1) * per_page

    return BountyListAdminResponse(
        items=[
            BountyAdminItem(**_bounty_to_dict(b))
            for b in items[offset : offset + per_page]
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("/bounties", summary="Create a new bounty (admin)")
async def create_bounty_admin(
    payload: BountyAdminCreate,
    actor: str = Depends(require_admin),
) -> Dict[str, Any]:
    """Create a bounty directly from the admin dashboard."""
    from app.services.bounty_service import create_bounty
    from app.models.bounty import BountyTier

    create_data = BountyCreate(
        title=payload.title,
        description=payload.description,
        tier=BountyTier(payload.tier),
        reward_amount=payload.reward_amount,
        deadline=payload.deadline,
        required_skills=payload.tags,
        created_by=actor,
        github_issue_url=None,
    )
    bounty = await create_bounty(create_data)
    await _log(
        "admin_bounty_created", actor=actor, bounty_id=bounty.id, title=payload.title
    )
    return {"ok": True, "bounty_id": bounty.id}


@router.patch("/bounties/{bounty_id}", summary="Update a bounty")
async def update_bounty_admin(
    bounty_id: str,
    update: BountyAdminUpdate,
    actor: str = Depends(require_admin),
) -> Dict[str, Any]:
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        raise HTTPException(status_code=404, detail=f"Bounty {bounty_id!r} not found")

    changes: Dict[str, Any] = {}

    if update.status is not None:
        # Validate against lifecycle transitions
        try:
            new_status = BountyStatus(update.status)
        except ValueError:
            valid = [s.value for s in BountyStatus]
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status {update.status!r}. Valid values: {valid}",
            )
        current = BountyStatus(bounty.status)
        allowed = VALID_STATUS_TRANSITIONS.get(current, set())
        if new_status not in allowed and new_status != current:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Transition {current.value!r} → {new_status.value!r} is not allowed. "
                    f"Allowed transitions: {[s.value for s in allowed]}"
                ),
            )
        bounty.status = new_status
        changes["status"] = new_status.value

    if update.reward_amount is not None:
        old_reward = bounty.reward_amount
        bounty.reward_amount = update.reward_amount
        changes["reward_amount"] = {"from": old_reward, "to": update.reward_amount}

    if update.title is not None:
        bounty.title = update.title
        changes["title"] = update.title

    if not changes:
        raise HTTPException(status_code=400, detail="No changes provided")

    await _log(
        "admin_bounty_updated", actor=actor, bounty_id=bounty_id, changes=changes
    )
    return {"ok": True, "bounty_id": bounty_id, "changes": changes}


@router.post("/bounties/{bounty_id}/close", summary="Force-close a bounty")
async def close_bounty_admin(
    bounty_id: str,
    actor: str = Depends(require_admin),
) -> Dict[str, str]:
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        raise HTTPException(status_code=404, detail=f"Bounty {bounty_id!r} not found")

    current = BountyStatus(bounty.status)
    allowed = VALID_STATUS_TRANSITIONS.get(current, set())
    if BountyStatus.CANCELLED not in allowed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot force-close a bounty in {current.value!r} state. "
                f"Allowed transitions: {[s.value for s in allowed]}"
            ),
        )

    old_status = bounty.status
    bounty.status = BountyStatus.CANCELLED
    await _log(
        "admin_bounty_closed",
        actor=actor,
        bounty_id=bounty_id,
        previous_status=str(old_status),
    )
    return {"ok": "true", "bounty_id": bounty_id, "status": BountyStatus.CANCELLED}


# ---------------------------------------------------------------------------
# Contributor management
# ---------------------------------------------------------------------------


@router.get(
    "/contributors",
    response_model=ContributorListAdminResponse,
    summary="List all contributors",
)
async def list_contributors_admin(
    search: Optional[str] = Query(None),
    is_banned: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _auth: tuple = Depends(require_any),
) -> ContributorListAdminResponse:
    items = list(_contributor_store.values())

    if search:
        q = search.lower()
        items = [c for c in items if q in c.username.lower()]
    if is_banned is not None:
        items = [c for c in items if getattr(c, "is_banned", False) == is_banned]

    items.sort(key=lambda c: getattr(c, "reputation_score", 0.0), reverse=True)
    total = len(items)
    offset = (page - 1) * per_page

    return ContributorListAdminResponse(
        items=[
            ContributorAdminItem(**_contributor_to_dict(c))
            for c in items[offset : offset + per_page]
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get(
    "/contributors/{contributor_id}/history",
    response_model=TierHistoryResponse,
    summary="Contributor tier + reputation history",
)
async def get_contributor_history(
    contributor_id: str,
    limit: int = Query(50, ge=1, le=200),
    _auth: tuple = Depends(require_any),
) -> TierHistoryResponse:
    """Return per-bounty reputation history from PostgreSQL reputation_history table."""
    from sqlalchemy import select as sa_select, desc
    from app.models.tables import ReputationHistoryTable

    try:
        async with get_db_session() as session:
            q = (
                sa_select(ReputationHistoryTable)
                .where(ReputationHistoryTable.contributor_id == contributor_id)
                .order_by(desc(ReputationHistoryTable.created_at))
                .limit(limit)
            )
            result = await session.execute(q)
            rows = result.scalars().all()
    except Exception:
        rows = []

    items = [
        TierHistoryItem(
            tier=str(r.bounty_tier),
            reputation_score=float(r.earned_reputation),
            bounty_id=r.bounty_id,
            bounty_title=r.bounty_title,
            earned_reputation=float(r.earned_reputation),
            created_at=r.created_at.isoformat()
            if hasattr(r.created_at, "isoformat")
            else str(r.created_at),
        )
        for r in rows
    ]
    return TierHistoryResponse(
        contributor_id=contributor_id, items=items, total=len(items)
    )


@router.post("/contributors/{contributor_id}/ban", summary="Ban a contributor")
async def ban_contributor(
    contributor_id: str,
    body: BanRequest,
    actor: str = Depends(require_admin),
) -> Dict[str, str]:
    contributor = _contributor_store.get(contributor_id)
    if not contributor:
        raise HTTPException(
            status_code=404, detail=f"Contributor {contributor_id!r} not found"
        )

    contributor.is_banned = True
    await _log(
        "admin_contributor_banned",
        actor=actor,
        contributor_id=contributor_id,
        username=contributor.username,
        reason=body.reason,
    )
    return {"ok": "true", "contributor_id": contributor_id, "action": "banned"}


@router.post("/contributors/{contributor_id}/unban", summary="Unban a contributor")
async def unban_contributor(
    contributor_id: str,
    actor: str = Depends(require_admin),
) -> Dict[str, str]:
    contributor = _contributor_store.get(contributor_id)
    if not contributor:
        raise HTTPException(
            status_code=404, detail=f"Contributor {contributor_id!r} not found"
        )

    contributor.is_banned = False
    await _log(
        "admin_contributor_unbanned",
        actor=actor,
        contributor_id=contributor_id,
        username=contributor.username,
    )
    return {"ok": "true", "contributor_id": contributor_id, "action": "unbanned"}


# ---------------------------------------------------------------------------
# Review pipeline
# ---------------------------------------------------------------------------


@router.get(
    "/reviews/pipeline",
    response_model=ReviewPipelineResponse,
    summary="Review pipeline",
)
async def get_review_pipeline(
    _auth: tuple = Depends(require_any),
) -> ReviewPipelineResponse:
    active: List[ReviewPipelineItem] = []
    completed_count = 0
    passing_count = 0
    score_sum = 0.0

    for bounty in _bounty_store.values():
        for sub in bounty.submissions or []:
            ai_score = float(getattr(sub, "ai_score", 0.0) or 0.0)
            review_complete = getattr(sub, "review_complete", False)
            meets = getattr(sub, "meets_threshold", False)

            if review_complete:
                completed_count += 1
                score_sum += ai_score
                if meets:
                    passing_count += 1
            else:
                active.append(
                    ReviewPipelineItem(
                        bounty_id=bounty.id,
                        bounty_title=bounty.title,
                        submission_id=str(getattr(sub, "id", "")),
                        pr_url=getattr(sub, "pr_url", ""),
                        submitted_by=getattr(sub, "submitted_by", ""),
                        ai_score=ai_score,
                        review_complete=review_complete,
                        meets_threshold=meets,
                        submitted_at=(
                            sub.submitted_at.isoformat()
                            if hasattr(sub, "submitted_at")
                            and hasattr(sub.submitted_at, "isoformat")
                            else str(getattr(sub, "submitted_at", ""))
                        ),
                    )
                )

    pass_rate = (passing_count / completed_count) if completed_count else 0.0
    avg_score = (score_sum / completed_count) if completed_count else 0.0

    return ReviewPipelineResponse(
        active=active,
        total_active=len(active),
        pass_rate=round(pass_rate, 4),
        avg_score=round(avg_score, 2),
    )


# ---------------------------------------------------------------------------
# Financial overview
# ---------------------------------------------------------------------------


@router.get(
    "/financial/overview",
    response_model=FinancialOverview,
    summary="Token distribution summary",
)
async def get_financial_overview(
    _auth: tuple = Depends(require_any),
) -> FinancialOverview:
    bounties = list(_bounty_store.values())
    paid = [b for b in bounties if b.status == BountyStatus.PAID]
    pending = [
        b
        for b in bounties
        if b.status in (BountyStatus.UNDER_REVIEW, BountyStatus.COMPLETED)
    ]

    total_distributed = sum(b.reward_amount for b in paid)
    rewards = [b.reward_amount for b in bounties if b.reward_amount]
    avg_reward = (sum(rewards) / len(rewards)) if rewards else 0.0
    highest = max(rewards) if rewards else 0.0

    return FinancialOverview(
        total_fndry_distributed=total_distributed,
        total_paid_bounties=len(paid),
        pending_payout_count=len(pending),
        pending_payout_amount=sum(b.reward_amount for b in pending),
        avg_reward=round(avg_reward, 2),
        highest_reward=highest,
    )


@router.get(
    "/financial/payouts", response_model=PayoutHistoryResponse, summary="Payout history"
)
async def get_payout_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _auth: tuple = Depends(require_any),
) -> PayoutHistoryResponse:
    paid_bounties = sorted(
        [b for b in _bounty_store.values() if b.status == BountyStatus.PAID],
        key=lambda b: getattr(b, "created_at", datetime.min),
        reverse=True,
    )
    total = len(paid_bounties)
    offset = (page - 1) * per_page
    page_items = paid_bounties[offset : offset + per_page]

    return PayoutHistoryResponse(
        items=[
            PayoutHistoryItem(
                bounty_id=b.id,
                bounty_title=b.title,
                winner=getattr(b, "winner_wallet", "") or getattr(b, "created_by", ""),
                amount=b.reward_amount,
                status=b.status,
                completed_at=(
                    b.created_at.isoformat()
                    if hasattr(b.created_at, "isoformat")
                    else str(b.created_at)
                ),
            )
            for b in page_items
        ],
        total=total,
    )


# ---------------------------------------------------------------------------
# System health (enhanced)
# ---------------------------------------------------------------------------


@router.get(
    "/system/health", response_model=SystemHealthResponse, summary="System health"
)
async def get_system_health_admin(
    _auth: tuple = Depends(require_any),
) -> SystemHealthResponse:
    from app.database import engine
    from sqlalchemy import text, select as sa_select, func
    from sqlalchemy.exc import SQLAlchemyError
    from redis.asyncio import from_url as redis_from_url, RedisError

    # Database probe
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except (SQLAlchemyError, Exception):
        db_status = "disconnected"

    # Redis probe
    try:
        from app.core.config import REDIS_URL

        redis_url = REDIS_URL
        client = redis_from_url(redis_url, decode_responses=True)
        async with client:
            await client.ping()
        redis_status = "connected"
    except (RedisError, Exception):
        redis_status = "disconnected"

    # WebSocket count
    try:
        from app.services.websocket_manager import manager as ws_manager

        ws_count = len(getattr(ws_manager, "active_connections", {}))
    except Exception:
        ws_count = 0

    # Audit log count from PostgreSQL (real webhook events processed)
    webhook_count = 0
    try:
        async with get_db_session() as session:
            result = await session.execute(
                sa_select(func.count()).select_from(AdminAuditLogTable)
            )
            webhook_count = result.scalar_one_or_none() or 0
    except Exception:
        pass

    # GitHub webhook service status: check if the webhook router is reachable
    try:
        from app.api.webhooks.github import router as _gh_router

        github_webhook_status = "configured" if _gh_router else "not_configured"
    except Exception:
        github_webhook_status = "not_configured"

    # Pending review queue depth
    pending_reviews = sum(
        1
        for b in _bounty_store.values()
        for s in (b.submissions or [])
        if not getattr(s, "review_complete", False) and s.status == "pending"
    )

    uptime = round(time.monotonic() - START_TIME)

    return SystemHealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        uptime_seconds=uptime,
        bot_uptime_seconds=uptime,
        timestamp=datetime.now(timezone.utc).isoformat(),
        services={
            "database": db_status,
            "redis": redis_status,
            "github_webhook": github_webhook_status,
        },
        queue_depth=pending_reviews,
        webhook_events_processed=webhook_count,
        github_webhook_status=github_webhook_status,
        active_websocket_connections=ws_count,
    )


# ---------------------------------------------------------------------------
# Treasury dashboard
# ---------------------------------------------------------------------------


class TreasuryDailyPoint(BaseModel):
    date: str  # YYYY-MM-DD
    outflow: float = 0.0
    inflow: float = 0.0


class TreasuryTransaction(BaseModel):
    id: str
    type: str  # "payout" or "buyback"
    amount: float
    token: str
    recipient: Optional[str] = None
    description: Optional[str] = None
    tx_hash: Optional[str] = None
    solscan_url: Optional[str] = None
    status: str
    created_at: str


class SpendingByTier(BaseModel):
    tier: int
    label: str
    total_fndry: float
    count: int


class BurnRateProjection(BaseModel):
    daily_avg_7d: float
    daily_avg_30d: float
    daily_avg_90d: float
    runway_days_7d: Optional[float] = None
    runway_days_30d: Optional[float] = None


class TreasuryDashboardResponse(BaseModel):
    # Live balances
    sol_balance: float
    fndry_balance: float
    treasury_wallet: str
    total_paid_out_fndry: float
    total_paid_out_sol: float
    total_payouts: int
    # 30-day daily chart data
    daily_points: List[TreasuryDailyPoint]
    # Burn rate / runway
    burn_rate: BurnRateProjection
    # Spending by tier
    spending_by_tier: List[SpendingByTier]
    # Recent 20 transactions
    recent_transactions: List[TreasuryTransaction]
    last_updated: str


def _build_daily_points(payouts: list, days: int = 30) -> List[TreasuryDailyPoint]:
    """Aggregate confirmed/paid payout amounts by day for the last `days` days."""
    from datetime import timedelta

    today = datetime.now(timezone.utc).date()
    buckets: Dict[str, float] = {
        str(today - timedelta(days=i)): 0.0 for i in range(days - 1, -1, -1)
    }
    for p in payouts:
        created = getattr(p, "created_at", None)
        if created is None:
            continue
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created)
            except ValueError:
                continue
        day_str = str(created.date() if hasattr(created, "date") else created)
        if day_str in buckets:
            buckets[day_str] += float(getattr(p, "amount", 0.0))
    return [TreasuryDailyPoint(date=d, outflow=v) for d, v in buckets.items()]


def _burn_rate(
    daily_points: List[TreasuryDailyPoint], fndry_balance: float
) -> BurnRateProjection:
    """Compute avg daily burn from daily points over 7/30/90-day windows and runway."""
    values = [p.outflow for p in daily_points]

    def avg(window: int) -> float:
        slice_ = values[-window:] if len(values) >= window else values
        return sum(slice_) / max(len(slice_), 1)

    d7 = avg(7)
    d30 = avg(30)
    d90 = avg(90)

    def runway(rate: float) -> Optional[float]:
        if rate <= 0:
            return None
        return round(fndry_balance / rate, 1)

    return BurnRateProjection(
        daily_avg_7d=round(d7, 2),
        daily_avg_30d=round(d30, 2),
        daily_avg_90d=round(d90, 2),
        runway_days_7d=runway(d7),
        runway_days_30d=runway(d30),
    )


def _spending_by_tier(bounties: list) -> List[SpendingByTier]:
    """Aggregate paid bounty amounts by tier."""
    tier_labels = {1: "T1 — Starter", 2: "T2 — Pro", 3: "T3 — Expert"}
    buckets: Dict[int, Dict[str, Any]] = {
        1: {"total": 0.0, "count": 0},
        2: {"total": 0.0, "count": 0},
        3: {"total": 0.0, "count": 0},
    }
    for b in bounties:
        if b.status != BountyStatus.PAID:
            continue
        tier_val = getattr(b, "tier", 2)
        try:
            tier_int = int(tier_val)
        except (TypeError, ValueError):
            tier_int = 2
        if tier_int in buckets:
            buckets[tier_int]["total"] += float(b.reward_amount)
            buckets[tier_int]["count"] += 1
    return [
        SpendingByTier(
            tier=t,
            label=tier_labels.get(t, f"T{t}"),
            total_fndry=round(data["total"], 2),
            count=data["count"],
        )
        for t, data in sorted(buckets.items())
    ]


@router.get(
    "/treasury/dashboard",
    response_model=TreasuryDashboardResponse,
    summary="Treasury health dashboard",
)
async def get_treasury_dashboard(
    _auth: tuple = Depends(require_any),
) -> TreasuryDashboardResponse:
    """Admin-only treasury health dashboard.

    Returns live balances, 30-day daily outflow chart, burn-rate projections,
    per-tier spending breakdown, and the 20 most recent transactions.
    """
    # Recent 20 transactions
    from app.services.payout_service import (
        _payout_store,
        _buyback_store,
        _store_lock,
    )
    from app.models.payout import PayoutStatus as PS

    # Snapshot stores under the lock to avoid races
    with _store_lock:
        all_payouts = list(_payout_store.values())
        all_buybacks = list(_buyback_store.values())

    treasury = await get_treasury_stats()

    # Confirmed payouts only for burn-rate charts
    confirmed_payouts = [p for p in all_payouts if p.status in (PS.CONFIRMED,)]

    daily_points = _build_daily_points(confirmed_payouts, days=30)
    burn_rate = _burn_rate(daily_points, treasury.fndry_balance)
    spending_by_tier = _spending_by_tier(list(_bounty_store.values()))

    # Recent 20 transactions: merge payouts + buybacks, sort newest-first
    tx_list: List[TreasuryTransaction] = []
    for p in all_payouts:
        tx_list.append(
            TreasuryTransaction(
                id=p.id,
                type="payout",
                amount=p.amount,
                token=p.token,
                recipient=p.recipient,
                description=p.bounty_title,
                tx_hash=p.tx_hash,
                solscan_url=p.solscan_url,
                status=p.status.value if hasattr(p.status, "value") else str(p.status),
                created_at=p.created_at.isoformat()
                if hasattr(p.created_at, "isoformat")
                else str(p.created_at),
            )
        )
    for b in all_buybacks:
        tx_list.append(
            TreasuryTransaction(
                id=b.id,
                type="buyback",
                amount=b.amount_sol,
                token="SOL",
                description=f"Buyback — {b.amount_fndry:,.0f} FNDRY acquired",
                tx_hash=b.tx_hash,
                solscan_url=b.solscan_url,
                status="confirmed",
                created_at=b.created_at.isoformat()
                if hasattr(b.created_at, "isoformat")
                else str(b.created_at),
            )
        )

    tx_list.sort(key=lambda t: t.created_at, reverse=True)
    recent_transactions = tx_list[:20]

    return TreasuryDashboardResponse(
        sol_balance=treasury.sol_balance,
        fndry_balance=treasury.fndry_balance,
        treasury_wallet=treasury.treasury_wallet,
        total_paid_out_fndry=treasury.total_paid_out_fndry,
        total_paid_out_sol=treasury.total_paid_out_sol,
        total_payouts=treasury.total_payouts,
        daily_points=daily_points,
        burn_rate=burn_rate,
        spending_by_tier=spending_by_tier,
        recent_transactions=recent_transactions,
        last_updated=treasury.last_updated.isoformat(),
    )


# ---------------------------------------------------------------------------
# Audit log (PostgreSQL-backed)
# ---------------------------------------------------------------------------


@router.get(
    "/audit-log", response_model=AuditLogResponse, summary="Admin action audit log"
)
async def get_audit_log(
    limit: int = Query(50, ge=1, le=200),
    event_filter: Optional[str] = Query(None, alias="event"),
    _auth: tuple = Depends(require_any),
) -> AuditLogResponse:
    """Return recent admin audit log entries from PostgreSQL, newest first."""
    from sqlalchemy import select as sa_select, desc

    try:
        from sqlalchemy import func as sa_func

        async with get_db_session() as session:
            base_filter = (
                AdminAuditLogTable.event.contains(event_filter)
                if event_filter
                else None
            )

            count_stmt = sa_select(sa_func.count()).select_from(AdminAuditLogTable)
            if base_filter is not None:
                count_stmt = count_stmt.where(base_filter)
            total_result = await session.execute(count_stmt)
            total = total_result.scalar_one_or_none() or 0

            q = sa_select(AdminAuditLogTable).order_by(
                desc(AdminAuditLogTable.created_at)
            )
            if base_filter is not None:
                q = q.where(base_filter)
            q = q.limit(limit)
            result = await session.execute(q)
            rows = result.scalars().all()
    except Exception as exc:
        import logging as _logging

        _logging.getLogger(__name__).error("audit_log_read_failed error=%r", exc)
        return AuditLogResponse(entries=[], total=0)

    return AuditLogResponse(
        entries=[
            AuditLogEntry(
                event=r.event,
                actor=r.actor,
                role=r.role or "admin",
                timestamp=r.created_at.isoformat()
                if hasattr(r.created_at, "isoformat")
                else str(r.created_at),
                details=r.details or {},
            )
            for r in rows
        ],
        total=total,
    )
