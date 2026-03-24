"""CI/CD Pipeline API endpoints.

Provides REST endpoints for managing pipeline runs, stages, deployments,
environment configurations, and CI config validation. All mutation endpoints
require authentication via ``get_current_user_id``.

Routes:
    POST   /api/pipelines/runs              — Create a new pipeline run
    GET    /api/pipelines/runs              — List pipeline runs (paginated)
    GET    /api/pipelines/runs/{id}         — Get a specific pipeline run
    PATCH  /api/pipelines/runs/{id}/status  — Update pipeline run status
    PATCH  /api/pipelines/stages/{id}/status — Update stage status
    POST   /api/pipelines/deployments       — Record a deployment
    GET    /api/pipelines/deployments       — List deployments (paginated)
    GET    /api/pipelines/stats             — Pipeline statistics
    POST   /api/pipelines/configs           — Set environment config
    GET    /api/pipelines/configs/{env}     — Get environment configs
    GET    /api/pipelines/environments      — Environment summary
    POST   /api/pipelines/validate          — Validate CI config

References:
    - FastAPI Router: https://fastapi.tiangolo.com/tutorial/bigger-applications/
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.services.pipeline_service import (
    DeploymentNotFoundError,
    InvalidPipelineTransitionError,
    InvalidStageTransitionError,
    PipelineNotFoundError,
    StageNotFoundError,
    create_deployment,
    create_pipeline_run,
    get_pipeline_run,
    get_pipeline_statistics,
    list_deployments,
    list_pipeline_runs,
    update_pipeline_status,
    update_stage_status,
)
from app.services.environment_service import (
    get_environment_summary,
    seed_default_configs,
)
from app.services.pipeline_service import (
    get_environment_configs,
    set_environment_config,
)
from app.services.ci_config_validator import (
    validate_workflow_config,
    validate_docker_compose,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/pipelines",
    tags=["pipelines"],
)


# ── Request/Response Schemas ──────────────────────────────────────────────────


class CreatePipelineRunRequest(BaseModel):
    """Request body for creating a new pipeline run.

    Attributes:
        repository: GitHub repository in ``owner/repo`` format.
        branch: Git branch name that triggered the run.
        commit_sha: Git commit SHA (minimum 7 characters).
        trigger: What initiated the run (push, pull_request, tag, manual).
        stages: Optional custom stage definitions.
    """

    repository: str = Field(..., min_length=1, max_length=255)
    branch: str = Field(..., min_length=1, max_length=255)
    commit_sha: str = Field(..., min_length=7, max_length=40)
    trigger: str = Field(default="push", max_length=50)
    stages: Optional[list[dict[str, Any]]] = None

    model_config = {"from_attributes": True}


class UpdateStatusRequest(BaseModel):
    """Request body for updating a pipeline run or stage status.

    Attributes:
        status: New status value.
        error_message: Optional error message for failure transitions.
        log_output: Optional log output for stage updates.
        error_detail: Optional structured error detail for stage updates.
    """

    status: str
    error_message: Optional[str] = None
    log_output: Optional[str] = None
    error_detail: Optional[str] = None

    model_config = {"from_attributes": True}


class CreateDeploymentRequest(BaseModel):
    """Request body for recording a new deployment.

    Attributes:
        environment: Target environment (local, devnet, staging, mainnet).
        version: Deployed version string (Git tag or short SHA).
        pipeline_run_id: Optional UUID of the triggering pipeline run.
        program_id: Optional Solana program ID for on-chain deploys.
    """

    environment: str
    version: str = Field(..., min_length=1, max_length=100)
    pipeline_run_id: Optional[str] = None
    program_id: Optional[str] = None

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, value: str) -> str:
        """Ensure environment is a valid deployment target.

        Args:
            value: The environment string to validate.

        Returns:
            The validated environment string.

        Raises:
            ValueError: If the environment is not a valid option.
        """
        valid_environments = {"local", "devnet", "staging", "mainnet"}
        if value not in valid_environments:
            raise ValueError(
                f"Invalid environment: {value}. Must be one of: {', '.join(sorted(valid_environments))}"
            )
        return value

    model_config = {"from_attributes": True}


class SetEnvironmentConfigRequest(BaseModel):
    """Request body for setting an environment configuration entry.

    Attributes:
        environment: Target environment.
        key: Configuration key name.
        value: Configuration value.
        is_secret: Whether this value should be masked in responses.
        description: Optional human-readable description.
    """

    environment: str
    key: str = Field(..., min_length=1, max_length=255)
    value: str
    is_secret: bool = False
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class ValidateConfigRequest(BaseModel):
    """Request body for validating a CI/CD configuration.

    Attributes:
        config: The workflow or docker-compose configuration dictionary.
        config_type: Type of config to validate (workflow or docker_compose).
    """

    config: dict[str, Any]
    config_type: str = Field(default="workflow")

    model_config = {"from_attributes": True}


class PipelineRunResponse(BaseModel):
    """Response body for a pipeline run.

    Attributes:
        id: Pipeline run UUID.
        repository: GitHub repository name.
        branch: Git branch name.
        commit_sha: Git commit SHA.
        trigger: What initiated the run.
        status: Current pipeline status.
        started_at: When the pipeline started executing.
        finished_at: When the pipeline completed.
        duration_seconds: Total duration in seconds.
        error_message: Error message if failed.
        created_at: Record creation timestamp.
        stages: List of stage details.
    """

    id: str
    repository: str
    branch: str
    commit_sha: str
    trigger: str
    status: str
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None
    created_at: str
    stages: list[dict[str, Any]] = []

    model_config = {"from_attributes": True}


class DeploymentResponse(BaseModel):
    """Response body for a deployment record.

    Attributes:
        id: Deployment UUID.
        environment: Target environment.
        version: Deployed version.
        program_id: Solana program ID (if applicable).
        deployed_at: Deployment timestamp.
        rollback_version: Previous version for rollback.
        status: Deployment status.
    """

    id: str
    environment: str
    version: str
    program_id: Optional[str] = None
    deployed_at: str
    rollback_version: Optional[str] = None
    status: str

    model_config = {"from_attributes": True}


# ── Helper Functions ──────────────────────────────────────────────────────────


def _serialize_pipeline_run(run: Any) -> dict[str, Any]:
    """Serialize a PipelineRunDB to a dictionary for API responses.

    Args:
        run: The PipelineRunDB instance to serialize.

    Returns:
        Dictionary representation suitable for JSON response.
    """
    stages = []
    if hasattr(run, "stages") and run.stages:
        for stage in sorted(run.stages, key=lambda s: s.stage_order):
            stages.append(
                {
                    "id": str(stage.id),
                    "name": stage.name,
                    "stage_order": stage.stage_order,
                    "status": str(stage.status),
                    "started_at": stage.started_at.isoformat() if stage.started_at else None,
                    "finished_at": stage.finished_at.isoformat() if stage.finished_at else None,
                    "duration_seconds": float(stage.duration_seconds) if stage.duration_seconds else None,
                    "log_output": stage.log_output,
                    "error_detail": stage.error_detail,
                }
            )

    return {
        "id": str(run.id),
        "repository": run.repository,
        "branch": run.branch,
        "commit_sha": run.commit_sha,
        "trigger": run.trigger,
        "status": str(run.status),
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "finished_at": run.finished_at.isoformat() if run.finished_at else None,
        "duration_seconds": float(run.duration_seconds) if run.duration_seconds else None,
        "error_message": run.error_message,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "stages": stages,
    }


def _serialize_deployment(deployment: Any) -> dict[str, Any]:
    """Serialize a DeploymentRecordDB to a dictionary for API responses.

    Args:
        deployment: The DeploymentRecordDB instance to serialize.

    Returns:
        Dictionary representation suitable for JSON response.
    """
    return {
        "id": str(deployment.id),
        "environment": str(deployment.environment),
        "version": deployment.version,
        "program_id": deployment.program_id,
        "deployed_at": deployment.deployed_at.isoformat() if deployment.deployed_at else None,
        "rollback_version": deployment.rollback_version,
        "status": deployment.status,
    }


# ── Pipeline Run Endpoints ────────────────────────────────────────────────────


@router.post("/runs", status_code=status.HTTP_201_CREATED)
async def create_run(
    request: CreatePipelineRunRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Create a new CI/CD pipeline run.

    Initializes a pipeline run in QUEUED status with default or custom
    stages. Requires authentication.

    Args:
        request: Pipeline run creation parameters.
        user_id: Authenticated user ID from auth middleware.
        session: Database session from dependency injection.

    Returns:
        The newly created pipeline run with all stages.

    Raises:
        HTTPException: 400 if validation fails.
    """
    try:
        run = await create_pipeline_run(
            session=session,
            repository=request.repository,
            branch=request.branch,
            commit_sha=request.commit_sha,
            trigger=request.trigger,
            created_by=user_id,
            stages=request.stages,
        )
        return _serialize_pipeline_run(run)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get("/runs")
