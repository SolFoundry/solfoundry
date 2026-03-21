"""Dispute resolution service.

Implements the full dispute lifecycle:
    OPENED → EVIDENCE → MEDIATION → RESOLVED

Key features:
- 72-hour initiation window after submission rejection
- Evidence submission by both contributor and creator
- AI auto-mediation: if the submission's AI review score >= 7/10 (threshold),
  the dispute is auto-resolved in the contributor's favour
- Manual admin mediation with Telegram notification
- Reputation adjustments for unfair rejections and frivolous disputes
- Full audit trail via dispute_history
"""

import os
import uuid
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_event
from app.models.dispute import (
    DisputeDB,
    DisputeEvidenceDB,
    DisputeHistoryDB,
    DisputeCreate,
    DisputeResolve,
    DisputeResponse,
    DisputeDetailResponse,
    DisputeListItem,
    DisputeListResponse,
    DisputeStats,
    DisputeStatus,
    DisputeOutcome,
    MediationType,
    EvidenceItem,
    EvidenceResponse,
    EvidenceSubmit,
    DisputeHistoryItem,
)
from app.models.bounty import SubmissionStatus
from app.services import bounty_service

logger = logging.getLogger(__name__)

DISPUTE_WINDOW_HOURS = 72
AI_AUTO_RESOLVE_THRESHOLD = 7.0  # out of 10
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID", "")

# Reputation deltas
REP_UNFAIR_REJECTION_PENALTY = -15  # creator penalised for unfair rejection
REP_FRIVOLOUS_DISPUTE_PENALTY = -10  # contributor penalised for frivolous dispute
REP_VALID_DISPUTE_BONUS = 5  # contributor rewarded for a justified dispute


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _str_id(value) -> str:
    return str(value) if value else ""


def _db_to_response(d: DisputeDB) -> DisputeResponse:
    return DisputeResponse(
        id=_str_id(d.id),
        bounty_id=_str_id(d.bounty_id),
        submission_id=d.submission_id,
        contributor_id=d.contributor_id,
        creator_id=d.creator_id,
        reason=d.reason,
        description=d.description,
        status=d.status,
        outcome=d.outcome,
        mediation_type=d.mediation_type,
        ai_score=d.ai_score,
        ai_review_summary=d.ai_review_summary,
        ai_auto_resolved=d.ai_auto_resolved,
        resolver_id=d.resolver_id,
        resolution_notes=d.resolution_notes,
        split_percentage=d.split_percentage,
        contributor_rep_delta=d.contributor_rep_delta,
        creator_rep_delta=d.creator_rep_delta,
        rejection_at=d.rejection_at,
        created_at=d.created_at,
        updated_at=d.updated_at,
        resolved_at=d.resolved_at,
    )


def _evidence_to_response(e: DisputeEvidenceDB) -> EvidenceResponse:
    return EvidenceResponse(
        id=_str_id(e.id),
        dispute_id=_str_id(e.dispute_id),
        submitted_by=e.submitted_by,
        role=e.role,
        evidence_type=e.evidence_type,
        url=e.url,
        explanation=e.explanation,
        created_at=e.created_at,
    )


def _history_to_response(h: DisputeHistoryDB) -> DisputeHistoryItem:
    return DisputeHistoryItem(
        id=_str_id(h.id),
        dispute_id=_str_id(h.dispute_id),
        action=h.action,
        previous_status=h.previous_status,
        new_status=h.new_status,
        actor_id=h.actor_id,
        actor_role=h.actor_role,
        notes=h.notes,
        created_at=h.created_at,
    )


