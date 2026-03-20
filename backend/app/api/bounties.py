"""Bounty CRUD, submission, and search API router.

Endpoints: create, list, get, update, delete, submit solution, list submissions,
search, autocomplete, hot bounties, recommended bounties.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
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

router = APIRouter(prefix="/api/bounties", tags=["bounties"])

# ---------------------------------------------------------------------------
# Common response dicts
# ---------------------------------------------------------------------------

_404_bounty = {
    "description": "Bounty not found",
    "content": {"application/json": {"example": {"detail": "Bounty not found"}}},
}
_400 = {
    "description": "Validation error or invalid state transition",
    "content": {
        "application/json": {
            "examples": {
                "invalid_status": {"value": {"detail": "Invalid status transition: open → paid"}},
                "already_submitted": {"value": {"detail": "Bounty is not open for submissions"}},
            }
        }
    },
}

_BOUNTY_EXAMPLE = {
    "id": "abc123",
    "title": "Fix escrow unlock race condition",
    "description": "The escrow unlock instruction sometimes fails under high load...",
    "tier": 2,
    "reward_amount": 750.0,
    "status": "open",
    "github_issue_url": "https://github.com/solfoundry/solfoundry/issues/42",
    "required_skills": ["rust", "anchor", "solana"],
    "deadline": "2024-03-01T00:00:00Z",
    "created_by": "solfoundry-bot",
    "submissions": [],
    "submission_count": 0,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
}


@router.post(
    "",
    response_model=BountyResponse,
    status_code=201,
    summary="Create a bounty",
    description="""
Create a new bounty that contributors can discover and claim.

**Tiers:**
- `1` — Simple tasks (bug fixes, docs): 100–500 FNDRY typical
- `2` — Medium tasks (features, refactors): 500–2,500 FNDRY typical
- `3` — Complex tasks (architecture, security audits): 2,500+ FNDRY typical

**Skills** must be lowercase alphanumeric and may contain `.`, `+`, `-`, `_`.
Maximum 20 skills per bounty.

**Status lifecycle:** `open → in_progress → completed → paid`
""",
    responses={
        201: {
            "description": "Bounty created",
            "content": {"application/json": {"example": _BOUNTY_EXAMPLE}},
        },
        422: {
            "description": "Validation error",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [
                            {
                                "loc": ["body", "required_skills", 0],
                                "msg": "Invalid skill format: 'My Skill'. Skills must be lowercase alphanumeric",
                                "type": "value_error",
                            }
                        ]
                    }
                }
            },
        },
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "title": "Fix escrow unlock race condition",
                        "description": "The escrow unlock instruction sometimes fails under high load. Root cause is a missing constraint check.",
                        "tier": 2,
                        "reward_amount": 750.0,
                        "github_issue_url": "https://github.com/solfoundry/solfoundry/issues/42",
                        "required_skills": ["rust", "anchor", "solana"],
                        "deadline": "2024-03-01T00:00:00Z",
                        "created_by": "alice",
                    }
                }
            }
        }
    },
)
async def create_bounty(data: BountyCreate) -> BountyResponse:
    return bounty_service.create_bounty(data)


@router.get(
    "",
    response_model=BountyListResponse,
    summary="List bounties",
    description="""
Return a paginated list of bounties with optional filters.

**Filter examples:**
- `?status=open` — only open bounties
- `?tier=3` — only Tier 3 bounties
- `?skills=rust,anchor` — bounties requiring Rust or Anchor (OR logic)
- `?status=open&tier=2&limit=5` — open Tier 2 bounties, 5 per page

Results are sorted by creation date (newest first).
For full-text search and advanced filtering, use `GET /api/bounties/search`.
""",
    responses={
        200: {
            "description": "Paginated bounty list",
            "content": {
                "application/json": {
                    "example": {
                        "items": [_BOUNTY_EXAMPLE],
                        "total": 42,
                        "skip": 0,
                        "limit": 20,
                    }
                }
            },
        }
    },
)
async def list_bounties(
    status: Optional[BountyStatus] = Query(
        None,
        description="Filter by lifecycle status: `open`, `in_progress`, `completed`, `paid`",
    ),
    tier: Optional[BountyTier] = Query(
        None,
        description="Filter by difficulty tier: `1` (easy), `2` (medium), `3` (hard)",
    ),
    skills: Optional[str] = Query(
        None,
        description="Comma-separated skill filter — returns bounties requiring **any** of the listed skills (case-insensitive). Example: `rust,anchor,typescript`",
    ),
    skip: int = Query(0, ge=0, description="Number of items to skip (pagination offset)"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return (max 100)"),
) -> BountyListResponse:
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
    summary="Full-text search bounties",
    description="""
Advanced bounty search with full-text matching, relevance scoring, and multi-dimensional filtering.

