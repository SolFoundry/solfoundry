"""CI/CD pipeline management service.

Provides business logic for creating, updating, and querying pipeline runs,
individual stages, deployments, and environment configurations. All data
is persisted to PostgreSQL as the primary source of truth.

The service layer enforces state machine transitions, validates inputs,
and emits structured log events for observability. No in-memory caches
are used -- every read goes through the database session.

References:
    - GitHub Actions Workflow: https://docs.github.com/en/actions
    - Solana Devnet Deployment: https://docs.solanalabs.com/cli/deploy
"""

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pipeline import (
    DeploymentEnvironment,
    DeploymentRecordDB,
    EnvironmentConfigDB,
    PipelineRunDB,
    PipelineStageDB,
    PipelineStatus,
    StageStatus,
)

logger = logging.getLogger(__name__)

# Valid pipeline status transitions (state machine)
_VALID_PIPELINE_TRANSITIONS: dict[PipelineStatus, set[PipelineStatus]] = {
    PipelineStatus.QUEUED: {PipelineStatus.RUNNING, PipelineStatus.CANCELLED},
    PipelineStatus.RUNNING: {
        PipelineStatus.SUCCESS,
        PipelineStatus.FAILURE,
        PipelineStatus.CANCELLED,
    },
    PipelineStatus.SUCCESS: set(),
    PipelineStatus.FAILURE: set(),
    PipelineStatus.CANCELLED: set(),
}

# Valid stage status transitions
_VALID_STAGE_TRANSITIONS: dict[StageStatus, set[StageStatus]] = {
    StageStatus.PENDING: {StageStatus.RUNNING, StageStatus.SKIPPED},
    StageStatus.RUNNING: {StageStatus.PASSED, StageStatus.FAILED, StageStatus.SKIPPED},
    StageStatus.PASSED: set(),
    StageStatus.FAILED: set(),
    StageStatus.SKIPPED: set(),
}

# Default pipeline stages in execution order
DEFAULT_PIPELINE_STAGES = [
    {"name": "lint", "stage_order": 0},
    {"name": "test", "stage_order": 1},
    {"name": "build", "stage_order": 2},
    {"name": "deploy", "stage_order": 3},
]


class PipelineNotFoundError(Exception):
    """Raised when a pipeline run ID does not exist in the database."""


class InvalidPipelineTransitionError(Exception):
    """Raised when an invalid pipeline status transition is attempted."""


class StageNotFoundError(Exception):
    """Raised when a pipeline stage ID does not exist in the database."""


class InvalidStageTransitionError(Exception):
    """Raised when an invalid stage status transition is attempted."""


class DeploymentNotFoundError(Exception):
    """Raised when a deployment record ID does not exist in the database."""


class EnvironmentConfigNotFoundError(Exception):
    """Raised when an environment config entry does not exist."""


class DuplicateEnvironmentConfigError(Exception):
    """Raised when a config key already exists for the given environment."""


