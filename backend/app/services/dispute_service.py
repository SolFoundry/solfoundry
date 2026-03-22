import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_factory
from app.models.dispute import (
    DisputeDB, DisputeStatus, DisputeResolution, DisputeCreate,
    DisputeResolve, DisputeHistoryDB, EvidenceItem, DisputeDetailResponse,
    DisputeHistoryItem
)
from app.models.bounty import BountyStatus, SubmissionStatus
from app.services import bounty_service, contributor_service, reputation_service, notification_service

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DISPUTE_WINDOW_HOURS = 72
AI_AUTO_RESOLVE_THRESHOLD = 7.0

# ---------------------------------------------------------------------------
# Dispute Service
# ---------------------------------------------------------------------------

async def initiate_dispute(
    data: DisputeCreate,
    contributor_id: str,
    session: Optional[AsyncSession] = None
) -> Tuple[Optional[DisputeDB], Optional[str]]:
    """Initiates a new dispute for a rejected submission."""
    async def _run(db_session: AsyncSession) -> Tuple[Optional[DisputeDB], Optional[str]]:
        # 1. Fetch Bounty and Submission
        bounty = await bounty_service.get_bounty(data.bounty_id)
        if not bounty:
            return None, "Bounty not found"
        
        # Find submission
        submission = next((s for s in bounty.submissions if s.id == data.submission_id), None)
        if not submission:
            return None, "Submission not found"
        
        # 2. Access control and state validation
        if submission.submitted_by != contributor_id:
            return None, "Only the submitter can initiate a dispute"
        
        if submission.status != SubmissionStatus.REJECTED:
             return None, f"Submission must be REJECTED to dispute (current: {submission.status.value})"

        # 3. Create Dispute
        dispute = DisputeDB(
            bounty_id=uuid.UUID(data.bounty_id),
            submission_id=data.submission_id,
            contributor_id=contributor_id,
            creator_id=bounty.created_by,
            reason=data.reason.value,
            description=data.description,
            status=DisputeStatus.OPENED.value,
            ai_score=submission.ai_score,
            evidence=[]
        )
        db_session.add(dispute)
        await db_session.flush()

        # 4. Log history
        history = DisputeHistoryDB(
            dispute_id=dispute.id,
            action="initiate",
            new_status=DisputeStatus.OPENED.value,
            actor_id=contributor_id,
            notes=f"Dispute opened for reason: {data.reason.value}"
        )
        db_session.add(history)

        # 5. AI Auto-mediation check
        if dispute.ai_score >= AI_AUTO_RESOLVE_THRESHOLD:
            logger.info(f"Dispute {dispute.id} qualifies for AI auto-resolution (Score: {dispute.ai_score})")
            await resolve_dispute(
                str(dispute.id),
                DisputeResolve(
                    resolution=DisputeResolution.PAYOUT,
                    resolution_notes=f"AI auto-resolution: submission score {dispute.ai_score} exceeds threshold {AI_AUTO_RESOLVE_THRESHOLD}."
                ),
                resolved_by="system",
                session=db_session
            )
            await db_session.refresh(dispute)
        else:
            _notify_creator_of_dispute(dispute)
            
        return dispute, None

    if session:
        return await _run(session)
    async with async_session_factory() as auto_session:
        res = await _run(auto_session)
        await auto_session.commit()
        return res

async def get_dispute_detail(dispute_id: str) -> Optional[DisputeDetailResponse]:
    """Retrieve full dispute details with history audit trail."""
    async with async_session_factory() as session:
        uid = uuid.UUID(dispute_id)
        
        # Fetch Dispute
        result = await session.execute(
            select(DisputeDB).where(DisputeDB.id == uid)
        )
        dispute = result.scalar_one_or_none()
        if not dispute:
            return None
        
        # Fetch History
        hist_result = await session.execute(
            select(DisputeHistoryDB)
            .where(DisputeHistoryDB.dispute_id == uid)
            .order_by(DisputeHistoryDB.created_at.desc())
        )
        history = hist_result.scalars().all()
        
        # Map to Pydantic
        res = DisputeDetailResponse.model_validate(dispute)
        res.history = history
        return res

async def get_dispute(dispute_id: str) -> Optional[DisputeDB]:
    """Retrieve raw dispute by ID."""
    async with async_session_factory() as session:
        uid = uuid.UUID(dispute_id)
        result = await session.execute(
            select(DisputeDB).where(DisputeDB.id == uid)
        )
        return result.scalar_one_or_none()

