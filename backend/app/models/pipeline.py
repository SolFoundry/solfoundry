"""Database models for CI/CD pipeline runs and deployment records.

Stores the complete lifecycle of pipeline executions including individual
stage results, deployment tracking, and environment configuration snapshots.
All pipeline data uses PostgreSQL as the primary source of truth with
proper indexes for dashboard queries.

References:
    - GitHub Actions API: https://docs.github.com/en/rest/actions
    - Solana CLI: https://docs.solanalabs.com/cli
"""

import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base, GUID


class PipelineStatus(str, enum.Enum):
    """Possible states for a CI/CD pipeline run.

    State machine transitions:
        QUEUED -> RUNNING -> SUCCESS | FAILURE | CANCELLED
        QUEUED -> CANCELLED
        RUNNING -> CANCELLED
    """

    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILURE = "failure"
    CANCELLED = "cancelled"


class StageStatus(str, enum.Enum):
    """Possible states for an individual pipeline stage.

    State machine transitions:
        PENDING -> RUNNING -> PASSED | FAILED | SKIPPED
        PENDING -> SKIPPED
    """

    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class DeploymentEnvironment(str, enum.Enum):
    """Target deployment environments with ascending trust levels.

    Promotions follow: local -> devnet -> staging -> mainnet.
    Each environment requires increasingly strict safety gates.
    """

    LOCAL = "local"
    DEVNET = "devnet"
    STAGING = "staging"
    MAINNET = "mainnet"


class PipelineRunDB(Base):
    """Represents a single CI/CD pipeline execution.

    Each run tracks the full lifecycle from queue to completion,
    including the Git context (branch, commit SHA), trigger source,
    and aggregated timing metrics. Linked to individual stage results
    via the ``stages`` relationship.

    Attributes:
        id: Unique identifier for this pipeline run.
        repository: GitHub repository in ``owner/repo`` format.
        branch: Git branch name that triggered the run.
        commit_sha: Full 40-character Git commit SHA.
        trigger: What initiated the run (push, pull_request, tag, manual).
        status: Current pipeline status (queued/running/success/failure/cancelled).
        started_at: Timestamp when the pipeline began executing.
        finished_at: Timestamp when the pipeline completed (nullable).
        duration_seconds: Total wall-clock time in seconds (nullable).
        created_by: User ID who triggered the run (nullable for automated triggers).
        error_message: Human-readable error summary on failure (nullable).
        created_at: Record creation timestamp.
    """

    __tablename__ = "pipeline_runs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    repository = Column(String(255), nullable=False, index=True)
    branch = Column(String(255), nullable=False)
    commit_sha = Column(String(40), nullable=False)
    trigger = Column(String(50), nullable=False, default="push")
    status = Column(
        String(20),
        nullable=False,
        default=PipelineStatus.QUEUED.value,
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Numeric(10, 2), nullable=True)
    created_by = Column(GUID(), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    stages = relationship(
        "PipelineStageDB",
        back_populates="pipeline_run",
        cascade="all, delete-orphan",
        order_by="PipelineStageDB.stage_order",
    )
    deployments = relationship(
        "DeploymentRecordDB",
        back_populates="pipeline_run",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_pipeline_runs_status_created", "status", "created_at"),
        Index("ix_pipeline_runs_branch", "branch"),
    )


class PipelineStageDB(Base):
    """Represents a single stage within a pipeline run.

    Stages execute sequentially (lint -> test -> build -> deploy) and
    each records its own status, timing, and output logs. The ``stage_order``
    column defines execution priority.

    Attributes:
        id: Unique identifier for this stage record.
        pipeline_run_id: Foreign key to the parent pipeline run.
        name: Human-readable stage name (e.g., ``lint``, ``test``, ``build``).
        stage_order: Execution order within the pipeline (0-based).
        status: Current stage status.
        started_at: Timestamp when this stage began (nullable).
        finished_at: Timestamp when this stage completed (nullable).
        duration_seconds: Wall-clock time for this stage in seconds (nullable).
        log_output: Truncated log output for display in the dashboard (nullable).
        error_detail: Structured error detail on failure (nullable).
    """

    __tablename__ = "pipeline_stages"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    pipeline_run_id = Column(
        GUID(), ForeignKey("pipeline_runs.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(100), nullable=False)
    stage_order = Column(Integer, nullable=False, default=0)
    status = Column(
        String(20),
        nullable=False,
        default=StageStatus.PENDING.value,
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Numeric(10, 2), nullable=True)
    log_output = Column(Text, nullable=True)
    error_detail = Column(Text, nullable=True)

    pipeline_run = relationship("PipelineRunDB", back_populates="stages")

    __table_args__ = (
        Index("ix_pipeline_stages_run_order", "pipeline_run_id", "stage_order"),
    )


class DeploymentRecordDB(Base):
    """Records a deployment to a specific environment.

    Tracks which pipeline run triggered the deployment, the target
    environment, the deployed version (Git tag or commit), and the
    Solana program IDs for on-chain deployments.

    Attributes:
        id: Unique identifier for this deployment.
        pipeline_run_id: Foreign key to the pipeline run that triggered this deploy.
        environment: Target environment (local/devnet/staging/mainnet).
        version: Deployed version string (Git tag or short SHA).
        program_id: Solana program ID for on-chain deploys (nullable).
        deployed_at: Timestamp of the deployment.
        deployed_by: User ID who authorized the deployment (nullable).
        rollback_version: Previous version for rollback reference (nullable).
        status: Deployment status (success/failure/rolled_back).
    """

    __tablename__ = "deployment_records"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    pipeline_run_id = Column(
        GUID(), ForeignKey("pipeline_runs.id", ondelete="SET NULL"), nullable=True
    )
    environment = Column(String(20), nullable=False)
    version = Column(String(100), nullable=False)
    program_id = Column(String(64), nullable=True)
    deployed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    deployed_by = Column(GUID(), nullable=True)
    rollback_version = Column(String(100), nullable=True)
    status = Column(String(20), nullable=False, default="success")

    pipeline_run = relationship("PipelineRunDB", back_populates="deployments")

    __table_args__ = (
        Index("ix_deployment_records_env_deployed", "environment", "deployed_at"),
    )


class EnvironmentConfigDB(Base):
    """Stores environment-specific configuration key-value pairs.

    Provides a centralized configuration store for local/devnet/mainnet
    settings. Sensitive values are never stored in plaintext -- the
    ``is_secret`` flag indicates values that should be masked in API
    responses and dashboard display.

    Attributes:
        id: Unique identifier for this config entry.
        environment: Which environment this config applies to.
        key: Configuration key name (e.g., ``SOLANA_RPC_URL``).
        value: Configuration value (masked if ``is_secret`` is true).
        is_secret: Whether this value should be redacted in API responses.
        description: Human-readable description of what this config controls.
        updated_at: Last modification timestamp.
        updated_by: User ID who last modified this entry (nullable).
    """

    __tablename__ = "environment_configs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    environment = Column(String(20), nullable=False)
    key = Column(String(255), nullable=False)
    value = Column(Text, nullable=False)
    is_secret = Column(Integer, nullable=False, default=0)
    description = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_by = Column(GUID(), nullable=True)

    __table_args__ = (
        UniqueConstraint("environment", "key", name="uq_env_config_env_key"),
        Index("ix_environment_configs_env", "environment"),
    )
