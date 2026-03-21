import asyncio
import json
import logging
import threading
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Set, Any, Union
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


class BountyState(Enum):
    DRAFT = "draft"
    OPEN = "open"
    CLAIMED = "claimed"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"
    PAID = "paid"
    CANCELLED = "cancelled"


class BountyTier(Enum):
    T1 = "tier1"
    T2 = "tier2"
    T3 = "tier3"


TERMINAL_STATES = {BountyState.PAID, BountyState.CANCELLED}

VALID_TRANSITIONS = {
    BountyState.DRAFT: {BountyState.OPEN, BountyState.CANCELLED},
    BountyState.OPEN: {BountyState.CLAIMED, BountyState.CANCELLED},
    BountyState.CLAIMED: {BountyState.IN_REVIEW, BountyState.OPEN, BountyState.CANCELLED},
    BountyState.IN_REVIEW: {BountyState.COMPLETED, BountyState.CLAIMED, BountyState.CANCELLED},
    BountyState.COMPLETED: {BountyState.PAID, BountyState.IN_REVIEW},
    BountyState.PAID: set(),
    BountyState.CANCELLED: set()
}


class BountyLifecycleError(Exception):
    """Base exception for bounty lifecycle errors"""
    pass


class InvalidTransitionError(BountyLifecycleError):
    """Attempted invalid state transition"""
    def __init__(self, from_state: BountyState, to_state: BountyState):
        self.from_state = from_state
        self.to_state = to_state
        super().__init__(f"Invalid transition from {from_state.value} to {to_state.value}")


class TerminalStateError(BountyLifecycleError):
    """Attempted operation on terminal state bounty"""
    def __init__(self, state: BountyState):
        self.state = state
        super().__init__(f"Cannot modify bounty in terminal state: {state.value}")


class ClaimConflictError(BountyLifecycleError):
    """Bounty already claimed by another user"""
    def __init__(self, current_claimant: str):
        self.current_claimant = current_claimant
        super().__init__(f"Bounty already claimed by {current_claimant}")


class TierGateError(BountyLifecycleError):
    """User lacks required tier access"""
    def __init__(self, required_tier: BountyTier, user_tier: Optional[BountyTier]):
        self.required_tier = required_tier
        self.user_tier = user_tier
        super().__init__(f"Tier {required_tier.value} required, user has {user_tier.value if user_tier else 'none'}")


class DeadlineExceededError(BountyLifecycleError):
    """Claim deadline exceeded"""
    def __init__(self, deadline: datetime):
        self.deadline = deadline
        super().__init__(f"Claim deadline exceeded: {deadline}")


@dataclass
class BountyClaim:
    user_id: str
    claimed_at: datetime
    deadline: datetime
    pr_url: Optional[str] = None
    warned_at: Optional[datetime] = None


@dataclass
class AuditEntry:
    timestamp: datetime
    bounty_id: str
    action: str
    from_state: Optional[BountyState]
    to_state: Optional[BountyState]
    user_id: Optional[str]
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class Bounty:
    id: str
    title: str
    description: str
    reward_amount: int
    tier: BountyTier
    state: BountyState
    created_at: datetime
    updated_at: datetime
    creator_id: str
    claim: Optional[BountyClaim] = None
    assignee: Optional[str] = None
    pr_url: Optional[str] = None


class ReputationService:
    """Mock reputation service for tier validation"""

    def __init__(self):
        self._user_tiers: Dict[str, BountyTier] = {}
        self._t1_completions: Dict[str, int] = {}

    def get_user_tier(self, user_id: str) -> Optional[BountyTier]:
        return self._user_tiers.get(user_id)

    def set_user_tier(self, user_id: str, tier: BountyTier) -> None:
        self._user_tiers[user_id] = tier

    def add_t1_completion(self, user_id: str) -> None:
        self._t1_completions[user_id] = self._t1_completions.get(user_id, 0) + 1
        if self._t1_completions[user_id] >= 4:
            self.set_user_tier(user_id, BountyTier.T2)

    def can_claim_tier(self, user_id: str, bounty_tier: BountyTier) -> bool:
        user_tier = self.get_user_tier(user_id)

        if bounty_tier == BountyTier.T1:
            return True
        elif bounty_tier == BountyTier.T2:
            return user_tier in {BountyTier.T2, BountyTier.T3}
        elif bounty_tier == BountyTier.T3:
            return user_tier == BountyTier.T3

        return False