async def submit_evidence(
    dispute_id: str,
    actor_id: str,
    evidence_type: str,
    content: str,
    session: Optional[AsyncSession] = None
) -> Tuple[bool, Optional[str]]:
    """Adds evidence and moves to EVIDENCE state."""
    async def _run(db_session: AsyncSession) -> Tuple[bool, Optional[str]]:
        uid = uuid.UUID(dispute_id)
        result = await db_session.execute(select(DisputeDB).where(DisputeDB.id == uid))
        dispute = result.scalar_one_or_none()
        if not dispute:
            return False, "Dispute not found"
        
        if dispute.status == DisputeStatus.RESOLVED.value:
            return False, "Cannot add evidence to a resolved dispute"

        # Append evidence
        new_evidence = dispute.evidence.copy()
        new_evidence.append({
            "type": evidence_type,
            "content": content,
            "actor_id": actor_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        dispute.evidence = new_evidence
        
        prev_status = dispute.status
        if dispute.status == DisputeStatus.OPENED.value:
            dispute.status = DisputeStatus.EVIDENCE.value
        
        # History
        history = DisputeHistoryDB(
            dispute_id=dispute.id,
            action="submit_evidence",
            previous_status=prev_status,
            new_status=dispute.status,
            actor_id=actor_id,
            notes=f"Evidence submitted by {actor_id}"
        )
        db_session.add(history)
        return True, None

    if session:
        return await _run(session)
    async with async_session_factory() as auto_session:
        res = await _run(auto_session)
        await auto_session.commit()
        return res

async def resolve_dispute(
    dispute_id: str,
    data: DisputeResolve,
    resolved_by: str,
    session: Optional[AsyncSession] = None
) -> Tuple[bool, Optional[str]]:
    """Resolves a dispute and updates reputation."""
    async def _run(db_session: AsyncSession) -> Tuple[bool, Optional[str]]:
        uid = uuid.UUID(dispute_id)
        result = await db_session.execute(select(DisputeDB).where(DisputeDB.id == uid))
        dispute = result.scalar_one_or_none()
        if not dispute:
            return False, "Dispute not found"
        
        if dispute.status == DisputeStatus.RESOLVED.value:
            return False, "Dispute is already resolved"

        prev_status = dispute.status
        dispute.status = DisputeStatus.RESOLVED.value
        dispute.resolution = data.resolution.value
        dispute.resolved_by = resolved_by
        dispute.resolution_notes = data.resolution_notes
        dispute.resolved_at = datetime.now(timezone.utc)
        
        if data.resolution == DisputeResolution.SPLIT:
            dispute.contributor_share = data.contributor_share
            dispute.creator_share = data.creator_share

        # Execution
        if data.resolution == DisputeResolution.PAYOUT:
            # Reapprove submission
            await bounty_service.update_submission(
                str(dispute.bounty_id), dispute.submission_id, SubmissionStatus.APPROVED.value
            )
            # Penalize Creator for unfair rejection
            if resolved_by != "system":
                 await reputation_service.record_reputation_penalty(dispute.creator_id, amount=5.0, reason="Unfair rejection (Dispute RESOLVED in favor of contributor)")
        
        elif data.resolution == DisputeResolution.REFUND:
            # Penalize Contributor for frivolous dispute
            if resolved_by != "system":
                await reputation_service.record_reputation_penalty(dispute.contributor_id, amount=2.0, reason="Frivolous dispute (RESOLVED in favor of creator)")

        # Audit
        history = DisputeHistoryDB(
            dispute_id=dispute.id,
            action="resolve",
            previous_status=prev_status,
            new_status=DisputeStatus.RESOLVED.value,
            actor_id=resolved_by,
            notes=f"Dispute resolved as {data.resolution.value}."
        )
        db_session.add(history)
        _notify_parties_of_resolution(dispute)
        return True, None

    if session:
        return await _run(session)
    async with async_session_factory() as auto_session:
        res = await _run(auto_session)
        await auto_session.commit()
        return res

def _notify_creator_of_dispute(dispute: DisputeDB):
    logger.info(f"[DISPUTE] ID: {dispute.id} OPENED. Notify Creator: {dispute.creator_id}")

def _notify_parties_of_resolution(dispute: DisputeDB):
    logger.info(f"[DISPUTE] ID: {dispute.id} RESOLVED as {dispute.resolution}")
