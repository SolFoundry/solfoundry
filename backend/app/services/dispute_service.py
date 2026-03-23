"""Dispute resolution service (Issue #192).

Implements the full dispute lifecycle: OPENED -> EVIDENCE -> MEDIATION -> RESOLVED.
Uses database-level locking (SELECT ... FOR UPDATE) for safe concurrent mutations,
enforces a 72-hour window from rejection, admin-only resolution, AI-assisted
mediation via a pluggable interface, and sanitized Telegram notifications.

State machine:
    OPENED -> EVIDENCE -> MEDIATION -> RESOLVED

Resolution outcomes:
    - release_to_contributor: Contributor was right, creator penalized.
    - refund_to_creator: Rejection upheld, contributor penalized.
    - split: Partial fault on both sides, penalties split.
"""

import asyncio
import logging
import os
import re
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import httpx
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    BountyNotFoundError,
    DisputeNotFoundError,
    DisputeWindowExpiredError,
    DuplicateDisputeError,
    InvalidDisputeTransitionError,
    SubmissionNotFoundError,
    UnauthorizedDisputeAccessError,
)
from app.models.dispute import (
    DisputeCreate,
    DisputeDB,
    DisputeDetailResponse,
    DisputeEvidenceSubmit,
    DisputeHistoryDB,
    DisputeHistoryItem,
    DisputeListItem,
    DisputeListResponse,
    DisputeOutcome,
    DisputeResolve,
    DisputeResponse,
    DisputeStatus,
    validate_transition,
)

logger = logging.getLogger(__name__)

# -- Configuration constants --------------------------------------------------

DISPUTE_WINDOW_HOURS = 72
"""Maximum hours after rejection within which a dispute can be filed."""

AI_MEDIATION_THRESHOLD = 7.0
"""AI score at or above which a dispute is auto-resolved in contributor's favor."""

UNFAIR_REJECTION_PENALTY = -5.0
"""Reputation penalty applied to creator when contributor wins the dispute."""

FRIVOLOUS_DISPUTE_PENALTY = -3.0
"""Reputation penalty applied to contributor when rejection is upheld."""

ADMIN_USER_IDS: frozenset[str] = frozenset(
    user_id.strip()
    for user_id in os.getenv("DISPUTE_ADMIN_USER_IDS", "").split(",")
    if user_id.strip()
)
"""Set of user IDs allowed to resolve disputes. Empty set = allow all (dev mode)."""

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")


# -- AI Mediation Interface ---------------------------------------------------


class MediationProvider(ABC):
    """Abstract interface for AI-assisted dispute mediation.

    Implementations must provide a ``mediate`` method that analyzes
    the dispute evidence and returns a score plus recommendation.
    """

    @abstractmethod
    async def mediate(
        self,
        dispute_id: str,
        bounty_id: str,
        reason: str,
        description: str,
        evidence: list,
    ) -> Tuple[Optional[float], str]:
        """Analyze a dispute and return (score, recommendation).

        Args:
            dispute_id: Unique identifier of the dispute.
            bounty_id: The bounty being disputed.
            reason: Category of the dispute (e.g., unfair_rejection).
            description: Contributor's description of why they dispute.
            evidence: List of evidence items submitted.

        Returns:
            A tuple of (score, recommendation_text). Score is 0-10 or
            None if the service is unavailable.
        """


