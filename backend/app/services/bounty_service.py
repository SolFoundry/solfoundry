"""In-memory bounty service for MVP (Issue #3).

Provides CRUD operations and solution submission.
Claim lifecycle is out of scope (see Issue #16).
"""

from datetime import datetime, timezone
from typing import Optional

from app.models.bounty import (
    BountyCreate,
    BountyDB,
    BountyListItem,
    BountyListResponse,
    BountyResponse,
    BountyStatus,
    BountyTier,
    BountyUpdate,
    SubmissionCreate,
    SubmissionRecord,
    SubmissionResponse,
    VALID_STATUS_TRANSITIONS,
    BountySearchParams,
    AutocompleteSuggestion,
    AutocompleteResponse,
    VALID_CATEGORIES,
    VALID_SORTS,
)

# ---------------------------------------------------------------------------
# In-memory store (replaced by a database in production)
# ---------------------------------------------------------------------------

_bounty_store: dict[str, BountyDB] = {}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _to_submission_response(s: SubmissionRecord) -> SubmissionResponse:
    return SubmissionResponse(
        id=s.id,
        bounty_id=s.bounty_id,
        pr_url=s.pr_url,
        submitted_by=s.submitted_by,
        notes=s.notes,
        submitted_at=s.submitted_at,
    )