class WebhookProcessor:
    """Processes GitHub webhook events for bounty transitions"""

    def __init__(self, lifecycle_engine):
        self.lifecycle_engine = lifecycle_engine

    def process_webhook(self, event_type: str, payload: Dict[str, Any]) -> Optional[str]:
        """Process GitHub webhook and trigger bounty transitions"""
        try:
            if event_type == "pull_request":
                return self._handle_pr_event(payload)
            return None
        except Exception as e:
            logger.error(f"Webhook processing error: {e}")
            return None

    def _handle_pr_event(self, payload: Dict[str, Any]) -> Optional[str]:
        action = payload.get("action")
        pr_number = payload.get("pull_request", {}).get("number")
        pr_url = payload.get("pull_request", {}).get("html_url")
        pr_body = payload.get("pull_request", {}).get("body", "")
        pr_user = payload.get("pull_request", {}).get("user", {}).get("login")

        if not pr_number or not pr_user:
            return None

        # Extract bounty ID from PR body
        bounty_id = self._extract_bounty_id(pr_body)
        if not bounty_id:
            return None

        try:
            if action == "opened":
                self.lifecycle_engine.transition_to_review(bounty_id, pr_user, pr_url)
                return f"Bounty {bounty_id} moved to review"
            elif action == "closed":
                pr_merged = payload.get("pull_request", {}).get("merged", False)
                if pr_merged:
                    self.lifecycle_engine.complete_bounty(bounty_id)
                    return f"Bounty {bounty_id} completed"
                else:
                    self.lifecycle_engine.release_claim(bounty_id)
                    return f"Bounty {bounty_id} claim released"
        except Exception as e:
            logger.error(f"Error processing PR webhook for bounty {bounty_id}: {e}")
            return None

        return None

    def _extract_bounty_id(self, pr_body: str) -> Optional[str]:
        """Extract bounty ID from PR body using Closes #XXX pattern"""
        import re
        if not pr_body:
            return None

        # Look for "Closes #123" pattern
        match = re.search(r'Closes\s+#(\d+)', pr_body, re.IGNORECASE)
        if match:
            return match.group(1)

        return None