async def create_pipeline_run(
    session: AsyncSession,
    repository: str,
    branch: str,
    commit_sha: str,
    trigger: str = "push",
    created_by: Optional[str] = None,
    stages: Optional[list[dict[str, Any]]] = None,
) -> PipelineRunDB:
    """Create a new pipeline run with default or custom stages.

    Inserts a new pipeline run record in QUEUED status along with its
    child stage records. If no custom stages are provided, the default
    lint -> test -> build -> deploy pipeline is used.

    Args:
        session: Active database session for the transaction.
        repository: GitHub repository in ``owner/repo`` format.
        branch: Git branch name that triggered the run.
        commit_sha: Full 40-character Git commit SHA.
        trigger: What initiated the run (push, pull_request, tag, manual).
        created_by: User ID who triggered the run (None for automated).
        stages: Optional list of stage definitions with ``name`` and ``stage_order``.

    Returns:
        The newly created PipelineRunDB with eager-loaded stages.

    Raises:
        ValueError: If repository, branch, or commit_sha is empty.
    """
    if not repository or not repository.strip():
        raise ValueError("Repository name is required")
    if not branch or not branch.strip():
        raise ValueError("Branch name is required")
    if not commit_sha or len(commit_sha.strip()) < 7:
        raise ValueError("Valid commit SHA is required (minimum 7 characters)")

    pipeline_run = PipelineRunDB(
        id=uuid.uuid4(),
        repository=repository.strip(),
        branch=branch.strip(),
        commit_sha=commit_sha.strip(),
        trigger=trigger,
        status=PipelineStatus.QUEUED.value,
        created_by=uuid.UUID(created_by) if created_by else None,
        created_at=datetime.now(timezone.utc),
    )
    session.add(pipeline_run)

    stage_definitions = stages or DEFAULT_PIPELINE_STAGES
    for stage_def in stage_definitions:
        stage = PipelineStageDB(
            id=uuid.uuid4(),
            pipeline_run_id=pipeline_run.id,
            name=stage_def["name"],
            stage_order=stage_def.get("stage_order", 0),
            status=StageStatus.PENDING.value,
        )
        session.add(stage)

    await session.commit()
    await session.refresh(pipeline_run)

    logger.info(
        "Pipeline run created: id=%s repo=%s branch=%s stages=%d",
        pipeline_run.id,
        repository,
        branch,
        len(stage_definitions),
    )
    return pipeline_run


async def get_pipeline_run(
    session: AsyncSession,
    pipeline_run_id: str,
) -> PipelineRunDB:
    """Retrieve a pipeline run by ID with eager-loaded stages.

    Args:
        session: Active database session.
        pipeline_run_id: UUID of the pipeline run to fetch.

    Returns:
        The PipelineRunDB with stages loaded.

    Raises:
        PipelineNotFoundError: If no run exists with the given ID.
    """
    query = (
        select(PipelineRunDB)
        .options(selectinload(PipelineRunDB.stages))
        .where(PipelineRunDB.id == uuid.UUID(pipeline_run_id))
    )
    result = await session.execute(query)
    pipeline_run = result.scalar_one_or_none()

    if pipeline_run is None:
        raise PipelineNotFoundError(
            f"Pipeline run not found: {pipeline_run_id}"
        )
    return pipeline_run


