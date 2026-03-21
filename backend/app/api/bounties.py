"""Bounty CRUD, submission, and search API router.

## Overview

Bounties are paid work opportunities on SolFoundry. Each bounty has:
- **Tier**: Difficulty level (1-3) determining reward range and deadline
- **Category**: Work type (frontend, backend, smart_contract, etc.)
- **Status**: Lifecycle state (open, claimed, completed, cancelled)
- **Reward**: $FNDRY token amount

## Bounty Tiers

| Tier | Reward Range | Deadline | Access |
|------|-------------|----------|--------|
| 1 | 50 - 500 $FNDRY | 72 hours | Open race |
| 2 | 500 - 5,000 $FNDRY | 7 days | 4+ merged T1 bounties |
| 3 | 5,000 - 50,000 $FNDRY | 14-30 days | 3+ merged T2 bounties |

## Categories

- `frontend`: UI/UX, React, Vue, CSS
- `backend`: API, database, services
- `smart_contract`: Solana programs, Anchor
- `documentation`: Docs, guides, README
- `testing`: Unit tests, integration tests
- `infrastructure`: DevOps, CI/CD, deployment
- `other`: Miscellaneous

## Status Lifecycle

```
open → claimed → completed
  │        │
  └────────┴──→ cancelled
```

## Authentication

Mutation endpoints (POST, PATCH, DELETE) require authentication via:
- Bearer token in Authorization header, or
- X-User-ID header (development mode)

## Rate Limits

- Search endpoints: 100 requests/minute
- CRUD operations: 30 requests/minute
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
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
)
from app.services import bounty_service
from app.services.bounty_search_service import BountySearchService
from app.core.errors import NotFoundException
from app.core.logging_config import get_logger
from app.core.audit import audit_log, AuditAction
from app.api.auth import get_current_user_id


logger = get_logger(__name__)
router = APIRouter(prefix="/api/bounties", tags=["bounties"])


def _get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=BountyResponse,
    status_code=201,
    summary="Create a new bounty",
    description="""
Create a new bounty on the platform.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Bounty title (1-255 chars) |
| description | string | Yes | Full bounty description |
| tier | integer | Yes | Difficulty tier (1-3) |
| category | string | Yes | Work category |
| reward_amount | float | Yes | $FNDRY reward amount |
| reward_token | string | No | Token symbol (default: "FNDRY") |
| deadline | datetime | No | Submission deadline |
| skills | array | No | Required skills |
| github_issue_url | string | No | Link to GitHub issue |
| github_issue_number | integer | No | GitHub issue number |
| github_repo | string | No | GitHub repository name |

## Tier Rules

- **Tier 1**: 50-500 $FNDRY, 72-hour deadline
- **Tier 2**: 500-5,000 $FNDRY, 7-day deadline
- **Tier 3**: 5,000-50,000 $FNDRY, 14-30 day deadline

## Rate Limit

30 requests per minute.
""",
)
async def create_bounty(
    data: BountyCreate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> BountyResponse:
    """Create a new bounty on the platform.
    
    Requires authentication.
    """
    logger.info(
        "Creating bounty",
        extra={"extra_data": {"title": data.title, "tier": str(data.tier), "user_id": user_id}},
    )
    result = bounty_service.create_bounty(data)

    # Audit log with actual caller and IP address
    audit_log(
        action=AuditAction.BOUNTY_CREATED,
        actor=user_id,
        resource="bounty",
        resource_id=result.id,
        ip_address=_get_client_ip(request),
        metadata={"title": data.title, "tier": str(data.tier)},
    )

    return result


@router.get(
    "",
    response_model=BountyListResponse,
    summary="List bounties with optional filters",
    description="""
Get a paginated list of bounties with optional filtering.

## Filter Options

- **status**: Filter by status (open, claimed, completed, cancelled)
- **tier**: Filter by tier (1, 2, or 3)
- **skills**: Filter by skills (comma-separated)

## Rate Limit

100 requests per minute.
""",
)
async def list_bounties(
    status: Optional[BountyStatus] = Query(None, description="Filter by status"),
    tier: Optional[BountyTier] = Query(None, description="Filter by tier"),
    skills: Optional[str] = Query(
        None, description="Comma-separated skill filter (case-insensitive)"
    ),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
) -> BountyListResponse:
    logger.debug(
        "Listing bounties",
        extra={"extra_data": {"status": str(status), "tier": str(tier)}},
    )
    skill_list = (
        [s.strip().lower() for s in skills.split(",") if s.strip()] if skills else None
    )
    return bounty_service.list_bounties(
        status=status, tier=tier, skills=skill_list, skip=skip, limit=limit
    )


# ---------------------------------------------------------------------------
# Search endpoints (placed before /{bounty_id} to avoid route conflicts)
# ---------------------------------------------------------------------------


async def _get_search_service(
    session: AsyncSession = Depends(get_db),
) -> BountySearchService:
    return BountySearchService(session)


@router.get(
    "/search",
    response_model=BountySearchResponse,
    summary="Full-text search with advanced filters",
    description="""
