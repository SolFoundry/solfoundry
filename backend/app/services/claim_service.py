"""Bounty claim service (Issue #16).

Handles the claim lifecycle: claim an open bounty, release a claim,
approve a claim (bounty -> completed), and list claims for a bounty.
Operates alongside the existing bounty CRUD service without modifying it.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from app.models.bounty import BountyStatus, VALID_STATUS_TRANSITIONS
from app.services import bounty_service


# ---------------------------------------------------------------------------
# Enums & models
# ---------------------------------------------------------------------------

class ClaimStatus(str, Enum):
    """Lifecycle status of a claim."""
    ACTIVE = "active"
    RELEASED = "released"
    APPROVED = "approved"
    REJECTED = "rejected"


class ClaimRecord(BaseModel):
    """Internal storage representation of a claim."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str
    claimant: str
    status: ClaimStatus = ClaimStatus.ACTIVE
    claimed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None


class ClaimCreate(BaseModel):
    """Payload for claiming a bounty."""
    claimant: str = Field(..., min_length=1, max_length=100)


class ClaimResponse(BaseModel):
    """API response for a single claim."""
    id: str
    bounty_id: str
    claimant: str
    status: ClaimStatus
    claimed_at: datetime
    resolved_at: Optional[datetime] = None


class ClaimListResponse(BaseModel):
    """API response for listing claims on a bounty."""
    items: list[ClaimResponse]
    total: int


# ---------------------------------------------------------------------------
# In-memory store (mirrors bounty_service pattern)
# ---------------------------------------------------------------------------

_claim_store: dict[str, ClaimRecord] = {}  # claim_id -> ClaimRecord


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_response(c: ClaimRecord) -> ClaimResponse:
    return ClaimResponse(
        id=c.id,
        bounty_id=c.bounty_id,
        claimant=c.claimant,
        status=c.status,
        claimed_at=c.claimed_at,
        resolved_at=c.resolved_at,
    )


def _active_claim_for_bounty(bounty_id: str) -> Optional[ClaimRecord]:
    """Return the active claim for a bounty, if any."""
    for c in _claim_store.values():
        if c.bounty_id == bounty_id and c.status == ClaimStatus.ACTIVE:
            return c
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def claim_bounty(
    bounty_id: str, data: ClaimCreate
) -> tuple[Optional[ClaimResponse], Optional[str]]:
    """Claim an open bounty. Transitions bounty to IN_PROGRESS."""
    bounty = bounty_service._bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    if bounty.status != BountyStatus.OPEN:
        return None, f"Bounty is not open for claiming (status: {bounty.status.value})"

    existing = _active_claim_for_bounty(bounty_id)
    if existing:
        return None, f"Bounty already claimed by {existing.claimant}"

    # Transition bounty to IN_PROGRESS via the valid transition
    from app.models.bounty import BountyUpdate
    result, err = bounty_service.update_bounty(
        bounty_id, BountyUpdate(status=BountyStatus.IN_PROGRESS)
    )
    if err:
        return None, f"Failed to update bounty status: {err}"

    claim = ClaimRecord(bounty_id=bounty_id, claimant=data.claimant)
    _claim_store[claim.id] = claim
    return _to_response(claim), None


def release_claim(
    claim_id: str,
) -> tuple[Optional[ClaimResponse], Optional[str]]:
    """Release an active claim. Transitions bounty back to OPEN."""
    claim = _claim_store.get(claim_id)
    if not claim:
        return None, "Claim not found"

    if claim.status != ClaimStatus.ACTIVE:
        return None, f"Claim is not active (status: {claim.status.value})"

    # Transition bounty back to OPEN
    from app.models.bounty import BountyUpdate
    result, err = bounty_service.update_bounty(
        claim.bounty_id, BountyUpdate(status=BountyStatus.OPEN)
    )
    if err:
        return None, f"Failed to update bounty status: {err}"

    claim.status = ClaimStatus.RELEASED
    claim.resolved_at = datetime.now(timezone.utc)
    return _to_response(claim), None


def approve_claim(
    claim_id: str,
) -> tuple[Optional[ClaimResponse], Optional[str]]:
    """Approve an active claim. Transitions bounty to COMPLETED."""
    claim = _claim_store.get(claim_id)
    if not claim:
        return None, "Claim not found"

    if claim.status != ClaimStatus.ACTIVE:
        return None, f"Claim is not active (status: {claim.status.value})"

    # Transition bounty to COMPLETED
    from app.models.bounty import BountyUpdate
    result, err = bounty_service.update_bounty(
        claim.bounty_id, BountyUpdate(status=BountyStatus.COMPLETED)
    )
    if err:
        return None, f"Failed to update bounty status: {err}"

    claim.status = ClaimStatus.APPROVED
    claim.resolved_at = datetime.now(timezone.utc)
    return _to_response(claim), None


def reject_claim(
    claim_id: str,
) -> tuple[Optional[ClaimResponse], Optional[str]]:
    """Reject an active claim. Transitions bounty back to OPEN."""
    claim = _claim_store.get(claim_id)
    if not claim:
        return None, "Claim not found"

    if claim.status != ClaimStatus.ACTIVE:
        return None, f"Claim is not active (status: {claim.status.value})"

    from app.models.bounty import BountyUpdate
    result, err = bounty_service.update_bounty(
        claim.bounty_id, BountyUpdate(status=BountyStatus.OPEN)
    )
    if err:
        return None, f"Failed to update bounty status: {err}"

    claim.status = ClaimStatus.REJECTED
    claim.resolved_at = datetime.now(timezone.utc)
    return _to_response(claim), None


def list_claims(bounty_id: str) -> tuple[Optional[ClaimListResponse], Optional[str]]:
    """List all claims for a bounty."""
    bounty = bounty_service._bounty_store.get(bounty_id)
    if not bounty:
        return None, "Bounty not found"

    claims = [c for c in _claim_store.values() if c.bounty_id == bounty_id]
    claims.sort(key=lambda c: c.claimed_at, reverse=True)
    return ClaimListResponse(
        items=[_to_response(c) for c in claims],
        total=len(claims),
    ), None
