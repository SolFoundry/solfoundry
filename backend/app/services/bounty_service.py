"""In-memory bounty service for MVP (Issue #3).

Provides CRUD operations and solution submission.
Claim lifecycle operations (Issue #16).
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
    BountyUpdate,
    SubmissionCreate,
    SubmissionRecord,
    SubmissionResponse,
    BountyClaimRequest,
    BountyUnclaimRequest,
    BountyClaimantResponse,
    BountyClaimHistoryItem,
    BountyClaimHistoryResponse,
    ClaimHistoryRecord,
    VALID_STATUS_TRANSITIONS,
)

_bounty_store: dict[str, BountyDB] = {}


def _to_submission_response(s: SubmissionRecord) -> SubmissionResponse:
    return SubmissionResponse(
        id=s.id, bounty_id=s.bounty_id, pr_url=s.pr_url,
        submitted_by=s.submitted_by, notes=s.notes, submitted_at=s.submitted_at,
    )


def _to_bounty_response(b: BountyDB) -> BountyResponse:
    subs = [_to_submission_response(s) for s in b.submissions]
    claimed_at = None
    if b.claimant_id:
        for record in reversed(b.claim_history):
            if record.claimant_id == b.claimant_id and record.action == "claimed":
                claimed_at = record.created_at
                break
    return BountyResponse(
        id=b.id, title=b.title, description=b.description, tier=b.tier,
        reward_amount=b.reward_amount, status=b.status,
        github_issue_url=b.github_issue_url, required_skills=b.required_skills,
        deadline=b.deadline, created_by=b.created_by,
        claimant_id=b.claimant_id, claimed_at=claimed_at,
        submissions=subs, submission_count=len(subs),
        created_at=b.created_at, updated_at=b.updated_at,
    )


def _to_list_item(b: BountyDB) -> BountyListItem:
    return BountyListItem(
        id=b.id, title=b.title, tier=b.tier, reward_amount=b.reward_amount,
        status=b.status, required_skills=b.required_skills, deadline=b.deadline,
        created_by=b.created_by, submission_count=len(b.submissions), created_at=b.created_at,
    )


def create_bounty(data: BountyCreate) -> BountyResponse:
    bounty = BountyDB(
        title=data.title, description=data.description, tier=data.tier,
        reward_amount=data.reward_amount, github_issue_url=data.github_issue_url,
        required_skills=data.required_skills, deadline=data.deadline, created_by=data.created_by,
    )
    _bounty_store[bounty.id] = bounty
    return _to_bounty_response(bounty)


def get_bounty(bounty_id: str) -> Optional[BountyResponse]:
    bounty = _bounty_store.get(bounty_id)
    return _to_bounty_response(bounty) if bounty else None


def list_bounties(*, status: Optional[BountyStatus] = None, tier: Optional[int] = None,
                  skills: Optional[list[str]] = None, skip: int = 0, limit: int = 20) -> BountyListResponse:
    results = list(_bounty_store.values())
    if status is not None:
        results = [b for b in results if b.status == status]
    if tier is not None:
        results = [b for b in results if b.tier == tier]
    if skills:
        skill_set = {s.lower() for s in skills}
        results = [b for b in results if skill_set & {s.lower() for s in b.required_skills}]
    total = len(results)
    page = results[skip : skip + limit]
    return BountyListResponse(items=[_to_list_item(b) for b in page], total=total, skip=skip, limit=limit)


def update_bounty(bounty_id: str, data: BountyUpdate) -> tuple[Optional[BountyResponse], Optional[str]]:
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"
    updates = data.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] is not None:
        new_status = BountyStatus(updates["status"])
        allowed = VALID_STATUS_TRANSITIONS.get(bounty.status, set())
        if new_status not in allowed:
            return None, f"Invalid status transition: {bounty.status.value} -> {new_status.value}."
    for key, value in updates.items():
        setattr(bounty, key, value)
    bounty.updated_at = datetime.now(timezone.utc)
    return _to_bounty_response(bounty), None


def delete_bounty(bounty_id: str) -> bool:
    return _bounty_store.pop(bounty_id, None) is not None


def submit_solution(bounty_id: str, data: SubmissionCreate) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"
    if bounty.status not in (BountyStatus.OPEN, BountyStatus.IN_PROGRESS):
        return None, f"Bounty is not accepting submissions (status: {bounty.status.value})"
    for existing in bounty.submissions:
        if existing.pr_url == data.pr_url:
            return None, "This PR URL has already been submitted for this bounty"
    submission = SubmissionRecord(bounty_id=bounty_id, pr_url=data.pr_url,
                                   submitted_by=data.submitted_by, notes=data.notes)
    bounty.submissions.append(submission)
    bounty.updated_at = datetime.now(timezone.utc)
    return _to_submission_response(submission), None


def get_submissions(bounty_id: str) -> Optional[list[SubmissionResponse]]:
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None
    return [_to_submission_response(s) for s in bounty.submissions]


def claim_bounty(bounty_id: str, data: BountyClaimRequest) -> tuple[Optional[BountyResponse], Optional[str]]:
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"
    if bounty.status != BountyStatus.OPEN:
        return None, f"Cannot claim bounty with status '{bounty.status.value}'."
    if bounty.claimant_id is not None:
        return None, f"Bounty is already claimed by {bounty.claimant_id}"
    bounty.claimant_id = data.claimant_id
    bounty.status = BountyStatus.CLAIMED
    bounty.updated_at = datetime.now(timezone.utc)
    bounty.claim_history.append(ClaimHistoryRecord(
        bounty_id=bounty_id, claimant_id=data.claimant_id, action="claimed"))
    return _to_bounty_response(bounty), None


def unclaim_bounty(bounty_id: str, claimant_id: str, data: Optional[BountyUnclaimRequest] = None) -> tuple[Optional[BountyResponse], Optional[str]]:
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"
    if bounty.status not in (BountyStatus.CLAIMED, BountyStatus.IN_PROGRESS):
        return None, f"Cannot unclaim bounty with status '{bounty.status.value}'."
    if bounty.claimant_id != claimant_id:
        return None, f"Only the current claimant can unclaim this bounty."
    bounty.claimant_id = None
    bounty.status = BountyStatus.OPEN
    bounty.updated_at = datetime.now(timezone.utc)
    bounty.claim_history.append(ClaimHistoryRecord(
        bounty_id=bounty_id, claimant_id=claimant_id, action="unclaimed",
        reason=data.reason if data else None))
    return _to_bounty_response(bounty), None


def get_claimant(bounty_id: str) -> tuple[Optional[BountyClaimantResponse], Optional[str]]:
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"
    if not bounty.claimant_id:
        return None, "Bounty is not currently claimed"
    claimed_at = None
    for record in reversed(bounty.claim_history):
        if record.claimant_id == bounty.claimant_id and record.action == "claimed":
            claimed_at = record.created_at
            break
    return BountyClaimantResponse(bounty_id=bounty_id, claimant_id=bounty.claimant_id,
                                   claimed_at=claimed_at or bounty.updated_at, status=bounty.status.value), None


def get_claim_history(bounty_id: str, skip: int = 0, limit: int = 20) -> tuple[Optional[BountyClaimHistoryResponse], Optional[str]]:
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"
    all_history = list(reversed(bounty.claim_history))
    total = len(all_history)
    page = all_history[skip:skip + limit]
    items = [BountyClaimHistoryItem(id=r.id, bounty_id=r.bounty_id, claimant_id=r.claimant_id,
                                     action=r.action, reason=r.reason, created_at=r.created_at) for r in page]
    return BountyClaimHistoryResponse(items=items, total=total, skip=skip, limit=limit), None