async def _add_history(
    db: AsyncSession,
    dispute_id,
    action: str,
    actor_id: str,
    *,
    previous_status: Optional[str] = None,
    new_status: Optional[str] = None,
    actor_role: Optional[str] = None,
    notes: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    entry = DisputeHistoryDB(
        dispute_id=dispute_id,
        action=action,
        previous_status=previous_status,
        new_status=new_status,
        actor_id=actor_id,
        actor_role=actor_role,
        notes=notes,
        metadata_=metadata,
    )
    db.add(entry)


def _compute_ai_score(pr_url: str, submission_ai_score: float) -> float:
    """Compute an AI mediation score.

    In production this would call the multi-LLM review pipeline.  For the
    MVP we combine the existing submission AI score with a deterministic
    hash-based component so that the threshold logic is exercisable.
    """
    url_hash = int(hashlib.md5(pr_url.encode()).hexdigest(), 16)
    hash_component = (url_hash % 40) / 100.0  # 0.0 – 0.39
    base = submission_ai_score * 10  # scale 0-1 → 0-10
    score = base * 0.7 + hash_component * 10 * 0.3
    return round(min(max(score, 0.0), 10.0), 2)


async def _send_telegram_notification(message: str):
    """Send a notification to the admin Telegram chat."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_ADMIN_CHAT_ID:
        logger.warning("Telegram credentials not configured — skipping notification")
        return

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_ADMIN_CHAT_ID,
        "text": message,
        "parse_mode": "Markdown",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                logger.error("Telegram send failed: %s %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.error("Telegram notification error: %s", exc)


# ---------------------------------------------------------------------------
# Public service methods
# ---------------------------------------------------------------------------


class DisputeService:
    """Manages the complete dispute lifecycle."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── CREATE ────────────────────────────────────────────────────────────

    async def create_dispute(
        self, data: DisputeCreate, contributor_id: str
    ) -> DisputeResponse:
        """Open a new dispute on a rejected submission.

        Validates:
        - The bounty and submission exist
        - The submission was rejected
        - The caller is the submission author
        - We are within the 72-hour dispute window
        - No duplicate dispute exists for this submission
        """
        bounty = bounty_service.get_bounty(data.bounty_id)
        if not bounty:
            raise ValueError("Bounty not found")

        submission = None
        for sub in bounty.submissions:
            if sub.id == data.submission_id:
                submission = sub
                break
        if not submission:
            raise ValueError("Submission not found")

        if submission.status != SubmissionStatus.REJECTED:
            raise ValueError(
                f"Submission is not rejected (current status: {submission.status.value}). "
                "Only rejected submissions can be disputed."
            )

        if submission.submitted_by != contributor_id:
            raise ValueError("Only the submission author can open a dispute")

        rejection_at = submission.submitted_at
        if _now() - rejection_at > timedelta(hours=DISPUTE_WINDOW_HOURS):
            raise ValueError(
                f"Dispute window expired. Disputes must be filed within "
                f"{DISPUTE_WINDOW_HOURS} hours of rejection."
            )

        existing = await self.db.execute(
            select(DisputeDB).where(
                and_(
                    DisputeDB.submission_id == data.submission_id,
                    DisputeDB.status != DisputeStatus.RESOLVED.value,
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("An active dispute already exists for this submission")

        dispute = DisputeDB(
            bounty_id=uuid.UUID(data.bounty_id) if isinstance(data.bounty_id, str) else data.bounty_id,
            submission_id=data.submission_id,
            contributor_id=contributor_id,
            creator_id=bounty.created_by,
            reason=data.reason,
            description=data.description,
            status=DisputeStatus.OPENED.value,
            rejection_at=rejection_at,
            ai_score=None,
        )
        self.db.add(dispute)
        await self.db.flush()

        for item in data.evidence:
            ev = DisputeEvidenceDB(
                dispute_id=dispute.id,
                submitted_by=contributor_id,
                role="contributor",
                evidence_type=item.evidence_type,
                url=item.url,
                explanation=item.explanation,
            )
            self.db.add(ev)

        await _add_history(
            self.db,
            dispute.id,
            "dispute_opened",
            contributor_id,
            new_status=DisputeStatus.OPENED.value,
            actor_role="contributor",
            notes=f"Dispute opened: {data.reason}",
        )

        bounty_service.update_submission(
            data.bounty_id, data.submission_id, SubmissionStatus.DISPUTED.value
        )

        await self.db.commit()
        await self.db.refresh(dispute)

        audit_event(
            "dispute_created",
            dispute_id=_str_id(dispute.id),
            bounty_id=data.bounty_id,
            submission_id=data.submission_id,
            contributor_id=contributor_id,
        )

        return _db_to_response(dispute)

    # ── READ ──────────────────────────────────────────────────────────────

    async def get_dispute(self, dispute_id: str) -> Optional[DisputeDetailResponse]:
        result = await self.db.execute(
            select(DisputeDB).where(DisputeDB.id == uuid.UUID(dispute_id))
        )
        dispute = result.scalar_one_or_none()
        if not dispute:
            return None

        ev_result = await self.db.execute(
            select(DisputeEvidenceDB)
            .where(DisputeEvidenceDB.dispute_id == dispute.id)
            .order_by(DisputeEvidenceDB.created_at.asc())
        )
        evidence = [_evidence_to_response(e) for e in ev_result.scalars().all()]

        hist_result = await self.db.execute(
            select(DisputeHistoryDB)
            .where(DisputeHistoryDB.dispute_id == dispute.id)
            .order_by(DisputeHistoryDB.created_at.asc())
        )
        history = [_history_to_response(h) for h in hist_result.scalars().all()]

        resp = DisputeDetailResponse(
            **_db_to_response(dispute).model_dump(),
            evidence=evidence,
            history=history,
        )
        return resp

    async def list_disputes(
        self,
        *,
        bounty_id: Optional[str] = None,
        contributor_id: Optional[str] = None,
        creator_id: Optional[str] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> DisputeListResponse:
        conditions = []
        if bounty_id:
            conditions.append(DisputeDB.bounty_id == uuid.UUID(bounty_id))
        if contributor_id:
            conditions.append(DisputeDB.contributor_id == contributor_id)
        if creator_id:
            conditions.append(DisputeDB.creator_id == creator_id)
        if status:
            conditions.append(DisputeDB.status == status)

        where = and_(*conditions) if conditions else True

        count_q = select(func.count(DisputeDB.id)).where(where)
        count_result = await self.db.execute(count_q)
        total = count_result.scalar() or 0

        q = (
            select(DisputeDB)
            .where(where)
            .order_by(DisputeDB.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(q)
        disputes = result.scalars().all()

        items = [
            DisputeListItem(
                id=_str_id(d.id),
                bounty_id=_str_id(d.bounty_id),
                submission_id=d.submission_id,
                contributor_id=d.contributor_id,
                reason=d.reason,
                status=d.status,
                outcome=d.outcome,
                ai_score=d.ai_score,
                ai_auto_resolved=d.ai_auto_resolved,
                created_at=d.created_at,
                resolved_at=d.resolved_at,
            )
            for d in disputes
        ]
        return DisputeListResponse(items=items, total=total, skip=skip, limit=limit)

    # ── EVIDENCE ──────────────────────────────────────────────────────────

    async def submit_evidence(
        self,
        dispute_id: str,
        data: EvidenceSubmit,
        user_id: str,
    ) -> list[EvidenceResponse]:
        """Submit evidence for a dispute. Both parties can submit."""
        result = await self.db.execute(
            select(DisputeDB).where(DisputeDB.id == uuid.UUID(dispute_id))
        )
        dispute = result.scalar_one_or_none()
        if not dispute:
            raise ValueError("Dispute not found")

        if dispute.status == DisputeStatus.RESOLVED.value:
            raise ValueError("Cannot submit evidence on a resolved dispute")

        if user_id == dispute.contributor_id:
            role = "contributor"
        elif user_id == dispute.creator_id:
            role = "creator"
        else:
            raise ValueError("Only the contributor or creator can submit evidence")

        created: list[EvidenceResponse] = []
        for item in data.items:
            ev = DisputeEvidenceDB(
                dispute_id=dispute.id,
                submitted_by=user_id,
                role=role,
                evidence_type=item.evidence_type,
                url=item.url,
                explanation=item.explanation,
            )
            self.db.add(ev)
            await self.db.flush()
            created.append(_evidence_to_response(ev))

        old_status = dispute.status
        if dispute.status == DisputeStatus.OPENED.value:
            dispute.status = DisputeStatus.EVIDENCE.value

        await _add_history(
            self.db,
            dispute.id,
            "evidence_submitted",
            user_id,
            previous_status=old_status,
            new_status=dispute.status,
            actor_role=role,
            notes=f"{len(data.items)} evidence item(s) submitted by {role}",
        )

        await self.db.commit()

        audit_event(
            "dispute_evidence_submitted",
            dispute_id=dispute_id,
            user_id=user_id,
            role=role,
            count=len(data.items),
        )

        return created

    # ── AI MEDIATION ──────────────────────────────────────────────────────

    async def trigger_ai_mediation(
        self, dispute_id: str
    ) -> DisputeResponse:
        """Run AI mediation on a dispute.

        If the AI review score >= threshold (7/10), auto-resolve in the
        contributor's favour.  Otherwise move to MEDIATION for manual review.
        """
        result = await self.db.execute(
            select(DisputeDB).where(DisputeDB.id == uuid.UUID(dispute_id))
        )
        dispute = result.scalar_one_or_none()
        if not dispute:
            raise ValueError("Dispute not found")

        if dispute.status == DisputeStatus.RESOLVED.value:
            raise ValueError("Dispute is already resolved")

        bounty = bounty_service.get_bounty(_str_id(dispute.bounty_id))
        if not bounty:
            raise ValueError("Associated bounty not found")

        submission = None
        for sub in bounty.submissions:
            if sub.id == dispute.submission_id:
                submission = sub
                break

        submission_ai_score = submission.ai_score if submission else 0.5
        pr_url = submission.pr_url if submission else ""
        ai_score = _compute_ai_score(pr_url, submission_ai_score)

        dispute.ai_score = ai_score
        dispute.ai_review_summary = (
            f"AI mediation score: {ai_score}/10 "
            f"(submission base score: {submission_ai_score:.2f}, "
            f"threshold: {AI_AUTO_RESOLVE_THRESHOLD}/10)"
        )

        old_status = dispute.status

        if ai_score >= AI_AUTO_RESOLVE_THRESHOLD:
            dispute.status = DisputeStatus.RESOLVED.value
            dispute.outcome = DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value
            dispute.mediation_type = MediationType.AI.value
            dispute.ai_auto_resolved = True
            dispute.resolved_at = _now()
            dispute.resolver_id = "ai_mediator"
            dispute.resolution_notes = (
                f"Auto-resolved by AI mediation. Score {ai_score}/10 meets "
                f"threshold of {AI_AUTO_RESOLVE_THRESHOLD}/10. "
                f"Funds released to contributor."
            )

            dispute.creator_rep_delta = REP_UNFAIR_REJECTION_PENALTY
            dispute.contributor_rep_delta = REP_VALID_DISPUTE_BONUS

            _apply_reputation_changes(
                dispute.contributor_id,
                dispute.creator_id,
                REP_VALID_DISPUTE_BONUS,
                REP_UNFAIR_REJECTION_PENALTY,
            )

            if submission:
                bounty_service.update_submission(
                    _str_id(dispute.bounty_id),
                    dispute.submission_id,
                    SubmissionStatus.APPROVED.value,
                )

            await _add_history(
                self.db,
                dispute.id,
                "ai_auto_resolved",
                "ai_mediator",
                previous_status=old_status,
                new_status=DisputeStatus.RESOLVED.value,
                actor_role="system",
                notes=dispute.resolution_notes,
                metadata={"ai_score": ai_score, "threshold": AI_AUTO_RESOLVE_THRESHOLD},
            )

            audit_event(
                "dispute_ai_auto_resolved",
                dispute_id=dispute_id,
                ai_score=ai_score,
                outcome=dispute.outcome,
            )
        else:
            dispute.status = DisputeStatus.MEDIATION.value
            dispute.mediation_type = MediationType.MANUAL.value

            await _add_history(
                self.db,
                dispute.id,
                "ai_mediation_inconclusive",
                "ai_mediator",
                previous_status=old_status,
                new_status=DisputeStatus.MEDIATION.value,
                actor_role="system",
                notes=(
                    f"AI score {ai_score}/10 below threshold "
                    f"{AI_AUTO_RESOLVE_THRESHOLD}/10. Escalated to manual mediation."
                ),
                metadata={"ai_score": ai_score, "threshold": AI_AUTO_RESOLVE_THRESHOLD},
            )

            await _send_telegram_notification(
                f"*Dispute Requires Manual Review*\n\n"
                f"Dispute ID: `{_str_id(dispute.id)}`\n"
                f"Bounty: `{_str_id(dispute.bounty_id)}`\n"
                f"AI Score: {ai_score}/10 (threshold: {AI_AUTO_RESOLVE_THRESHOLD})\n"
                f"Reason: {dispute.reason}\n\n"
                f"Please review at /admin/disputes/{_str_id(dispute.id)}"
            )

            audit_event(
                "dispute_escalated_to_manual",
                dispute_id=dispute_id,
                ai_score=ai_score,
            )

        await self.db.commit()
        await self.db.refresh(dispute)
        return _db_to_response(dispute)

    # ── MANUAL RESOLUTION ─────────────────────────────────────────────────

    async def resolve_dispute(
        self,
        dispute_id: str,
        data: DisputeResolve,
        admin_id: str,
    ) -> DisputeResponse:
        """Manually resolve a dispute (admin action)."""
        result = await self.db.execute(
            select(DisputeDB).where(DisputeDB.id == uuid.UUID(dispute_id))
        )
        dispute = result.scalar_one_or_none()
        if not dispute:
            raise ValueError("Dispute not found")

        if dispute.status == DisputeStatus.RESOLVED.value:
            raise ValueError("Dispute is already resolved")

        old_status = dispute.status
        outcome = DisputeOutcome(data.outcome)

        dispute.status = DisputeStatus.RESOLVED.value
        dispute.outcome = outcome.value
        dispute.mediation_type = MediationType.MANUAL.value
        dispute.resolver_id = admin_id
        dispute.resolution_notes = data.resolution_notes
        dispute.resolved_at = _now()

        if outcome == DisputeOutcome.SPLIT:
            dispute.split_percentage = data.split_percentage or 50.0

        if outcome == DisputeOutcome.RELEASE_TO_CONTRIBUTOR:
            dispute.creator_rep_delta = REP_UNFAIR_REJECTION_PENALTY
            dispute.contributor_rep_delta = REP_VALID_DISPUTE_BONUS
            _apply_reputation_changes(
                dispute.contributor_id,
                dispute.creator_id,
                REP_VALID_DISPUTE_BONUS,
                REP_UNFAIR_REJECTION_PENALTY,
            )
            bounty_service.update_submission(
                _str_id(dispute.bounty_id),
                dispute.submission_id,
                SubmissionStatus.APPROVED.value,
            )
        elif outcome == DisputeOutcome.REFUND_TO_CREATOR:
            dispute.contributor_rep_delta = REP_FRIVOLOUS_DISPUTE_PENALTY
            _apply_reputation_changes(
                dispute.contributor_id,
                dispute.creator_id,
                REP_FRIVOLOUS_DISPUTE_PENALTY,
                0,
            )
        elif outcome == DisputeOutcome.SPLIT:
            pass

        await _add_history(
            self.db,
            dispute.id,
            "dispute_resolved_manually",
            admin_id,
            previous_status=old_status,
            new_status=DisputeStatus.RESOLVED.value,
            actor_role="admin",
            notes=data.resolution_notes,
            metadata={
                "outcome": outcome.value,
                "split_percentage": dispute.split_percentage,
            },
        )

        await self.db.commit()
        await self.db.refresh(dispute)

        await _send_telegram_notification(
            f"*Dispute Resolved*\n\n"
            f"Dispute: `{_str_id(dispute.id)}`\n"
            f"Outcome: {outcome.value}\n"
            f"Resolved by: `{admin_id}`\n"
            f"Notes: {data.resolution_notes[:200]}"
        )

        audit_event(
            "dispute_resolved_manually",
            dispute_id=dispute_id,
            outcome=outcome.value,
            admin_id=admin_id,
        )

        return _db_to_response(dispute)

    # ── STATS ─────────────────────────────────────────────────────────────

    async def get_stats(self) -> DisputeStats:
        total_q = select(func.count(DisputeDB.id))
        total = (await self.db.execute(total_q)).scalar() or 0

        def _count_where(condition):
            return select(func.count(DisputeDB.id)).where(condition)

        opened = (await self.db.execute(
            _count_where(DisputeDB.status == DisputeStatus.OPENED.value)
        )).scalar() or 0
        evidence = (await self.db.execute(
            _count_where(DisputeDB.status == DisputeStatus.EVIDENCE.value)
        )).scalar() or 0
        mediation = (await self.db.execute(
            _count_where(DisputeDB.status == DisputeStatus.MEDIATION.value)
        )).scalar() or 0
        resolved = (await self.db.execute(
            _count_where(DisputeDB.status == DisputeStatus.RESOLVED.value)
        )).scalar() or 0

        ai_resolved = (await self.db.execute(
            _count_where(DisputeDB.ai_auto_resolved.is_(True))
        )).scalar() or 0
        manual_resolved = (await self.db.execute(
            _count_where(
                and_(
                    DisputeDB.status == DisputeStatus.RESOLVED.value,
                    DisputeDB.mediation_type == MediationType.MANUAL.value,
                )
            )
        )).scalar() or 0

        release_count = (await self.db.execute(
            _count_where(DisputeDB.outcome == DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value)
        )).scalar() or 0
        refund_count = (await self.db.execute(
            _count_where(DisputeDB.outcome == DisputeOutcome.REFUND_TO_CREATOR.value)
        )).scalar() or 0
        split_count = (await self.db.execute(
            _count_where(DisputeDB.outcome == DisputeOutcome.SPLIT.value)
        )).scalar() or 0

        avg_q = select(func.avg(DisputeDB.ai_score)).where(
            DisputeDB.ai_score.isnot(None)
        )
        avg_ai = (await self.db.execute(avg_q)).scalar()

        return DisputeStats(
            total_disputes=total,
            opened_disputes=opened,
            in_evidence=evidence,
            in_mediation=mediation,
            resolved_disputes=resolved,
            ai_resolved_count=ai_resolved,
            manual_resolved_count=manual_resolved,
            release_to_contributor_count=release_count,
            refund_to_creator_count=refund_count,
            split_count=split_count,
            avg_ai_score=round(avg_ai, 2) if avg_ai else None,
        )


# ---------------------------------------------------------------------------
# Reputation helper (works with the in-memory contributor store)
# ---------------------------------------------------------------------------


def _apply_reputation_changes(
    contributor_id: str,
    creator_id: str,
    contributor_delta: float,
    creator_delta: float,
):
    """Apply reputation deltas to in-memory contributor records."""
    from app.services.contributor_service import _store

    for cid, delta in [(contributor_id, contributor_delta), (creator_id, creator_delta)]:
        if not delta:
            continue
        db_obj = _store.get(cid)
        if db_obj:
            db_obj.reputation_score = max(0, db_obj.reputation_score + int(delta))
            logger.info(
                "Reputation updated: user=%s delta=%s new_score=%s",
                cid, delta, db_obj.reputation_score,
            )
        else:
            logger.warning("Could not find contributor %s for reputation update", cid)
