"""Persistent anti-gaming: audit trail, admin alerts, appeals, T1 cooldown log."""

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, Integer, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class AntiGamingAuditTable(Base):
    """Append-only record of anti-gaming decisions for compliance review."""

    __tablename__ = "anti_gaming_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    decision = Column(String(20), nullable=False, index=True)
    rule_name = Column(String(80), nullable=False, index=True)
    outcome = Column(String(20), nullable=False)
    subject_user_id = Column(String(36), nullable=True, index=True)
    subject_key = Column(String(200), nullable=True, index=True)
    details = Column(sa.JSON, nullable=False, default=dict)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )


class SybilAlertTable(Base):
    """Admin-visible alerts for suspicious patterns (IP, wallet clustering, etc.)."""

    __tablename__ = "sybil_admin_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_type = Column(String(64), nullable=False, index=True)
    severity = Column(String(20), nullable=False, server_default="warning")
    summary = Column(String(500), nullable=False)
    details = Column(sa.JSON, nullable=False, default=dict)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String(200), nullable=True)


class AntiGamingAppealTable(Base):
    """User appeals after false positives or disputed automated decisions."""

    __tablename__ = "anti_gaming_appeals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(36), nullable=False, index=True)
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, server_default="pending", index=True)
    related_audit_id = Column(UUID(as_uuid=True), nullable=True)
    admin_note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class T1CompletionLogTable(Base):
    """Tracks T1 completions per actor for cooldown enforcement."""

    __tablename__ = "t1_completion_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_key = Column(String(200), nullable=False, index=True)
    bounty_id = Column(String(64), nullable=False, index=True)
    completed_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )

    __table_args__ = (Index("ix_t1_actor_completed", "actor_key", "completed_at"),)


class WalletClusterMembershipTable(Base):
    """Maps users to an inferred on-chain funding fingerprint (shared = suspicious)."""

    __tablename__ = "wallet_cluster_membership"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(36), nullable=False, unique=True, index=True)
    cluster_key = Column(String(64), nullable=False, index=True)
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )
