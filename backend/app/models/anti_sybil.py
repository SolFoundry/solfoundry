"""ORM models and Pydantic schemas for the anti-sybil / anti-gaming system."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import sqlalchemy as sa
from pydantic import BaseModel, Field
from sqlalchemy import Column, Index, String, Text, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship  # noqa: F401 (kept for future FKs)

from app.database import Base, GUID


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class FlagType(str, enum.Enum):
    """Category of the detected violation."""

    GITHUB_AGE = "github_age"
    GITHUB_ACTIVITY = "github_activity"
    WALLET_CLUSTER = "wallet_cluster"
    IP_CLUSTER = "ip_cluster"
    CLAIM_RATE = "claim_rate"
    T1_FARMING = "t1_farming"


class FlagSeverity(str, enum.Enum):
    """Impact level of the flag."""

    SOFT = "soft"   # Log + alert, but do not block
    HARD = "hard"   # Block the offending action


class AppealStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# ---------------------------------------------------------------------------
# ORM tables
# ---------------------------------------------------------------------------


class SybilFlagTable(Base):
    """Persistent record of every anti-sybil check that fired."""

    __tablename__ = "sybil_flags"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), nullable=False, index=True)
    flag_type = Column(SAEnum(FlagType, name="flag_type_enum"), nullable=False, index=True)
    severity = Column(SAEnum(FlagSeverity, name="flag_severity_enum"), nullable=False)
    details = Column(JSONB().with_variant(sa.JSON, "sqlite"), nullable=False, server_default=sa.text("'{}'::jsonb"))
    resolved = Column(Boolean, nullable=False, server_default=sa.false())
    resolved_by = Column(String(100), nullable=True)
    resolved_note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_sybil_flags_user_type", "user_id", "flag_type"),
        Index("ix_sybil_flags_created_at", "created_at"),
    )


class SybilAppealTable(Base):
    """Appeal submitted by a user against a sybil flag."""

    __tablename__ = "sybil_appeals"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(100), nullable=False, index=True)
    flag_id = Column(GUID(), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    status = Column(
        SAEnum(AppealStatus, name="appeal_status_enum"),
        nullable=False,
        server_default="pending",
    )
    reviewer_note = Column(Text, nullable=True)
    reviewed_by = Column(String(100), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_sybil_appeals_user_flag", "user_id", "flag_id"),)


class IpAccountMapTable(Base):
    """Tracks which IP addresses have been used to register accounts.

    Used for IP-clustering detection (multiple accounts from the same IP).
    """

    __tablename__ = "ip_account_map"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    ip_hash = Column(String(64), nullable=False, index=True)  # SHA-256 of real IP
    user_id = Column(String(100), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

    __table_args__ = (
        Index("ix_ip_account_map_ip_user", "ip_hash", "user_id", unique=True),
    )


class WalletFundingMapTable(Base):
    """Maps a contributor wallet to the wallet that funded it (first SOL funder).

    Used for wallet-clustering detection.
    """

    __tablename__ = "wallet_funding_map"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    wallet = Column(String(64), nullable=False, unique=True, index=True)
    funding_source = Column(String(64), nullable=True, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class SybilFlagResponse(BaseModel):
    id: str
    user_id: str
    flag_type: FlagType
    severity: FlagSeverity
    details: dict[str, Any]
    resolved: bool
    resolved_by: Optional[str] = None
    resolved_note: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AppealCreateRequest(BaseModel):
    flag_id: str = Field(..., description="UUID of the SybilFlag being appealed")
    reason: str = Field(
        ...,
        min_length=20,
        max_length=2000,
        description="Explanation of why the flag is incorrect",
    )


class AppealResponse(BaseModel):
    id: str
    user_id: str
    flag_id: str
    reason: str
    status: AppealStatus
    reviewer_note: Optional[str] = None
    reviewed_by: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ResolveAppealRequest(BaseModel):
    status: AppealStatus = Field(
        ..., description="New status: 'approved' or 'rejected'"
    )
    reviewer_note: str = Field(..., min_length=5, max_length=1000)


class ResolveFlagRequest(BaseModel):
    resolved_note: str = Field(..., min_length=5, max_length=1000)


class CheckResult(BaseModel):
    """Result returned by a single heuristic check."""

    passed: bool
    flag_type: Optional[FlagType] = None
    severity: Optional[FlagSeverity] = None
    details: dict[str, Any] = Field(default_factory=dict)
    message: str = ""


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
