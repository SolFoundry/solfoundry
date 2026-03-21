"""Dispute Resolution API Router.

This module provides API endpoints for the dispute resolution system.

## Endpoints

- POST /api/disputes - Create a new dispute
- GET /api/disputes - List disputes (with filters)
- GET /api/disputes/{dispute_id} - Get dispute details
- POST /api/disputes/{dispute_id}/evidence - Submit evidence
- POST /api/disputes/{dispute_id}/resolve - Resolve dispute (admin)
- POST /api/disputes/{dispute_id}/mediate - Transition to mediation
- GET /api/disputes/stats - Get dispute statistics

## Authentication

All endpoints require authentication via:
- Bearer token (Authorization header)
- X-User-ID header (development mode)

## Rate Limits

- List/Search: 100 requests/minute
- Create/Update: 30 requests/minute
"""

from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.dispute import (
    DisputeCreate,
    DisputeResponse,
    DisputeListResponse,
    DisputeDetailResponse,
    DisputeResolve,
    DisputeTransition,
    DisputeStats,
    EvidenceSubmission,
    DisputeState,
)
from app.services.dispute_service import DisputeService
from app.auth import get_current_user_id

router = APIRouter(prefix="/api/disputes", tags=["disputes"])


async def get_dispute_service(
    session: AsyncSession = Depends(get_db),
) -> DisputeService:
    """Dependency injection for DisputeService."""
    return DisputeService(session)


@router.post(
    "",
    response_model=DisputeResponse,
    status_code=201,
    summary="Create a new dispute",
    description="""
Create a new dispute for a rejected submission.

## Requirements
- Submission must be rejected
- Dispute must be filed within 72 hours of rejection
- No existing dispute for the same submission

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| bounty_id | string | Yes | ID of the bounty |
| submission_id | string | Yes | ID of the rejected submission |
| reason | string | Yes | Reason for dispute (enum) |
| description | string | Yes | Detailed explanation (10-5000 chars) |
| initial_evidence | array | No | Initial evidence items |

## Rate Limit

30 requests per minute.
""",
)
async def create_dispute(
    data: DisputeCreate,
    user_id: str = Depends(get_current_user_id),
    svc: DisputeService = Depends(get_dispute_service),
) -> DisputeResponse:
    """Create a new dispute for a rejected submission."""
    # In a real implementation, we'd fetch the creator_id from the bounty
    # For now, we'll use a placeholder
    creator_id = "00000000-0000-0000-0000-000000000000"

    result, error = await svc.create_dispute(
        contributor_id=user_id,
        data=data,
        creator_id=creator_id,
    )

    if error:
        if "not found" in error.lower():
            raise HTTPException(status_code=404, detail=error)
        elif "72 hours" in error:
            raise HTTPException(status_code=400, detail=error)
        elif "already exists" in error.lower():
            raise HTTPException(status_code=409, detail=error)
        raise HTTPException(status_code=400, detail=error)

    return result


