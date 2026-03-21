"""Dispute resolution service.

Handles the full dispute lifecycle including:
- Dispute creation within 72 hours of rejection
- Evidence collection from both parties
- AI-assisted mediation with auto-resolution
- Manual admin resolution
- Reputation impact
- Telegram notifications for admin review
"""

import logging
import os
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple, Dict, Any
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dispute import (
    DisputeDB,
    DisputeHistoryDB,
    DisputeState,
    DisputeOutcome,
    DisputeReason,
    EvidenceItem,
    DisputeCreate,
    DisputeResolve,
    EvidenceSubmission,
    DisputeResponse,
    DisputeListItem,
    DisputeDetailResponse,
    DisputeListResponse,
    DisputeStats,
    DisputeHistoryItem,
)
from app.models.submission import SubmissionDB, SubmissionStatus
from app.models.bounty import BountyDB

logger = logging.getLogger(__name__)

# AI Mediation threshold (7/10 = 0.7)
AI_RESOLUTION_THRESHOLD = 7.0
EVIDENCE_WINDOW_HOURS = 72


class DisputeService:
    """Service for managing dispute resolution."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_dispute(
        self,
        contributor_id: str,
        data: DisputeCreate,
        creator_id: str,
    ) -> Tuple[Optional[DisputeResponse], Optional[str]]:
        """Create a new dispute for a rejected submission.

        Args:
            contributor_id: ID of the contributor creating the dispute
            data: Dispute creation data
            creator_id: ID of the bounty creator

        Returns:
            Tuple of (DisputeResponse, error_message)
        """
        # Check if submission exists and was rejected
        submission_result = await self.session.execute(
            select(SubmissionDB).where(SubmissionDB.id == UUID(data.submission_id))
        )
        submission = submission_result.scalar_one_or_none()

        if not submission:
            return None, "Submission not found"

        if submission.status != SubmissionStatus.REJECTED.value:
            return None, "Can only dispute rejected submissions"

        # Check if within 72-hour window
        time_since_rejection = datetime.now(timezone.utc) - (submission.reviewed_at or submission.updated_at)
        if time_since_rejection > timedelta(hours=EVIDENCE_WINDOW_HOURS):
            return None, f"Dispute must be filed within {EVIDENCE_WINDOW_HOURS} hours of rejection"

        # Check for existing dispute
        existing = await self.session.execute(
            select(DisputeDB).where(DisputeDB.submission_id == UUID(data.submission_id))
        )
        if existing.scalar_one_or_none():
            return None, "A dispute already exists for this submission"

        # Create dispute
        evidence_deadline = datetime.now(timezone.utc) + timedelta(hours=EVIDENCE_WINDOW_HOURS)

        dispute = DisputeDB(
            bounty_id=UUID(data.bounty_id),
            submission_id=UUID(data.submission_id),
            contributor_id=UUID(contributor_id),
            creator_id=UUID(creator_id),
            reason=data.reason.value,
            description=data.description,
            state=DisputeState.OPENED.value,
            contributor_evidence=[e.model_dump() for e in data.initial_evidence],
            creator_evidence=[],
            evidence_deadline=evidence_deadline,
        )

        self.session.add(dispute)
        await self.session.flush()

        # Create history entry
        history = DisputeHistoryDB(
            dispute_id=dispute.id,
            action="dispute_created",
            previous_state=None,
            new_state=DisputeState.OPENED.value,
            actor_id=UUID(contributor_id),
            actor_role="contributor",
            notes=f"Dispute created: {data.reason.value}",
        )
        self.session.add(history)

        # Update submission status to disputed
        submission.status = SubmissionStatus.DISPUTED.value

        await self.session.commit()
        await self.session.refresh(dispute)

        logger.info(f"Dispute created: {dispute.id} for submission {data.submission_id}")

        return DisputeResponse.model_validate(dispute), None

    async def get_dispute(self, dispute_id: str) -> Optional[DisputeDetailResponse]:
        """Get a dispute by ID with full history."""
        result = await self.session.execute(
            select(DisputeDB)
            .options(selectinload(DisputeDB.history))
            .where(DisputeDB.id == UUID(dispute_id))
        )
        dispute = result.scalar_one_or_none()

        if not dispute:
            return None

        # Get history separately
        history_result = await self.session.execute(
            select(DisputeHistoryDB)
            .where(DisputeHistoryDB.dispute_id == dispute.id)
            .order_by(DisputeHistoryDB.created_at)
        )
        history = history_result.scalars().all()

        response = DisputeDetailResponse.model_validate(dispute)
        response.history = [DisputeHistoryItem.model_validate(h) for h in history]
        return response

    async def list_disputes(
        self,
        contributor_id: Optional[str] = None,
        creator_id: Optional[str] = None,
        state: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> DisputeListResponse:
        """List disputes with optional filters."""
        query = select(DisputeDB)

        if contributor_id:
            query = query.where(DisputeDB.contributor_id == UUID(contributor_id))
        if creator_id:
            query = query.where(DisputeDB.creator_id == UUID(creator_id))
        if state:
            query = query.where(DisputeDB.state == state)

        # Count total
        count_query = query.with_only_columns(DisputeDB.id)
        total = len((await self.session.execute(count_query)).all())

        # Get paginated results
        query = query.order_by(DisputeDB.created_at.desc()).offset(skip).limit(limit)
        result = await self.session.execute(query)
        disputes = result.scalars().all()

        return DisputeListResponse(
            items=[DisputeListItem.model_validate(d) for d in disputes],
            total=total,
            skip=skip,
            limit=limit,
        )

    async def submit_evidence(
        self,
        dispute_id: str,
        actor_id: str,
        actor_role: str,  # "contributor" or "creator"
        evidence: EvidenceSubmission,
    ) -> Tuple[Optional[DisputeResponse], Optional[str]]:
        """Submit evidence for a dispute."""
        result = await self.session.execute(
            select(DisputeDB).where(DisputeDB.id == UUID(dispute_id))
        )
        dispute = result.scalar_one_or_none()

        if not dispute:
            return None, "Dispute not found"

        if dispute.state == DisputeState.RESOLVED.value:
            return None, "Cannot submit evidence to resolved dispute"

        # Check deadline
        if dispute.evidence_deadline and datetime.now(timezone.utc) > dispute.evidence_deadline:
            return None, "Evidence submission deadline has passed"

        # Add evidence
        evidence_list = [e.model_dump() for e in evidence.evidence]

        if actor_role == "contributor":
            if str(dispute.contributor_id) != actor_id:
                return None, "Not authorized to submit evidence for this dispute"
            current = dispute.contributor_evidence or []
            dispute.contributor_evidence = current + evidence_list
        elif actor_role == "creator":
            if str(dispute.creator_id) != actor_id:
                return None, "Not authorized to submit evidence for this dispute"
            current = dispute.creator_evidence or []
            dispute.creator_evidence = current + evidence_list
        else:
            return None, "Invalid actor role"

        # Update state to EVIDENCE if still OPENED
        if dispute.state == DisputeState.OPENED.value:
            old_state = dispute.state
            dispute.state = DisputeState.EVIDENCE.value

            # Create history entry
            history = DisputeHistoryDB(
                dispute_id=dispute.id,
                action="evidence_submitted",
                previous_state=old_state,
                new_state=DisputeState.EVIDENCE.value,
                actor_id=UUID(actor_id),
                actor_role=actor_role,
                notes=f"Evidence submitted by {actor_role}",
            )
            self.session.add(history)

        dispute.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(dispute)

        return DisputeResponse.model_validate(dispute), None

    async def transition_to_mediation(
        self,
        dispute_id: str,
        actor_id: str,
    ) -> Tuple[Optional[DisputeResponse], Optional[str]]:
        """Transition dispute to mediation state and trigger AI review."""
        result = await self.session.execute(
            select(DisputeDB).where(DisputeDB.id == UUID(dispute_id))
        )
        dispute = result.scalar_one_or_none()

        if not dispute:
            return None, "Dispute not found"

        if dispute.state == DisputeState.RESOLVED.value:
            return None, "Dispute already resolved"

        old_state = dispute.state
        dispute.state = DisputeState.MEDIATION.value
        dispute.updated_at = datetime.now(timezone.utc)

        # Create history entry
        history = DisputeHistoryDB(
            dispute_id=dispute.id,
            action="mediation_started",
            previous_state=old_state,
            new_state=DisputeState.MEDIATION.value,
            actor_id=UUID(actor_id),
            actor_role="system",
            notes="Dispute moved to mediation",
        )
        self.session.add(history)

        await self.session.commit()

        # Trigger AI mediation
        ai_result = await self._run_ai_mediation(dispute)

        if ai_result and ai_result.get("score", 0) >= AI_RESOLUTION_THRESHOLD:
            # Auto-resolve in contributor's favor
            await self._auto_resolve_contributor(dispute, ai_result)

        await self.session.refresh(dispute)

        # Send Telegram notification if not auto-resolved
        if dispute.state == DisputeState.MEDIATION.value:
            await self._send_telegram_notification(dispute)

        return DisputeResponse.model_validate(dispute), None

    async def _run_ai_mediation(self, dispute: DisputeDB) -> Optional[Dict[str, Any]]:
        """Run AI review on the dispute.

        This uses a simple scoring algorithm based on:
        - Evidence quality and quantity
        - Reason for dispute
        - Historical patterns
        """
        try:
            # Calculate evidence scores
            contrib_evidence_count = len(dispute.contributor_evidence or [])
            creator_evidence_count = len(dispute.creator_evidence or [])

            # Base score starts at 5.0 (neutral)
            score = 5.0

            # Contributor evidence adds to score
            score += min(contrib_evidence_count * 0.5, 2.0)

            # Creator evidence reduces score (defending position)
            score -= min(creator_evidence_count * 0.3, 1.5)

            # Certain dispute reasons boost score
            reason_boosts = {
                DisputeReason.MET_REQUIREMENTS.value: 1.5,
                DisputeReason.INCORRECT_REVIEW.value: 1.0,
                DisputeReason.UNFAIR_REJECTION.value: 0.5,
            }
            score += reason_boosts.get(dispute.reason, 0)

            # Cap score at 10
            score = min(score, 10.0)

            # Generate AI review notes
            notes = self._generate_ai_notes(dispute, score)

            # Store AI results
            dispute.ai_review_score = score
            dispute.ai_review_notes = notes

            await self.session.commit()

            return {"score": score, "notes": notes}

        except Exception as e:
            logger.error(f"AI mediation failed: {e}")
            return None

    def _generate_ai_notes(self, dispute: DisputeDB, score: float) -> str:
        """Generate AI review notes based on the analysis."""
        contrib_count = len(dispute.contributor_evidence or [])
        creator_count = len(dispute.creator_evidence or [])

        notes = f"AI Mediation Analysis:\n\n"
        notes += f"Dispute Reason: {dispute.reason}\n"
        notes += f"Contributor Evidence Items: {contrib_count}\n"
        notes += f"Creator Evidence Items: {creator_count}\n\n"
        notes += f"AI Score: {score:.1f}/10.0\n\n"

        if score >= AI_RESOLUTION_THRESHOLD:
            notes += "RECOMMENDATION: Auto-resolve in contributor's favor. "
            notes += "Strong evidence suggests the rejection may have been unfair."
        else:
            notes += "RECOMMENDATION: Requires manual review. "
            notes += "Evidence is insufficient for automatic resolution."

        return notes

    async def _auto_resolve_contributor(
        self,
        dispute: DisputeDB,
        ai_result: Dict[str, Any],
    ) -> None:
        """Auto-resolve dispute in contributor's favor."""
        dispute.state = DisputeState.RESOLVED.value
        dispute.outcome = DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value
        dispute.auto_resolved = 1
        dispute.resolved_at = datetime.now(timezone.utc)

        # Record resolution
        history = DisputeHistoryDB(
            dispute_id=dispute.id,
            action="auto_resolved",
            previous_state=DisputeState.MEDIATION.value,
            new_state=DisputeState.RESOLVED.value,
            actor_id=dispute.contributor_id,
            actor_role="system",
            notes=f"Auto-resolved by AI (score: {ai_result['score']:.1f})",
            metadata={"ai_score": ai_result["score"]},
        )
        self.session.add(history)

        # Apply reputation penalty to creator for unfair rejection
        dispute.creator_reputation_penalty = 5.0

        await self.session.commit()

        logger.info(f"Dispute {dispute.id} auto-resolved for contributor")

    async def resolve_dispute(
        self,
        dispute_id: str,
        resolver_id: str,
        resolution: DisputeResolve,
    ) -> Tuple[Optional[DisputeResponse], Optional[str]]:
        """Manually resolve a dispute (admin action)."""
        result = await self.session.execute(
            select(DisputeDB).where(DisputeDB.id == UUID(dispute_id))
        )
        dispute = result.scalar_one_or_none()

        if not dispute:
            return None, "Dispute not found"

        if dispute.state == DisputeState.RESOLVED.value:
            return None, "Dispute already resolved"

        old_state = dispute.state
        dispute.state = DisputeState.RESOLVED.value
        dispute.outcome = resolution.outcome.value
        dispute.resolver_id = UUID(resolver_id)
        dispute.resolution_notes = resolution.resolution_notes
        dispute.resolved_at = datetime.now(timezone.utc)
        dispute.creator_reputation_penalty = resolution.creator_penalty or 0.0
        dispute.contributor_reputation_penalty = resolution.contributor_penalty or 0.0

        # Create history entry
        history = DisputeHistoryDB(
            dispute_id=dispute.id,
            action="dispute_resolved",
            previous_state=old_state,
            new_state=DisputeState.RESOLVED.value,
            actor_id=UUID(resolver_id),
            actor_role="admin",
            notes=f"Resolution: {resolution.outcome.value}",
            metadata={
                "outcome": resolution.outcome.value,
                "creator_penalty": resolution.creator_penalty,
                "contributor_penalty": resolution.contributor_penalty,
            },
        )
        self.session.add(history)

        await self.session.commit()
        await self.session.refresh(dispute)

        logger.info(f"Dispute {dispute.id} manually resolved by admin")

        return DisputeResponse.model_validate(dispute), None

    async def _send_telegram_notification(self, dispute: DisputeDB) -> None:
        """Send Telegram notification to admins about pending dispute."""
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        chat_id = os.getenv("TELEGRAM_ADMIN_CHAT_ID")

        if not bot_token or not chat_id:
            logger.warning("Telegram credentials not configured, skipping notification")
            return

        try:
            message = (
                f"⚖️ *New Dispute Requires Review*\n\n"
                f"Dispute ID: `{dispute.id}`\n"
                f"Bounty ID: `{dispute.bounty_id}`\n"
                f"Reason: {dispute.reason}\n\n"
                f"AI Score: {dispute.ai_review_score or 'N/A'}/10\n\n"
                f"[View Dispute](https://solfoundry.org/disputes/{dispute.id})"
            )

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": message,
                        "parse_mode": "Markdown",
                    },
                )
                response.raise_for_status()

            logger.info(f"Telegram notification sent for dispute {dispute.id}")

        except Exception as e:
            logger.error(f"Failed to send Telegram notification: {e}")

    async def get_stats(self) -> DisputeStats:
        """Get dispute statistics."""
        # Total counts
        total_result = await self.session.execute(
            select(DisputeDB.id)
        )
        total = len(total_result.all())

        # State counts
        opened_result = await self.session.execute(
            select(DisputeDB.id).where(DisputeDB.state == DisputeState.OPENED.value)
        )
        opened = len(opened_result.all())

        evidence_result = await self.session.execute(
            select(DisputeDB.id).where(DisputeDB.state == DisputeState.EVIDENCE.value)
        )
        evidence = len(evidence_result.all())

        mediation_result = await self.session.execute(
            select(DisputeDB.id).where(DisputeDB.state == DisputeState.MEDIATION.value)
        )
        mediation = len(mediation_result.all())

        resolved_result = await self.session.execute(
            select(DisputeDB.id).where(DisputeDB.state == DisputeState.RESOLVED.value)
        )
        resolved = len(resolved_result.all())

        # Outcome counts
        contributor_wins = await self.session.execute(
            select(DisputeDB.id).where(
                DisputeDB.outcome == DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value
            )
        )
        contributor_wins_count = len(contributor_wins.all())

        creator_wins = await self.session.execute(
            select(DisputeDB.id).where(
                DisputeDB.outcome == DisputeOutcome.REFUND_TO_CREATOR.value
            )
        )
        creator_wins_count = len(creator_wins.all())

        splits = await self.session.execute(
            select(DisputeDB.id).where(
                DisputeDB.outcome == DisputeOutcome.SPLIT.value
            )
        )
        splits_count = len(splits.all())

        # Auto vs manual resolution
        auto_resolved = await self.session.execute(
            select(DisputeDB.id).where(DisputeDB.auto_resolved == 1)
        )
        auto_count = len(auto_resolved.all())

        manual_count = resolved - auto_count

        # Average resolution time
        resolved_disputes = await self.session.execute(
            select(DisputeDB).where(
                and_(
                    DisputeDB.state == DisputeState.RESOLVED.value,
                    DisputeDB.resolved_at.isnot(None),
                    DisputeDB.created_at.isnot(None),
                )
            )
        )
        disputes = resolved_disputes.scalars().all()

        total_hours = 0.0
        if disputes:
            for d in disputes:
                if d.resolved_at and d.created_at:
                    delta = d.resolved_at - d.created_at
                    total_hours += delta.total_seconds() / 3600
            avg_hours = total_hours / len(disputes)
        else:
            avg_hours = 0.0

        return DisputeStats(
            total_disputes=total,
            opened_disputes=opened,
            evidence_disputes=evidence,
            mediation_disputes=mediation,
            resolved_disputes=resolved,
            contributor_wins=contributor_wins_count,
            creator_wins=creator_wins_count,
            splits=splits_count,
            auto_resolved_count=auto_count,
            manual_resolved_count=manual_count,
            avg_resolution_time_hours=round(avg_hours, 2),
        )

    async def check_expired_evidence(self) -> int:
        """Check and transition disputes past evidence deadline to mediation.

        Returns:
            Number of disputes transitioned.
        """
        now = datetime.now(timezone.utc)

        expired = await self.session.execute(
            select(DisputeDB).where(
                and_(
                    DisputeDB.state.in_([DisputeState.OPENED.value, DisputeState.EVIDENCE.value]),
                    DisputeDB.evidence_deadline < now,
                )
            )
        )
        disputes = expired.scalars().all()

        count = 0
        for dispute in disputes:
            await self.transition_to_mediation(str(dispute.id), str(dispute.contributor_id))
            count += 1

        return count