"""Dispute resolution service with authorization and bounty validation."""

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

from app.models.dispute import (
    DisputeCreate, DisputeDetailResponse, DisputeHistoryItem, DisputeListItem,
    DisputeListResponse, DisputeOutcome, DisputeResolve, DisputeResponse,
    DisputeStats, DisputeStatus, EvidenceItem, EvidenceSubmit)
from app.services.bounty_service import _bounty_store
from app.services.contributor_service import _store as _contributor_store

logger = logging.getLogger(__name__)

_dispute_store: dict[str, dict] = {}
_history_store: dict[str, list[dict]] = {}
_reputation_impacts: list[dict] = []

AI_MEDIATION_THRESHOLD = 7.0
DISPUTE_WINDOW_HOURS = 72
ADMIN_USER_IDS: set[str] = set(
    filter(None, os.getenv("ADMIN_USER_IDS", "").split(","))
)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

_now = lambda: datetime.now(timezone.utc)
_id = lambda: str(uuid.uuid4())

def is_admin(user_id: str) -> bool:
    """Check whether user_id is in the configured admin set."""
    return user_id in ADMIN_USER_IDS

def _hist(dispute_id, action, actor, prev=None, new=None, notes=None):
    """Record an audit trail entry for a dispute."""
    _history_store.setdefault(dispute_id, []).append(
        {"id": _id(), "dispute_id": dispute_id, "action": action,
         "previous_status": prev, "new_status": new,
         "actor_id": actor, "notes": notes, "created_at": _now()})

def _resp(d):
    """Convert internal dict to DisputeResponse."""
    ev = [EvidenceItem(evidence_type=i.get("evidence_type", "link"),
          url=i.get("url"), description=i.get("description", ""))
          for i in d.get("evidence_links", []) if isinstance(i, dict)]
    return DisputeResponse(
        id=d["id"], bounty_id=d["bounty_id"], submitter_id=d["submitter_id"],
        creator_id=d["creator_id"], reason=d["reason"],
        description=d["description"], evidence_links=ev, status=d["status"],
        outcome=d.get("outcome"), reviewer_id=d.get("reviewer_id"),
        review_notes=d.get("review_notes"),
        resolution_action=d.get("resolution_action"),
        ai_review_score=d.get("ai_review_score"),
        ai_recommendation=d.get("ai_recommendation"),
        created_at=d["created_at"], updated_at=d["updated_at"],
        resolved_at=d.get("resolved_at"))

def _apply_reputation(user_id: str, impact_type: str, dispute_id: str, delta: float):
    """Record reputation impact and update contributor score if available."""
    _reputation_impacts.append({"user_id": user_id, "impact_type": impact_type,
        "dispute_id": dispute_id, "delta": delta, "created_at": _now()})
    contributor = _contributor_store.get(user_id)
    if contributor:
        contributor.reputation_score = max(0, contributor.reputation_score + int(delta * 100))

def _send_telegram_notification(dispute_id: str, message: str):
    """Send Telegram alert when a dispute needs admin mediation."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.debug("Telegram not configured, skipping notification")
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        httpx.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": message}, timeout=5)
    except Exception as exc:
        logger.warning("Telegram notification failed: %s", exc)

def _get_bounty_rejection_info(bounty_id: str):
    """Look up bounty and return (bounty, rejected_at) or (None, None)."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, None
    rejected = [s for s in bounty.submissions if s.status.value == "rejected"]
    if not rejected:
        return bounty, None
    latest = max(rejected, key=lambda s: s.submitted_at)
    return bounty, latest.submitted_at