@router.get(
    "",
    response_model=DisputeListResponse,
    summary="List disputes with optional filters",
    description="""
Get a paginated list of disputes.

## Filter Options

- **contributor_id**: Filter by contributor
- **creator_id**: Filter by bounty creator
- **state**: Filter by dispute state (OPENED, EVIDENCE, MEDIATION, RESOLVED)

## Pagination

- **skip**: Number of items to skip (default: 0)
- **limit**: Items per page (default: 20, max: 100)

## Rate Limit

100 requests per minute.
""",
)
async def list_disputes(
    contributor_id: Optional[str] = Query(None, description="Filter by contributor ID"),
    creator_id: Optional[str] = Query(None, description="Filter by creator ID"),
    state: Optional[str] = Query(None, description="Filter by state"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    svc: DisputeService = Depends(get_dispute_service),
) -> DisputeListResponse:
    """List disputes with optional filters."""
    return await svc.list_disputes(
        contributor_id=contributor_id,
        creator_id=creator_id,
        state=state,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/stats",
    response_model=DisputeStats,
    summary="Get dispute statistics",
    description="""
Get aggregate statistics about disputes.

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| total_disputes | int | Total number of disputes |
| opened_disputes | int | Disputes in OPENED state |
| evidence_disputes | int | Disputes in EVIDENCE state |
| mediation_disputes | int | Disputes in MEDIATION state |
| resolved_disputes | int | Disputes in RESOLVED state |
| contributor_wins | int | Disputes resolved for contributor |
| creator_wins | int | Disputes resolved for creator |
| splits | int | Disputes with split outcome |
| auto_resolved_count | int | Disputes auto-resolved by AI |
| manual_resolved_count | int | Disputes manually resolved by admin |
| avg_resolution_time_hours | float | Average time to resolution |

## Rate Limit

100 requests per minute.
""",
)
async def get_dispute_stats(
    svc: DisputeService = Depends(get_dispute_service),
) -> DisputeStats:
    """Get dispute statistics."""
    return await svc.get_stats()


@router.get(
    "/{dispute_id}",
    response_model=DisputeDetailResponse,
    summary="Get dispute details",
    description="""
Get detailed information about a specific dispute.

Includes full history of state transitions and actions.

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique dispute ID |
| bounty_id | string | Associated bounty ID |
| submission_id | string | Associated submission ID |
| contributor_id | string | ID of disputing contributor |
| creator_id | string | ID of bounty creator |
| reason | string | Reason for dispute |
| description | string | Detailed description |
| state | string | Current state |
| outcome | string | Resolution outcome (if resolved) |
| contributor_evidence | array | Evidence submitted by contributor |
| creator_evidence | array | Evidence submitted by creator |
| ai_review_score | float | AI mediation score (0-10) |
| ai_review_notes | string | AI analysis notes |
| auto_resolved | bool | Whether auto-resolved by AI |
| resolver_id | string | Admin who resolved (if manual) |
| resolution_notes | string | Resolution explanation |
| history | array | State transition history |

## Rate Limit

100 requests per minute.
""",
)
async def get_dispute(
    dispute_id: str,
    svc: DisputeService = Depends(get_dispute_service),
) -> DisputeDetailResponse:
    """Get a specific dispute by ID."""
    result = await svc.get_dispute(dispute_id)

    if not result:
        raise HTTPException(status_code=404, detail="Dispute not found")

    return result


@router.post(
    "/{dispute_id}/evidence",
    response_model=DisputeResponse,
    summary="Submit evidence for a dispute",
    description="""
Submit evidence for an ongoing dispute.

## Who Can Submit
- Contributors can submit contributor_evidence
- Bounty creators can submit creator_evidence

## Evidence Types

| Type | Description |
|------|-------------|
| link | URL to external resource |
| image | URL to image |
| text | Text explanation |
| code | Code snippet or gist URL |
| document | URL to document |

## Deadline

Evidence must be submitted within 72 hours of dispute creation.

## Rate Limit

30 requests per minute.
""",
)
async def submit_evidence(
    dispute_id: str,
    data: EvidenceSubmission,
    user_id: str = Depends(get_current_user_id),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    svc: DisputeService = Depends(get_dispute_service),
) -> DisputeResponse:
    """Submit evidence for a dispute."""
    # Determine actor role from context
    # In production, this would check the user's relationship to the dispute
    actor_role = x_user_role or "contributor"

    result, error = await svc.submit_evidence(
        dispute_id=dispute_id,
        actor_id=user_id,
        actor_role=actor_role,
        evidence=data,
    )

    if error:
        if "not found" in error.lower():
            raise HTTPException(status_code=404, detail=error)
        elif "deadline" in error.lower():
            raise HTTPException(status_code=400, detail=error)
        elif "authorized" in error.lower():
            raise HTTPException(status_code=403, detail=error)
        raise HTTPException(status_code=400, detail=error)

    return result


@router.post(
    "/{dispute_id}/mediate",
    response_model=DisputeResponse,
    summary="Transition dispute to mediation",
    description="""
Transition a dispute to the MEDIATION state.

This triggers:
1. AI review of the dispute
2. Auto-resolution if AI score >= 7/10
3. Telegram notification to admins if manual review needed

## Authorization

Only the dispute creator or an admin can trigger mediation.

## Rate Limit

30 requests per minute.
""",
)
async def transition_to_mediation(
    dispute_id: str,
    user_id: str = Depends(get_current_user_id),
    svc: DisputeService = Depends(get_dispute_service),
) -> DisputeResponse:
    """Transition dispute to mediation state."""
    result, error = await svc.transition_to_mediation(
        dispute_id=dispute_id,
        actor_id=user_id,
    )

    if error:
        if "not found" in error.lower():
            raise HTTPException(status_code=404, detail=error)
        raise HTTPException(status_code=400, detail=error)

    return result


@router.post(
    "/{dispute_id}/resolve",
    response_model=DisputeResponse,
    summary="Resolve a dispute (admin only)",
    description="""
Manually resolve a dispute.

## Authorization

Requires admin role.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| outcome | string | Yes | Resolution outcome (enum) |
| resolution_notes | string | Yes | Explanation (1-5000 chars) |
| creator_penalty | float | No | Reputation penalty for creator (0-100) |
| contributor_penalty | float | No | Reputation penalty for contributor (0-100) |

## Outcomes

| Outcome | Description |
|---------|-------------|
| release_to_contributor | Reward goes to contributor |
| refund_to_creator | Reward refunded to creator |
| split | Reward split between parties |

## Rate Limit

30 requests per minute.
""",
)
async def resolve_dispute(
    dispute_id: str,
    data: DisputeResolve,
    user_id: str = Depends(get_current_user_id),
    svc: DisputeService = Depends(get_dispute_service),
) -> DisputeResponse:
    """Resolve a dispute (admin action)."""
    # In production, verify admin role here

    result, error = await svc.resolve_dispute(
        dispute_id=dispute_id,
        resolver_id=user_id,
        resolution=data,
    )

    if error:
        if "not found" in error.lower():
            raise HTTPException(status_code=404, detail=error)
        elif "already resolved" in error.lower():
            raise HTTPException(status_code=400, detail=error)
        raise HTTPException(status_code=400, detail=error)

    return result