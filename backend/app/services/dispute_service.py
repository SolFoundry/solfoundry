"""Dispute resolution service (Issue #192).

OPENED -> EVIDENCE -> MEDIATION -> RESOLVED. SQLAlchemy async, asyncio.Lock
on mutations, 72h window from REJECTION, admin-only resolve, AI mediation,
sanitized Telegram notifications.
"""
import asyncio, logging, os, re, uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
import httpx
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.exceptions import (
    BountyNotFoundError, DisputeNotFoundError, DisputeWindowExpiredError,
    DuplicateDisputeError, InvalidDisputeTransitionError,
    SubmissionNotFoundError, UnauthorizedDisputeAccessError,
)
from app.models.dispute import (
    DisputeCreate, DisputeDB, DisputeDetailResponse, DisputeEvidenceSubmit,
    DisputeHistoryDB, DisputeHistoryItem, DisputeListItem, DisputeListResponse,
    DisputeOutcome, DisputeResolve, DisputeResponse, DisputeStatus, validate_transition,
)

logger = logging.getLogger(__name__)
DISPUTE_WINDOW_HOURS = 72
AI_MEDIATION_THRESHOLD = 7.0
UNFAIR_REJECTION_PENALTY = -5.0
FRIVOLOUS_DISPUTE_PENALTY = -3.0
ADMIN_USER_IDS: frozenset[str] = frozenset(
    u.strip() for u in os.getenv("DISPUTE_ADMIN_USER_IDS", "").split(",") if u.strip())
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
_lock = asyncio.Lock()

def _sanitize_tg(text: str) -> str:
    """Sanitize text for Telegram MarkdownV2."""
    s = re.sub(r"[<>&]", "", text)
    for ch in r"_*[]()~`>#+-=|{}.!": s = s.replace(ch, f"\\{ch}")
    return s[:4000]

def _require_admin(uid: str) -> None:
    """Assert user is admin. Allows all if ADMIN_USER_IDS unconfigured."""
    if not ADMIN_USER_IDS:
        logger.warning("DISPUTE_ADMIN_USER_IDS not set; allowing %s", uid); return
    if uid not in ADMIN_USER_IDS:
        raise UnauthorizedDisputeAccessError(f"User '{uid}' not authorized to resolve disputes.")

