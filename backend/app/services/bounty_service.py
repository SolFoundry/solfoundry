"""In-memory bounty service for MVP."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.models.bounty import (
    BountyCreate, BountyDB, BountyListItem, BountyListResponse,
    BountyResponse, BountyStatus, BountyTier, BountyUpdate,
    ClaimRecord, ClaimResponse, ClaimStatus,
    SubmissionCreate, SubmissionRecord, SubmissionResponse,
    TIER_DEADLINE_DAYS, TIER_REP_REQUIREMENTS, VALID_STATUS_TRANSITIONS,
)

_bounty_store: dict[str, BountyDB] = {}


def _effective_min_rep(b: BountyDB) -> int:
    if b.min_reputation is not None:
        return b.min_reputation
    return TIER_REP_REQUIREMENTS.get(b.tier, 0)


def _sub_resp(s: SubmissionRecord) -> SubmissionResponse:
    return SubmissionResponse(id=s.id, bounty_id=s.bounty_id, pr_url=s.pr_url,
                              submitted_by=s.submitted_by, notes=s.notes, submitted_at=s.submitted_at)


def _claim_resp(c: ClaimRecord) -> ClaimResponse:
    return ClaimResponse(id=c.id, bounty_id=c.bounty_id, contributor_id=c.contributor_id,
                         status=c.status, application_text=c.application_text,
                         claimed_at=c.claimed_at, deadline=c.deadline,
                         released_at=c.released_at, completed_at=c.completed_at)


def _bounty_resp(b: BountyDB) -> BountyResponse:
    ac = None
    if b.active_claim_id:
        for c in b.claim_history:
            if c.id == b.active_claim_id:
                ac = _claim_resp(c)
                break
    return BountyResponse(
        id=b.id, title=b.title, description=b.description, tier=b.tier,
        reward_amount=b.reward_amount, status=b.status,
        github_issue_url=b.github_issue_url, required_skills=b.required_skills,
        deadline=b.deadline, min_reputation=_effective_min_rep(b),
        created_by=b.created_by, active_claim=ac,
        claim_count=len(b.claim_history),
        submissions=[_sub_resp(s) for s in b.submissions],
        submission_count=len(b.submissions),
        created_at=b.created_at, updated_at=b.updated_at,
    )


def _bounty_list_item(b: BountyDB) -> BountyListItem:
    return BountyListItem(
        id=b.id, title=b.title, tier=b.tier, reward_amount=b.reward_amount,
        status=b.status, required_skills=b.required_skills, deadline=b.deadline,
        created_by=b.created_by, submission_count=len(b.submissions),
        claim_count=len(b.claim_history), created_at=b.created_at,
    )


def create_bounty(data: BountyCreate) -> BountyResponse:
    b = BountyDB(title=data.title, description=data.description, tier=data.tier,
                 reward_amount=data.reward_amount, github_issue_url=data.github_issue_url,
                 required_skills=data.required_skills, deadline=data.deadline,
                 min_reputation=data.min_reputation, created_by=data.created_by)
    _bounty_store[b.id] = b
    return _bounty_resp(b)


def get_bounty(bid: str) -> Optional[BountyResponse]:
    b = _bounty_store.get(bid)
    return _bounty_resp(b) if b else None


def get_bounty_db(bid: str) -> Optional[BountyDB]:
    return _bounty_store.get(bid)


def list_bounties(status=None, tier=None, skills=None, skip=0, limit=20) -> BountyListResponse:
    results = list(_bounty_store.values())
    if status:
        results = [b for b in results if b.status == status]
    if tier:
        results = [b for b in results if b.tier == tier]
    if skills:
        ss = {s.lower() for s in skills}
        results = [b for b in results if ss & {s.lower() for s in b.required_skills}]
    total = len(results)
    return BountyListResponse(items=[_bounty_list_item(b) for b in results[skip:skip+limit]],
                              total=total, skip=skip, limit=limit)


def update_bounty(bid: str, data: BountyUpdate) -> tuple[Optional[BountyResponse], Optional[str]]:
    b = _bounty_store.get(bid)
    if not b:
        return None, "Bounty not found"
    updates = data.model_dump(exclude_unset=True)
    if "status" in updates and updates["status"] is not None:
        new_s = BountyStatus(updates["status"])
        allowed = VALID_STATUS_TRANSITIONS.get(b.status, set())
        if new_s not in allowed:
            return None, (f"Invalid status transition: {b.status.value} -> {new_s.value}. "
                          f"Allowed transitions: {[s.value for s in allowed]}")
    for k, v in updates.items():
        setattr(b, k, v)
    b.updated_at = datetime.now(timezone.utc)
    return _bounty_resp(b), None


def delete_bounty(bid: str) -> bool:
    return _bounty_store.pop(bid, None) is not None


def submit_solution(bid: str, data: SubmissionCreate) -> tuple[Optional[SubmissionResponse], Optional[str]]:
    b = _bounty_store.get(bid)
    if not b:
        return None, "Bounty not found"
    if b.status not in (BountyStatus.OPEN, BountyStatus.IN_PROGRESS):
        return None, f"Bounty is not accepting submissions (status: {b.status.value})"
    for ex in b.submissions:
        if ex.pr_url == data.pr_url:
            return None, "This PR URL has already been submitted for this bounty"
    sub = SubmissionRecord(bounty_id=bid, pr_url=data.pr_url,
                           submitted_by=data.submitted_by, notes=data.notes)
    b.submissions.append(sub)
    b.updated_at = datetime.now(timezone.utc)
    return _sub_resp(sub), None


def get_submissions(bid: str) -> Optional[list[SubmissionResponse]]:
    b = _bounty_store.get(bid)
    if not b:
        return None
    return [_sub_resp(s) for s in b.submissions]


def claim_bounty(bid, contributor_id, contributor_reputation, application_text=None):
    b = _bounty_store.get(bid)
    if not b:
        return None, "Bounty not found"
    if b.status != BountyStatus.OPEN:
        return None, f"Bounty is not available for claiming (status: {b.status.value})"
    if b.tier == BountyTier.T1:
        return None, "Tier 1 bounties do not require claiming"
    min_rep = _effective_min_rep(b)
    if contributor_reputation < min_rep:
        return None, f"Insufficient reputation ({contributor_reputation} < {min_rep} required)"
    for bb in _bounty_store.values():
        for c in bb.claim_history:
            if c.contributor_id == contributor_id and c.status in (ClaimStatus.ACTIVE, ClaimStatus.PENDING):
                return None, f"You already have an active claim on bounty {bb.id}"
    if b.tier == BountyTier.T3 and not application_text:
        return None, "Tier 3 bounties require an application with a plan"
    dd = TIER_DEADLINE_DAYS.get(b.tier, 7)
    now = datetime.now(timezone.utc)
    deadline = now + timedelta(days=dd) if dd > 0 else None
    init = ClaimStatus.PENDING if b.tier == BountyTier.T3 else ClaimStatus.ACTIVE
    claim = ClaimRecord(bounty_id=bid, contributor_id=contributor_id, status=init,
                        application_text=application_text, claimed_at=now, deadline=deadline)
    b.claim_history.append(claim)
    if init == ClaimStatus.ACTIVE:
        b.active_claim_id = claim.id
        b.status = BountyStatus.IN_PROGRESS
    b.updated_at = now
    return _claim_resp(claim), None


def unclaim_bounty(bid, contributor_id):
    b = _bounty_store.get(bid)
    if not b:
        return None, "Bounty not found"
    claim = None
    for c in b.claim_history:
        if c.contributor_id == contributor_id and c.status in (ClaimStatus.ACTIVE, ClaimStatus.PENDING):
            claim = c
            break
    if not claim:
        return None, "No active claim found for this contributor on this bounty"
    now = datetime.now(timezone.utc)
    claim.status = ClaimStatus.RELEASED
    claim.released_at = now
    if b.active_claim_id == claim.id:
        b.active_claim_id = None
        b.status = BountyStatus.OPEN
    b.updated_at = now
    return _claim_resp(claim), None


def approve_claim(bid, claim_id):
    b = _bounty_store.get(bid)
    if not b:
        return None, "Bounty not found"
    claim = None
    for c in b.claim_history:
        if c.id == claim_id:
            claim = c
            break
    if not claim:
        return None, "Claim not found"
    if claim.status != ClaimStatus.PENDING:
        return None, f"Claim is not pending (status: {claim.status})"
    now = datetime.now(timezone.utc)
    claim.status = ClaimStatus.ACTIVE
    claim.deadline = now + timedelta(days=TIER_DEADLINE_DAYS.get(b.tier, 14))
    b.active_claim_id = claim.id
    b.status = BountyStatus.IN_PROGRESS
    b.updated_at = now
    return _claim_resp(claim), None


def reject_claim(bid, claim_id):
    b = _bounty_store.get(bid)
    if not b:
        return None, "Bounty not found"
    claim = None
    for c in b.claim_history:
        if c.id == claim_id:
            claim = c
            break
    if not claim:
        return None, "Claim not found"
    if claim.status != ClaimStatus.PENDING:
        return None, f"Claim is not pending (status: {claim.status})"
    claim.status = ClaimStatus.REJECTED
    b.updated_at = datetime.now(timezone.utc)
    return _claim_resp(claim), None


def get_claim_history(bid):
    b = _bounty_store.get(bid)
    if not b:
        return None
    return [_claim_resp(c) for c in b.claim_history]


def get_contributor_claims(cid):
    claims = []
    for b in _bounty_store.values():
        for c in b.claim_history:
            if c.contributor_id == cid:
                claims.append(_claim_resp(c))
    return claims


def check_expired_claims():
    now = datetime.now(timezone.utc)
    expired = []
    for b in _bounty_store.values():
        for c in b.claim_history:
            if c.status == ClaimStatus.ACTIVE and c.deadline and c.deadline <= now:
                c.status = ClaimStatus.EXPIRED
                c.released_at = now
                if b.active_claim_id == c.id:
                    b.active_claim_id = None
                    b.status = BountyStatus.OPEN
                b.updated_at = now
                expired.append(_claim_resp(c))
    return expired