**Sort options:**
- `newest` — most recently created (default)
- `reward_high` — highest reward first
- `reward_low` — lowest reward first
- `deadline` — soonest deadline first
- `submissions` — most submissions first
- `best_match` — relevance score (only useful when `q` is set)

**Category values:** `smart-contract`, `frontend`, `backend`, `design`, `content`, `security`, `devops`, `documentation`

**Creator type:** `platform` (SolFoundry-managed) or `community` (user-created)
""",
    responses={
        200: {
            "description": "Search results with relevance metadata",
            "content": {
                "application/json": {
                    "example": {
                        "items": [
                            {
                                **_BOUNTY_EXAMPLE,
                                "description": "The escrow unlock instruction sometimes fails...",
                                "relevance_score": 0.92,
                                "skill_match_count": 2,
                            }
                        ],
                        "total": 5,
                        "page": 1,
                        "per_page": 20,
                        "query": "escrow unlock",
                    }
                }
            },
        }
    },
)
async def search_bounties(
    q: str = Query("", max_length=200, description="Full-text search query"),
    status: Optional[BountyStatus] = Query(None, description="Filter by status"),
    tier: Optional[int] = Query(None, ge=1, le=3, description="Filter by tier (1–3)"),
    skills: Optional[str] = Query(None, description="Comma-separated skill filter"),
    category: Optional[str] = Query(
        None,
        description="Category: smart-contract, frontend, backend, design, content, security, devops, documentation",
    ),
    creator_type: Optional[str] = Query(
        None,
        pattern=r"^(platform|community)$",
        description="Creator type: `platform` or `community`",
    ),
    reward_min: Optional[float] = Query(None, ge=0, description="Minimum reward amount (FNDRY)"),
    reward_max: Optional[float] = Query(None, ge=0, description="Maximum reward amount (FNDRY)"),
    deadline_before: Optional[str] = Query(None, description="ISO 8601 datetime — return bounties expiring before this date"),
    sort: str = Query(
        "newest",
        description="Sort order: newest, reward_high, reward_low, deadline, submissions, best_match",
    ),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    per_page: int = Query(20, ge=1, le=100, description="Results per page (max 100)"),
    svc: BountySearchService = Depends(_get_search_service),
) -> BountySearchResponse:
    skill_list = (
        [s.strip().lower() for s in skills.split(",") if s.strip()]
        if skills
        else []
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
    summary="Autocomplete search suggestions",
    description="""
Returns search suggestions for the query prefix — useful for powering a search-as-you-type input.

Suggestions include:
- Bounty **titles** matching the prefix
- **Skills** matching the prefix

Minimum query length is 2 characters. Maximum is 100 characters.
""",
    responses={
        200: {
            "description": "Autocomplete suggestions",
            "content": {
                "application/json": {
                    "example": {
                        "suggestions": [
                            {"text": "Fix escrow unlock race condition", "type": "title", "bounty_id": "abc123"},
                            {"text": "rust", "type": "skill", "bounty_id": None},
                            {"text": "anchor", "type": "skill", "bounty_id": None},
                        ]
                    }
                }
            },
        }
    },
)
async def autocomplete(
    q: str = Query(..., min_length=2, max_length=100, description="Search prefix (min 2 chars)"),
    limit: int = Query(8, ge=1, le=20, description="Max suggestions to return"),
    svc: BountySearchService = Depends(_get_search_service),
) -> AutocompleteResponse:
    return await svc.autocomplete(q, limit)


@router.get(
    "/hot",
    response_model=list[BountySearchResult],
    summary="Hot bounties (trending)",
    description="""
Returns the bounties with the highest activity (views + submissions) in the last 24 hours.

Use this to surface trending work to contributors on your homepage or dashboard.
""",
    responses={
        200: {
            "description": "List of trending bounties",
            "content": {
                "application/json": {
                    "example": [
                        {
                            **_BOUNTY_EXAMPLE,
                            "description": "The escrow unlock instruction sometimes fails...",
                            "relevance_score": 0.0,
                            "skill_match_count": 0,
                        }
                    ]
                }
            },
        }
    },
)
async def hot_bounties(
    limit: int = Query(6, ge=1, le=20, description="Max bounties to return"),
    svc: BountySearchService = Depends(_get_search_service),
) -> list[BountySearchResult]:
    return await svc.hot_bounties(limit)


@router.get(
    "/recommended",
    response_model=list[BountySearchResult],
    summary="Recommended bounties by skill match",
    description="""
Returns bounties that best match the provided skill set, ranked by skill overlap.

Pass the authenticated user's skills as a comma-separated string to surface
the most relevant work.