def create_dispute(data: DisputeCreate, submitter_id: str):
    """File a new dispute. Validates bounty, rejection, and 72h window."""
    bounty, rejected_at = _get_bounty_rejection_info(data.bounty_id)
    if not bounty:
        return None, "Bounty not found"
    creator_id = bounty.created_by
    if submitter_id == creator_id:
        return None, "Cannot dispute your own bounty"
    rejected_by_submitter = [
        s for s in bounty.submissions
        if s.status.value == "rejected" and s.submitted_by == submitter_id
    ]
    if not rejected_by_submitter:
        return None, "Only contributors with a rejected submission can file a dispute"
    if not rejected_at:
        return None, "Bounty has no rejected submissions"
    if _now() - rejected_at > timedelta(hours=DISPUTE_WINDOW_HOURS):
        return None, "Dispute window expired (72 hours after rejection)"
    for e in _dispute_store.values():
        if (e["bounty_id"] == data.bounty_id and e["submitter_id"] == submitter_id
                and e["status"] != DisputeStatus.RESOLVED.value):
            return None, "An active dispute already exists for this bounty"
    did, now = _id(), _now()
    d = {"id": did, "bounty_id": data.bounty_id, "submitter_id": submitter_id,
         "creator_id": creator_id, "reason": data.reason,
         "description": data.description,
         "evidence_links": [i.model_dump() for i in data.evidence_links],
         "status": DisputeStatus.OPENED.value, "outcome": None,
         "reviewer_id": None, "review_notes": None, "resolution_action": None,
         "ai_review_score": None, "ai_recommendation": None,
         "created_at": now, "updated_at": now, "resolved_at": None}
    _dispute_store[did] = d
    _hist(did, "dispute_opened", submitter_id, None, d["status"])
    return _resp(d), None

def get_dispute(dispute_id: str, user_id: str = None, require_admin: bool = False):
    """Retrieve dispute with audit history. Enforces access control."""
    d = _dispute_store.get(dispute_id)
    if not d:
        return None, "not_found"
    if user_id and not is_admin(user_id):
        if user_id not in (d["submitter_id"], d["creator_id"]):
            return None, "forbidden"
    r = _resp(d)
    h = [DisputeHistoryItem(**e) for e in _history_store.get(dispute_id, [])]
    return DisputeDetailResponse(**r.model_dump(), history=h), None

def list_disputes(user_id: str, status=None, bounty_id=None, skip=0, limit=20):
    """List disputes visible to user. Admins see all; others see own disputes."""
    res = list(_dispute_store.values())
    if not is_admin(user_id):
        res = [d for d in res if user_id in (d["submitter_id"], d["creator_id"])]
    if status:
        res = [d for d in res if d["status"] == status.value]
    if bounty_id:
        res = [d for d in res if d["bounty_id"] == bounty_id]
    res.sort(key=lambda d: d["created_at"], reverse=True)
    return DisputeListResponse(
        items=[DisputeListItem(id=d["id"], bounty_id=d["bounty_id"],
            submitter_id=d["submitter_id"], reason=d["reason"],
            status=d["status"], outcome=d.get("outcome"),
            created_at=d["created_at"], resolved_at=d.get("resolved_at"))
            for d in res[skip:skip+limit]],
        total=len(res), skip=skip, limit=limit)

def submit_evidence(dispute_id: str, data: EvidenceSubmit, actor_id: str):
    """Submit evidence to a dispute. Both parties can submit during open/evidence phases."""
    d = _dispute_store.get(dispute_id)
    if not d:
        return None, "Dispute not found"
    if actor_id not in (d["submitter_id"], d["creator_id"]):
        return None, "Only dispute participants can submit evidence"
    cur = DisputeStatus(d["status"])
    if cur not in (DisputeStatus.OPENED, DisputeStatus.EVIDENCE):
        return None, f"Cannot submit evidence in {cur.value} state"
    d["evidence_links"] += [i.model_dump() for i in data.evidence_items]
    d["updated_at"] = _now()
    if cur == DisputeStatus.OPENED:
        prev = d["status"]
        d["status"] = DisputeStatus.EVIDENCE.value
        _hist(dispute_id, "status_transition", actor_id, prev, d["status"])
    _hist(dispute_id, "evidence_submitted", actor_id, d["status"], d["status"],
          data.notes or f"{len(data.evidence_items)} item(s)")
    return _resp(d), None

