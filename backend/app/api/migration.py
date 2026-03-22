"""Migration API endpoints for off-chain to on-chain data migration.

All endpoints require admin authorization (not just authentication).
The migration operations are destructive and affect on-chain state,
so they must be restricted to platform administrators only.

Authorization model:
    - All endpoints require authentication via get_current_user_id
    - All mutation endpoints additionally require admin role verification
    - Admin role is checked via the ADMIN_USER_IDS environment variable
    - If ADMIN_USER_IDS is not set, all mutation requests are rejected (fail-closed)
"""

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user_id
from app.database import get_db
from app.models.migration import (
    MigrationEntityType,
    MigrationJobCreate,
    MigrationJobListResponse,
    MigrationJobResponse,
    MigrationProgressResponse,
    RollbackRequest,
    RollbackResponse,
    VerificationReport,
)
from app.services.migration_service import (
    get_migration_job,
    get_migration_progress,
    list_migration_jobs,
    rollback_migration,
    start_migration_job,
    verify_migration,
)

router = APIRouter(prefix="/api/migration", tags=["migration"])

# Admin user IDs - must be explicitly configured. Fail-closed if empty.
ADMIN_USER_IDS: set[str] = set(
    uid.strip()
    for uid in os.getenv("ADMIN_USER_IDS", "").split(",")
    if uid.strip()
)


async def require_admin(
    user_id: str = Depends(get_current_user_id),
) -> str:
    """Verify that the authenticated user has admin privileges.

    Checks the user_id against the ADMIN_USER_IDS environment variable.
    This is authorization (role check), not just authentication
    (identity verification). Fails closed: if no admin IDs are
    configured, ALL requests are rejected.

    Args:
        user_id: The authenticated user ID from the auth middleware.

    Returns:
        The verified admin user ID.

    Raises:
        HTTPException: 403 if user is not an admin, or if no admins configured.
    """
    if not ADMIN_USER_IDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Migration operations require admin privileges. "
            "No admin users are configured (ADMIN_USER_IDS is empty). "
            "Contact a platform administrator.",
        )
    if user_id not in ADMIN_USER_IDS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Migration operations require admin privileges. "
            f"User '{user_id}' is not authorized to perform this action.",
        )
    return user_id