def _to_bounty_response(b: BountyDB) -> BountyResponse:
    subs = [_to_submission_response(s) for s in b.submissions]
    return BountyResponse(
        id=b.id,
        title=b.title,
        description=b.description,
        tier=b.tier,
        category=b.category,
        reward_amount=b.reward_amount,
        status=b.status,
        github_issue_url=b.github_issue_url,
        required_skills=b.required_skills,
        deadline=b.deadline,
        created_by=b.created_by,
        submissions=subs,
        submission_count=len(subs),
        popularity=b.popularity,
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


def _to_list_item(b: BountyDB) -> BountyListItem:
    return BountyListItem(
        id=b.id,
        title=b.title,
        description=b.description,
        tier=b.tier,
        category=b.category,
        reward_amount=b.reward_amount,
        status=b.status,
        required_skills=b.required_skills,
        deadline=b.deadline,
        created_by=b.created_by,
        submission_count=len(b.submissions),
        popularity=b.popularity,
        created_at=b.created_at,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_bounty(data: BountyCreate) -> BountyResponse:
    """Create a new bounty and return its response representation."""
    bounty = BountyDB(
        title=data.title,
        description=data.description,
        tier=data.tier,
        category=data.category,
        reward_amount=data.reward_amount,
        github_issue_url=data.github_issue_url,
        required_skills=data.required_skills,
        deadline=data.deadline,
        created_by=data.created_by,
    )
    _bounty_store[bounty.id] = bounty
    return _to_bounty_response(bounty)


def get_bounty(bounty_id: str) -> Optional[BountyResponse]:
    """Retrieve a single bounty by ID, or None if not found."""
    bounty = _bounty_store.get(bounty_id)
    return _to_bounty_response(bounty) if bounty else None


def list_bounties(
    *,
    status: Optional[BountyStatus] = None,
    tier: Optional[int] = None,
    skills: Optional[list[str]] = None,
    skip: int = 0,
    limit: int = 20,
) -> BountyListResponse:
    """List bounties with optional filtering and pagination."""
    results = list(_bounty_store.values())

    if status is not None:
        results = [b for b in results if b.status == status]
    if tier is not None:
        results = [b for b in results if b.tier.value == tier]
    if skills:
        skill_set = {s.lower() for s in skills}
        results = [
            b for b in results
            if skill_set & {s.lower() for s in b.required_skills}
        ]

    total = len(results)
    page = results[skip : skip + limit]

    return BountyListResponse(
        items=[_to_list_item(b) for b in page],
        total=total,
        skip=skip,
        limit=limit,
    )


def update_bounty(
    bounty_id: str, data: BountyUpdate
) -> tuple[Optional[BountyResponse], Optional[str]]:
    """Update a bounty. Returns (response, None) on success or (None, error) on failure."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    updates = data.model_dump(exclude_unset=True)

    # Validate status transition before applying any changes
    if "status" in updates and updates["status"] is not None:
        new_status = BountyStatus(updates["status"])
        allowed = VALID_STATUS_TRANSITIONS.get(bounty.status, set())
        if new_status not in allowed:
            return None, (
                f"Invalid status transition: {bounty.status.value} -> {new_status.value}. "
                f"Allowed transitions: {[s.value for s in sorted(allowed, key=lambda x: x.value)]}"
            )

    # Apply updates
    for key, value in updates.items():
        setattr(bounty, key, value)

    bounty.updated_at = datetime.now(timezone.utc)
    return _to_bounty_response(bounty), None


def delete_bounty(bounty_id: str) -> bool:
    """Delete a bounty by ID. Returns True if deleted, False if not found."""
    return _bounty_store.pop(bounty_id, None) is not None


def submit_solution(
    bounty_id: str, data: SubmissionCreate
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Submit a PR solution for a bounty."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    if bounty.status not in (BountyStatus.OPEN, BountyStatus.IN_PROGRESS):
        return None, f"Bounty is not accepting submissions (status: {bounty.status.value})"

    # Reject duplicate PR URLs on the same bounty
    for existing in bounty.submissions:
        if existing.pr_url == data.pr_url:
            return None, "This PR URL has already been submitted for this bounty"

    submission = SubmissionRecord(
        bounty_id=bounty_id,
        pr_url=data.pr_url,
        submitted_by=data.submitted_by,
        notes=data.notes,
    )
    bounty.submissions.append(submission)
    bounty.updated_at = datetime.now(timezone.utc)
    return _to_submission_response(submission), None


def get_submissions(bounty_id: str) -> Optional[list[SubmissionResponse]]:
    """List all submissions for a bounty. Returns None if bounty not found."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None
    return [_to_submission_response(s) for s in bounty.submissions]


# ---------------------------------------------------------------------------
# Search and Filter Functions
# ---------------------------------------------------------------------------

def search_bounties(params: BountySearchParams) -> BountyListResponse:
    """
    Full-text search with filtering and sorting.
    
    Uses simple in-memory text matching for MVP.
    In production, this would use PostgreSQL full-text search with tsvector.
    
    Args:
        params: Search parameters including query, filters, sort, and pagination.
        
    Returns:
        BountyListResponse with matching bounties and total count.
        
    Raises:
        ValueError: If filter parameters are invalid.
    """
    # Validate parameters
    _validate_search_params(params)
    
    # Start with all bounties
    results = list(_bounty_store.values())
    
    # Apply full-text search if query provided
    if params.q:
        query_lower = params.q.lower()
        results = [
            b for b in results
            if query_lower in b.title.lower() or query_lower in b.description.lower()
        ]
    
    # Apply filters
    if params.status:
        results = [b for b in results if b.status.value == params.status]
    else:
        # Default to open bounties only
        results = [b for b in results if b.status == BountyStatus.OPEN]
    
    if params.tier:
        results = [b for b in results if b.tier.value == params.tier]
    
    if params.category:
        results = [b for b in results if b.category == params.category]
    
    if params.reward_min is not None:
        results = [b for b in results if b.reward_amount >= params.reward_min]
    
    if params.reward_max is not None:
        results = [b for b in results if b.reward_amount <= params.reward_max]
    
    if params.skills:
        skill_list = params.get_skills_list()
        if skill_list:
            skill_set = {s.lower() for s in skill_list}
            results = [
                b for b in results
                if skill_set & {s.lower() for s in b.required_skills}
            ]
    
    # Apply sorting
    results = _sort_bounties(results, params.sort)
    
    # Apply pagination
    total = len(results)
    page = results[params.skip : params.skip + params.limit]
    
    return BountyListResponse(
        items=[_to_list_item(b) for b in page],
        total=total,
        skip=params.skip,
        limit=params.limit,
    )


def get_autocomplete_suggestions(query: str, limit: int = 10) -> AutocompleteResponse:
    """
    Get autocomplete suggestions for search.
    
    Returns matching bounty titles and skills for partial queries.
    Minimum query length is 2 characters.
    
    Args:
        query: Partial search query (min 2 chars).
        limit: Maximum number of suggestions to return.
        
    Returns:
        AutocompleteResponse with matching suggestions.
    """
    suggestions = []
    
    # Require minimum query length
    if not query or len(query.strip()) < 2:
        return AutocompleteResponse(suggestions=suggestions)
    
    query = query.strip().lower()
    
    # Search in titles (case-insensitive)
    seen_titles = set()
    for bounty in _bounty_store.values():
        if bounty.status == BountyStatus.OPEN and query in bounty.title.lower():
            if bounty.title not in seen_titles:
                suggestions.append(AutocompleteSuggestion(
                    text=bounty.title,
                    type="title"
                ))
                seen_titles.add(bounty.title)
            if len(suggestions) >= limit:
                break
    
    # Search in skills if we have room
    remaining = limit - len(suggestions)
    if remaining > 0:
        seen_skills = set()
        for bounty in _bounty_store.values():
            if bounty.status == BountyStatus.OPEN:
                for skill in bounty.required_skills:
                    if skill.lower().startswith(query) and skill not in seen_skills:
                        suggestions.append(AutocompleteSuggestion(
                            text=skill,
                            type="skill"
                        ))
                        seen_skills.add(skill)
                        if len(suggestions) >= limit:
                            break
                if len(suggestions) >= limit:
                    break
    
    return AutocompleteResponse(suggestions=suggestions)


def _validate_search_params(params: BountySearchParams) -> None:
    """Validate search parameters."""
    if params.tier is not None and params.tier not in (1, 2, 3):
        raise ValueError(f"Invalid tier: {params.tier}. Must be 1, 2, or 3.")
    
    if params.category is not None and params.category not in VALID_CATEGORIES:
        raise ValueError(f"Invalid category: {params.category}. Must be one of {sorted(VALID_CATEGORIES)}.")
    
    if params.status is not None:
        valid_statuses = {s.value for s in BountyStatus}
        if params.status not in valid_statuses:
            raise ValueError(f"Invalid status: {params.status}. Must be one of {sorted(valid_statuses)}.")
    
    if params.reward_min is not None and params.reward_min < 0:
        raise ValueError("reward_min cannot be negative.")
    
    if params.reward_max is not None and params.reward_max < 0:
        raise ValueError("reward_max cannot be negative.")
    
    if (params.reward_min is not None and params.reward_max is not None 
            and params.reward_min > params.reward_max):
        raise ValueError(f"reward_min ({params.reward_min}) cannot be less than reward_max ({params.reward_max}).")
    
    if params.sort not in VALID_SORTS:
        raise ValueError(f"Invalid sort: {params.sort}. Must be one of {sorted(VALID_SORTS)}.")


def _sort_bounties(bounties: list[BountyDB], sort: str) -> list[BountyDB]:
    """Sort bounties by the specified field."""
    if sort == "newest":
        return sorted(bounties, key=lambda b: b.created_at, reverse=True)
    elif sort == "reward_high":
        return sorted(bounties, key=lambda b: b.reward_amount, reverse=True)
    elif sort == "reward_low":
        return sorted(bounties, key=lambda b: b.reward_amount)
    elif sort == "deadline":
        # Sort by deadline, with None values at the end
        return sorted(bounties, key=lambda b: b.deadline or datetime.max.replace(tzinfo=timezone.utc))
    elif sort == "popularity":
        return sorted(bounties, key=lambda b: b.popularity, reverse=True)
    return bounties