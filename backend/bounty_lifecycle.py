# SPDX-License-Identifier: MIT

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from enum import Enum
import logging
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from backend.database import get_db
from backend.models import Bounty, BountyState, BountyTier, User, BountyAuditLog
from backend.auth import get_current_user
from backend.webhooks import send_bounty_webhook

logger = logging.getLogger(__name__)


class BountyLifecycleError(Exception):
    """Raised when bounty lifecycle operation fails"""
    pass


class StateTransition(Enum):
    """Valid state transitions in bounty lifecycle"""
    DRAFT_TO_OPEN = "draft_to_open"
    OPEN_TO_CLAIMED = "open_to_claimed"
    OPEN_TO_IN_REVIEW = "open_to_in_review"
    CLAIMED_TO_OPEN = "claimed_to_open"
    CLAIMED_TO_IN_REVIEW = "claimed_to_in_review"
    IN_REVIEW_TO_COMPLETED = "in_review_to_completed"
    IN_REVIEW_TO_OPEN = "in_review_to_open"
    COMPLETED_TO_PAID = "completed_to_paid"


class BountyLifecycleEngine:
    """Manages complete bounty lifecycle state machine"""

    def __init__(self, db: Session):
        self.db = db

        # State transition rules
        self.valid_transitions = {
            BountyState.DRAFT: [BountyState.OPEN],
            BountyState.OPEN: [BountyState.CLAIMED, BountyState.IN_REVIEW],
            BountyState.CLAIMED: [BountyState.OPEN, BountyState.IN_REVIEW],
            BountyState.IN_REVIEW: [BountyState.COMPLETED, BountyState.OPEN],
            BountyState.COMPLETED: [BountyState.PAID],
            BountyState.PAID: []
        }

        # Tier-specific claim timeouts (hours)
        self.claim_timeouts = {
            BountyTier.T1: 0,  # No claims, open race
            BountyTier.T2: 48,
            BountyTier.T3: 72
        }

    def _validate_transition(self, bounty: Bounty, new_state: BountyState) -> bool:
        """Validate if state transition is allowed"""
        valid_next_states = self.valid_transitions.get(bounty.state, [])
        return new_state in valid_next_states

    def _log_audit(self, bounty: Bounty, action: str, old_state: BountyState,
                   new_state: BountyState, user_id: Optional[int] = None,
                   metadata: Optional[Dict] = None):
        """Create immutable audit log entry"""
        audit_log = BountyAuditLog(
            bounty_id=bounty.id,
            action=action,
            old_state=old_state,
            new_state=new_state,
            user_id=user_id,
            metadata=metadata or {},
            timestamp=datetime.utcnow()
        )
        self.db.add(audit_log)
        self.db.flush()

    def _send_lifecycle_webhook(self, bounty: Bounty, event: str, metadata: Dict = None):
        """Send webhook for lifecycle events"""
        try:
            send_bounty_webhook(
                event=f"bounty.{event}",
                bounty_id=bounty.id,
                data={
                    "bounty_id": bounty.id,
                    "title": bounty.title,
                    "state": bounty.state.value,
                    "tier": bounty.tier.value,
                    "reward": bounty.reward,
                    "metadata": metadata or {}
                }
            )
        except Exception as e:
            logger.error(f"Webhook failed for bounty {bounty.id}: {e}")

    def create_draft_bounty(self, title: str, description: str, tier: BountyTier,
                           reward: int, creator_id: int, tags: List[str] = None) -> Bounty:
        """Create new bounty in DRAFT state"""
        bounty = Bounty(
            title=title,
            description=description,
            tier=tier,
            reward=reward,
            state=BountyState.DRAFT,
            created_by=creator_id,
            tags=tags or [],
            created_at=datetime.utcnow()
        )

        self.db.add(bounty)
        self.db.flush()

        self._log_audit(
            bounty, "created", None, BountyState.DRAFT,
            creator_id, {"initial_creation": True}
        )

        self._send_lifecycle_webhook(bounty, "created")
        return bounty

    def publish_bounty(self, bounty_id: int, user_id: int) -> Bounty:
        """Transition bounty from DRAFT to OPEN"""
        bounty = self.db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if not bounty:
            raise BountyLifecycleError(f"Bounty {bounty_id} not found")

        if bounty.created_by != user_id:
            raise BountyLifecycleError("Only bounty creator can publish")

        if not self._validate_transition(bounty, BountyState.OPEN):
            raise BountyLifecycleError(f"Cannot transition from {bounty.state} to OPEN")

        old_state = bounty.state
        bounty.state = BountyState.OPEN
        bounty.published_at = datetime.utcnow()

        self._log_audit(bounty, "published", old_state, BountyState.OPEN, user_id)
        self._send_lifecycle_webhook(bounty, "published")

        self.db.commit()
        return bounty

    def claim_bounty(self, bounty_id: int, user_id: int) -> Bounty:
        """Claim bounty (T2/T3 only - T1 goes direct to in_review)"""
        bounty = self.db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if not bounty:
            raise BountyLifecycleError(f"Bounty {bounty_id} not found")

        if bounty.tier == BountyTier.T1:
            raise BountyLifecycleError("T1 bounties cannot be claimed - open race only")

        if not self._validate_transition(bounty, BountyState.CLAIMED):
            raise BountyLifecycleError(f"Cannot claim bounty in {bounty.state} state")

        old_state = bounty.state
        bounty.state = BountyState.CLAIMED
        bounty.claimed_by = user_id
        bounty.claimed_at = datetime.utcnow()

        # Set deadline based on tier
        timeout_hours = self.claim_timeouts[bounty.tier]
        bounty.claim_deadline = datetime.utcnow() + timedelta(hours=timeout_hours)

        self._log_audit(
            bounty, "claimed", old_state, BountyState.CLAIMED, user_id,
            {"claim_deadline": bounty.claim_deadline.isoformat()}
        )
        self._send_lifecycle_webhook(bounty, "claimed", {"claimed_by": user_id})

        self.db.commit()
        return bounty

    def start_review(self, bounty_id: int, pr_url: str, user_id: int) -> Bounty:
        """Move bounty to IN_REVIEW state when PR is submitted"""
        bounty = self.db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if not bounty:
            raise BountyLifecycleError(f"Bounty {bounty_id} not found")

        # Check if user is allowed to submit
        if bounty.state == BountyState.CLAIMED and bounty.claimed_by != user_id:
            raise BountyLifecycleError("Only the claimer can submit PR for claimed bounty")

        if bounty.state == BountyState.OPEN and bounty.tier != BountyTier.T1:
            # T2/T3 must be claimed first
            raise BountyLifecycleError("T2/T3 bounties must be claimed before submission")

        if not self._validate_transition(bounty, BountyState.IN_REVIEW):
            raise BountyLifecycleError(f"Cannot start review from {bounty.state} state")

        old_state = bounty.state
        bounty.state = BountyState.IN_REVIEW
        bounty.pr_url = pr_url
        bounty.submitted_by = user_id
        bounty.submitted_at = datetime.utcnow()

        # If it was T1 open race, set claimed_by
        if old_state == BountyState.OPEN:
            bounty.claimed_by = user_id
            bounty.claimed_at = datetime.utcnow()

        self._log_audit(
            bounty, "review_started", old_state, BountyState.IN_REVIEW, user_id,
            {"pr_url": pr_url}
        )
        self._send_lifecycle_webhook(bounty, "review_started", {
            "pr_url": pr_url, "submitted_by": user_id
        })

        self.db.commit()
        return bounty

    def complete_bounty(self, bounty_id: int, reviewer_id: int) -> Bounty:
        """Mark bounty as completed (PR approved)"""
        bounty = self.db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if not bounty:
            raise BountyLifecycleError(f"Bounty {bounty_id} not found")

        if not self._validate_transition(bounty, BountyState.COMPLETED):
            raise BountyLifecycleError(f"Cannot complete bounty in {bounty.state} state")

        old_state = bounty.state
        bounty.state = BountyState.COMPLETED
        bounty.completed_by = reviewer_id
        bounty.completed_at = datetime.utcnow()

        self._log_audit(
            bounty, "completed", old_state, BountyState.COMPLETED, reviewer_id
        )
        self._send_lifecycle_webhook(bounty, "completed", {"reviewer": reviewer_id})

        self.db.commit()
        return bounty

    def reject_submission(self, bounty_id: int, reviewer_id: int, reason: str) -> Bounty:
        """Reject PR and return bounty to OPEN state"""
        bounty = self.db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if not bounty:
            raise BountyLifecycleError(f"Bounty {bounty_id} not found")

        if not self._validate_transition(bounty, BountyState.OPEN):
            raise BountyLifecycleError(f"Cannot reject from {bounty.state} state")

        old_state = bounty.state
        bounty.state = BountyState.OPEN
        bounty.claimed_by = None
        bounty.claimed_at = None
        bounty.claim_deadline = None
        bounty.submitted_by = None
        bounty.submitted_at = None
        bounty.pr_url = None

        self._log_audit(
            bounty, "rejected", old_state, BountyState.OPEN, reviewer_id,
            {"reason": reason}
        )
        self._send_lifecycle_webhook(bounty, "rejected", {
            "reviewer": reviewer_id, "reason": reason
        })

        self.db.commit()
        return bounty

    def pay_bounty(self, bounty_id: int, payer_id: int, transaction_hash: str) -> Bounty:
        """Mark bounty as paid with transaction proof"""
        bounty = self.db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if not bounty:
            raise BountyLifecycleError(f"Bounty {bounty_id} not found")

        if not self._validate_transition(bounty, BountyState.PAID):
            raise BountyLifecycleError(f"Cannot pay bounty in {bounty.state} state")

        old_state = bounty.state
        bounty.state = BountyState.PAID
        bounty.paid_by = payer_id
        bounty.paid_at = datetime.utcnow()
        bounty.payment_tx = transaction_hash

        self._log_audit(
            bounty, "paid", old_state, BountyState.PAID, payer_id,
            {"transaction_hash": transaction_hash}
        )
        self._send_lifecycle_webhook(bounty, "paid", {
            "transaction_hash": transaction_hash, "paid_by": payer_id
        })

        self.db.commit()
        return bounty

    def release_expired_claims(self) -> List[Bounty]:
        """Release claims that have exceeded deadline"""
        now = datetime.utcnow()
        expired_bounties = self.db.query(Bounty).filter(
            and_(
                Bounty.state == BountyState.CLAIMED,
                Bounty.claim_deadline <= now
            )
        ).all()

        released = []
        for bounty in expired_bounties:
            old_claimer = bounty.claimed_by
            bounty.state = BountyState.OPEN
            bounty.claimed_by = None
            bounty.claimed_at = None
            bounty.claim_deadline = None

            self._log_audit(
                bounty, "claim_expired", BountyState.CLAIMED, BountyState.OPEN,
                metadata={
                    "previous_claimer": old_claimer,
                    "expired_at": now.isoformat()
                }
            )
            self._send_lifecycle_webhook(bounty, "claim_expired", {
                "previous_claimer": old_claimer
            })

            released.append(bounty)

        if released:
            self.db.commit()
            logger.info(f"Released {len(released)} expired claims")

        return released

    def get_bounties_near_deadline(self, warning_threshold: float = 0.8) -> List[Bounty]:
        """Get bounties approaching claim deadline (default 80%)"""
        now = datetime.utcnow()

        near_deadline = []
        claimed_bounties = self.db.query(Bounty).filter(
            and_(
                Bounty.state == BountyState.CLAIMED,
                Bounty.claim_deadline.isnot(None)
            )
        ).all()

        for bounty in claimed_bounties:
            if bounty.claimed_at and bounty.claim_deadline:
                total_duration = bounty.claim_deadline - bounty.claimed_at
                elapsed = now - bounty.claimed_at
                progress = elapsed.total_seconds() / total_duration.total_seconds()

                if progress >= warning_threshold:
                    near_deadline.append(bounty)

        return near_deadline

    def handle_pr_webhook(self, pr_data: Dict) -> Optional[Bounty]:
        """Handle GitHub PR webhook events"""
        pr_url = pr_data.get("html_url", "")
        action = pr_data.get("action", "")

        bounty = self.db.query(Bounty).filter(Bounty.pr_url == pr_url).first()
        if not bounty:
            return None

        metadata = {
            "pr_action": action,
            "pr_number": pr_data.get("number"),
            "pr_title": pr_data.get("title", "")
        }

        if action == "opened" and bounty.state != BountyState.IN_REVIEW:
            # PR opened but bounty not in review - sync state
            self._log_audit(
                bounty, "pr_opened", bounty.state, bounty.state,
                metadata=metadata
            )
        elif action == "closed":
            if pr_data.get("merged", False):
                # PR merged - could trigger completion
                self._log_audit(
                    bounty, "pr_merged", bounty.state, bounty.state,
                    metadata=metadata
                )
            else:
                # PR closed without merge
                self._log_audit(
                    bounty, "pr_closed", bounty.state, bounty.state,
                    metadata=metadata
                )

        self.db.commit()
        return bounty

    def get_audit_trail(self, bounty_id: int) -> List[BountyAuditLog]:
        """Get complete immutable audit trail for bounty"""
        return self.db.query(BountyAuditLog).filter(
            BountyAuditLog.bounty_id == bounty_id
        ).order_by(BountyAuditLog.timestamp.asc()).all()

    def get_lifecycle_stats(self) -> Dict[str, Any]:
        """Get bounty lifecycle statistics"""
        stats = {}

        # Count by state
        for state in BountyState:
            count = self.db.query(Bounty).filter(Bounty.state == state).count()
            stats[f"{state.value}_count"] = count

        # Average completion times
        completed_bounties = self.db.query(Bounty).filter(
            and_(
                Bounty.state.in_([BountyState.COMPLETED, BountyState.PAID]),
                Bounty.published_at.isnot(None),
                Bounty.completed_at.isnot(None)
            )
        ).all()

        if completed_bounties:
            total_time = sum([
                (b.completed_at - b.published_at).total_seconds()
                for b in completed_bounties
            ])
            stats["avg_completion_hours"] = total_time / (len(completed_bounties) * 3600)
        else:
            stats["avg_completion_hours"] = 0

        # Claim success rate
        claimed_count = len([b for b in completed_bounties if b.claimed_at])
        if completed_bounties:
            stats["claim_success_rate"] = claimed_count / len(completed_bounties)
        else:
            stats["claim_success_rate"] = 0

        return stats