def _tz(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime is UTC-aware."""
    return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt

def _rejection_ts(sub) -> datetime:
    """Get rejection timestamp from submission (reviewed_at > updated_at > created_at)."""
    for a in ("reviewed_at", "updated_at", "created_at"):
        v = getattr(sub, a, None)
        if v: return _tz(v)
    return datetime.now(timezone.utc)

class DisputeService:
    """All mutations acquire _lock to prevent races."""
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _hist(self, did, action, prev, new, actor, notes):
        """Append history record."""
        self.db.add(DisputeHistoryDB(id=uuid.uuid4(), dispute_id=did, action=action,
            previous_status=prev, new_status=new, actor_id=actor, notes=notes))

    async def _dispute(self, did: str) -> DisputeDB:
        r = (await self.db.execute(select(DisputeDB).where(DisputeDB.id == did))).scalar_one_or_none()
        if not r: raise DisputeNotFoundError(f"Dispute '{did}' not found")
        return r

    async def _bounty(self, bid: str):
        from app.models.bounty_table import BountyTable
        r = (await self.db.execute(select(BountyTable).where(
            BountyTable.id == (uuid.UUID(bid) if isinstance(bid, str) else bid)))).scalar_one_or_none()
        if not r: raise BountyNotFoundError(f"Bounty '{bid}' not found")
        return r

    async def _sub(self, sid: str):
        from app.models.submission import SubmissionDB
        r = (await self.db.execute(select(SubmissionDB).where(
            SubmissionDB.id == (uuid.UUID(sid) if isinstance(sid, str) else sid)))).scalar_one_or_none()
        if not r: raise SubmissionNotFoundError(f"Submission '{sid}' not found")
        return r

    async def create_dispute(self, data: DisputeCreate, user_id: str) -> DisputeResponse:
        """Initiate dispute within 72h of rejection."""
        async with _lock:
            bounty = await self._bounty(data.bounty_id)
            sub = await self._sub(data.submission_id)
            if (await self.db.execute(select(DisputeDB).where(
                    DisputeDB.submission_id == data.submission_id))).scalar_one_or_none():
                raise DuplicateDisputeError(f"A dispute already exists for submission '{data.submission_id}'")
            rts = _rejection_ts(sub)
            now = datetime.now(timezone.utc)
            if now > rts + timedelta(hours=DISPUTE_WINDOW_HOURS):
                raise DisputeWindowExpiredError(
                    f"Dispute window expired. Rejection was {(now-rts).total_seconds()/3600:.1f}h ago; max {DISPUTE_WINDOW_HOURS}h.")
            d = DisputeDB(id=uuid.uuid4(), bounty_id=data.bounty_id, submission_id=data.submission_id,
                contributor_id=user_id, creator_id=str(bounty.created_by), reason=data.reason,
                description=data.description, evidence_links=[i.model_dump() for i in data.evidence_links],
                status=DisputeStatus.OPENED.value, rejection_timestamp=rts)
            self.db.add(d)
            self._hist(d.id, "dispute_opened", None, "opened", user_id, f"Opened: {data.reason}")
            await self.db.commit(); await self.db.refresh(d)
            asyncio.create_task(_tg(f"Dispute on bounty {data.bounty_id} by {user_id}"))
            return DisputeResponse.model_validate(d)

    async def get_dispute(self, did: str) -> DisputeDetailResponse:
        """Get dispute with audit history."""
        d = await self._dispute(did)
        h = (await self.db.execute(select(DisputeHistoryDB).where(
            DisputeHistoryDB.dispute_id == did).order_by(DisputeHistoryDB.created_at.asc()))).scalars().all()
        r = DisputeDetailResponse.model_validate(d)
        r.history = [DisputeHistoryItem.model_validate(x) for x in h]
        return r

    async def list_disputes(self, status_filter=None, bounty_id=None, contributor_id=None,
                            skip=0, limit=20) -> DisputeListResponse:
        """List with optional filters."""
        conds = []
        if status_filter: conds.append(DisputeDB.status == status_filter)
        if bounty_id: conds.append(DisputeDB.bounty_id == bounty_id)
        if contributor_id: conds.append(DisputeDB.contributor_id == contributor_id)
        w = and_(*conds) if conds else True
        total = (await self.db.execute(select(func.count(DisputeDB.id)).where(w))).scalar() or 0
        rows = (await self.db.execute(select(DisputeDB).where(w).order_by(
            DisputeDB.created_at.desc()).offset(skip).limit(limit))).scalars().all()
        return DisputeListResponse(items=[DisputeListItem.model_validate(r) for r in rows],
                                   total=total, skip=skip, limit=limit)

    async def submit_evidence(self, did: str, data: DisputeEvidenceSubmit, user_id: str) -> DisputeResponse:
        """Submit evidence; OPENED->EVIDENCE on first submission."""
        async with _lock:
            d = await self._dispute(did)
            cur = DisputeStatus(d.status)
            if cur not in (DisputeStatus.OPENED, DisputeStatus.EVIDENCE):
                raise InvalidDisputeTransitionError(f"Cannot submit evidence in '{cur.value}' state.")
            prev = d.status
            if cur == DisputeStatus.OPENED: d.status = DisputeStatus.EVIDENCE.value
            d.evidence_links = (d.evidence_links or []) + [i.model_dump() for i in data.evidence_links]
            d.updated_at = datetime.now(timezone.utc)
            self._hist(d.id, "evidence_submitted", prev, d.status, user_id,
                       data.notes or f"Added {len(data.evidence_links)} item(s)")
            await self.db.commit(); await self.db.refresh(d)
            return DisputeResponse.model_validate(d)

    async def move_to_mediation(self, did: str, user_id: str) -> DisputeResponse:
        """EVIDENCE->MEDIATION; triggers AI and possible auto-resolve."""
        async with _lock:
            d = await self._dispute(did)
            cur = DisputeStatus(d.status)
            if not validate_transition(cur, DisputeStatus.MEDIATION):
                raise InvalidDisputeTransitionError(
                    f"Cannot move to mediation from '{cur.value}'. Must be in 'evidence' state.")
            d.status = DisputeStatus.MEDIATION.value; d.updated_at = datetime.now(timezone.utc)
            self._hist(d.id, "moved_to_mediation", cur.value, "mediation", user_id, "Moved to mediation")
            await self.db.commit(); await self.db.refresh(d)
        score, rec = await _ai_mediate(d)
        async with _lock:
            d = await self._dispute(did)
            d.ai_review_score = score; d.ai_recommendation = rec; d.updated_at = datetime.now(timezone.utc)
            self._hist(d.id, "ai_mediation_completed", "mediation", "mediation", user_id, f"AI: {score}/10")
            if score is not None and score >= AI_MEDIATION_THRESHOLD:
                d.status = DisputeStatus.RESOLVED.value
                d.outcome = DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value
                d.resolution_notes = f"Auto-resolved by AI (score: {score}/10). {rec}"
                d.resolved_at = datetime.now(timezone.utc)
                d.reputation_impact_creator = UNFAIR_REJECTION_PENALTY
                self._hist(d.id, "auto_resolved_by_ai", "mediation", "resolved", user_id, f"AI score: {score}")
            await self.db.commit(); await self.db.refresh(d)
            return DisputeResponse.model_validate(d)

    async def resolve_dispute(self, did: str, data: DisputeResolve, admin_id: str) -> DisputeResponse:
        """Admin-only resolve. Must be in MEDIATION."""
        _require_admin(admin_id)
        async with _lock:
            d = await self._dispute(did)
            cur = DisputeStatus(d.status)
            if not validate_transition(cur, DisputeStatus.RESOLVED):
                raise InvalidDisputeTransitionError(
                    f"Cannot resolve from '{cur.value}'. Must be in 'mediation' state.")
            outcome = DisputeOutcome(data.outcome)
            d.status = DisputeStatus.RESOLVED.value; d.outcome = outcome.value
            d.resolver_id = admin_id; d.resolution_notes = data.resolution_notes
            d.resolved_at = datetime.now(timezone.utc); d.updated_at = datetime.now(timezone.utc)
            impacts = {DisputeOutcome.RELEASE_TO_CONTRIBUTOR: (UNFAIR_REJECTION_PENALTY, 0.0),
                       DisputeOutcome.REFUND_TO_CREATOR: (0.0, FRIVOLOUS_DISPUTE_PENALTY),
                       DisputeOutcome.SPLIT: (UNFAIR_REJECTION_PENALTY/2, FRIVOLOUS_DISPUTE_PENALTY/2)}
            d.reputation_impact_creator, d.reputation_impact_contributor = impacts[outcome]
            self._hist(d.id, "dispute_resolved", cur.value, "resolved", admin_id,
                       f"'{outcome.value}': {data.resolution_notes}")
            await self.db.commit(); await self.db.refresh(d)
            asyncio.create_task(_tg(f"Dispute {did} resolved as '{outcome.value}'"))
            return DisputeResponse.model_validate(d)

async def _ai_mediate(d: DisputeDB) -> tuple[Optional[float], str]:
    """Call AI mediation service. Placeholder when unconfigured."""
    url = os.getenv("AI_MEDIATION_SERVICE_URL", "")
    if not url: return None, "AI mediation not configured. Manual admin resolution required."
    try:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(f"{url}/api/mediate", json={"dispute_id": str(d.id),
                "bounty_id": str(d.bounty_id), "reason": d.reason,
                "description": d.description, "evidence": d.evidence_links or []})
            r.raise_for_status(); j = r.json()
            return float(j.get("score", 0)), str(j.get("recommendation", ""))
    except Exception as e:
        logger.error("AI mediation failed: %s", e)
        return None, f"AI unavailable ({type(e).__name__}). Manual resolution required."

async def _tg(msg: str) -> None:
    """Send sanitized Telegram notification. Failures logged, never raised."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID: return
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            await c.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_CHAT_ID, "text": _sanitize_tg(msg)})
    except Exception as e: logger.warning("Telegram failed: %s", e)
