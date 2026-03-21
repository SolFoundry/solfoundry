"""Dispute Resolution Service."""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import HTTPException, status

from app.models.dispute import (
    DisputeDB,
    DisputeHistoryDB,
    DisputeStatus,
    DisputeOutcome,
    DisputeCreate,
    EvidenceItem,
    DisputeResolve,
    DisputeResponse,
    DisputeDetailResponse,
    DisputeHistoryItem,
)
from app.models.submission import SubmissionStatus, SubmissionDB
from app.models.bounty import BountyStatus
from app.models.bounty_table import BountyTable
from app.models.user import User, UserRole
from app.models.payout import PayoutCreate
from app.services import review_service, payout_service
from app.services.notification_service import TelegramNotifier

logger = logging.getLogger(__name__)

class DisputeError(Exception):
    """Custom exception for dispute-related errors."""
    pass

class DisputeService:
    """Service handling the lifecycle of disputes using PostgreSQL persistence."""

    async def _check_authorization(self, db: AsyncSession, dispute: DisputeDB, actor_id: str):
        """
        Verify if the actor has permission to interact with this dispute.
        Allowed: Submitter, Bounty Creator, or Admin.
        """
        actor_uuid = UUID(actor_id)
        
        # 1. Is Submitter?
        if dispute.submitter_id == actor_uuid:
            return True
            
        # 2. Is Bounty Creator?
        stmt = select(BountyTable).where(BountyTable.id == dispute.bounty_id)
        res = await db.execute(stmt)
        bounty = res.scalar_one_or_none()
        if bounty and bounty.created_by == actor_id:
            return True
            
        # 3. Is Admin?
        user_stmt = select(User).where(User.id == actor_uuid)
        u_res = await db.execute(user_stmt)
        user = u_res.scalar_one_or_none()
        if user and user.role == UserRole.ADMIN.value:
            return True
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this dispute."
        )

    async def _update_user_reputation(self, db: AsyncSession, user_id: UUID, amount: float, role: str = "contributor"):
        """Apply reputation changes directly to the persistent User table."""
        if role == "creator":
            stmt = update(User).where(User.id == user_id).values(
                creator_reputation_score=User.creator_reputation_score + amount
            )
        else:
            stmt = update(User).where(User.id == user_id).values(
                reputation_score=User.reputation_score + amount
            )
        await db.execute(stmt)

    async def _create_history(
        self,
        db: AsyncSession,
        dispute_id: UUID,
        action: str,
        actor_id: str,
        previous_status: Optional[str] = None,
        new_status: Optional[str] = None,
        notes: Optional[str] = None
    ):
        """Internal helper to create an audit record for a dispute."""
        history = DisputeHistoryDB(
            dispute_id=dispute_id,
            action=action,
            actor_id=actor_id,
            previous_status=previous_status,
            new_status=new_status,
            notes=notes
        )
        db.add(history)

    async def create_dispute(self, db: AsyncSession, data: DisputeCreate, submitter_id: str) -> DisputeResponse:
        """Initiate a dispute for a rejected bounty submission."""
        submitter_id_uuid = UUID(submitter_id)
        bounty_id_uuid = UUID(data.bounty_id)
        
        # 1. Fetch the submission and verify business rules
        stmt = (
            select(SubmissionDB, BountyTable)
            .join(BountyTable, BountyTable.id == SubmissionDB.bounty_id)
            .where(SubmissionDB.bounty_id == bounty_id_uuid)
            .where(SubmissionDB.contributor_id == submitter_id_uuid)
        )
        result = await db.execute(stmt)
        row = result.first()
        
        if not row:
            raise DisputeError("No submission found for this bounty and contributor.")
        
        sub, bounty = row
        
        if sub.status != SubmissionStatus.REJECTED.value:
            raise DisputeError(f"Only rejected submissions can be disputed. Current status: {sub.status}")
            
        # 2. Enforce 72-hour filing window using reviewed_at
        rejection_time = sub.reviewed_at or sub.updated_at
        if rejection_time:
             if rejection_time.tzinfo is None:
                 rejection_time = rejection_time.replace(tzinfo=timezone.utc)
             
             if (datetime.now(timezone.utc) - rejection_time) > timedelta(hours=72):
                 raise DisputeError("Dispute window expired. Must be filed within 72 hours of rejection.")

        # 3. Create the dispute record
        dispute = DisputeDB(
            bounty_id=bounty.id,
            submitter_id=submitter_id_uuid,
            reason=data.reason,
            description=data.description,
            evidence_links=[e.model_dump() for e in data.evidence_links] if data.evidence_links else [],
            status=DisputeStatus.OPENED.value
        )
        db.add(dispute)
        await db.flush()
        
        # Update submission status
        sub.status = SubmissionStatus.DISPUTED.value
        
        await self._create_history(
            db, dispute.id, "DISPUTE_OPENED", submitter_id, None, DisputeStatus.OPENED.value, "Dispute created"
        )
        
        await db.commit()
        await db.refresh(dispute)
        
        # 4. Trigger AI mediation
        return await self._run_ai_mediation(db, dispute)

    async def get_dispute(self, db: AsyncSession, dispute_id: str, actor_id: str) -> DisputeDetailResponse:
        """Retrieve full dispute details with authorization check."""
        stmt = select(DisputeDB).where(DisputeDB.id == UUID(dispute_id))
        result = await db.execute(stmt)
        dispute = result.scalar_one_or_none()
        if not dispute:
            raise DisputeError("Dispute not found.")
            
        await self._check_authorization(db, dispute, actor_id)
            
        history_stmt = (
            select(DisputeHistoryDB)
            .where(DisputeHistoryDB.dispute_id == dispute.id)
            .order_by(DisputeHistoryDB.created_at)
        )
        history_res = await db.execute(history_stmt)
        histories = history_res.scalars().all()
        
        resp = DisputeDetailResponse.model_validate(dispute)
        resp.history = [DisputeHistoryItem.model_validate(h) for h in histories]
        return resp

    async def add_evidence(self, db: AsyncSession, dispute_id: str, evidence: List[EvidenceItem], actor_id: str) -> DisputeResponse:
        """Append evidence with strict participant-only access."""
        dispute_uuid = UUID(dispute_id)
        stmt = select(DisputeDB).where(DisputeDB.id == dispute_uuid)
        result = await db.execute(stmt)
        dispute = result.scalar_one_or_none()
        
        if not dispute:
            raise DisputeError("Dispute not found.")
            
        await self._check_authorization(db, dispute, actor_id)
            
        if dispute.status == DisputeStatus.RESOLVED.value:
            raise DisputeError("Cannot add evidence to a resolved dispute.")
            
        # Merge new evidence
        new_links = list(dispute.evidence_links) + [e.model_dump() for e in evidence]
        dispute.evidence_links = new_links
        
        prev_status = dispute.status
        if dispute.status == DisputeStatus.OPENED.value:
            dispute.status = DisputeStatus.EVIDENCE.value
            
        await self._create_history(
            db, dispute.id, "EVIDENCE_ADDED", actor_id, prev_status, dispute.status, f"Added {len(evidence)} items"
        )
        await db.commit()
        await db.refresh(dispute)
        
        return DisputeResponse.model_validate(dispute)

    async def _run_ai_mediation(self, db: AsyncSession, dispute: DisputeDB) -> DisputeResponse:
        """Attempt auto-resolution via AI review scores with transactional safety."""
        try:
            # Create a savepoint for AI resolution attempts
            async with db.begin_nested():
                sub_stmt = select(SubmissionDB).where(
                    SubmissionDB.bounty_id == dispute.bounty_id,
                    SubmissionDB.contributor_id == dispute.submitter_id
                )
                sub_res = await db.execute(sub_stmt)
                sub = sub_res.scalar_one_or_none()
                
                if not sub:
                    return DisputeResponse.model_validate(dispute)

                from app.models.review import AI_REVIEW_SCORE_THRESHOLD
                score_data = review_service.get_aggregated_score(str(sub.id), str(dispute.bounty_id))
                
                if score_data and score_data.overall_score >= AI_REVIEW_SCORE_THRESHOLD:
                    return await self.resolve_dispute(
                        db,
                        dispute.id,
                        DisputeResolve(
                            outcome=DisputeOutcome.RELEASE_TO_CONTRIBUTOR,
                            review_notes=f"AI Auto-Resolve: Score {score_data.overall_score} meets threshold.",
                            resolution_action="SYSTEM_AUTO_RESOLVE"
                        ),
                        actor_id="00000000-0000-0000-0000-000000000001"
                    )
        except Exception as e:
            logger.warning(f"AI Mediation logic had an error, falling back to manual: {e}")
            # The nested transaction is automatically rolled back on exception exit
            
        # Fallback to manual mediation
        dispute.status = DisputeStatus.MEDIATION.value
        await self._create_history(
            db, dispute.id, "MEDIATION_REQUIRED", "00000000-0000-0000-0000-000000000001", DisputeStatus.OPENED.value, dispute.status, "Manual review needed"
        )
        await db.commit()
        
        # Real Notification Call
        await TelegramNotifier.send_alert(
            f"⚖️ *New Dispute in Remediation*\nID: `{dispute.id}`\nBounty: `{dispute.bounty_id}`\nReason: {dispute.reason}"
        )
        
        await db.refresh(dispute)
        return DisputeResponse.model_validate(dispute)

    async def resolve_dispute(self, db: AsyncSession, dispute_id: UUID, resolve_data: DisputeResolve, actor_id: str) -> DisputeResponse:
        """Resolve dispute, apply mandatory reputation impacts, and record payouts."""
        stmt = select(DisputeDB).where(DisputeDB.id == dispute_id)
        result = await db.execute(stmt)
        dispute = result.scalar_one_or_none()
        
        if not dispute or dispute.status == DisputeStatus.RESOLVED.value:
            raise DisputeError("Dispute not found or already resolved.")
            
        # Fetch bounty and submission for metadata/reputation/payouts
        b_stmt = select(BountyTable).where(BountyTable.id == dispute.bounty_id)
        b_res = await db.execute(b_stmt)
        bounty = b_res.scalar_one()
        
        sub_stmt = select(SubmissionDB).where(
            SubmissionDB.bounty_id == dispute.bounty_id,
            SubmissionDB.contributor_id == dispute.submitter_id
        ).order_by(SubmissionDB.created_at.desc())
        sub_res = await db.execute(sub_stmt)
        sub = sub_res.scalars().first()

        if not sub:
            raise DisputeError("Matching submission for dispute not found.")

        prev_status = dispute.status
        dispute.status = DisputeStatus.RESOLVED.value
        dispute.outcome = resolve_data.outcome
        dispute.reviewer_id = UUID(actor_id)
        dispute.review_notes = resolve_data.review_notes
        dispute.resolution_action = resolve_data.resolution_action
        dispute.resolved_at = datetime.now(timezone.utc)
        
        payout_amount = 0.0
        
        # 1. IMPACT & STATUS LOGIC
        if resolve_data.outcome == DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value:
            sub.status = SubmissionStatus.APPROVED.value
            bounty.status = BountyStatus.COMPLETED.value
            payout_amount = bounty.reward_amount
            
            # Reputation: Penalty Creator (-50), Bonus Contributor (+25)
            creator_id_str = bounty.created_by
            if creator_id_str:
                try:
                    creator_uuid = UUID(creator_id_str)
                    await self._update_user_reputation(db, creator_uuid, -50.0, role="creator")
                except ValueError:
                    pass
            await self._update_user_reputation(db, dispute.submitter_id, 25.0, role="contributor")
            
        elif resolve_data.outcome == DisputeOutcome.REFUND_TO_CREATOR.value:
            sub.status = SubmissionStatus.REJECTED.value
            # Penalty Contributor (-20) for frivolous dispute
            await self._update_user_reputation(db, dispute.submitter_id, -20.0, role="contributor")
            
        elif resolve_data.outcome == DisputeOutcome.SPLIT.value:
            sub.status = SubmissionStatus.APPROVED.value
            split_pct = resolve_data.split_percent if resolve_data.split_percent is not None else 50.0
            payout_amount = (bounty.reward_amount * split_pct) / 100.0
            # No specific reputation impact defined for SPLIT in requirements
            
        # 2. Record Payout if amount > 0
        if payout_amount > 0:
            payout_service.create_payout(PayoutCreate(
                recipient=str(dispute.submitter_id),
                recipient_wallet=sub.contributor_wallet,
                amount=payout_amount,
                token="FNDRY", # Defaulting to FNDRY
                bounty_id=str(bounty.id),
                bounty_title=bounty.title
            ))
        
        await self._create_history(
            db, dispute.id, "DISPUTE_RESOLVED", actor_id, prev_status, dispute.status, f"Outcome: {resolve_data.outcome}. Payout: {payout_amount}"
        )
        
        await db.commit()
        await db.refresh(dispute)
        return DisputeResponse.model_validate(dispute)

dispute_service = DisputeService()