Full-text search and filter for bounties.

## Search Features

- **Full-text search**: Searches across title and description
- **Multi-filter support**: Combine tier, category, status, reward range, skills
- **Multiple sort options**: By date, reward, deadline, or popularity
- **Pagination**: Efficient browsing with page/per_page

## Example Requests

```
GET /api/bounties/search?q=smart+contract&tier=1&status=open
GET /api/bounties/search?category=frontend&reward_min=100&reward_max=500
GET /api/bounties/search?skills=rust,anchor&sort=newest
```

## Rate Limit

100 requests per minute.
""",
)
async def search_bounties(
    q: str = Query("", max_length=200, description="Search query"),
    status: Optional[BountyStatus] = Query(None),
    tier: Optional[int] = Query(None, ge=1, le=3),
    skills: Optional[str] = Query(None, description="Comma-separated skills"),
    category: Optional[str] = Query(None),
    creator_type: Optional[str] = Query(None, pattern=r"^(platform|community)$"),
    reward_min: Optional[float] = Query(None, ge=0),
    reward_max: Optional[float] = Query(None, ge=0),
    deadline_before: Optional[str] = Query(None, description="ISO datetime"),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    svc: BountySearchService = Depends(_get_search_service),
) -> BountySearchResponse:
    logger.info(
        "Searching bounties", extra={"extra_data": {"query": q, "status": str(status)}}
    )
    skill_list = (
        [s.strip().lower() for s in skills.split(",") if s.strip()] if skills else []
    )
    params = BountySearchParams(
        q=q,
        status=status,
        tier=tier,
        skills=skill_list,
        category=category,
        creator_type=creator_type,
        reward_min=reward_min,
        reward_max=reward_max,
        sort=sort,
        page=page,
        per_page=per_page,
    )
    return await svc.search(params)


@router.get(
    "/autocomplete",
    response_model=AutocompleteResponse,
    summary="Search autocomplete suggestions",
    description="""
Get autocomplete suggestions for bounty search.

Returns matching bounty titles and skills based on the query string.
Minimum query length is 2 characters.

## Use Case

Use this endpoint to implement search suggestions as users type.
Results include both bounty titles and skill names.

## Rate Limit

100 requests per minute.
""",
)
async def autocomplete(
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(8, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> AutocompleteResponse:
    return await svc.autocomplete(q, limit)


@router.get(
    "/hot",
    response_model=list[BountySearchResult],
    summary="Hot bounties — highest activity in last 24h",
    description="""
Get bounties with the highest activity in the last 24 hours.

## Use Case

Display trending bounties on the homepage or in a "Hot" section.

## Rate Limit

100 requests per minute.
""",
)
async def hot_bounties(
    limit: int = Query(6, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> list[BountySearchResult]:
    return await svc.hot_bounties(limit)


@router.get(
    "/recommended",
    response_model=list[BountySearchResult],
    summary="Recommended bounties based on user skills",
    description="""
Get recommended bounties based on user skills.

## Use Case

Display personalized bounty recommendations to logged-in users.

## Parameters

- **skills**: Comma-separated list of user skills
- **exclude**: Comma-separated bounty IDs to exclude (e.g., already viewed)
- **limit**: Maximum number of recommendations

## Rate Limit

100 requests per minute.
""",
)
async def recommended_bounties(
    skills: str = Query(..., description="Comma-separated user skills"),
    exclude: Optional[str] = Query(
        None, description="Comma-separated bounty IDs to exclude"
    ),
    limit: int = Query(6, ge=1, le=20),
    svc: BountySearchService = Depends(_get_search_service),
) -> list[BountySearchResult]:
    skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()]
    excluded = [e.strip() for e in exclude.split(",") if e.strip()] if exclude else []
    return await svc.recommended(skill_list, excluded, limit)


# ---------------------------------------------------------------------------
# CRUD endpoints (by ID)
# ---------------------------------------------------------------------------


@router.get(
    "/{bounty_id}",
    response_model=BountyResponse,
    summary="Get a single bounty by ID",
    description="""
