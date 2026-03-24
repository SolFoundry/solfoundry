"""Anti-sybil REST API endpoints.

User endpoints (authenticated):
  POST /api/anti-sybil/appeal          Submit an appeal against a flag
  GET  /api/anti-sybil/my-flags        View own active flags

Admin endpoints (admin role required):
  GET  /api/admin/sybil/flags          List all flags (filterable)
  POST /api/admin/sybil/flags/{id}/resolve   Resolve a flag (false positive)
  GET  /api/admin/sybil/appeals        List all appeals
  POST /api/admin/sybil/appeals/{id}/resolve Approve or reject an appeal
"""

from __future__ import annotations

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.api.admin import require_admin
from app.api.auth import get_current_user_id
from app.database import get_db
from app.models.anti_sybil import (
    AppealCreateRequest,
    AppealResponse,
    AppealStatus,
    ResolveAppealRequest,
    ResolveFlagRequest,
    SybilAppealTable,
    SybilFlagTable,
    SybilFlagResponse,
)
from app.services import anti_sybil_service

router = APIRouter(tags=["anti-sybil"])

# ---------------------------------------------------------------------------
# User-facing endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/anti-sybil/appeal",
    response_model=AppealResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an appeal against a sybil flag",
)
async def submit_appeal(
    body: AppealCreateRequest,
    user_id: str = Depends(get_current_user_id),
) -> AppealResponse:
    """Submit an appeal if you believe a sybil flag was applied incorrectly.

    Your appeal will be reviewed by an admin. The flag remains active
    until the appeal is approved.
    """
    try:
        appeal = await anti_sybil_service.create_appeal(
            user_id=user_id,
            flag_id=body.flag_id,
            reason=body.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return AppealResponse(
        id=str(appeal.id),
        user_id=appeal.user_id,
        flag_id=str(appeal.flag_id),
        reason=appeal.reason,
        status=appeal.status,
        reviewer_note=appeal.reviewer_note,
        reviewed_by=appeal.reviewed_by,
        created_at=appeal.created_at,
        resolved_at=appeal.resolved_at,
    )


@router.get(
    "/anti-sybil/my-flags",
    response_model=list[SybilFlagResponse],
    summary="View your own unresolved sybil flags",
)
async def my_flags(
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
) -> list[SybilFlagResponse]:
    """Return all unresolved sybil flags on your account.

    Resolved flags (cleared by admin or approved appeal) are excluded.
    """
    result = await db.execute(
        select(SybilFlagTable)
        .where(
            SybilFlagTable.user_id == user_id,
            SybilFlagTable.resolved.is_(False),
        )
        .order_by(SybilFlagTable.created_at.desc())
    )
    flags = result.scalars().all()
    return [
        SybilFlagResponse(
            id=str(f.id),
            user_id=f.user_id,
            flag_type=f.flag_type,
            severity=f.severity,
            details=f.details or {},
            resolved=f.resolved,
            resolved_by=f.resolved_by,
            resolved_note=f.resolved_note,
            created_at=f.created_at,
            resolved_at=f.resolved_at,
        )
        for f in flags
    ]


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/admin/sybil/flags",
    response_model=list[SybilFlagResponse],
    summary="[Admin] List sybil flags",
)
async def admin_list_flags(
    user_id: Optional[str] = Query(None),
    flag_type: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    actor: str = Depends(require_admin),
    db=Depends(get_db),
) -> list[SybilFlagResponse]:
    """List sybil flags with optional filters."""
    q = select(SybilFlagTable).order_by(SybilFlagTable.created_at.desc())
    if user_id:
        q = q.where(SybilFlagTable.user_id == user_id)
    if flag_type:
        q = q.where(SybilFlagTable.flag_type == flag_type)
    if resolved is not None:
        q = q.where(SybilFlagTable.resolved.is_(resolved))
    q = q.offset(skip).limit(limit)

    result = await db.execute(q)
    flags = result.scalars().all()
    return [
        SybilFlagResponse(
            id=str(f.id),
            user_id=f.user_id,
            flag_type=f.flag_type,
            severity=f.severity,
            details=f.details or {},
            resolved=f.resolved,
            resolved_by=f.resolved_by,
            resolved_note=f.resolved_note,
            created_at=f.created_at,
            resolved_at=f.resolved_at,
        )
        for f in flags
    ]


@router.post(
    "/admin/sybil/flags/{flag_id}/resolve",
    response_model=SybilFlagResponse,
    summary="[Admin] Resolve a sybil flag (false positive)",
)
async def admin_resolve_flag(
    flag_id: str,
    body: ResolveFlagRequest,
    actor: str = Depends(require_admin),
) -> SybilFlagResponse:
    """Mark a sybil flag as resolved (false positive clearance)."""
    try:
        flag = await anti_sybil_service.resolve_flag(
            flag_id=flag_id, resolver_id=actor, note=body.resolved_note
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return SybilFlagResponse(
        id=str(flag.id),
        user_id=flag.user_id,
        flag_type=flag.flag_type,
        severity=flag.severity,
        details=flag.details or {},
        resolved=flag.resolved,
        resolved_by=flag.resolved_by,
        resolved_note=flag.resolved_note,
        created_at=flag.created_at,
        resolved_at=flag.resolved_at,
    )


@router.get(
    "/admin/sybil/appeals",
    response_model=list[AppealResponse],
    summary="[Admin] List sybil appeals",
)
async def admin_list_appeals(
    appeal_status: Optional[str] = Query(None, alias="status"),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    actor: str = Depends(require_admin),
    db=Depends(get_db),
) -> list[AppealResponse]:
    """List all appeals, optionally filtered by status."""
    q = select(SybilAppealTable).order_by(SybilAppealTable.created_at.desc())
    if appeal_status:
        q = q.where(SybilAppealTable.status == appeal_status)
    q = q.offset(skip).limit(limit)

    result = await db.execute(q)
    appeals = result.scalars().all()
    return [
        AppealResponse(
            id=str(a.id),
            user_id=a.user_id,
            flag_id=str(a.flag_id),
            reason=a.reason,
            status=a.status,
            reviewer_note=a.reviewer_note,
            reviewed_by=a.reviewed_by,
            created_at=a.created_at,
            resolved_at=a.resolved_at,
        )
        for a in appeals
    ]


@router.post(
    "/admin/sybil/appeals/{appeal_id}/resolve",
    response_model=AppealResponse,
    summary="[Admin] Approve or reject a sybil appeal",
)
async def admin_resolve_appeal(
    appeal_id: str,
    body: ResolveAppealRequest,
    actor: str = Depends(require_admin),
) -> AppealResponse:
    """Approve or reject an appeal.

    Approving an appeal also resolves the underlying flag, unblocking
    the affected user from the restricted action.
    """
    if body.status not in (AppealStatus.APPROVED, AppealStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be 'approved' or 'rejected'",
        )

    try:
        appeal = await anti_sybil_service.resolve_appeal(
            appeal_id=appeal_id,
            reviewer_id=actor,
            status=body.status,
            note=body.reviewer_note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return AppealResponse(
        id=str(appeal.id),
        user_id=appeal.user_id,
        flag_id=str(appeal.flag_id),
        reason=appeal.reason,
        status=appeal.status,
        reviewer_note=appeal.reviewer_note,
        reviewed_by=appeal.reviewed_by,
        created_at=appeal.created_at,
        resolved_at=appeal.resolved_at,
    )