The `exclude` parameter accepts a comma-separated list of bounty IDs to omit
(e.g., bounties the user has already seen or submitted to).
""",
    responses={
        200: {
            "description": "Skill-matched bounty recommendations",
            "content": {
                "application/json": {
                    "example": [
                        {
                            **_BOUNTY_EXAMPLE,
                            "description": "The escrow unlock instruction sometimes fails...",
                            "relevance_score": 0.85,
                            "skill_match_count": 3,
                        }
                    ]
                }
            },
        }
    },
)
async def recommended_bounties(
    skills: str = Query(
        ...,
        description="Comma-separated user skills for matching. Example: `rust,anchor,typescript`",
    ),
    exclude: Optional[str] = Query(
        None,
        description="Comma-separated bounty IDs to exclude from results",
    ),
    limit: int = Query(6, ge=1, le=20, description="Max recommendations to return"),
    svc: BountySearchService = Depends(_get_search_service),
) -> list[BountySearchResult]:
    skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()]
    excluded = (
        [e.strip() for e in exclude.split(",") if e.strip()] if exclude else []
    )
    return await svc.recommended(skill_list, excluded, limit)


# ---------------------------------------------------------------------------
# CRUD endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/{bounty_id}",
    response_model=BountyResponse,
    summary="Get a bounty",
    description="Returns the full bounty record including all submissions.",
    responses={
        200: {
            "description": "Bounty details",
            "content": {"application/json": {"example": _BOUNTY_EXAMPLE}},
        },
        404: _404_bounty,
    },
)
async def get_bounty(bounty_id: str) -> BountyResponse:
    result = bounty_service.get_bounty(bounty_id)
    if not result:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result


@router.patch(
    "/{bounty_id}",
    response_model=BountyResponse,
    summary="Partially update a bounty",
    description="""
Apply a partial update to a bounty. Only provided fields are updated.

**Status transitions** (only valid transitions are accepted):
```
open → in_progress
in_progress → completed | open
completed → paid | in_progress
paid → (terminal — no further transitions)
```
""",
    responses={
        200: {
            "description": "Updated bounty",
            "content": {"application/json": {"example": _BOUNTY_EXAMPLE}},
        },
        400: _400,
        404: _404_bounty,
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "status": "in_progress",
                        "reward_amount": 1000.0,
                    }
                }
            }
        }
    },
)
async def update_bounty(bounty_id: str, data: BountyUpdate) -> BountyResponse:
    result, error = bounty_service.update_bounty(bounty_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.delete(
    "/{bounty_id}",
    status_code=204,
    summary="Delete a bounty",
    description="Permanently delete a bounty. Returns 204 No Content on success.",
    responses={
        204: {"description": "Bounty deleted"},
        404: _404_bounty,
    },
)
async def delete_bounty(bounty_id: str) -> None:
    if not bounty_service.delete_bounty(bounty_id):
        raise HTTPException(status_code=404, detail="Bounty not found")


@router.post(
    "/{bounty_id}/submit",
    response_model=SubmissionResponse,
    status_code=201,
    summary="Submit a PR solution",
    description="""
Submit a GitHub pull request URL as a solution to a bounty.

The `pr_url` must be a valid GitHub URL (https://github.com/...).
The bounty must be in `open` or `in_progress` status to accept submissions.

Multiple contributors can submit solutions; the bounty creator reviews and
selects a winner.
""",
    responses={
        201: {
            "description": "Submission recorded",
            "content": {
                "application/json": {
                    "example": {
                        "id": "def456",
                        "bounty_id": "abc123",
                        "pr_url": "https://github.com/org/repo/pull/42",
                        "submitted_by": "alice",
                        "notes": "Fixed the race condition with an atomic CAS instruction",
                        "submitted_at": "2024-01-20T14:00:00Z",
                    }
                }
            },
        },
        400: {
            "description": "Invalid PR URL or bounty not accepting submissions",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_url": {"value": {"detail": "pr_url must be a valid GitHub URL"}},
                        "closed": {"value": {"detail": "Bounty is not open for submissions"}},
                    }
                }
            },
        },
        404: _404_bounty,
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "pr_url": "https://github.com/org/repo/pull/42",
                        "submitted_by": "alice",
                        "notes": "Fixed the race condition with an atomic CAS instruction",
                    }
                }
            }
        }
    },
)
async def submit_solution(bounty_id: str, data: SubmissionCreate) -> SubmissionResponse:
    result, error = bounty_service.submit_solution(bounty_id, data)
    if error:
        status_code = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status_code, detail=error)
    return result


@router.get(
    "/{bounty_id}/submissions",
    response_model=list[SubmissionResponse],
    summary="List bounty submissions",
    description="Returns all PR submissions for the specified bounty.",
    responses={
        200: {
            "description": "List of submissions",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "id": "def456",
                            "bounty_id": "abc123",
                            "pr_url": "https://github.com/org/repo/pull/42",
                            "submitted_by": "alice",
                            "notes": "Fixed the race condition",
                            "submitted_at": "2024-01-20T14:00:00Z",
                        }
                    ]
                }
            },
        },
        404: _404_bounty,
    },
)
async def get_submissions(bounty_id: str) -> list[SubmissionResponse]:
    result = bounty_service.get_submissions(bounty_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result