Retrieve detailed information about a specific bounty.

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique bounty identifier (UUID) |
| title | string | Bounty title |
| description | string | Full bounty description |
| tier | integer | Difficulty tier (1-3) |
| category | string | Work category |
| status | string | Current status |
| reward_amount | float | $FNDRY reward amount |
| reward_token | string | Token symbol (always "FNDRY") |
| deadline | datetime | Submission deadline |
| skills | array | Required skills |
| github_issue_url | string | Link to GitHub issue |
| claimant_id | string | ID of user who claimed (if claimed) |
| winner_id | string | ID of winner (if completed) |
| popularity | integer | View/interest count |
| created_at | datetime | Creation timestamp |
| updated_at | datetime | Last update timestamp |

## Rate Limit

100 requests per minute.
""",
)
async def get_bounty(bounty_id: str) -> BountyResponse:
    logger.debug(f"Fetching bounty: {bounty_id}")
    result = bounty_service.get_bounty(bounty_id)
    if not result:
        raise NotFoundException("Bounty", bounty_id)
    return result


@router.patch(
    "/{bounty_id}",
    response_model=BountyResponse,
    summary="Partially update a bounty",
    description="""
Update an existing bounty.

## Updatable Fields

All fields are optional. Only provided fields will be updated.

| Field | Type | Description |
|-------|------|-------------|
| title | string | Bounty title |
| description | string | Full description |
| tier | integer | Difficulty tier (1-3) |
| category | string | Work category |
| reward_amount | float | $FNDRY reward |
| deadline | datetime | Submission deadline |
| skills | array | Required skills |

## Rate Limit

30 requests per minute.
""",
)
async def update_bounty(
    bounty_id: str,
    data: BountyUpdate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> BountyResponse:
    """Update an existing bounty.
    
    Requires authentication.
    """
    logger.info(f"Updating bounty: {bounty_id} by user: {user_id}")
    result, error = bounty_service.update_bounty(bounty_id, data)
    if error:
        if "not found" in error.lower():
            raise NotFoundException("Bounty", bounty_id)
        raise HTTPException(status_code=400, detail=error)

    # Audit log with actual caller and IP address
    audit_log(
        action=AuditAction.BOUNTY_ESCALATED,
        actor=user_id,
        resource="bounty",
        resource_id=bounty_id,
        ip_address=_get_client_ip(request),
        metadata={"update_fields": data.model_dump(exclude_unset=True)},
    )

    return result


@router.delete(
    "/{bounty_id}",
    status_code=204,
    summary="Delete a bounty",
    description="""
Delete a bounty permanently.

## Authentication Required

This endpoint requires authentication.

## Warning

This action is irreversible. All bounty data will be permanently deleted.

## Rate Limit

30 requests per minute.
""",
)
async def delete_bounty(
    bounty_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> None:
    """Delete a bounty permanently.
    
    Requires authentication.
    """
    logger.info(f"Deleting bounty: {bounty_id} by user: {user_id}")
    if not bounty_service.delete_bounty(bounty_id):
        raise NotFoundException("Bounty", bounty_id)

    # Audit log with actual caller and IP address
    audit_log(
        action=AuditAction.BOUNTY_CANCELLED,
        actor=user_id,
        resource="bounty",
        resource_id=bounty_id,
        ip_address=_get_client_ip(request),
    )


@router.post(
    "/{bounty_id}/submit",
    response_model=SubmissionResponse,
    status_code=201,
    summary="Submit a PR solution for a bounty",
    description="""
Submit a pull request as a solution for a bounty.

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| pr_url | string | Yes | URL of the pull request |
| pr_number | integer | Yes | PR number |
| wallet_address | string | Yes | Solana wallet for payout |

## Requirements

- PR must reference the bounty issue (e.g., "Closes #123")
- Wallet address must be valid Solana address

## Rate Limit

30 requests per minute.
""",
)
async def submit_solution(bounty_id: str, data: SubmissionCreate) -> SubmissionResponse:
    logger.info(f"Submitting solution for bounty: {bounty_id}")
    result, error = bounty_service.submit_solution(bounty_id, data)
    if error:
        if "not found" in error.lower():
            raise NotFoundException("Bounty", bounty_id)
        raise HTTPException(status_code=400, detail=error)

    # Audit log
    audit_log(
        action=AuditAction.BOUNTY_CLAIMED,
        actor=data.submitted_by or "unknown",
        resource="bounty",
        resource_id=bounty_id,
    )

    return result


@router.get(
    "/{bounty_id}/submissions",
    response_model=list[SubmissionResponse],
    summary="List submissions for a bounty",
    description="""
Get all submissions for a specific bounty.

## Response

Returns a list of submission objects, each containing:
- PR URL and number
- Submitter information
- Wallet address for payout
- Submission timestamp

## Rate Limit

100 requests per minute.
""",
)
async def get_submissions(bounty_id: str) -> list[SubmissionResponse]:
    result = bounty_service.get_submissions(bounty_id)
    if result is None:
        raise NotFoundException("Bounty", bounty_id)
    return result
