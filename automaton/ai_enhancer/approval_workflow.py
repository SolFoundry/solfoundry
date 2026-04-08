"""Maintainer approval workflow for enhanced bounty descriptions."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    PUBLISHED = "published"
    REVERTED = "reverted"


@dataclass
class ApprovalRequest:
    """Tracks an enhancement through the approval pipeline."""

    bounty_id: str
    enhancer_result: dict[str, Any]
    status: ApprovalStatus = ApprovalStatus.PENDING
    reviewer: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    comment_id: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class ApprovalWorkflow:
    """Manages the approve/reject lifecycle of enhanced bounties."""

    def __init__(self) -> None:
        # In production this would be a database; dict for now.
        self._store: dict[str, ApprovalRequest] = {}

    def submit(self, bounty_id: str, enhanced: dict[str, Any]) -> ApprovalRequest:
        """Store an enhanced bounty as pending maintainer approval."""
        req = ApprovalRequest(bounty_id=bounty_id, enhancer_result=enhanced)
        self._store[bounty_id] = req
        logger.info("Submitted enhancement for bounty %s — pending approval", bounty_id)
        return req

    def get_status(self, bounty_id: str) -> Optional[ApprovalStatus]:
        """Return the current approval status for a bounty."""
        req = self._store.get(bounty_id)
        return req.status if req else None

    def get_request(self, bounty_id: str) -> Optional[ApprovalRequest]:
        return self._store.get(bounty_id)

    def approve(self, bounty_id: str, reviewer: str) -> ApprovalRequest:
        """Approve and publish the enhanced description."""
        req = self._require(bounty_id)
        if req.status != ApprovalStatus.PENDING:
            raise ValueError(f"Bounty {bounty_id} is {req.status.value}, not pending")
        req.status = ApprovalStatus.APPROVED
        req.reviewer = reviewer
        req.reviewed_at = datetime.now(timezone.utc)
        # Publish — in production this would update the bounty record
        req.status = ApprovalStatus.PUBLISHED
        logger.info("Bounty %s approved and published by %s", bounty_id, reviewer)
        return req

    def reject(self, bounty_id: str, reviewer: str) -> ApprovalRequest:
        """Reject and revert the enhanced description."""
        req = self._require(bounty_id)
        if req.status != ApprovalStatus.PENDING:
            raise ValueError(f"Bounty {bounty_id} is {req.status.value}, not pending")
        req.status = ApprovalStatus.REJECTED
        req.reviewer = reviewer
        req.reviewed_at = datetime.now(timezone.utc)
        req.status = ApprovalStatus.REVERTED
        logger.info("Bounty %s rejected by %s — reverted", bounty_id, reviewer)
        return req

    def _require(self, bounty_id: str) -> ApprovalRequest:
        req = self._store.get(bounty_id)
        if req is None:
            raise KeyError(f"No enhancement found for bounty {bounty_id}")
        return req