async def list_runs(
    repository: Optional[str] = Query(None, description="Filter by repository"),
    branch: Optional[str] = Query(None, description="Filter by branch"),
    pipeline_status: Optional[str] = Query(
        None, alias="status", description="Filter by status"
    ),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """List pipeline runs with optional filters and pagination.

    Returns a paginated list of pipeline runs ordered by creation time
    (newest first). No authentication required for read access.

    Args:
        repository: Optional repository name filter.
        branch: Optional branch name filter.
        pipeline_status: Optional status filter.
        limit: Maximum results per page (1-100).
        offset: Pagination offset.
        session: Database session from dependency injection.

    Returns:
        Paginated response with pipeline runs and metadata.
    """
    result = await list_pipeline_runs(
        session=session,
        repository=repository,
        branch=branch,
        status=pipeline_status,
        limit=limit,
        offset=offset,
    )
    return {
        "items": [_serialize_pipeline_run(run) for run in result["items"]],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
    }


@router.get("/runs/{pipeline_run_id}")
async def get_run(
    pipeline_run_id: str,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get a specific pipeline run by ID.

    Returns the full pipeline run details including all stages.
    No authentication required for read access.

    Args:
        pipeline_run_id: UUID of the pipeline run.
        session: Database session from dependency injection.

    Returns:
        The pipeline run with all stage details.

    Raises:
        HTTPException: 404 if the pipeline run does not exist.
    """
    try:
        run = await get_pipeline_run(session, pipeline_run_id)
        return _serialize_pipeline_run(run)
    except PipelineNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline run not found: {pipeline_run_id}",
        )


@router.patch("/runs/{pipeline_run_id}/status")
async def update_run_status(
    pipeline_run_id: str,
    request: UpdateStatusRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Update the status of a pipeline run.

    Enforces the pipeline state machine. Only valid transitions are
    allowed. Requires authentication.

    Args:
        pipeline_run_id: UUID of the pipeline run to update.
        request: New status and optional error message.
        user_id: Authenticated user ID from auth middleware.
        session: Database session from dependency injection.

    Returns:
        The updated pipeline run.

    Raises:
        HTTPException: 404 if not found, 409 if transition is invalid.
    """
    try:
        run = await update_pipeline_status(
            session=session,
            pipeline_run_id=pipeline_run_id,
            new_status=request.status,
            error_message=request.error_message,
        )
        return _serialize_pipeline_run(run)
    except PipelineNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline run not found: {pipeline_run_id}",
        )
    except InvalidPipelineTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


# ── Stage Endpoints ───────────────────────────────────────────────────────────


@router.patch("/stages/{stage_id}/status")
async def update_stage(
    stage_id: str,
    request: UpdateStatusRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Update the status of a pipeline stage.

    Enforces the stage state machine. Optionally attaches log output
    or error details. Requires authentication.

    Args:
        stage_id: UUID of the stage to update.
        request: New status, optional logs and error detail.
        user_id: Authenticated user ID from auth middleware.
        session: Database session from dependency injection.

    Returns:
        The updated stage details.

    Raises:
        HTTPException: 404 if not found, 409 if transition is invalid.
    """
    try:
        stage = await update_stage_status(
            session=session,
            stage_id=stage_id,
            new_status=request.status,
            log_output=request.log_output,
            error_detail=request.error_detail,
        )
        return {
            "id": str(stage.id),
            "name": stage.name,
            "stage_order": stage.stage_order,
            "status": str(stage.status),
            "started_at": stage.started_at.isoformat() if stage.started_at else None,
            "finished_at": stage.finished_at.isoformat() if stage.finished_at else None,
            "duration_seconds": float(stage.duration_seconds) if stage.duration_seconds else None,
            "log_output": stage.log_output,
            "error_detail": stage.error_detail,
        }
    except StageNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pipeline stage not found: {stage_id}",
        )
    except InvalidStageTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


# ── Deployment Endpoints ──────────────────────────────────────────────────────


@router.post("/deployments", status_code=status.HTTP_201_CREATED)
async def create_deployment_record(
    request: CreateDeploymentRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Record a new deployment to a target environment.

    Creates a deployment record with automatic rollback version tracking.
    Requires authentication.

    Args:
        request: Deployment creation parameters.
        user_id: Authenticated user ID from auth middleware.
        session: Database session from dependency injection.

    Returns:
        The newly created deployment record.

    Raises:
        HTTPException: 400 if validation fails.
    """
    try:
        deployment = await create_deployment(
            session=session,
            environment=request.environment,
            version=request.version,
            pipeline_run_id=request.pipeline_run_id,
            program_id=request.program_id,
            deployed_by=user_id,
        )
        return _serialize_deployment(deployment)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get("/deployments")
async def list_deployment_records(
    environment: Optional[str] = Query(None, description="Filter by environment"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """List deployment records with optional environment filter.

    Returns a paginated list of deployments ordered by deployment time
    (newest first). No authentication required for read access.

    Args:
        environment: Optional environment name filter.
        limit: Maximum results per page (1-100).
        offset: Pagination offset.
        session: Database session from dependency injection.

    Returns:
        Paginated response with deployment records and metadata.
    """
    result = await list_deployments(
        session=session,
        environment=environment,
        limit=limit,
        offset=offset,
    )
    return {
        "items": [_serialize_deployment(d) for d in result["items"]],
        "total": result["total"],
        "limit": result["limit"],
        "offset": result["offset"],
    }


# ── Statistics Endpoint ───────────────────────────────────────────────────────


@router.get("/stats")
async def pipeline_stats(
    repository: Optional[str] = Query(None, description="Filter by repository"),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get aggregate pipeline statistics.

    Returns total runs, status breakdown, average duration, and success
    rate. No authentication required for read access.

    Args:
        repository: Optional repository name filter.
        session: Database session from dependency injection.

    Returns:
        Pipeline statistics dictionary.
    """
    return await get_pipeline_statistics(session, repository=repository)


# ── Environment Config Endpoints ──────────────────────────────────────────────


@router.post("/configs", status_code=status.HTTP_201_CREATED)
async def set_config(
    request: SetEnvironmentConfigRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Set an environment configuration entry.

    Creates or updates a config key-value pair for the specified
    environment. Requires authentication.

    Args:
        request: Configuration entry parameters.
        user_id: Authenticated user ID from auth middleware.
        session: Database session from dependency injection.

    Returns:
        The created or updated configuration entry.

    Raises:
        HTTPException: 400 if validation fails.
    """
    try:
        config_entry = await set_environment_config(
            session=session,
            environment=request.environment,
            key=request.key,
            value=request.value,
            is_secret=request.is_secret,
            description=request.description,
            updated_by=user_id,
        )
        return {
            "id": str(config_entry.id),
            "environment": str(config_entry.environment),
            "key": config_entry.key,
            "value": "********" if config_entry.is_secret else config_entry.value,
            "is_secret": bool(config_entry.is_secret),
            "description": config_entry.description,
        }
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get("/configs/{environment}")
async def get_configs(
    environment: str,
    session: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Get all configuration entries for an environment.

    Secret values are masked with asterisks in the response.
    No authentication required for read access.

    Args:
        environment: Target environment name.
        session: Database session from dependency injection.

    Returns:
        List of configuration entries with masked secret values.

    Raises:
        HTTPException: 400 if environment is invalid.
    """
    try:
        configs = await get_environment_configs(session, environment)
        return [
            {
                "id": str(config_entry.id),
                "environment": str(config_entry.environment),
                "key": config_entry.key,
                "value": "********" if config_entry.is_secret else config_entry.value,
                "is_secret": bool(config_entry.is_secret),
                "description": config_entry.description,
            }
            for config_entry in configs
        ]
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get("/environments")
async def environment_summary(
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Get a summary of all environment configurations.

    Returns config counts and masked values for each environment.
    No authentication required.

    Args:
        session: Database session from dependency injection.

    Returns:
        Dictionary mapping environment names to their config summaries.
    """
    return await get_environment_summary(session)


@router.post("/environments/seed", status_code=status.HTTP_201_CREATED)
async def seed_configs(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Seed default environment configurations.

    Populates all environments with sensible default configurations.
    Safe to call multiple times (upsert behavior). Requires authentication.

    Args:
        user_id: Authenticated user ID from auth middleware.
        session: Database session from dependency injection.

    Returns:
        Dictionary mapping environment names to seeded config counts.
    """
    return await seed_default_configs(session)


# ── Validation Endpoint ───────────────────────────────────────────────────────


@router.post("/validate")
async def validate_config(
    request: ValidateConfigRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Validate a CI/CD configuration (workflow or docker-compose).

    Runs comprehensive validation checks against the provided configuration
    and returns findings with severity levels. Requires authentication.

    Args:
        request: Configuration to validate and its type.
        user_id: Authenticated user ID from auth middleware.

    Returns:
        Validation result with findings, validity status, and check counts.
    """
    if request.config_type == "docker_compose":
        validation_result = validate_docker_compose(request.config)
    else:
        validation_result = validate_workflow_config(request.config)

    return {
        "is_valid": validation_result.is_valid,
        "workflow_name": validation_result.workflow_name,
        "total_checks": validation_result.total_checks,
        "error_count": validation_result.error_count,
        "warning_count": validation_result.warning_count,
        "findings": [
            {
                "severity": finding.severity.value,
                "rule": finding.rule,
                "message": finding.message,
                "path": finding.path,
                "suggestion": finding.suggestion,
            }
            for finding in validation_result.findings
        ],
    }