class BountyLifecycleEngine:
    """Complete bounty lifecycle management with state machine"""

    def __init__(self, reputation_service: Optional[ReputationService] = None):
        self._bounties: Dict[str, Bounty] = {}
        self._audit_log: List[AuditEntry] = []
        self._state_lock = threading.RLock()
        self._claim_deadline_hours = 72
        self._warning_threshold = 0.8

        self.reputation_service = reputation_service or ReputationService()
        self.webhook_processor = WebhookProcessor(self)

    def create_bounty(self, bounty_id: str, title: str, description: str,
                     reward_amount: int, tier: BountyTier, creator_id: str) -> Bounty:
        """Create new bounty in DRAFT state"""
        with self._state_lock:
            if bounty_id in self._bounties:
                raise ValueError(f"Bounty {bounty_id} already exists")

            now = datetime.utcnow()
            bounty = Bounty(
                id=bounty_id,
                title=title,
                description=description,
                reward_amount=reward_amount,
                tier=tier,
                state=BountyState.DRAFT,
                created_at=now,
                updated_at=now,
                creator_id=creator_id
            )

            self._bounties[bounty_id] = bounty
            self._log_audit("bounty_created", bounty_id, None, BountyState.DRAFT, creator_id)

            return bounty

    def publish_bounty(self, bounty_id: str) -> None:
        """Transition bounty from DRAFT to OPEN"""
        with self._state_lock:
            bounty = self._get_bounty(bounty_id)
            self._validate_transition(bounty.state, BountyState.OPEN)

            bounty.state = BountyState.OPEN
            bounty.updated_at = datetime.utcnow()

            self._log_audit("bounty_published", bounty_id, BountyState.DRAFT, BountyState.OPEN, None)

    def claim_bounty(self, bounty_id: str, user_id: str) -> None:
        """Claim an open bounty with tier validation"""
        with self._state_lock:
            bounty = self._get_bounty(bounty_id)

            # Validate state and tier access
            self._validate_transition(bounty.state, BountyState.CLAIMED)

            if not self.reputation_service.can_claim_tier(user_id, bounty.tier):
                user_tier = self.reputation_service.get_user_tier(user_id)
                raise TierGateError(bounty.tier, user_tier)

            # Check for existing claim
            if bounty.claim and bounty.claim.user_id != user_id:
                raise ClaimConflictError(bounty.claim.user_id)

            # Create claim with deadline
            now = datetime.utcnow()
            deadline = now + timedelta(hours=self._claim_deadline_hours)

            bounty.state = BountyState.CLAIMED
            bounty.claim = BountyClaim(user_id=user_id, claimed_at=now, deadline=deadline)
            bounty.assignee = user_id
            bounty.updated_at = now

            self._log_audit("bounty_claimed", bounty_id, BountyState.OPEN, BountyState.CLAIMED, user_id)

    def transition_to_review(self, bounty_id: str, user_id: str, pr_url: str) -> None:
        """Transition claimed bounty to IN_REVIEW when PR opened"""
        with self._state_lock:
            bounty = self._get_bounty(bounty_id)
            self._validate_transition(bounty.state, BountyState.IN_REVIEW)

            # Validate claimant
            if not bounty.claim or bounty.claim.user_id != user_id:
                raise ValueError(f"User {user_id} has not claimed this bounty")

            bounty.state = BountyState.IN_REVIEW
            bounty.pr_url = pr_url
            if bounty.claim:
                bounty.claim.pr_url = pr_url
            bounty.updated_at = datetime.utcnow()

            self._log_audit("bounty_in_review", bounty_id, BountyState.CLAIMED,
                          BountyState.IN_REVIEW, user_id, {"pr_url": pr_url})

    def complete_bounty(self, bounty_id: str) -> None:
        """Mark bounty as completed when PR merged"""
        with self._state_lock:
            bounty = self._get_bounty(bounty_id)
            self._validate_transition(bounty.state, BountyState.COMPLETED)

            bounty.state = BountyState.COMPLETED
            bounty.updated_at = datetime.utcnow()

            # Update reputation for T1 completions
            if bounty.claim and bounty.tier == BountyTier.T1:
                self.reputation_service.add_t1_completion(bounty.claim.user_id)

            self._log_audit("bounty_completed", bounty_id, BountyState.IN_REVIEW,
                          BountyState.COMPLETED, bounty.claim.user_id if bounty.claim else None)

    def pay_bounty(self, bounty_id: str) -> None:
        """Final state transition to PAID"""
        with self._state_lock:
            bounty = self._get_bounty(bounty_id)
            self._validate_transition(bounty.state, BountyState.PAID)

            bounty.state = BountyState.PAID
            bounty.updated_at = datetime.utcnow()

            self._log_audit("bounty_paid", bounty_id, BountyState.COMPLETED,
                          BountyState.PAID, bounty.claim.user_id if bounty.claim else None)

    def release_claim(self, bounty_id: str, reason: str = "manual") -> None:
        """Release claim and return bounty to OPEN state"""
        with self._state_lock:
            bounty = self._get_bounty(bounty_id)

            if bounty.state not in {BountyState.CLAIMED, BountyState.IN_REVIEW}:
                raise InvalidTransitionError(bounty.state, BountyState.OPEN)

            old_claimant = bounty.claim.user_id if bounty.claim else None

            bounty.state = BountyState.OPEN
            bounty.claim = None
            bounty.assignee = None
            bounty.pr_url = None
            bounty.updated_at = datetime.utcnow()

            self._log_audit("claim_released", bounty_id, bounty.state, BountyState.OPEN,
                          old_claimant, {"reason": reason})

    def cancel_bounty(self, bounty_id: str, reason: str = "manual") -> None:
        """Cancel bounty (terminal state)"""
        with self._state_lock:
            bounty = self._get_bounty(bounty_id)

            if bounty.state in TERMINAL_STATES:
                raise TerminalStateError(bounty.state)

            old_state = bounty.state
            bounty.state = BountyState.CANCELLED
            bounty.updated_at = datetime.utcnow()

            self._log_audit("bounty_cancelled", bounty_id, old_state, BountyState.CANCELLED,
                          None, {"reason": reason})

    def check_claim_deadlines(self) -> List[str]:
        """Check for expired claims and send warnings"""
        with self._state_lock:
            now = datetime.utcnow()
            expired_bounties = []

            for bounty in self._bounties.values():
                if bounty.state != BountyState.CLAIMED or not bounty.claim:
                    continue

                claim = bounty.claim
                time_remaining = claim.deadline - now
                total_time = claim.deadline - claim.claimed_at
                progress = 1.0 - (time_remaining.total_seconds() / total_time.total_seconds())

                # Send warning at 80% progress
                if progress >= self._warning_threshold and not claim.warned_at:
                    claim.warned_at = now
                    logger.warning(f"Claim deadline warning for bounty {bounty.id}")

                # Auto-release expired claims
                if now >= claim.deadline:
                    self.release_claim(bounty.id, "deadline_exceeded")
                    expired_bounties.append(bounty.id)

            return expired_bounties

    def process_webhook(self, event_type: str, payload: Dict[str, Any]) -> Optional[str]:
        """Process GitHub webhook events"""
        return self.webhook_processor.process_webhook(event_type, payload)

    def get_bounty(self, bounty_id: str) -> Optional[Bounty]:
        """Get bounty by ID (thread-safe read)"""
        with self._state_lock:
            return self._bounties.get(bounty_id)

    def list_bounties(self, state: Optional[BountyState] = None,
                     tier: Optional[BountyTier] = None) -> List[Bounty]:
        """List bounties with optional filtering"""
        with self._state_lock:
            bounties = list(self._bounties.values())

            if state:
                bounties = [b for b in bounties if b.state == state]
            if tier:
                bounties = [b for b in bounties if b.tier == tier]

            return bounties

    def get_audit_log(self, bounty_id: Optional[str] = None) -> List[AuditEntry]:
        """Get audit log entries"""
        with self._state_lock:
            if bounty_id:
                return [entry for entry in self._audit_log if entry.bounty_id == bounty_id]
            return list(self._audit_log)

    def get_user_claims(self, user_id: str) -> List[Bounty]:
        """Get all bounties claimed by user"""
        with self._state_lock:
            return [b for b in self._bounties.values()
                   if b.claim and b.claim.user_id == user_id]

    def _get_bounty(self, bounty_id: str) -> Bounty:
        """Internal helper to get bounty with existence check"""
        bounty = self._bounties.get(bounty_id)
        if not bounty:
            raise ValueError(f"Bounty {bounty_id} not found")
        return bounty

    def _validate_transition(self, from_state: BountyState, to_state: BountyState) -> None:
        """Validate state transition is legal"""
        if from_state in TERMINAL_STATES:
            raise TerminalStateError(from_state)

        if to_state not in VALID_TRANSITIONS[from_state]:
            raise InvalidTransitionError(from_state, to_state)

    def _log_audit(self, action: str, bounty_id: str, from_state: Optional[BountyState],
                  to_state: Optional[BountyState], user_id: Optional[str],
                  metadata: Optional[Dict[str, Any]] = None) -> None:
        """Append audit entry (append-only logging)"""
        entry = AuditEntry(
            timestamp=datetime.utcnow(),
            bounty_id=bounty_id,
            action=action,
            from_state=from_state,
            to_state=to_state,
            user_id=user_id,
            metadata=metadata
        )
        self._audit_log.append(entry)
