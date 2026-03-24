"""Migration models for off-chain to on-chain data migration.

Defines SQLAlchemy tables and Pydantic schemas for tracking migration jobs,
individual record migrations, and verification results. All monetary values
use Numeric/Decimal for precision.

PostgreSQL migration path:
    CREATE TABLE migration_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        dry_run BOOLEAN NOT NULL DEFAULT true,
        batch_size INTEGER NOT NULL DEFAULT 10,
        total_records INTEGER NOT NULL DEFAULT 0,
        migrated_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        started_by VARCHAR(100) NOT NULL,
        error_summary TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
    );
    CREATE TABLE migration_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES migration_jobs(id),
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        pda_address VARCHAR(64),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        tx_signature VARCHAR(128),
        error_message TEXT,
        on_chain_data JSONB,
        off_chain_data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
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


class MigrationEntityType(str, Enum):
    """Types of entities that can be migrated to on-chain PDAs."""

    REPUTATION = "reputation"
    BOUNTY_RECORD = "bounty_record"
    TIER_LEVEL = "tier_level"


class MigrationJobStatus(str, Enum):
    """Lifecycle status of a migration job."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"
    DRY_RUN_COMPLETE = "dry_run_complete"


class MigrationRecordStatus(str, Enum):
    """Status of an individual record migration."""

    PENDING = "pending"
    MIGRATED = "migrated"
    SKIPPED = "skipped"
    FAILED = "failed"
    VERIFIED = "verified"
    ROLLED_BACK = "rolled_back"


# ---------------------------------------------------------------------------
# SQLAlchemy models
# ---------------------------------------------------------------------------


class MigrationJobTable(Base):
    """Persistent storage for migration job metadata.

    Tracks the overall progress of a batch migration job, including
    how many records were processed, skipped, or failed. Each job
    targets a single entity type (reputation, bounty_record, tier_level).
    """

    __tablename__ = "migration_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(50), nullable=False, index=True)
    status = Column(
        String(20), nullable=False, default=MigrationJobStatus.PENDING.value
    )
    dry_run = Column(Boolean, nullable=False, default=True)
    batch_size = Column(Integer, nullable=False, default=10)
    total_records = Column(Integer, nullable=False, default=0)
    migrated_count = Column(Integer, nullable=False, default=0)
    skipped_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    started_by = Column(String(100), nullable=False)
    error_summary = Column(Text, nullable=True)
    started_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)


class MigrationRecordTable(Base):
    """Persistent storage for individual record migration results.

    Each row represents one off-chain entity that was (or will be)
    migrated to an on-chain PDA. Stores both the original off-chain
    data snapshot and the resulting on-chain address and transaction
    signature for full audit traceability.
    """

    __tablename__ = "migration_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(
        UUID(as_uuid=True), ForeignKey("migration_jobs.id"), nullable=False, index=True
    )
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(String(100), nullable=False, index=True)
    pda_address = Column(String(64), nullable=True)
    status = Column(
        String(20), nullable=False, default=MigrationRecordStatus.PENDING.value
    )
    tx_signature = Column(String(128), nullable=True)
    error_message = Column(Text, nullable=True)
    on_chain_data = Column(JSON, nullable=True)
    off_chain_data = Column(JSON, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Pydantic request/response schemas
# ---------------------------------------------------------------------------


class MigrationJobCreate(BaseModel):
    """Request body to start a new migration job.

    Args:
        entity_type: Which data type to migrate (reputation, bounty_record, tier_level).
        dry_run: If True, simulate migration without sending on-chain transactions.
        batch_size: Number of records to process per transaction batch (1-50).
    """

    entity_type: MigrationEntityType
    dry_run: bool = Field(
        True, description="If true, simulate migration without sending transactions"
    )
    batch_size: int = Field(
        10, ge=1, le=50, description="Records per batch (max 50)"
    )

    @field_validator("batch_size")
    @classmethod
    def validate_batch_size(cls, value: int) -> int:
        """Ensure batch size is within safe limits for Solana transaction throughput."""
        if value < 1 or value > 50:
            raise ValueError("batch_size must be between 1 and 50")
        return value


class MigrationRecordResponse(BaseModel):
    """API response for a single migration record.

    Contains the full audit trail: entity identification, PDA address,
    transaction signature, and both off-chain and on-chain data snapshots.
    """

    id: str
    job_id: str
    entity_type: str
    entity_id: str
    pda_address: Optional[str] = None
    status: str
    tx_signature: Optional[str] = None
    error_message: Optional[str] = None
    on_chain_data: Optional[dict[str, Any]] = None
    off_chain_data: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class MigrationProgressResponse(BaseModel):
    """Real-time progress snapshot for a running migration job.

    Provides both counts and a percentage for UI progress bars.
    """

    job_id: str
    entity_type: str
    status: str
    total_records: int
    migrated_count: int
    skipped_count: int
    failed_count: int
    progress_percent: float = Field(
        description="Percentage of total records processed (0.0-100.0)"
    )

    model_config = {"from_attributes": True}


class MigrationJobResponse(BaseModel):
    """Full API response for a migration job.

    Includes all metadata, counts, and timing information for the job.
    """

    id: str
    entity_type: str
    status: str
    dry_run: bool
    batch_size: int
    total_records: int
    migrated_count: int
    skipped_count: int
    failed_count: int
    started_by: str
    error_summary: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    records: list[MigrationRecordResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class MigrationJobListResponse(BaseModel):
    """Paginated list of migration jobs."""

    items: list[MigrationJobResponse]
    total: int
    skip: int
    limit: int


class VerificationResult(BaseModel):
    """Result of comparing on-chain state against the off-chain database.

    Each mismatch includes which field differed and the values from
    both the off-chain database and the on-chain PDA.
    """

    entity_id: str
    entity_type: str
    pda_address: Optional[str] = None
    matches: bool
    off_chain_data: dict[str, Any]
    on_chain_data: Optional[dict[str, Any]] = None
    mismatches: list[str] = Field(default_factory=list)


class VerificationReport(BaseModel):
    """Aggregated verification report for a migration job.

    Summarizes how many entities match, how many have mismatches,
    and how many are missing from the chain entirely.
    """

    job_id: str
    entity_type: str
    total_checked: int
    matched_count: int
    mismatched_count: int
    missing_on_chain_count: int
    results: list[VerificationResult]


class RollbackRequest(BaseModel):
    """Request body to initiate a rollback of a completed migration job.

    Rollback flags records as rolled_back and documents the reversion
    to off-chain-only state. On-chain PDAs are marked as deprecated
    but not deleted (Solana accounts require lamport reclamation).

    Args:
        reason: Human-readable explanation for why rollback is needed.
    """

    reason: str = Field(
        ..., min_length=5, max_length=500,
        description="Reason for rollback (required for audit trail)"
    )


class RollbackResponse(BaseModel):
    """Response after completing a migration rollback.

    Reports how many records were reverted and the new job status.
    """

    job_id: str
    status: str
    rolled_back_count: int
    reason: str
    message: str