class RemoteMediationProvider(MediationProvider):
    """HTTP-based AI mediation that calls an external scoring service.

    Requires the ``AI_MEDIATION_SERVICE_URL`` environment variable to
    be set. Falls back gracefully when the service is unreachable.
    """

    def __init__(self, service_url: str) -> None:
        """Initialize with the mediation service base URL.

        Args:
            service_url: Base URL of the AI mediation HTTP service.
        """
        self.service_url = service_url

    async def mediate(
        self,
        dispute_id: str,
        bounty_id: str,
        reason: str,
        description: str,
        evidence: list,
    ) -> Tuple[Optional[float], str]:
        """Call the remote AI mediation service.

        Args:
            dispute_id: Unique identifier of the dispute.
            bounty_id: The bounty being disputed.
            reason: Category of the dispute.
            description: Contributor's dispute description.
            evidence: List of evidence items.

        Returns:
            Tuple of (score, recommendation) from the AI service, or
            (None, error_message) if the service call fails.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.service_url}/api/mediate",
                    json={
                        "dispute_id": dispute_id,
                        "bounty_id": bounty_id,
                        "reason": reason,
                        "description": description,
                        "evidence": evidence,
                    },
                )
                response.raise_for_status()
                data = response.json()
                return float(data.get("score", 0)), str(data.get("recommendation", ""))
        except Exception as error:
            logger.error("AI mediation failed: %s", error)
            return (
                None,
                f"AI unavailable ({type(error).__name__}). Manual resolution required.",
            )


class PlaceholderMediationProvider(MediationProvider):
    """Fallback provider used when no AI service is configured.

    Returns None score and a message indicating manual review is needed.
    """

    async def mediate(
        self,
        dispute_id: str,
        bounty_id: str,
        reason: str,
        description: str,
        evidence: list,
    ) -> Tuple[Optional[float], str]:
        """Return a placeholder response indicating manual review is required.

        Args:
            dispute_id: Unique identifier of the dispute.
            bounty_id: The bounty being disputed.
            reason: Category of the dispute.
            description: Contributor's dispute description.
            evidence: List of evidence items.

        Returns:
            (None, message) indicating AI is not configured.
        """
        return None, "AI mediation not configured. Manual admin resolution required."


def get_mediation_provider() -> MediationProvider:
    """Factory that returns the appropriate mediation provider.

    Uses RemoteMediationProvider if ``AI_MEDIATION_SERVICE_URL`` is set,
    otherwise falls back to PlaceholderMediationProvider.

    Returns:
        A MediationProvider instance.
    """
    service_url = os.getenv("AI_MEDIATION_SERVICE_URL", "")
    if service_url:
        return RemoteMediationProvider(service_url)
    return PlaceholderMediationProvider()


async def _ai_mediate(dispute: DisputeDB) -> Tuple[Optional[float], str]:
    """Run AI mediation on a dispute using the configured provider.

    Args:
        dispute: The dispute database record to analyze.

    Returns:
        Tuple of (score, recommendation_text).
    """
    provider = get_mediation_provider()
    return await provider.mediate(
        dispute_id=str(dispute.id),
        bounty_id=str(dispute.bounty_id),
        reason=dispute.reason,
        description=dispute.description,
        evidence=dispute.evidence_links or [],
    )


# -- Helpers -------------------------------------------------------------------


def _sanitize_telegram_text(text: str) -> str:
    """Sanitize text for Telegram MarkdownV2 format.

    Removes HTML-unsafe characters and escapes Telegram special characters.
    Truncates to 4000 characters (Telegram message limit).

    Args:
        text: Raw text to sanitize.

    Returns:
        Sanitized string safe for Telegram MarkdownV2.
    """
    sanitized = re.sub(r"[<>&]", "", text)
    for char in r"_*[]()~`>#+-=|{}.!":
        sanitized = sanitized.replace(char, f"\\{char}")
    return sanitized[:4000]


def _require_admin(user_id: str) -> None:
    """Assert that the user has admin privileges for dispute resolution.

    When DISPUTE_ADMIN_USER_IDS is not configured (empty), all users
    are allowed (development mode). In production, only listed IDs pass.

    Args:
        user_id: The user ID to check.

    Raises:
        UnauthorizedDisputeAccessError: If user is not an admin.
    """
    if not ADMIN_USER_IDS:
        logger.warning(
            "DISPUTE_ADMIN_USER_IDS not set; allowing user %s as admin",
            user_id,
        )
        return
    if user_id not in ADMIN_USER_IDS:
        raise UnauthorizedDisputeAccessError(
            f"User '{user_id}' not authorized to resolve disputes."
        )


def _ensure_utc_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure a datetime is UTC-aware. Returns None for None input.

    Args:
        dt: A datetime that may or may not have timezone info.

    Returns:
        The datetime with UTC timezone, or None.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _get_rejection_timestamp(submission) -> datetime:
    """Extract the rejection timestamp from a submission record.

    Checks reviewed_at, then updated_at, then created_at. Falls back
    to current UTC time if none are available.

    Args:
        submission: A SubmissionDB record.

    Returns:
        A UTC-aware datetime representing when the rejection occurred.
    """
    for attribute in ("reviewed_at", "updated_at", "created_at"):
        value = getattr(submission, attribute, None)
        if value:
            return _ensure_utc_aware(value)
    return datetime.now(timezone.utc)


async def _send_telegram_notification(message: str) -> None:
    """Send a sanitized Telegram notification. Failures are logged, never raised.

    Args:
        message: The raw message text to send.
    """
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": _sanitize_telegram_text(message),
                },
            )
    except Exception as error:
        logger.warning("Telegram notification failed: %s", error)


# -- Reputation Impact Mapping ------------------------------------------------

OUTCOME_REPUTATION_IMPACTS: dict[DisputeOutcome, Tuple[float, float]] = {
    DisputeOutcome.RELEASE_TO_CONTRIBUTOR: (UNFAIR_REJECTION_PENALTY, 0.0),
    DisputeOutcome.REFUND_TO_CREATOR: (0.0, FRIVOLOUS_DISPUTE_PENALTY),
    DisputeOutcome.SPLIT: (UNFAIR_REJECTION_PENALTY / 2, FRIVOLOUS_DISPUTE_PENALTY / 2),
}
"""Maps outcome to (creator_impact, contributor_impact) reputation changes."""


# -- Main Service --------------------------------------------------------------


class DisputeService:
    """Service for managing the dispute resolution lifecycle.

    All state-mutating operations use database-level row locking
    (SELECT ... FOR UPDATE) to prevent race conditions in concurrent
    environments, replacing the previous per-process asyncio.Lock pattern.

    Attributes:
        db: The async database session for this request.
    """

    def __init__(self, db: AsyncSession) -> None:
        """Initialize the dispute service with a database session.

        Args:
            db: An async SQLAlchemy session scoped to the current request.
        """
        self.db = db

    def _record_history(
        self,
        dispute_id,
        action: str,
        previous_status: Optional[str],
        new_status: Optional[str],
        actor_id: str,
        notes: Optional[str],
    ) -> None:
        """Append an audit history record for a dispute state change.

        Args:
            dispute_id: The dispute this history entry belongs to.
            action: Short description of what happened (e.g., 'dispute_opened').
            previous_status: The status before this action, or None.
            new_status: The status after this action, or None.
            actor_id: The user who performed the action.
            notes: Optional additional context.
        """
        self.db.add(
            DisputeHistoryDB(
                id=uuid.uuid4(),
                dispute_id=dispute_id,
                action=action,
                previous_status=previous_status,
                new_status=new_status,
                actor_id=actor_id,
                notes=notes,
            )
        )

    async def _get_dispute(self, dispute_id: str) -> DisputeDB:
        """Fetch a dispute by ID, raising DisputeNotFoundError if missing.

        Args:
            dispute_id: The unique dispute identifier.

        Returns:
            The DisputeDB record.

        Raises:
            DisputeNotFoundError: If no dispute with this ID exists.
        """
        result = await self.db.execute(
            select(DisputeDB).where(DisputeDB.id == dispute_id)
        )
        dispute = result.scalar_one_or_none()
        if not dispute:
            raise DisputeNotFoundError(f"Dispute '{dispute_id}' not found")
        return dispute

    async def _get_dispute_for_update(self, dispute_id: str) -> DisputeDB:
        """Fetch a dispute with a row-level lock for safe mutation.

        Uses SELECT ... FOR UPDATE to prevent concurrent modifications.

        Args:
            dispute_id: The unique dispute identifier.

        Returns:
            The locked DisputeDB record.

        Raises:
            DisputeNotFoundError: If no dispute with this ID exists.
        """
        result = await self.db.execute(
            select(DisputeDB).where(DisputeDB.id == dispute_id).with_for_update()
        )
        dispute = result.scalar_one_or_none()
        if not dispute:
            raise DisputeNotFoundError(f"Dispute '{dispute_id}' not found")
        return dispute

    async def _get_bounty(self, bounty_id: str):
        """Fetch a bounty by ID.

        Args:
            bounty_id: The bounty identifier (string UUID).

        Returns:
            The BountyTable record.

        Raises:
            BountyNotFoundError: If no bounty with this ID exists.
        """
        from app.models.bounty_table import BountyTable

        parsed_id = uuid.UUID(bounty_id) if isinstance(bounty_id, str) else bounty_id
        result = await self.db.execute(
            select(BountyTable).where(BountyTable.id == parsed_id)
        )
        bounty = result.scalar_one_or_none()
        if not bounty:
            raise BountyNotFoundError(f"Bounty '{bounty_id}' not found")
        return bounty

    async def _get_submission(self, submission_id: str):
        """Fetch a submission by ID.

        Args:
            submission_id: The submission identifier (string UUID).

        Returns:
            The SubmissionDB record.

        Raises:
            SubmissionNotFoundError: If no submission with this ID exists.
        """
        from app.models.submission import SubmissionDB as SubDB

        parsed_id = (
            uuid.UUID(submission_id)
            if isinstance(submission_id, str)
            else submission_id
        )
        result = await self.db.execute(select(SubDB).where(SubDB.id == parsed_id))
        submission = result.scalar_one_or_none()
        if not submission:
            raise SubmissionNotFoundError(f"Submission '{submission_id}' not found")
        return submission

    async def create_dispute(
        self, data: DisputeCreate, user_id: str
    ) -> DisputeResponse:
        """Initiate a dispute on a rejected submission within the 72-hour window.

        Validates that:
        - The bounty and submission exist
        - The caller is the submission's contributor
        - No duplicate dispute exists for this submission
        - The rejection happened within the dispute window

        Args:
            data: The dispute creation payload.
            user_id: The authenticated user initiating the dispute.

        Returns:
            The created dispute as a DisputeResponse.

        Raises:
            BountyNotFoundError: If the bounty does not exist.
            SubmissionNotFoundError: If the submission does not exist.
            UnauthorizedDisputeAccessError: If the caller is not the contributor.
            DuplicateDisputeError: If a dispute already exists for this submission.
            DisputeWindowExpiredError: If the 72-hour window has passed.
        """
        bounty = await self._get_bounty(data.bounty_id)
        submission = await self._get_submission(data.submission_id)

        # Authorization: only the submission's contributor can dispute
        submission_contributor_id = str(submission.contributor_id)
        if submission_contributor_id != user_id:
            raise UnauthorizedDisputeAccessError(
                "Only the submission's contributor can initiate a dispute."
            )

        # Check for duplicate disputes on the same submission
        existing = await self.db.execute(
            select(DisputeDB).where(DisputeDB.submission_id == data.submission_id)
        )
        if existing.scalar_one_or_none():
            raise DuplicateDisputeError(
                f"A dispute already exists for submission '{data.submission_id}'"
            )

        # Enforce 72-hour dispute window
        rejection_timestamp = _get_rejection_timestamp(submission)
        now = datetime.now(timezone.utc)
        if now > rejection_timestamp + timedelta(hours=DISPUTE_WINDOW_HOURS):
            hours_elapsed = (now - rejection_timestamp).total_seconds() / 3600
            raise DisputeWindowExpiredError(
                f"Dispute window expired. Rejection was {hours_elapsed:.1f}h ago; "
                f"max {DISPUTE_WINDOW_HOURS}h."
            )

        dispute = DisputeDB(
            id=uuid.uuid4(),
            bounty_id=data.bounty_id,
            submission_id=data.submission_id,
            contributor_id=user_id,
            creator_id=str(bounty.created_by),
            reason=data.reason,
            description=data.description,
            evidence_links=[item.model_dump() for item in data.evidence_links],
            status=DisputeStatus.OPENED.value,
            rejection_timestamp=rejection_timestamp,
        )
        self.db.add(dispute)
        self._record_history(
            dispute.id,
            "dispute_opened",
            None,
            "opened",
            user_id,
            f"Opened: {data.reason}",
        )
        await self.db.commit()
        await self.db.refresh(dispute)

        # Fire-and-forget Telegram notification
        asyncio.create_task(
            _send_telegram_notification(
                f"Dispute on bounty {data.bounty_id} by {user_id}"
            )
        )

        return DisputeResponse.model_validate(dispute)

    async def get_dispute(self, dispute_id: str, user_id: str) -> DisputeDetailResponse:
        """Get a dispute with its full audit history.

        Enforces access control: only the contributor, creator, or an
        admin can view dispute details.

        Args:
            dispute_id: The dispute to retrieve.
            user_id: The authenticated user requesting the dispute.

        Returns:
            The dispute detail including history timeline.

        Raises:
            DisputeNotFoundError: If the dispute does not exist.
            UnauthorizedDisputeAccessError: If user is not a participant.
        """
        dispute = await self._get_dispute(dispute_id)

        # Access control: participant or admin only
        is_participant = user_id in (
            str(dispute.contributor_id),
            str(dispute.creator_id),
        )
        is_admin = (not ADMIN_USER_IDS) or (user_id in ADMIN_USER_IDS)
        if not is_participant and not is_admin:
            raise UnauthorizedDisputeAccessError(
                "You do not have permission to view this dispute."
            )

        history_result = await self.db.execute(
            select(DisputeHistoryDB)
            .where(DisputeHistoryDB.dispute_id == dispute_id)
            .order_by(DisputeHistoryDB.created_at.asc())
        )
        history_rows = history_result.scalars().all()

        response = DisputeDetailResponse.model_validate(dispute)
        response.history = [
            DisputeHistoryItem.model_validate(row) for row in history_rows
        ]
        return response

    async def list_disputes(
        self,
        user_id: str,
        status_filter: Optional[str] = None,
        bounty_id: Optional[str] = None,
        contributor_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> DisputeListResponse:
        """List disputes visible to the current user with optional filters.

        Users only see disputes where they are a participant (contributor
        or creator). Admins see all disputes.

        Args:
            user_id: The authenticated user requesting the list.
            status_filter: Optional filter by dispute status.
            bounty_id: Optional filter by bounty ID.
            contributor_id: Optional filter by contributor ID.
            skip: Pagination offset.
            limit: Maximum number of results.

        Returns:
            Paginated list of disputes.
        """
        conditions = []

        # Access control: non-admins only see their own disputes
        is_admin = (not ADMIN_USER_IDS) or (user_id in ADMIN_USER_IDS)
        if not is_admin:
            conditions.append(
                (DisputeDB.contributor_id == user_id)
                | (DisputeDB.creator_id == user_id)
            )

        if status_filter:
            conditions.append(DisputeDB.status == status_filter)
        if bounty_id:
            conditions.append(DisputeDB.bounty_id == bounty_id)
        if contributor_id:
            conditions.append(DisputeDB.contributor_id == contributor_id)

        where_clause = and_(*conditions) if conditions else True

        total_result = await self.db.execute(
            select(func.count(DisputeDB.id)).where(where_clause)
        )
        total = total_result.scalar() or 0

        rows_result = await self.db.execute(
            select(DisputeDB)
            .where(where_clause)
            .order_by(DisputeDB.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        rows = rows_result.scalars().all()

        return DisputeListResponse(
            items=[DisputeListItem.model_validate(row) for row in rows],
            total=total,
            skip=skip,
            limit=limit,
        )

    async def submit_evidence(
        self,
        dispute_id: str,
        data: DisputeEvidenceSubmit,
        user_id: str,
    ) -> DisputeResponse:
        """Submit additional evidence for a dispute.

        Transitions the dispute from OPENED to EVIDENCE on the first
        evidence submission. Additional evidence can be submitted while
        in the EVIDENCE state.

        Only participants (contributor or creator) can submit evidence.

        Args:
            dispute_id: The dispute to add evidence to.
            data: The evidence payload.
            user_id: The authenticated user submitting evidence.

        Returns:
            Updated dispute response.

        Raises:
            DisputeNotFoundError: If the dispute does not exist.
            UnauthorizedDisputeAccessError: If user is not a participant.
            InvalidDisputeTransitionError: If evidence cannot be submitted in current state.
        """
        dispute = await self._get_dispute_for_update(dispute_id)

        # Authorization: only participants can submit evidence
        is_participant = user_id in (
            str(dispute.contributor_id),
            str(dispute.creator_id),
        )
        if not is_participant:
            raise UnauthorizedDisputeAccessError(
                "Only dispute participants can submit evidence."
            )

        current_status = DisputeStatus(dispute.status)
        if current_status not in (DisputeStatus.OPENED, DisputeStatus.EVIDENCE):
            raise InvalidDisputeTransitionError(
                f"Cannot submit evidence in '{current_status.value}' state."
            )

        previous_status = dispute.status
        if current_status == DisputeStatus.OPENED:
            dispute.status = DisputeStatus.EVIDENCE.value

        dispute.evidence_links = (dispute.evidence_links or []) + [
            item.model_dump() for item in data.evidence_links
        ]
        dispute.updated_at = datetime.now(timezone.utc)

        self._record_history(
            dispute.id,
            "evidence_submitted",
            previous_status,
            dispute.status,
            user_id,
            data.notes or f"Added {len(data.evidence_links)} evidence item(s)",
        )

        await self.db.commit()
        await self.db.refresh(dispute)
        return DisputeResponse.model_validate(dispute)

    async def move_to_mediation(self, dispute_id: str, user_id: str) -> DisputeResponse:
        """Move a dispute from EVIDENCE to MEDIATION phase.

        Triggers AI mediation analysis. If the AI score meets the
        threshold (>= 7.0/10), the dispute is auto-resolved in
        the contributor's favor.

        Args:
            dispute_id: The dispute to advance.
            user_id: The authenticated user requesting mediation.

        Returns:
            Updated dispute response (may be resolved if AI threshold met).

        Raises:
            DisputeNotFoundError: If the dispute does not exist.
            InvalidDisputeTransitionError: If not in EVIDENCE state.
        """
        dispute = await self._get_dispute_for_update(dispute_id)
        current_status = DisputeStatus(dispute.status)

        if not validate_transition(current_status, DisputeStatus.MEDIATION):
            raise InvalidDisputeTransitionError(
                f"Cannot move to mediation from '{current_status.value}'. "
                "Must be in 'evidence' state."
            )

        dispute.status = DisputeStatus.MEDIATION.value
        dispute.updated_at = datetime.now(timezone.utc)

        self._record_history(
            dispute.id,
            "moved_to_mediation",
            current_status.value,
            "mediation",
            user_id,
            "Moved to mediation phase",
        )

        await self.db.commit()
        await self.db.refresh(dispute)

        # Run AI mediation (outside row lock)
        score, recommendation = await _ai_mediate(dispute)

        # Re-acquire lock to apply AI results
        dispute = await self._get_dispute_for_update(dispute_id)
        dispute.ai_review_score = score
        dispute.ai_recommendation = recommendation
        dispute.updated_at = datetime.now(timezone.utc)

        self._record_history(
            dispute.id,
            "ai_mediation_completed",
            "mediation",
            "mediation",
            user_id,
            f"AI score: {score}/10",
        )

        # Auto-resolve if AI score meets threshold
        if score is not None and score >= AI_MEDIATION_THRESHOLD:
            dispute.status = DisputeStatus.RESOLVED.value
            dispute.outcome = DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value
            dispute.resolution_notes = (
                f"Auto-resolved by AI (score: {score}/10). {recommendation}"
            )
            dispute.resolved_at = datetime.now(timezone.utc)
            dispute.reputation_impact_creator = UNFAIR_REJECTION_PENALTY
            self._record_history(
                dispute.id,
                "auto_resolved_by_ai",
                "mediation",
                "resolved",
                user_id,
                f"AI score: {score}/10 >= threshold {AI_MEDIATION_THRESHOLD}",
            )

        await self.db.commit()
        await self.db.refresh(dispute)
        return DisputeResponse.model_validate(dispute)

    async def resolve_dispute(
        self,
        dispute_id: str,
        data: DisputeResolve,
        admin_id: str,
    ) -> DisputeResponse:
        """Resolve a dispute with an admin decision.

        Only administrators can resolve disputes. The dispute must be
        in MEDIATION state. Applies reputation impacts based on outcome.

        Args:
            dispute_id: The dispute to resolve.
            data: The resolution payload with outcome and notes.
            admin_id: The admin user performing the resolution.

        Returns:
            The resolved dispute response.

        Raises:
            UnauthorizedDisputeAccessError: If user is not an admin.
            DisputeNotFoundError: If the dispute does not exist.
            InvalidDisputeTransitionError: If not in MEDIATION state.
        """
        _require_admin(admin_id)

        dispute = await self._get_dispute_for_update(dispute_id)
        current_status = DisputeStatus(dispute.status)

        if not validate_transition(current_status, DisputeStatus.RESOLVED):
            raise InvalidDisputeTransitionError(
                f"Cannot resolve from '{current_status.value}'. "
                "Must be in 'mediation' state."
            )

        outcome = DisputeOutcome(data.outcome)
        dispute.status = DisputeStatus.RESOLVED.value
        dispute.outcome = outcome.value
        dispute.resolver_id = admin_id
        dispute.resolution_notes = data.resolution_notes
        dispute.resolved_at = datetime.now(timezone.utc)
        dispute.updated_at = datetime.now(timezone.utc)

        creator_impact, contributor_impact = OUTCOME_REPUTATION_IMPACTS.get(
            outcome, (0.0, 0.0)
        )
        dispute.reputation_impact_creator = creator_impact
        dispute.reputation_impact_contributor = contributor_impact

        self._record_history(
            dispute.id,
            "dispute_resolved",
            current_status.value,
            "resolved",
            admin_id,
            f"Outcome '{outcome.value}': {data.resolution_notes}",
        )

        await self.db.commit()
        await self.db.refresh(dispute)

        # Fire-and-forget Telegram notification
        asyncio.create_task(
            _send_telegram_notification(
                f"Dispute {dispute_id} resolved as '{outcome.value}'"
            )
        )

        return DisputeResponse.model_validate(dispute)
