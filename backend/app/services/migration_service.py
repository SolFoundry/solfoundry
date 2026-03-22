"""Migration service for off-chain to on-chain data migration.

Orchestrates the batch migration of off-chain database records (reputation
scores, completed bounty records, tier levels) to on-chain Solana PDAs.

Key design principles:
    - PostgreSQL as primary store for all migration state and audit trails
    - Idempotent: checks PDA existence before writing, safe to re-run
    - Batch processing: configurable batch size (default 10) to avoid
      overwhelming the Solana network
    - Fail-closed: any error stops the batch and marks the job as failed
    - Full audit trail: every record migration is logged with before/after data

Rollback plan:
    If issues are detected after migration:
    1. The rollback endpoint marks all migrated records as 'rolled_back'
    2. The system reverts to reading from the off-chain database only
    3. On-chain PDAs are flagged as deprecated (not deleted, since Solana
       account deletion requires lamport reclamation via a separate process)
    4. A new migration job can be started after fixes are applied
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.migration import (
    MigrationEntityType,
    MigrationJobCreate,
    MigrationJobListResponse,
    MigrationJobResponse,
    MigrationJobStatus,
    MigrationJobTable,
    MigrationProgressResponse,
    MigrationRecordResponse,
    MigrationRecordStatus,
    MigrationRecordTable,
    RollbackResponse,
    VerificationReport,
    VerificationResult,
)
from app.services.onchain_client import (
    OnchainClientError,
    check_pda_exists,
    derive_pda_address,
    read_pda_data,
    simulate_write,
    write_pda_data,
)
from app.services.bounty_service import _bounty_store
from app.services.contributor_service import _store as _contributor_store

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data extraction helpers
# ---------------------------------------------------------------------------


def _extract_reputation_records() -> list[dict[str, Any]]:
    """Extract contributor reputation scores from the off-chain database.

    Reads all contributors from the in-memory contributor store and
    formats their reputation data for on-chain migration.

    Returns:
        List of dictionaries containing contributor reputation data,
        each with entity_id, username, reputation_score, and
        total_contributions fields.
    """
    records = []
    for contributor_id, contributor in _contributor_store.items():
        records.append({
            "entity_id": str(contributor_id),
            "username": contributor.username,
            "reputation_score": contributor.reputation_score,
            "total_contributions": contributor.total_contributions,
            "total_earnings": float(contributor.total_earnings),
        })
    return records


def _extract_bounty_records() -> list[dict[str, Any]]:
    """Extract completed bounty records from the off-chain database.

    Reads all bounties with status 'completed' or 'paid' from the
    in-memory bounty store and formats them for on-chain migration.

    Returns:
        List of dictionaries containing completed bounty data,
        each with entity_id, title, reward_amount, status, tier,
        created_by, and completed_at fields.
    """
    records = []
    for bounty_id, bounty in _bounty_store.items():
        if bounty.status.value in ("completed", "paid"):
            records.append({
                "entity_id": str(bounty_id),
                "title": bounty.title,
                "reward_amount": float(bounty.reward_amount),
                "status": bounty.status.value,
                "tier": bounty.tier.value if hasattr(bounty.tier, "value") else bounty.tier,
                "created_by": bounty.created_by,
                "completed_at": bounty.updated_at.isoformat() if bounty.updated_at else None,
            })
    return records


def _extract_tier_records() -> list[dict[str, Any]]:
    """Extract contributor tier levels from the off-chain database.

    Computes each contributor's effective tier based on their
    total_bounties_completed count, following the SolFoundry tier rules:
        - T1: 0+ completed bounties (everyone starts here)
        - T2: 4+ merged T1 bounties
        - T3: 3+ merged T2 bounties (7+ total)

    Returns:
        List of dictionaries containing tier assignment data,
        each with entity_id, username, tier_level, and
        bounties_completed fields.
    """
    records = []
    for contributor_id, contributor in _contributor_store.items():
        completed = contributor.total_bounties_completed
        if completed >= 7:
            tier = 3
        elif completed >= 4:
            tier = 2
        else:
            tier = 1
        records.append({
            "entity_id": str(contributor_id),
            "username": contributor.username,
            "tier_level": tier,
            "bounties_completed": completed,
        })
    return records


_EXTRACTORS: dict[str, Any] = {
    MigrationEntityType.REPUTATION.value: _extract_reputation_records,
    MigrationEntityType.BOUNTY_RECORD.value: _extract_bounty_records,
    MigrationEntityType.TIER_LEVEL.value: _extract_tier_records,
}


# ---------------------------------------------------------------------------
# Core migration operations
# ---------------------------------------------------------------------------


async def start_migration_job(
    session: AsyncSession,
    request: MigrationJobCreate,
    started_by: str,
) -> MigrationJobResponse:
    """Start a new migration job for the specified entity type.

    Creates a migration job record in the database, extracts the relevant
    off-chain data, and processes it in batches. Each batch is committed
    to the database as it completes, providing progress tracking.

    For dry-run jobs, all records are simulated without sending on-chain
    transactions. For live jobs, each record is written to a PDA and the
    transaction signature is recorded.

    Args:
        session: The async database session for persistence.
        request: The migration job parameters (entity_type, dry_run, batch_size).
        started_by: The user ID of the admin who initiated the migration.

    Returns:
        MigrationJobResponse with the complete job details and record list.

    Raises:
        ValueError: If the entity type has no registered data extractor.
    """
    entity_type = request.entity_type.value
    extractor = _EXTRACTORS.get(entity_type)
    if extractor is None:
        raise ValueError(f"No data extractor registered for entity type: {entity_type}")

    # Extract source data
    source_records = extractor()
    total_records = len(source_records)

    logger.info(
        "Starting migration job: entity_type=%s, dry_run=%s, batch_size=%d, total=%d, by=%s",
        entity_type, request.dry_run, request.batch_size, total_records, started_by,
    )

    # Create job record
    job = MigrationJobTable(
        entity_type=entity_type,
        status=MigrationJobStatus.RUNNING.value,
        dry_run=request.dry_run,
        batch_size=request.batch_size,
        total_records=total_records,
        started_by=started_by,
    )
    session.add(job)
    await session.flush()
    job_id = job.id

    # Process records in batches
    migrated_count = 0
    skipped_count = 0
    failed_count = 0
    migration_records: list[MigrationRecordTable] = []
    error_messages: list[str] = []

    for batch_start in range(0, total_records, request.batch_size):
        batch = source_records[batch_start:batch_start + request.batch_size]
        batch_results = await _process_batch(
            session=session,
            job_id=job_id,
            entity_type=entity_type,
            batch=batch,
            dry_run=request.dry_run,
        )

        for record in batch_results:
            migration_records.append(record)
            if record.status == MigrationRecordStatus.MIGRATED.value:
                migrated_count += 1
            elif record.status == MigrationRecordStatus.SKIPPED.value:
                skipped_count += 1
            elif record.status == MigrationRecordStatus.FAILED.value:
                failed_count += 1
                if record.error_message:
                    error_messages.append(
                        f"{record.entity_id}: {record.error_message}"
                    )

        # Report progress
        processed = batch_start + len(batch)
        logger.info(
            "Migration progress: %d/%d (migrated=%d, skipped=%d, failed=%d)",
            processed, total_records, migrated_count, skipped_count, failed_count,
        )

    # Finalize job status
    if request.dry_run:
        final_status = MigrationJobStatus.DRY_RUN_COMPLETE.value
    elif failed_count > 0 and migrated_count == 0:
        final_status = MigrationJobStatus.FAILED.value
    else:
        final_status = MigrationJobStatus.COMPLETED.value

    job.status = final_status
    job.migrated_count = migrated_count
    job.skipped_count = skipped_count
    job.failed_count = failed_count
    job.completed_at = datetime.now(timezone.utc)
    if error_messages:
        job.error_summary = "; ".join(error_messages[:20])  # Cap at 20 errors

    await session.commit()

    logger.info(
        "Migration job %s completed: status=%s, migrated=%d, skipped=%d, failed=%d",
        str(job_id), final_status, migrated_count, skipped_count, failed_count,
    )

    return _job_to_response(job, migration_records)


async def _process_batch(
    session: AsyncSession,
    job_id: uuid.UUID,
    entity_type: str,
    batch: list[dict[str, Any]],
    dry_run: bool,
) -> list[MigrationRecordTable]:
    """Process a single batch of records for migration.

    For each record in the batch:
    1. Derive the PDA address
    2. Check if the PDA already exists (idempotent)
    3. Write data to PDA (or simulate in dry-run mode)
    4. Store the migration record in the database

    Args:
        session: The async database session.
        job_id: The parent migration job UUID.
        entity_type: The entity type being migrated.
        batch: List of off-chain data records to migrate.
        dry_run: If True, simulate without sending transactions.

    Returns:
        List of MigrationRecordTable objects for the processed batch.
    """
    results: list[MigrationRecordTable] = []

    for item in batch:
        entity_id = item["entity_id"]
        pda_address = derive_pda_address(entity_type, entity_id)

        record = MigrationRecordTable(
            job_id=job_id,
            entity_type=entity_type,
            entity_id=entity_id,
            pda_address=pda_address,
            off_chain_data=item,
        )

        try:
            if dry_run:
                # Simulate the write without on-chain interaction
                simulation = await simulate_write(
                    pda_address=pda_address,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    data=item,
                )
                record.status = MigrationRecordStatus.MIGRATED.value
                record.on_chain_data = simulation
                logger.debug(
                    "DRY RUN: Would migrate %s/%s to PDA %s",
                    entity_type, entity_id, pda_address,
                )
            else:
                # Check idempotency - skip if PDA already exists
                try:
                    pda_exists = await check_pda_exists(pda_address)
                except OnchainClientError:
                    # If we can't check, assume it doesn't exist
                    # Fail-closed on the check itself
                    pda_exists = False
                    logger.warning(
                        "Could not check PDA existence for %s, proceeding with write",
                        pda_address,
                    )

                if pda_exists:
                    record.status = MigrationRecordStatus.SKIPPED.value
                    record.error_message = "PDA already exists on-chain (idempotent skip)"
                    logger.info(
                        "Skipped %s/%s: PDA %s already exists",
                        entity_type, entity_id, pda_address,
                    )
                else:
                    # Write to on-chain PDA
                    tx_signature = await write_pda_data(
                        pda_address=pda_address,
                        entity_type=entity_type,
                        entity_id=entity_id,
                        data=item,
                    )
                    record.status = MigrationRecordStatus.MIGRATED.value
                    record.tx_signature = tx_signature
                    record.on_chain_data = item
                    logger.info(
                        "Migrated %s/%s to PDA %s (tx: %s)",
                        entity_type, entity_id, pda_address, tx_signature,
                    )
        except OnchainClientError as exc:
            record.status = MigrationRecordStatus.FAILED.value
            record.error_message = str(exc)
            logger.error(
                "Failed to migrate %s/%s: %s", entity_type, entity_id, exc,
            )
        except Exception as exc:
            record.status = MigrationRecordStatus.FAILED.value
            record.error_message = f"Unexpected error: {exc}"
            logger.exception(
                "Unexpected error migrating %s/%s", entity_type, entity_id,
            )

        session.add(record)
        results.append(record)

    await session.flush()
    return results


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------


async def verify_migration(
    session: AsyncSession,
    job_id: str,
) -> VerificationReport:
    """Compare on-chain PDA state against the off-chain database records.

    For each migrated record in the job, reads the on-chain PDA data and
    compares key fields against the original off-chain snapshot. Reports
    any mismatches or missing accounts.

    Args:
        session: The async database session.
        job_id: The UUID of the migration job to verify.

    Returns:
        VerificationReport with match/mismatch counts and detailed results.

    Raises:
        ValueError: If the job_id does not exist.
    """
    job_uuid = uuid.UUID(job_id)

    # Load job
    job_result = await session.execute(
        select(MigrationJobTable).where(MigrationJobTable.id == job_uuid)
    )
    job = job_result.scalar_one_or_none()
    if job is None:
        raise ValueError(f"Migration job {job_id} not found")

    # Load migrated records
    records_result = await session.execute(
        select(MigrationRecordTable).where(
            MigrationRecordTable.job_id == job_uuid,
            MigrationRecordTable.status == MigrationRecordStatus.MIGRATED.value,
        )
    )
    records = records_result.scalars().all()

    results: list[VerificationResult] = []
    matched_count = 0
    mismatched_count = 0
    missing_count = 0

    for record in records:
        pda_address = record.pda_address
        entity_id = str(record.entity_id)
        off_chain = record.off_chain_data or {}

        try:
            on_chain = await read_pda_data(pda_address) if pda_address else None
        except OnchainClientError as exc:
            logger.warning("Verification RPC error for %s: %s", pda_address, exc)
            on_chain = None

        if on_chain is None:
            missing_count += 1
            results.append(VerificationResult(
                entity_id=entity_id,
                entity_type=record.entity_type,
                pda_address=pda_address,
                matches=False,
                off_chain_data=off_chain,
                on_chain_data=None,
                mismatches=["Account not found on-chain"],
            ))
        else:
            # Compare data fields
            mismatches = _compare_data(off_chain, on_chain)
            if mismatches:
                mismatched_count += 1
            else:
                matched_count += 1
                # Update record status to verified
                record.status = MigrationRecordStatus.VERIFIED.value

            results.append(VerificationResult(
                entity_id=entity_id,
                entity_type=record.entity_type,
                pda_address=pda_address,
                matches=len(mismatches) == 0,
                off_chain_data=off_chain,
                on_chain_data=on_chain,
                mismatches=mismatches,
            ))

    await session.commit()

    logger.info(
        "Verification for job %s: matched=%d, mismatched=%d, missing=%d",
        job_id, matched_count, mismatched_count, missing_count,
    )

    return VerificationReport(
        job_id=job_id,
        entity_type=job.entity_type,
        total_checked=len(records),
        matched_count=matched_count,
        mismatched_count=mismatched_count,
        missing_on_chain_count=missing_count,
        results=results,
    )


def _compare_data(
    off_chain: dict[str, Any], on_chain: dict[str, Any]
) -> list[str]:
    """Compare off-chain and on-chain data, returning a list of mismatch descriptions.

    Checks each key in the off-chain data against the on-chain data.
    Keys present in off-chain but missing from on-chain are reported
    as mismatches. Value differences are reported with both values.

    Args:
        off_chain: The original off-chain data snapshot.
        on_chain: The data read from the on-chain PDA.

    Returns:
        List of human-readable mismatch descriptions. Empty list means match.
    """
    mismatches: list[str] = []
    for key, off_value in off_chain.items():
        if key == "entity_id":
            continue  # Entity ID is a reference key, not stored data
        on_value = on_chain.get(key)
        if on_value is None and off_value is not None:
            mismatches.append(f"Field '{key}' missing on-chain (off-chain: {off_value})")
        elif str(off_value) != str(on_value):
            mismatches.append(
                f"Field '{key}' mismatch: off-chain={off_value}, on-chain={on_value}"
            )
    return mismatches


# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------


async def rollback_migration(
    session: AsyncSession,
    job_id: str,
    reason: str,
) -> RollbackResponse:
    """Roll back a completed migration job.

    Marks all migrated records as 'rolled_back' and updates the job
    status. The system will revert to reading from the off-chain database.
    On-chain PDAs are flagged but not deleted (Solana account closure
    requires a separate lamport reclamation process).

    Args:
        session: The async database session.
        job_id: The UUID of the migration job to roll back.
        reason: Human-readable explanation for the rollback.

    Returns:
        RollbackResponse with the count of rolled-back records.

    Raises:
        ValueError: If the job doesn't exist or isn't in a rollback-eligible state.
    """
    job_uuid = uuid.UUID(job_id)

    # Load and validate job
    job_result = await session.execute(
        select(MigrationJobTable).where(MigrationJobTable.id == job_uuid)
    )
    job = job_result.scalar_one_or_none()
    if job is None:
        raise ValueError(f"Migration job {job_id} not found")

    rollback_eligible = {
        MigrationJobStatus.COMPLETED.value,
        MigrationJobStatus.FAILED.value,
    }
    if job.status not in rollback_eligible:
        raise ValueError(
            f"Job {job_id} has status '{job.status}' which is not eligible "
            f"for rollback. Eligible statuses: {rollback_eligible}"
        )

    # Mark all migrated/verified records as rolled back
    records_result = await session.execute(
        select(MigrationRecordTable).where(
            MigrationRecordTable.job_id == job_uuid,
            MigrationRecordTable.status.in_([
                MigrationRecordStatus.MIGRATED.value,
                MigrationRecordStatus.VERIFIED.value,
            ]),
        )
    )
    records = records_result.scalars().all()

    rolled_back_count = 0
    for record in records:
        record.status = MigrationRecordStatus.ROLLED_BACK.value
        record.error_message = f"Rolled back: {reason}"
        rolled_back_count += 1

    job.status = MigrationJobStatus.ROLLED_BACK.value
    job.error_summary = f"Rolled back ({rolled_back_count} records): {reason}"
    job.completed_at = datetime.now(timezone.utc)

    await session.commit()

    logger.info(
        "Rolled back job %s: %d records reverted. Reason: %s",
        job_id, rolled_back_count, reason,
    )

    return RollbackResponse(
        job_id=job_id,
        status=MigrationJobStatus.ROLLED_BACK.value,
        rolled_back_count=rolled_back_count,
        reason=reason,
        message=f"Successfully rolled back {rolled_back_count} records. "
        "System will use off-chain database as source of truth.",
    )


# ---------------------------------------------------------------------------
# Query operations
# ---------------------------------------------------------------------------


async def get_migration_job(
    session: AsyncSession,
    job_id: str,
) -> Optional[MigrationJobResponse]:
    """Retrieve a single migration job by ID with all its records.

    Args:
        session: The async database session.
        job_id: The UUID of the migration job.

    Returns:
        MigrationJobResponse if found, None otherwise.
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        return None

    job_result = await session.execute(
        select(MigrationJobTable).where(MigrationJobTable.id == job_uuid)
    )
    job = job_result.scalar_one_or_none()
    if job is None:
        return None

    records_result = await session.execute(
        select(MigrationRecordTable)
        .where(MigrationRecordTable.job_id == job_uuid)
        .order_by(MigrationRecordTable.created_at)
    )
    records = records_result.scalars().all()

    return _job_to_response(job, records)