def _run_ai_mediation(dispute_id: str, d: dict):
    """Internal AI mediation logic run as part of resolve flow."""
    evidence_count = len(d.get("evidence_links", []))
    score = min(10.0, round(evidence_count * 1.5 + 3.0, 1))
    d["ai_review_score"] = score
    d["updated_at"] = _now()
    if DisputeStatus(d["status"]) == DisputeStatus.EVIDENCE:
        prev = d["status"]
        d["status"] = DisputeStatus.MEDIATION.value
        _hist(dispute_id, "ai_mediation_started", "system", prev, d["status"])
    if score >= AI_MEDIATION_THRESHOLD:
        d.update(ai_recommendation=DisputeOutcome.CONTRIBUTOR_WINS.value,
            status=DisputeStatus.RESOLVED.value,
            outcome=DisputeOutcome.CONTRIBUTOR_WINS.value,
            review_notes=f"Auto-resolved by AI mediation. Score {score}/10 meets threshold.",
            resolution_action="release_to_contributor",
            resolved_at=_now(), updated_at=_now())
        _hist(dispute_id, "ai_auto_resolved", "system",
              DisputeStatus.MEDIATION.value, DisputeStatus.RESOLVED.value)
        _apply_reputation(d["creator_id"], "unfair_rejection", dispute_id, -0.5)
        return True
    d["ai_recommendation"] = "manual_review_needed"
    _hist(dispute_id, "ai_mediation_inconclusive", "system", d["status"], d["status"])
    _send_telegram_notification(dispute_id,
        f"Dispute {dispute_id} needs admin mediation (AI score: {score}/10)")
    return False

def resolve_dispute(dispute_id: str, data: DisputeResolve, reviewer_id: str):
    """Admin resolves a dispute. AI mediation runs automatically first."""
    if not is_admin(reviewer_id):
        return None, "Only admins can resolve disputes"
    d = _dispute_store.get(dispute_id)
    if not d:
        return None, "Dispute not found"
    cur = DisputeStatus(d["status"])
    if cur == DisputeStatus.EVIDENCE:
        auto = _run_ai_mediation(dispute_id, d)
        if auto:
            return _resp(d), None
    elif cur != DisputeStatus.MEDIATION:
        return None, f"Only disputes in evidence or mediation can be resolved. Current: {d['status']}"
    prev, oc = d["status"], DisputeOutcome(data.outcome)
    acts = {DisputeOutcome.CONTRIBUTOR_WINS: "release_to_contributor",
            DisputeOutcome.CREATOR_WINS: "refund_to_creator",
            DisputeOutcome.SPLIT: "split_between_parties"}
    d.update(status=DisputeStatus.RESOLVED.value, outcome=oc.value,
             reviewer_id=reviewer_id, review_notes=data.review_notes,
             resolution_action=data.resolution_action or acts.get(oc),
             resolved_at=_now(), updated_at=_now())
    _hist(dispute_id, "dispute_resolved", reviewer_id, prev, d["status"])
    if oc == DisputeOutcome.CONTRIBUTOR_WINS:
        _apply_reputation(d["creator_id"], "unfair_rejection", dispute_id, -0.5)
    elif oc == DisputeOutcome.CREATOR_WINS:
        _apply_reputation(d["submitter_id"], "frivolous_dispute", dispute_id, -0.3)
    return _resp(d), None

def get_dispute_stats():
    """Calculate aggregate dispute statistics across all stored disputes."""
    ds = list(_dispute_store.values())
    c = lambda s: sum(1 for d in ds if d["status"] == s.value)
    o = lambda v: sum(1 for d in ds if d.get("outcome") == v.value)
    r, cw = c(DisputeStatus.RESOLVED), o(DisputeOutcome.CONTRIBUTOR_WINS)
    return DisputeStats(total_disputes=len(ds), opened_disputes=c(DisputeStatus.OPENED),
        evidence_disputes=c(DisputeStatus.EVIDENCE),
        mediation_disputes=c(DisputeStatus.MEDIATION), resolved_disputes=r,
        contributor_wins=cw, creator_wins=o(DisputeOutcome.CREATOR_WINS),
        split_outcomes=o(DisputeOutcome.SPLIT),
        contributor_win_rate=round(cw/r, 4) if r else 0.0)

def get_reputation_impacts(user_id=None):
    """Get reputation impacts, optionally filtered by user_id."""
    if user_id:
        return [i for i in _reputation_impacts if i["user_id"] == user_id]
    return list(_reputation_impacts)