async def list_pipeline_runs(
    session: AsyncSession,
    repository: Optional[str] = None,
    branch: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    """List pipeline runs with optional filters and pagination.

    Returns a paginated list of pipeline runs ordered by creation time
    (newest first). Supports filtering by repository, branch, and status.

    Args:
        session: Active database session.
        repository: Filter by repository name (optional).
        branch: Filter by branch name (optional).
        status: Filter by pipeline status (optional).
        limit: Maximum number of results to return (default 20, max 100).
        offset: Number of results to skip for pagination (default 0).

    Returns:
        Dictionary with ``items`` (list of runs), ``total`` (count),
        ``limit``, and ``offset`` for pagination metadata.
    """
    limit = min(max(1, limit), 100)
    offset = max(0, offset)

    conditions = []
    if repository:
        conditions.append(PipelineRunDB.repository == repository)
    if branch:
        conditions.append(PipelineRunDB.branch == branch)
    if status:
        try:
            status_enum = PipelineStatus(status)
            conditions.append(PipelineRunDB.status == status_enum.value)
        except ValueError:
            pass

    where_clause = and_(*conditions) if conditions else True

    count_query = select(func.count(PipelineRunDB.id)).where(where_clause)
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(PipelineRunDB)
        .options(selectinload(PipelineRunDB.stages))
        .where(where_clause)
        .order_by(desc(PipelineRunDB.created_at))
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(query)
    items = list(result.scalars().all())

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


async def update_pipeline_status(
    session: AsyncSession,
    pipeline_run_id: str,
    new_status: str,
    error_message: Optional[str] = None,
) -> PipelineRunDB:
    """Transition a pipeline run to a new status.

    Enforces the pipeline state machine -- only valid transitions are
    allowed. Automatically sets timing fields (started_at, finished_at,
    duration_seconds) based on the transition.

    Args:
        session: Active database session.
        pipeline_run_id: UUID of the pipeline run to update.
        new_status: Target status string (must be a valid PipelineStatus).
        error_message: Optional error message for failure transitions.

    Returns:
        The updated PipelineRunDB.

    Raises:
        PipelineNotFoundError: If no run exists with the given ID.
        InvalidPipelineTransitionError: If the transition is not allowed.
    """
    pipeline_run = await get_pipeline_run(session, pipeline_run_id)
    new_status_enum = PipelineStatus(new_status)

    # Get current status as enum for state machine lookup
    current_status_enum = PipelineStatus(pipeline_run.status)
    allowed_transitions = _VALID_PIPELINE_TRANSITIONS.get(current_status_enum, set())
    if new_status_enum not in allowed_transitions:
        raise InvalidPipelineTransitionError(
            f"Cannot transition from {pipeline_run.status} to {new_status}"
        )

    now = datetime.now(timezone.utc)
    pipeline_run.status = new_status_enum.value

    if new_status_enum == PipelineStatus.RUNNING:
        pipeline_run.started_at = now

    if new_status_enum in (
        PipelineStatus.SUCCESS,
        PipelineStatus.FAILURE,
        PipelineStatus.CANCELLED,
    ):
        pipeline_run.finished_at = now
        if pipeline_run.started_at:
            started = pipeline_run.started_at
            # Normalize timezone awareness for SQLite compatibility
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            delta = (now - started).total_seconds()
            pipeline_run.duration_seconds = Decimal(str(round(delta, 2)))

    if error_message:
        pipeline_run.error_message = error_message

    await session.commit()
    await session.refresh(pipeline_run)

    logger.info(
        "Pipeline status updated: id=%s status=%s",
        pipeline_run_id,
        new_status,
    )
    return pipeline_run


async def update_stage_status(
    session: AsyncSession,
    stage_id: str,
    new_status: str,
    log_output: Optional[str] = None,
    error_detail: Optional[str] = None,
) -> PipelineStageDB:
    """Transition a pipeline stage to a new status.

    Enforces the stage state machine and automatically manages timing
    fields. Optionally attaches log output or error details.

    Args:
        session: Active database session.
        stage_id: UUID of the stage to update.
        new_status: Target status string (must be a valid StageStatus).
        log_output: Optional log output to attach to the stage.
        error_detail: Optional error detail for failed stages.

    Returns:
        The updated PipelineStageDB.

    Raises:
        StageNotFoundError: If no stage exists with the given ID.
        InvalidStageTransitionError: If the transition is not allowed.
    """
    query = select(PipelineStageDB).where(
        PipelineStageDB.id == uuid.UUID(stage_id)
    )
    result = await session.execute(query)
    stage = result.scalar_one_or_none()

    if stage is None:
        raise StageNotFoundError(f"Pipeline stage not found: {stage_id}")

    new_status_enum = StageStatus(new_status)
    current_status_enum = StageStatus(stage.status)
    allowed_transitions = _VALID_STAGE_TRANSITIONS.get(current_status_enum, set())
    if new_status_enum not in allowed_transitions:
        raise InvalidStageTransitionError(
            f"Cannot transition stage from {stage.status} to {new_status}"
        )

    now = datetime.now(timezone.utc)
    stage.status = new_status_enum.value

    if new_status_enum == StageStatus.RUNNING:
        stage.started_at = now

    if new_status_enum in (StageStatus.PASSED, StageStatus.FAILED, StageStatus.SKIPPED):
        stage.finished_at = now
        if stage.started_at:
            started = stage.started_at
            # Normalize timezone awareness for SQLite compatibility
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            delta = (now - started).total_seconds()
            stage.duration_seconds = Decimal(str(round(delta, 2)))

    if log_output is not None:
        stage.log_output = log_output
    if error_detail is not None:
        stage.error_detail = error_detail

    await session.commit()
    await session.refresh(stage)

    logger.info(
        "Stage status updated: id=%s name=%s status=%s",
        stage_id,
        stage.name,
        new_status,
    )
    return stage


async def create_deployment(
    session: AsyncSession,
    environment: str,
    version: str,
    pipeline_run_id: Optional[str] = None,
    program_id: Optional[str] = None,
    deployed_by: Optional[str] = None,
) -> DeploymentRecordDB:
    """Record a new deployment to a target environment.

    Creates a deployment record linked to an optional pipeline run.
    Automatically captures the current version for rollback reference
    if a previous deployment exists for the same environment.

    Args:
        session: Active database session.
        environment: Target environment string (local/devnet/staging/mainnet).
        version: Deployed version (Git tag or short SHA).
        pipeline_run_id: UUID of the pipeline run that triggered this deploy.
        program_id: Solana program ID for on-chain deploys (optional).
        deployed_by: User ID who authorized the deployment (optional).

    Returns:
        The newly created DeploymentRecordDB.

    Raises:
        ValueError: If environment or version is invalid.
    """
    environment_enum = DeploymentEnvironment(environment)

    if not version or not version.strip():
        raise ValueError("Deployment version is required")

    # Find previous deployment for rollback reference
    prev_query = (
        select(DeploymentRecordDB)
        .where(DeploymentRecordDB.environment == environment_enum.value)
        .order_by(desc(DeploymentRecordDB.deployed_at))
        .limit(1)
    )
    prev_result = await session.execute(prev_query)
    previous_deployment = prev_result.scalar_one_or_none()

    deployment = DeploymentRecordDB(
        id=uuid.uuid4(),
        pipeline_run_id=uuid.UUID(pipeline_run_id) if pipeline_run_id else None,
        environment=environment_enum.value,
        version=version.strip(),
        program_id=program_id,
        deployed_at=datetime.now(timezone.utc),
        deployed_by=uuid.UUID(deployed_by) if deployed_by else None,
        rollback_version=previous_deployment.version if previous_deployment else None,
        status="success",
    )
    session.add(deployment)
    await session.commit()
    await session.refresh(deployment)

    logger.info(
        "Deployment recorded: id=%s env=%s version=%s",
        deployment.id,
        environment,
        version,
    )
    return deployment


async def list_deployments(
    session: AsyncSession,
    environment: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    """List deployments with optional environment filter and pagination.

    Args:
        session: Active database session.
        environment: Filter by target environment (optional).
        limit: Maximum number of results (default 20, max 100).
        offset: Pagination offset (default 0).

    Returns:
        Dictionary with ``items``, ``total``, ``limit``, and ``offset``.
    """
    limit = min(max(1, limit), 100)
    offset = max(0, offset)

    conditions = []
    if environment:
        try:
            env_enum = DeploymentEnvironment(environment)
            conditions.append(DeploymentRecordDB.environment == env_enum.value)
        except ValueError:
            pass

    where_clause = and_(*conditions) if conditions else True

    count_query = select(func.count(DeploymentRecordDB.id)).where(where_clause)
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(DeploymentRecordDB)
        .where(where_clause)
        .order_by(desc(DeploymentRecordDB.deployed_at))
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(query)
    items = list(result.scalars().all())

    return {"items": items, "total": total, "limit": limit, "offset": offset}


async def set_environment_config(
    session: AsyncSession,
    environment: str,
    key: str,
    value: str,
    is_secret: bool = False,
    description: Optional[str] = None,
    updated_by: Optional[str] = None,
) -> EnvironmentConfigDB:
    """Create or update an environment configuration entry.

    If a config with the same environment and key already exists, it is
    updated in place. Otherwise a new record is created.

    Args:
        session: Active database session.
        environment: Target environment (local/devnet/staging/mainnet).
        key: Configuration key name.
        value: Configuration value.
        is_secret: Whether this value should be masked in API responses.
        description: Human-readable description (optional).
        updated_by: User ID performing the update (optional).

    Returns:
        The created or updated EnvironmentConfigDB.
    """
    environment_enum = DeploymentEnvironment(environment)

    if not key or not key.strip():
        raise ValueError("Configuration key is required")

    query = select(EnvironmentConfigDB).where(
        and_(
            EnvironmentConfigDB.environment == environment_enum.value,
            EnvironmentConfigDB.key == key.strip(),
        )
    )
    result = await session.execute(query)
    existing = result.scalar_one_or_none()

    if existing:
        existing.value = value
        existing.is_secret = 1 if is_secret else 0
        existing.description = description
        existing.updated_at = datetime.now(timezone.utc)
        existing.updated_by = uuid.UUID(updated_by) if updated_by else None
        config_entry = existing
    else:
        config_entry = EnvironmentConfigDB(
            id=uuid.uuid4(),
            environment=environment_enum.value,
            key=key.strip(),
            value=value,
            is_secret=1 if is_secret else 0,
            description=description,
            updated_at=datetime.now(timezone.utc),
            updated_by=uuid.UUID(updated_by) if updated_by else None,
        )
        session.add(config_entry)

    await session.commit()
    await session.refresh(config_entry)

    logger.info(
        "Environment config set: env=%s key=%s secret=%s",
        environment,
        key,
        is_secret,
    )
    return config_entry


async def get_environment_configs(
    session: AsyncSession,
    environment: str,
) -> list[EnvironmentConfigDB]:
    """Retrieve all configuration entries for a specific environment.

    Secret values are returned with their ``is_secret`` flag set so the
    API layer can mask them before sending to the client.

    Args:
        session: Active database session.
        environment: Target environment to fetch configs for.

    Returns:
        List of EnvironmentConfigDB entries for the given environment.
    """
    environment_enum = DeploymentEnvironment(environment)

    query = (
        select(EnvironmentConfigDB)
        .where(EnvironmentConfigDB.environment == environment_enum.value)
        .order_by(EnvironmentConfigDB.key)
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_pipeline_statistics(
    session: AsyncSession,
    repository: Optional[str] = None,
) -> dict[str, Any]:
    """Compute aggregate pipeline statistics.

    Returns counts by status, average duration, and success rate for
    the optional repository filter. Used by the CI/CD dashboard.

    Args:
        session: Active database session.
        repository: Filter by repository name (optional).

    Returns:
        Dictionary with ``total_runs``, ``status_counts``, ``average_duration_seconds``,
        and ``success_rate`` (0.0 - 1.0).
    """
    conditions = []
    if repository:
        conditions.append(PipelineRunDB.repository == repository)

    where_clause = and_(*conditions) if conditions else True

    # Total runs
    total_query = select(func.count(PipelineRunDB.id)).where(where_clause)
    total_result = await session.execute(total_query)
    total_runs = total_result.scalar() or 0

    # Counts by status
    status_query = (
        select(PipelineRunDB.status, func.count(PipelineRunDB.id))
        .where(where_clause)
        .group_by(PipelineRunDB.status)
    )
    status_result = await session.execute(status_query)
    status_counts = {
        (row[0].value if hasattr(row[0], "value") else str(row[0])): row[1]
        for row in status_result.all()
    }

    # Average duration of completed runs
    avg_query = (
        select(func.avg(PipelineRunDB.duration_seconds))
        .where(
            and_(
                where_clause,
                PipelineRunDB.duration_seconds.isnot(None),
            )
        )
    )
    avg_result = await session.execute(avg_query)
    average_duration = avg_result.scalar()

    success_count = status_counts.get("success", 0)
    success_rate = (
        round(success_count / total_runs, 4) if total_runs > 0 else 0.0
    )

    return {
        "total_runs": total_runs,
        "status_counts": status_counts,
        "average_duration_seconds": (
            float(average_duration) if average_duration else None
        ),
        "success_rate": success_rate,
    }
