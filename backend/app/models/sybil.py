"""Anti-gaming and sybil protection database models and Pydantic schemas.

Defines SQLAlchemy ORM models for sybil detection audit logs, admin alerts,
and appeal records. Also provides Pydantic request/response schemas for the
anti-gaming API endpoints.

Tables:
    - sybil_audit_logs: Immutable audit trail of every anti-gaming decision.
    - sybil_alerts: Admin-facing alerts for suspicious patterns.
    - sybil_appeals: False-positive recovery requests from flagged users.

PostgreSQL migration: managed by Alembic (see ``alembic/versions/``).
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SybilCheckType(str, Enum):
    """Classification of individual anti-gaming checks.

    Each value corresponds to a specific detection heuristic
    implemented in the sybil service layer.
    """

    GITHUB_ACCOUNT_AGE = "github_account_age"
    GITHUB_ACTIVITY = "github_activity"
    WALLET_CLUSTERING = "wallet_clustering"
    CLAIM_RATE_LIMIT = "claim_rate_limit"
    T1_COOLDOWN = "t1_cooldown"
    IP_HEURISTIC = "ip_heuristic"


class SybilDecision(str, Enum):
    """Outcome of a sybil detection evaluation.

    Attributes:
        ALLOW: User passed all checks and may proceed.
        FLAG: Suspicious activity detected; logged but not blocked.
        BLOCK: User failed hard checks and is denied access.
    """

    ALLOW = "allow"
    FLAG = "flag"
    BLOCK = "block"


class AlertSeverity(str, Enum):
    """Severity level for admin alerts.

    Attributes:
        LOW: Informational; minor anomaly detected.
        MEDIUM: Warrants investigation within 24 hours.
        HIGH: Requires immediate admin attention.
        CRITICAL: Active exploitation attempt detected.
    """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    """Lifecycle status of an admin alert.

    Attributes:
        OPEN: Alert is pending admin review.
        ACKNOWLEDGED: Admin has seen the alert but not resolved it.
        RESOLVED: Investigation complete, action taken.
        DISMISSED: Alert was a false positive or not actionable.
    """

    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class AppealStatus(str, Enum):
    """Lifecycle status of a user appeal.

    Attributes:
        PENDING: Appeal submitted, awaiting admin review.
        APPROVED: Appeal granted; restrictions lifted.
        REJECTED: Appeal denied; restrictions remain.
    """

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# ---------------------------------------------------------------------------
# SQLAlchemy ORM models
# ---------------------------------------------------------------------------


class SybilAuditLogDB(Base):
    """Immutable audit log for every anti-gaming decision.

    Records the check type, outcome, and metadata for each evaluation
    so that administrators can trace enforcement actions and identify
    false positives. Rows are never updated or deleted.

    Indexes:
        - ix_sybil_audit_user_id: Fast lookup by user.
        - ix_sybil_audit_check_decision: Filter by check type and decision.
        - ix_sybil_audit_created_at: Time-range queries for dashboards.
    """

    __tablename__ = "sybil_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(128), nullable=False, index=True)
    check_type = Column(String(64), nullable=False)
    decision = Column(String(16), nullable=False)
    reason = Column(Text, nullable=False)
    details = Column(JSON, default=dict, nullable=False)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_sybil_audit_check_decision", "check_type", "decision"),
        Index("ix_sybil_audit_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return (
            f"<SybilAuditLogDB(id={self.id!r}, user={self.user_id!r}, "
            f"check={self.check_type!r}, decision={self.decision!r})>"
        )


class SybilAlertDB(Base):
    """Admin alert for suspicious patterns detected by the sybil system.

    Alerts are created automatically when the detection engine observes
    anomalous behaviour (e.g., multiple accounts from the same IP,
    wallet clustering). Admins acknowledge and resolve alerts through
    the admin API.

    Indexes:
        - ix_sybil_alerts_status: Quick filtering for open alerts.
        - ix_sybil_alerts_severity: Priority-based alert triage.
    """

    __tablename__ = "sybil_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(128), nullable=False, index=True)
    alert_type = Column(String(64), nullable=False)
    severity = Column(String(16), nullable=False, default="medium")
    status = Column(String(16), nullable=False, default="open")
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=False)
    details = Column(JSON, default=dict, nullable=False)
    resolved_by = Column(String(128), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_sybil_alerts_status", "status"),
        Index("ix_sybil_alerts_severity", "severity"),
    )

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return (
            f"<SybilAlertDB(id={self.id!r}, user={self.user_id!r}, "
            f"severity={self.severity!r}, status={self.status!r})>"
        )


class SybilAppealDB(Base):
    """User appeal for false-positive sybil detections.

    Users who believe they were incorrectly flagged or blocked can
    submit an appeal with supporting evidence. Admins review and
    either approve (lifting restrictions) or reject the appeal.

    Indexes:
        - ix_sybil_appeals_status: Filter by appeal status.
        - ix_sybil_appeals_user_id: Lookup appeals for a specific user.
    """

    __tablename__ = "sybil_appeals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(128), nullable=False, index=True)
    audit_log_id = Column(UUID(as_uuid=True), nullable=True)
    reason = Column(Text, nullable=False)
    evidence = Column(Text, nullable=True)
    status = Column(String(16), nullable=False, default="pending")
    reviewed_by = Column(String(128), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_sybil_appeals_status", "status"),
    )

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return (
            f"<SybilAppealDB(id={self.id!r}, user={self.user_id!r}, "
            f"status={self.status!r})>"
        )


# ---------------------------------------------------------------------------
# Pydantic API schemas
# ---------------------------------------------------------------------------


class SybilCheckResult(BaseModel):
    """Result of a single anti-gaming check.

    Returned as part of the overall evaluation response so callers
    can see which specific check triggered a flag or block.

    Attributes:
        check_type: Which heuristic was evaluated.
        passed: Whether the user passed this specific check.
        decision: The enforcement outcome (allow, flag, or block).
        reason: Human-readable explanation of the decision.
        details: Machine-readable metadata about the check.
    """

    check_type: SybilCheckType
    passed: bool
    decision: SybilDecision
    reason: str
    details: Dict[str, Any] = Field(default_factory=dict)


class SybilEvaluationResponse(BaseModel):
    """Aggregate evaluation result across all anti-gaming checks.

    Contains the overall decision plus per-check breakdowns.
    The overall decision is the most restrictive among individual checks
    (block > flag > allow).

    Attributes:
        user_id: The user who was evaluated.
        overall_decision: The final enforcement decision.
        checks: Results from each individual heuristic.
        flagged_checks: Count of checks that returned flag or block.
        evaluated_at: Timestamp of the evaluation.
    """

    user_id: str
    overall_decision: SybilDecision
    checks: List[SybilCheckResult]
    flagged_checks: int = 0
    evaluated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class SybilAuditLogResponse(BaseModel):
    """API response for a single audit log entry.

    Attributes:
        id: Unique identifier for the audit record.
        user_id: The user who triggered the check.
        check_type: Which detection heuristic ran.
        decision: The enforcement outcome.
        reason: Human-readable explanation.
        details: Structured metadata.
        ip_address: Client IP at time of evaluation.
        created_at: When the record was created.
    """

    id: str
    user_id: str
    check_type: str
    decision: str
    reason: str
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SybilAuditLogListResponse(BaseModel):
    """Paginated list of sybil audit log entries.

    Attributes:
        items: The audit log records for the current page.
        total: Total number of matching records.
        page: Current page number (1-based).
        per_page: Maximum records per page.
    """

    items: List[SybilAuditLogResponse]
    total: int
    page: int
    per_page: int


class AlertResponse(BaseModel):
    """API response for a single admin alert.

    Attributes:
        id: Unique identifier for the alert.
        user_id: The flagged user.
        alert_type: Category of suspicious activity.
        severity: Alert priority level.
        status: Current lifecycle status.
        title: Brief summary of the alert.
        description: Detailed explanation.
        details: Machine-readable context.
        resolved_by: Admin who resolved the alert.
        resolved_at: When the alert was resolved.
        resolution_notes: Admin notes on resolution.
        created_at: When the alert was created.
    """

    id: str
    user_id: str
    alert_type: str
    severity: str
    status: str
    title: str
    description: str
    details: Dict[str, Any] = Field(default_factory=dict)
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertListResponse(BaseModel):
    """Paginated list of admin alerts.

    Attributes:
        items: Alert records for the current page.
        total: Total matching alert count.
        page: Current page number.
        per_page: Maximum records per page.
    """

    items: List[AlertResponse]
    total: int
    page: int
    per_page: int


class AlertResolveRequest(BaseModel):
    """Request body for resolving or dismissing an admin alert.

    Attributes:
        status: Target status (resolved or dismissed).
        notes: Admin explanation of the resolution.
    """

    status: AlertStatus = Field(
        ...,
        description="Target status: 'resolved' or 'dismissed'",
    )
    notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Admin notes explaining the resolution",
    )

    @field_validator("status")
    @classmethod
    def validate_resolve_status(cls, value: AlertStatus) -> AlertStatus:
        """Ensure only resolution statuses are used in this endpoint."""
        if value not in (AlertStatus.RESOLVED, AlertStatus.DISMISSED):
            raise ValueError("Status must be 'resolved' or 'dismissed'")
        return value


class AppealCreateRequest(BaseModel):
    """Request body for submitting a false-positive appeal.

    Attributes:
        audit_log_id: Optional reference to the specific audit entry being appealed.
        reason: User's explanation of why the flag was incorrect.
        evidence: Optional supporting evidence (links, screenshots, etc.).
    """

    audit_log_id: Optional[str] = Field(
        None,
        description="UUID of the audit log entry being appealed",
    )
    reason: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Explanation of why the detection was a false positive",
    )
    evidence: Optional[str] = Field(
        None,
        max_length=5000,
        description="Supporting evidence (links, explanations)",
    )


class AppealResponse(BaseModel):
    """API response for a single appeal record.

    Attributes:
        id: Unique identifier for the appeal.
        user_id: The user who submitted the appeal.
        audit_log_id: Reference to the disputed audit entry.
        reason: User's explanation.
        evidence: Supporting evidence.
        status: Current appeal lifecycle status.
        reviewed_by: Admin who reviewed the appeal.
        reviewed_at: When the review was completed.
        review_notes: Admin notes on the review decision.
        created_at: When the appeal was submitted.
    """

    id: str
    user_id: str
    audit_log_id: Optional[str] = None
    reason: str
    evidence: Optional[str] = None
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AppealListResponse(BaseModel):
    """Paginated list of appeal records.

    Attributes:
        items: Appeal records for the current page.
        total: Total matching appeal count.
        page: Current page number.
        per_page: Maximum records per page.
    """

    items: List[AppealResponse]
    total: int
    page: int
    per_page: int


class AppealReviewRequest(BaseModel):
    """Request body for an admin to approve or reject an appeal.

    Attributes:
        status: Target status (approved or rejected).
        notes: Admin explanation of the decision.
    """

    status: AppealStatus = Field(
        ...,
        description="Target status: 'approved' or 'rejected'",
    )
    notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Admin notes explaining the decision",
    )

    @field_validator("status")
    @classmethod
    def validate_review_status(cls, value: AppealStatus) -> AppealStatus:
        """Ensure only review-terminal statuses are used."""
        if value not in (AppealStatus.APPROVED, AppealStatus.REJECTED):
            raise ValueError("Status must be 'approved' or 'rejected'")
        return value


class SybilConfigResponse(BaseModel):
    """Current anti-gaming configuration thresholds.

    All thresholds are configurable via environment variables so
    operators can tune sensitivity without code changes.

    Attributes:
        github_min_account_age_days: Minimum GitHub account age in days.
        github_min_public_repos: Minimum public repositories required.
        github_min_total_commits: Minimum total commit contributions.
        max_active_claims_per_user: Maximum concurrent bounty claims.
        t1_cooldown_hours: Hours between T1 bounty completions.
        ip_max_accounts: Maximum accounts allowed per IP before flagging.
        wallet_cluster_threshold: Number of wallets from the same funding
            source before flagging.
    """

    github_min_account_age_days: int
    github_min_public_repos: int
    github_min_total_commits: int
    max_active_claims_per_user: int
    t1_cooldown_hours: int
    ip_max_accounts: int
    wallet_cluster_threshold: int