# ---------------------------------------------------------------------------
# Job management endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/jobs",
    response_model=MigrationJobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new migration job",
    description=(
        "Starts a new off-chain to on-chain migration job for the specified "
        "entity type. Requires admin authorization. Use dry_run=true to "
        "simulate the migration without sending on-chain transactions."
    ),
)
async def create_migration_job(
    request: MigrationJobCreate,
    admin_user_id: str = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> MigrationJobResponse:
    """Create and execute a migration job.

    Extracts off-chain data for the specified entity type and migrates
    it to on-chain PDAs in configurable batches. Progress is tracked
    in the database with full audit trail.

    Args:
        request: Migration job parameters (entity_type, dry_run, batch_size).
        admin_user_id: The verified admin user ID.
        session: The database session for persistence.

    Returns:
        MigrationJobResponse with complete job details and record list.

    Raises:
        HTTPException: 403 if not admin, 400 if invalid entity type.
    """
    try:
        result = await start_migration_job(
            session=session,
            request=request,
            started_by=admin_user_id,
        )
        return result
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/jobs",
    response_model=MigrationJobListResponse,
    summary="List migration jobs",
    description="List all migration jobs with optional entity type filter and pagination.",
)
async def list_jobs(
    entity_type: Optional[MigrationEntityType] = Query(
        None, description="Filter by entity type"
    ),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> MigrationJobListResponse:
    """List migration jobs with optional filtering.

    Read-only endpoint available to any authenticated user for
    monitoring migration status.

    Args:
        entity_type: Optional filter for specific entity types.
        skip: Pagination offset.
        limit: Maximum results per page.
        user_id: Authenticated user ID (read-only access, no admin required).
        session: The database session.

    Returns:
        Paginated list of migration jobs.
    """
    entity_value = entity_type.value if entity_type else None
    return await list_migration_jobs(
        session=session,
        entity_type=entity_value,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/jobs/{job_id}",
    response_model=MigrationJobResponse,
    summary="Get migration job details",
    description="Retrieve a single migration job with all its records.",
)
async def get_job(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> MigrationJobResponse:
    """Get full details for a specific migration job.

    Returns the job metadata and all associated migration records.
    Read-only endpoint, available to any authenticated user.

    Args:
        job_id: The UUID of the migration job.
        user_id: Authenticated user ID (read-only access).
        session: The database session.

    Returns:
        MigrationJobResponse with complete details.

    Raises:
        HTTPException: 404 if job not found.
    """
    result = await get_migration_job(session=session, job_id=job_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Migration job '{job_id}' not found",
        )
    return result


@router.get(
    "/jobs/{job_id}/progress",
    response_model=MigrationProgressResponse,
    summary="Get migration job progress",
    description="Get real-time progress for a migration job (N/total with percentage).",
)
async def get_job_progress(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> MigrationProgressResponse:
    """Get real-time progress for a running migration job.

    Returns current counts (migrated, skipped, failed) and a
    progress percentage for UI rendering.

    Args:
        job_id: The UUID of the migration job.
        user_id: Authenticated user ID (read-only access).
        session: The database session.

    Returns:
        MigrationProgressResponse with current progress.

    Raises:
        HTTPException: 404 if job not found.
    """
    result = await get_migration_progress(session=session, job_id=job_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Migration job '{job_id}' not found",
        )
    return result


# ---------------------------------------------------------------------------
# Verification endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/jobs/{job_id}/verify",
    response_model=VerificationReport,
    summary="Verify migration against on-chain state",
    description=(
        "Compares the on-chain PDA state against the off-chain database for "
        "all records in the specified migration job. Reports matches, "
        "mismatches, and missing accounts."
    ),
)
async def verify_job(
    job_id: str,
    admin_user_id: str = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> VerificationReport:
    """Verify that on-chain state matches the off-chain database.

    Reads each PDA that was written during the migration job and
    compares its data against the original off-chain snapshot.
    Admin-only because verification triggers on-chain reads.

    Args:
        job_id: The UUID of the migration job to verify.
        admin_user_id: The verified admin user ID.
        session: The database session.

    Returns:
        VerificationReport with match/mismatch details.

    Raises:
        HTTPException: 403 if not admin, 404 if job not found, 400 on error.
    """
    try:
        return await verify_migration(session=session, job_id=job_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


# ---------------------------------------------------------------------------
# Rollback endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/jobs/{job_id}/rollback",
    response_model=RollbackResponse,
    summary="Roll back a completed migration",
    description=(
        "Reverts a completed migration job. Marks all migrated records "
        "as rolled_back and reverts the system to using the off-chain "
        "database as the source of truth. On-chain PDAs are flagged as "
        "deprecated but not deleted."
    ),
)
async def rollback_job(
    job_id: str,
    request: RollbackRequest,
    admin_user_id: str = Depends(require_admin),
    session: AsyncSession = Depends(get_db),
) -> RollbackResponse:
    """Roll back a completed migration job.

    Requires admin authorization and a reason for the rollback
    (for audit trail purposes). Only jobs in 'completed' or 'failed'
    status can be rolled back.

    Args:
        job_id: The UUID of the migration job to roll back.
        request: Rollback request with reason.
        admin_user_id: The verified admin user ID.
        session: The database session.

    Returns:
        RollbackResponse with rollback details.

    Raises:
        HTTPException: 403 if not admin, 404 if not found, 400 if not eligible.
    """
    try:
        return await rollback_migration(
            session=session,
            job_id=job_id,
            reason=request.reason,
        )
    except ValueError as exc:
        error_msg = str(exc)
        if "not found" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        ) from exc
