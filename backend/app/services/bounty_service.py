"""In-memory bounty service for MVP (Issue #3) and Claiming System (Issue #16).

Provides CRUD operations, solution submission, and claim lifecycle management.
"""

from datetime import datetime, timezone, timedelta
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
    # Claim models
    BountyClaimRequest,
    BountyUnclaimRequest,
    BountyClaimantResponse,
    BountyClaimHistoryResponse,
    ClaimHistoryRecord,
    ClaimStatus,
    T2_CLAIM_DEADLINE_DAYS,
    T3_CLAIM_DEADLINE_DAYS,
    T2_MIN_REPUTATION,
    T3_MIN_REPUTATION,
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
        reward_amount=b.reward_amount,
        status=b.status,
        github_issue_url=b.github_issue_url,
        required_skills=b.required_skills,
        deadline=b.deadline,
        created_by=b.created_by,
        claimant_id=b.claimant_id,
        claimed_at=b.claimed_at,
        claim_deadline=b.claim_deadline,
        submissions=subs,
        submission_count=len(subs),
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


def _to_list_item(b: BountyDB) -> BountyListItem:
    return BountyListItem(
        id=b.id,
        title=b.title,
        tier=b.tier,
        reward_amount=b.reward_amount,
        status=b.status,
        required_skills=b.required_skills,
        deadline=b.deadline,
        created_by=b.created_by,
        claimant_id=b.claimant_id,
        submission_count=len(b.submissions),
        created_at=b.created_at,
    )


# ---------------------------------------------------------------------------
# Public API - CRUD Operations
# ---------------------------------------------------------------------------

def create_bounty(data: BountyCreate) -> BountyResponse:
    """Create a new bounty and return its response representation."""
    bounty = BountyDB(
        title=data.title,
        description=data.description,
        tier=data.tier,
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
        results = [b for b in results if b.tier == tier]
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


# ---------------------------------------------------------------------------
# Public API - Submissions
# ---------------------------------------------------------------------------

def submit_solution(
    bounty_id: str, data: SubmissionCreate
) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    """Submit a PR solution for a bounty."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    if bounty.status not in (BountyStatus.OPEN, BountyStatus.IN_PROGRESS, BountyStatus.CLAIMED):
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
# Public API - Claim Lifecycle (Issue #16)
# ---------------------------------------------------------------------------

def claim_bounty(
    bounty_id: str,
    claimant_id: str,
    reputation: int,
    application: Optional[str] = None,
) -> tuple[Optional[BountyResponse], Optional[str]]:
    """Claim a bounty for a contributor.
    
    Args:
        bounty_id: ID of the bounty to claim
        claimant_id: Authenticated user ID (from auth context, not client input)
        reputation: User's reputation score (from server, not client input)
        application: Optional application plan (required for T3 bounties)
    """
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"
    
    if bounty.status != BountyStatus.OPEN:
        return None, f"Bounty is not available for claiming (status: {bounty.status.value})"
    
    if bounty.tier == BountyTier.T1:
        return None, "Tier 1 bounties do not support claiming. Submit directly."
    
    min_reputation = T2_MIN_REPUTATION if bounty.tier == BountyTier.T2 else T3_MIN_REPUTATION
    if reputation < min_reputation:
        return None, f"Insufficient reputation. Tier {bounty.tier} requires reputation >= {min_reputation}"
    
    if bounty.tier == BountyTier.T3 and not application:
        return None, "Tier 3 bounties require an application plan"
    
    if bounty.tier == BountyTier.T2:
        for b in _bounty_store.values():
            if b.claimant_id == claimant_id and b.status == BountyStatus.CLAIMED:
                return None, "You already have an active claim. Release it before claiming another."
    
    deadline_days = T2_CLAIM_DEADLINE_DAYS if bounty.tier == BountyTier.T2 else T3_CLAIM_DEADLINE_DAYS
    claim_deadline = datetime.now(timezone.utc) + timedelta(days=deadline_days)
    now = datetime.now(timezone.utc)
    
    history_record = ClaimHistoryRecord(
        claimant_id=claimant_id,
        claimed_at=now,
        deadline=claim_deadline,
        status=ClaimStatus.ACTIVE,
    )
    
    bounty.status = BountyStatus.CLAIMED
    bounty.claimant_id = claimant_id
    bounty.claimed_at = now
    bounty.claim_deadline = claim_deadline
    bounty.claim_history.append(history_record)
    bounty.updated_at = now
    
    return _to_bounty_response(bounty), None


def unclaim_bounty(
    bounty_id: str, claimant_id: str, data: Optional[BountyUnclaimRequest] = None
) -> tuple[Optional[BountyResponse], Optional[str]]:
    """Release a claim on a bounty."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"
    
    if bounty.status != BountyStatus.CLAIMED:
        return None, f"Bounty is not claimed (status: {bounty.status.value})"
    
    if bounty.claimant_id != claimant_id:
        return None, "Only the current claimant can release the claim"
    
    now = datetime.now(timezone.utc)
    
    for record in bounty.claim_history:
        if record.claimant_id == claimant_id and record.status == ClaimStatus.ACTIVE:
            record.status = ClaimStatus.RELEASED
            record.released_at = now
            record.release_reason = data.reason if data else None
            break
    
    bounty.status = BountyStatus.OPEN
    bounty.claimant_id = None
    bounty.claimed_at = None
    bounty.claim_deadline = None
    bounty.updated_at = now
    
    return _to_bounty_response(bounty), None


def get_claimant(bounty_id: str) -> tuple[Optional[BountyClaimantResponse], Optional[str]]:
    """Get the current claimant for a bounty."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"
    
    if bounty.status != BountyStatus.CLAIMED or not bounty.claimant_id:
        return None, "Bounty is not currently claimed"
    
    return BountyClaimantResponse(
        bounty_id=bounty.id,
        claimant_id=bounty.claimant_id,
        claimed_at=bounty.claimed_at,
        deadline=bounty.claim_deadline,
        status=bounty.status,
    ), None


def get_claim_history(
    bounty_id: str, skip: int = 0, limit: int = 20
) -> tuple[Optional[BountyClaimHistoryResponse], Optional[str]]:
    """Get the claim history for a bounty."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"
    
    total = len(bounty.claim_history)
    all_records = list(reversed(bounty.claim_history))
    page = all_records[skip:skip + limit]
    
    return BountyClaimHistoryResponse(
        bounty_id=bounty_id,
        items=page,
        total=total,
    ), None


def release_expired_claims() -> int:
    """Background task to release expired claims."""
    now = datetime.now(timezone.utc)
    released_count = 0
    
    for bounty in _bounty_store.values():
        if bounty.status == BountyStatus.CLAIMED and bounty.claim_deadline:
            if bounty.claim_deadline < now:
                for record in bounty.claim_history:
                    if record.claimant_id == bounty.claimant_id and record.status == ClaimStatus.ACTIVE:
                        record.status = ClaimStatus.EXPIRED
                        record.released_at = now
                        record.release_reason = "Claim deadline expired"
                        break
                
                bounty.status = BountyStatus.OPEN
                bounty.claimant_id = None
                bounty.claimed_at = None
                bounty.claim_deadline = None
                bounty.updated_at = now
                released_count += 1
    
    return released_count