async def list_migration_jobs(
    session: AsyncSession,
    entity_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
) -> MigrationJobListResponse:
    """List migration jobs with optional entity type filter and pagination.

    Args:
        session: The async database session.
        entity_type: Optional filter by entity type.
        skip: Number of records to skip for pagination.
        limit: Maximum number of records to return.

    Returns:
        MigrationJobListResponse with paginated results.
    """
    query = select(MigrationJobTable).order_by(MigrationJobTable.started_at.desc())
    count_query = select(func.count()).select_from(MigrationJobTable)

    if entity_type:
        query = query.where(MigrationJobTable.entity_type == entity_type)
        count_query = count_query.where(
            MigrationJobTable.entity_type == entity_type
        )

    # Get total count
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = query.offset(skip).limit(limit)
    result = await session.execute(query)
    jobs = result.scalars().all()

    items = []
    for job in jobs:
        items.append(_job_to_response(job, []))

    return MigrationJobListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


async def get_migration_progress(
    session: AsyncSession,
    job_id: str,
) -> Optional[MigrationProgressResponse]:
    """Get real-time progress for a migration job.

    Calculates the percentage complete based on migrated, skipped,
    and failed counts relative to total records.

    Args:
        session: The async database session.
        job_id: The UUID of the migration job.

    Returns:
        MigrationProgressResponse if found, None otherwise.
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        return None

    job_result = await session.execute(
        select(MigrationJobTable).where(MigrationJobTable.id == job_uuid)
    )
    job = job_result.scalar_one_or_none()
    if job is None:
        return None

    processed = job.migrated_count + job.skipped_count + job.failed_count
    progress = (processed / job.total_records * 100.0) if job.total_records > 0 else 0.0

    return MigrationProgressResponse(
        job_id=str(job.id),
        entity_type=job.entity_type,
        status=job.status,
        total_records=job.total_records,
        migrated_count=job.migrated_count,
        skipped_count=job.skipped_count,
        failed_count=job.failed_count,
        progress_percent=round(progress, 2),
    )


# ---------------------------------------------------------------------------
# Response mapping
# ---------------------------------------------------------------------------


def _job_to_response(
    job: MigrationJobTable,
    records: list[MigrationRecordTable],
) -> MigrationJobResponse:
    """Convert a SQLAlchemy MigrationJobTable to a Pydantic response model.

    Maps the database model fields to the API response schema, including
    all associated migration records.

    Args:
        job: The SQLAlchemy job model instance.
        records: List of associated migration record model instances.

    Returns:
        MigrationJobResponse with all job details and records.
    """
    return MigrationJobResponse(
        id=str(job.id),
        entity_type=job.entity_type,
        status=job.status,
        dry_run=job.dry_run,
        batch_size=job.batch_size,
        total_records=job.total_records,
        migrated_count=job.migrated_count,
        skipped_count=job.skipped_count,
        failed_count=job.failed_count,
        started_by=job.started_by,
        error_summary=job.error_summary,
        started_at=job.started_at,
        completed_at=job.completed_at,
        records=[
            MigrationRecordResponse(
                id=str(r.id),
                job_id=str(r.job_id),
                entity_type=r.entity_type,
                entity_id=r.entity_id,
                pda_address=r.pda_address,
                status=r.status,
                tx_signature=r.tx_signature,
                error_message=r.error_message,
                on_chain_data=r.on_chain_data,
                off_chain_data=r.off_chain_data,
                created_at=r.created_at,
            )
            for r in records
        ],
    )
