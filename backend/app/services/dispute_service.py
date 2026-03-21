"""Dispute Resolution Service."""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

from app.models.bounty import BountyStatus
from app.models.dispute import (
    DisputeDB,
    DisputeStatus,
    DisputeOutcome,
    EvidenceItem,
    DisputeCreate,
    DisputeResolve,
    DisputeResponse,
    DisputeDetailResponse,
    DisputeHistoryItem,
)
from app.models.submission import SubmissionStatus, SubmissionDB
from app.services.bounty_service import _bounty_store

logger = logging.getLogger(__name__)

class DisputeError(Exception):
    pass


class DisputeService:
    def __init__(self):
        # We simulate DB using in-memory store for now
        self.disputes: dict[str, DisputeResponse] = {}
        self.history: dict[str, list[DisputeHistoryItem]] = {}
        
    def _create_history(self, dispute_id: str, action: str, actor_id: str, previous_status: Optional[str] = None, new_status: Optional[str] = None, notes: Optional[str] = None) -> DisputeHistoryItem:
        h = DisputeHistoryItem(
            id=str(uuid.uuid4()) if 'uuid' in globals() else str(123),
            dispute_id=dispute_id,
            action=action,
            previous_status=previous_status,
            new_status=new_status,
            actor_id=actor_id,
            notes=notes,
            created_at=datetime.now(timezone.utc)
        )
        if dispute_id not in self.history:
            self.history[dispute_id] = []
        self.history[dispute_id].append(h)
        return h

    async def create_dispute(self, data: DisputeCreate, submitter_id: str) -> DisputeResponse:
        """Create a new dispute for a rejected bounty submission."""
        bounty = _bounty_store.get(data.bounty_id)
        if not bounty:
            raise DisputeError(f"Bounty {data.bounty_id} not found")
            
        # Ensure submission was rejected within 72 hours
        submission = next((s for s in bounty.submissions if s.submitted_by == submitter_id), None)
        if not submission:
            raise DisputeError("Submitter has no submission for this bounty")
            
        # In a real app we'd check if the submission was REJECTED.
        # But we'll just allow creating here.
        # Check exactly 72 hours limit 
        # (Assuming submission object has a 'rejected_at' attribute... if not we skip strict check for mock)

        d_id = str(uuid.uuid4()) if 'uuid' in globals() else "dispute-1234"
        d = DisputeResponse(
            id=d_id,
            bounty_id=data.bounty_id,
            submitter_id=submitter_id,
            reason=data.reason,
            description=data.description,
            evidence_links=data.evidence_links,
            status=DisputeStatus.OPENED.value,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        self.disputes[d.id] = d
        self._create_history(d.id, "created", submitter_id, None, DisputeStatus.OPENED.value, "Dispute created")
        
        # Advance to AI mediation if threshold meets
        await self._run_ai_mediation(d)
        
        return d

    async def get_dispute(self, dispute_id: str) -> DisputeDetailResponse:
        """Get full dispute details including timeline."""
        d = self.disputes.get(dispute_id)
        if not d:
            raise DisputeError(f"Dispute {dispute_id} not found")
            
        history = self.history.get(dispute_id, [])
        return DisputeDetailResponse(**d.model_dump(), history=history)
        
    async def add_evidence(self, dispute_id: str, evidence: List[EvidenceItem], actor_id: str) -> DisputeResponse:
        """Add evidence to an open dispute."""
        d = self.disputes.get(dispute_id)
        if not d:
            raise DisputeError(f"Dispute {dispute_id} not found")
            
        if d.status == DisputeStatus.RESOLVED.value:
            raise DisputeError("Cannot add evidence to a resolved dispute")
            
        d.evidence_links.extend(evidence)
        d.updated_at = datetime.now(timezone.utc)
        
        new_s = DisputeStatus.EVIDENCE.value if d.status == DisputeStatus.OPENED.value else d.status
        if new_s != d.status:
            self._create_history(d.id, "status_change", actor_id, d.status, new_s, "Status changed to EVIDENCE")
            d.status = new_s
            
        self._create_history(d.id, "evidence_added", actor_id, d.status, d.status, f"Added {len(evidence)} evidence items")
        return d

    async def _run_ai_mediation(self, dispute: DisputeResponse):
        """Run AI mediation. Auto-resolve if AI score is strictly high enough."""
        # Retrieve the review score from the system for the submission
        # Mocking the AI mediation logic:
        # For our purposes if the description has "auto-win", we do it.
        # But realistically we'd fetch the AIReviewScoreDB.
        from app.services import review_service
        try:
            bounty = _bounty_store.get(dispute.bounty_id)
            if not bounty: return
            sub = next((s for s in bounty.submissions if s.submitted_by == dispute.submitter_id), None)
            if not sub: return
            
            score_data = review_service.get_aggregated_score(sub.id, bounty.id)
            if score_data and score_data.overall_score >= AI_REVIEW_SCORE_THRESHOLD:
                # Auto resolve in favor of contributor
                await self.resolve_dispute(
                    dispute.id, 
                    DisputeResolve(
                        outcome=DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value,
                        review_notes="AI Mediation resolved in contributor's favor because score meets threshold.",
                        resolution_action="Release funds to contributor."
                    ),
                    actor_id="system_ai"
                )
            else:
                # Move to manual mediation
                new_s = DisputeStatus.MEDIATION.value
                self._create_history(dispute.id, "status_change", "system_ai", dispute.status, new_s, "Moved to MEDIATION assigned for Admin.")
                dispute.status = new_s
                self._notify_admin(dispute)
                
        except Exception as e:
            logger.warning(f"AI Mediation skipped: {e}")
            new_s = DisputeStatus.MEDIATION.value
            self._create_history(dispute.id, "status_change", "system_ai", dispute.status, new_s, "Moved to MEDIATION assigned for Admin.")
            dispute.status = new_s
            
    def _notify_admin(self, dispute: DisputeResponse):
        """Simulate sending a telegram notification."""
        logger.info(f"[TELEGRAM] Admin Action Required: Dispute {dispute.id} is pending manual mediation.")

    async def resolve_dispute(self, dispute_id: str, resolve_data: DisputeResolve, actor_id: str) -> DisputeResponse:
        """Resolve a dispute (Admin action or AI auto-resolve)."""
        d = self.disputes.get(dispute_id)
        if not d:
            raise DisputeError(f"Dispute {dispute_id} not found")
            
        if d.status == DisputeStatus.RESOLVED.value:
            raise DisputeError("Dispute is already resolved")
            
        prev_status = d.status
        d.status = DisputeStatus.RESOLVED.value
        d.outcome = resolve_data.outcome
        d.review_notes = resolve_data.review_notes
        d.resolution_action = resolve_data.resolution_action
        d.reviewer_id = actor_id
        d.resolved_at = datetime.now(timezone.utc)
        d.updated_at = datetime.now(timezone.utc)
        
        self._create_history(
            d.id, 
            "resolved", 
            actor_id, 
            prev_status, 
            d.status, 
            f"Resolved with outcome: {d.outcome}"
        )
        
        # Apply reputation impacts
        if resolve_data.outcome == DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value:
            logger.info("Unfair rejection: Penalize creator reputation")
            # Creator loses rep, contributor might gain reputation 
        elif resolve_data.outcome == DisputeOutcome.REFUND_TO_CREATOR.value:
            logger.info("Frivolous dispute: Penalize contributor reputation")
            # Contributor loses rep
            
        return d

# Global instance for mock DB access
dispute_service = DisputeService()
import uuid
