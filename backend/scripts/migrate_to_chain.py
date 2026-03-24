#!/usr/bin/env python3
"""CLI migration script: reads database state, writes to on-chain PDAs.

This script orchestrates the full migration pipeline from the command line:
    1. Reads current off-chain database state (reputation, bounties, tiers)
    2. Derives PDA addresses for each record
    3. Checks idempotency (skips existing PDAs)
    4. Writes data to on-chain PDAs in configurable batches
    5. Reports progress in real-time (N/total migrated)
    6. Logs full audit trail to both console and file

Usage:
    # Dry run (default) — simulates without sending transactions
    python scripts/migrate_to_chain.py --entity-type reputation --dry-run

    # Live migration with batch size 10
    python scripts/migrate_to_chain.py --entity-type reputation --batch-size 10

    # Migrate all entity types (reputation + bounties + tiers)
    python scripts/migrate_to_chain.py --all --dry-run

    # Verify a previous migration job
    python scripts/migrate_to_chain.py --verify JOB_UUID

    # Show migration history
    python scripts/migrate_to_chain.py --history

Environment variables:
    DATABASE_URL: PostgreSQL connection string
    MIGRATION_AUTHORITY_KEY: Base58-encoded Solana keypair for signing
    MIGRATION_PROGRAM_ID: Solana program ID for migration PDAs
    SOLANA_RPC_URL: Solana RPC endpoint (default: mainnet)
    ADMIN_USER_IDS: Comma-separated admin user UUIDs

Rollback plan:
    If issues are detected after migration:
    1. Run: python scripts/migrate_to_chain.py --rollback JOB_UUID --reason "..."
    2. The system reverts to reading from the off-chain database only
    3. On-chain PDAs are flagged as deprecated (not deleted)
    4. Fix the issue, then re-run migration on a fresh job
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone

# Add the backend directory to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import async_session_factory, init_db
from app.models.migration import (
    MigrationEntityType,
    MigrationJobCreate,
)
from app.services.migration_service import (
    get_migration_job,
    list_migration_jobs,
    rollback_migration,
    start_migration_job,
    verify_migration,
)

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
LOG_FILE = os.getenv(
    "MIGRATION_LOG_FILE",
    f"migration_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.log",
)


def setup_logging(verbose: bool = False) -> None:
    """Configure logging for both console and file output.

    Sets up dual handlers: console output for real-time monitoring
    and file output for persistent audit trail.

    Args:
        verbose: If True, set log level to DEBUG; otherwise INFO.
    """
    level = logging.DEBUG if verbose else logging.INFO

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT))

    # File handler for audit trail
    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)  # Always verbose in file
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT))

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)


logger = logging.getLogger("migrate_to_chain")


# ---------------------------------------------------------------------------
# CLI commands
# ---------------------------------------------------------------------------


async def run_migration(
    entity_type: str,
    dry_run: bool,
    batch_size: int,
    admin_user_id: str,
) -> None:
    """Execute a migration job for a single entity type.

    Initializes the database, creates a migration job, and processes
    all records in batches with real-time progress reporting.

    Args:
        entity_type: One of 'reputation', 'bounty_record', 'tier_level'.
        dry_run: If True, simulate without sending on-chain transactions.
        batch_size: Number of records per batch.
        admin_user_id: The admin user ID initiating the migration.
    """
    await init_db()

    logger.info("=" * 60)
    logger.info("MIGRATION START: %s", entity_type)
    logger.info("  Dry run: %s", dry_run)
    logger.info("  Batch size: %d", batch_size)
    logger.info("  Admin: %s", admin_user_id)
    logger.info("  Log file: %s", LOG_FILE)
    logger.info("=" * 60)

    request = MigrationJobCreate(
        entity_type=MigrationEntityType(entity_type),
        dry_run=dry_run,
        batch_size=batch_size,
    )

    async with async_session_factory() as session:
        result = await start_migration_job(
            session=session,
            request=request,
            started_by=admin_user_id,
        )

    logger.info("")
    logger.info("=" * 60)
    logger.info("MIGRATION COMPLETE")
    logger.info("  Job ID: %s", result.id)
    logger.info("  Status: %s", result.status)
    logger.info("  Total records: %d", result.total_records)
    logger.info("  Migrated: %d", result.migrated_count)
    logger.info("  Skipped: %d", result.skipped_count)
    logger.info("  Failed: %d", result.failed_count)
    if result.error_summary:
        logger.warning("  Errors: %s", result.error_summary)
    logger.info("=" * 60)


async def run_all_migrations(
    dry_run: bool,
    batch_size: int,
    admin_user_id: str,
) -> None:
    """Run migration for all entity types sequentially.

    Processes reputation scores, then bounty records, then tier levels.

    Args:
        dry_run: If True, simulate without sending on-chain transactions.
        batch_size: Number of records per batch.
        admin_user_id: The admin user ID initiating the migration.
    """
    entity_types = [
        MigrationEntityType.REPUTATION.value,
        MigrationEntityType.BOUNTY_RECORD.value,
        MigrationEntityType.TIER_LEVEL.value,
    ]
    for entity_type in entity_types:
        await run_migration(entity_type, dry_run, batch_size, admin_user_id)
        logger.info("")


async def run_verify(job_id: str) -> None:
    """Verify a completed migration job against on-chain state.

    Reads each PDA written during the job and compares data against
    the off-chain database snapshot.

    Args:
        job_id: The UUID of the migration job to verify.
    """
    await init_db()

    logger.info("Verifying migration job: %s", job_id)

    async with async_session_factory() as session:
        report = await verify_migration(session=session, job_id=job_id)

    logger.info("")
    logger.info("=" * 60)
    logger.info("VERIFICATION REPORT")
    logger.info("  Job ID: %s", report.job_id)
    logger.info("  Entity type: %s", report.entity_type)
    logger.info("  Total checked: %d", report.total_checked)
    logger.info("  Matched: %d", report.matched_count)
    logger.info("  Mismatched: %d", report.mismatched_count)
    logger.info("  Missing on-chain: %d", report.missing_on_chain_count)
    logger.info("=" * 60)

    if report.mismatched_count > 0 or report.missing_on_chain_count > 0:
        logger.warning("VERIFICATION FAILED — review results above")
        for result in report.results:
            if not result.matches:
                logger.warning(
                    "  MISMATCH %s/%s: %s",
                    result.entity_type, result.entity_id,
                    ", ".join(result.mismatches),
                )
    else:
        logger.info("VERIFICATION PASSED — all records match on-chain state")


async def run_rollback(job_id: str, reason: str) -> None:
    """Roll back a completed migration job.

    Marks all migrated records as rolled_back and reverts
    to off-chain database as source of truth.

    Args:
        job_id: The UUID of the migration job to roll back.
        reason: Human-readable explanation for the rollback.
    """
    await init_db()

    logger.info("Rolling back migration job: %s", job_id)
    logger.info("Reason: %s", reason)

    async with async_session_factory() as session:
        result = await rollback_migration(
            session=session, job_id=job_id, reason=reason,
        )

    logger.info("")
    logger.info("=" * 60)
    logger.info("ROLLBACK COMPLETE")
    logger.info("  Job ID: %s", result.job_id)
    logger.info("  Status: %s", result.status)
    logger.info("  Records rolled back: %d", result.rolled_back_count)
    logger.info("  Message: %s", result.message)
    logger.info("=" * 60)


async def run_history(entity_type: str | None = None) -> None:
    """Display migration job history.

    Shows recent migration jobs with their status, counts, and timing.

    Args:
        entity_type: Optional filter for specific entity types.
    """
    await init_db()

    async with async_session_factory() as session:
        result = await list_migration_jobs(
            session=session, entity_type=entity_type, skip=0, limit=50,
        )

    if not result.items:
        logger.info("No migration jobs found.")
        return

    logger.info("Migration History (%d jobs):", result.total)
    logger.info("-" * 90)
    logger.info(
        "%-36s  %-15s  %-18s  %5s  %5s  %5s  %5s",
        "JOB ID", "ENTITY TYPE", "STATUS", "TOTAL", "OK", "SKIP", "FAIL",
    )
    logger.info("-" * 90)
    for job in result.items:
        logger.info(
            "%-36s  %-15s  %-18s  %5d  %5d  %5d  %5d",
            job.id, job.entity_type, job.status,
            job.total_records, job.migrated_count,
            job.skipped_count, job.failed_count,
        )
    logger.info("-" * 90)


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser with all migration subcommands.

    Returns:
        Configured ArgumentParser with migrate, verify, rollback, and history commands.
    """
    parser = argparse.ArgumentParser(
        description="Off-chain to on-chain migration tool for SolFoundry",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--entity-type",
        choices=["reputation", "bounty_record", "tier_level"],
        help="Entity type to migrate",
    )
    parser.add_argument(
        "--all", action="store_true", dest="migrate_all",
        help="Migrate all entity types (reputation, bounty_record, tier_level)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", default=True,
        help="Simulate migration without sending on-chain transactions (default: True)",
    )
    parser.add_argument(
        "--live", action="store_true",
        help="Execute live migration (sends real on-chain transactions)",
    )
    parser.add_argument(
        "--batch-size", type=int, default=10,
        help="Number of records per batch (default: 10, max: 50)",
    )
    parser.add_argument(
        "--verify", metavar="JOB_ID",
        help="Verify a completed migration job against on-chain state",
    )
    parser.add_argument(
        "--rollback", metavar="JOB_ID",
        help="Roll back a completed migration job",
    )
    parser.add_argument(
        "--reason", default="",
        help="Reason for rollback (required with --rollback)",
    )
    parser.add_argument(
        "--history", action="store_true",
        help="Show migration job history",
    )
    parser.add_argument(
        "--admin-user-id", default="system-cli",
        help="Admin user ID for audit trail (default: system-cli)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Enable verbose (DEBUG-level) logging",
    )
    return parser


def main() -> None:
    """Entry point for the migration CLI tool.

    Parses arguments and dispatches to the appropriate async command handler.
    Validates argument combinations and enforces required parameters.
    """
    parser = build_parser()
    args = parser.parse_args()

    setup_logging(verbose=args.verbose)

    # Determine dry_run mode
    dry_run = not args.live

    # Validate batch size
    if args.batch_size < 1 or args.batch_size > 50:
        parser.error("--batch-size must be between 1 and 50")

    if args.verify:
        asyncio.run(run_verify(args.verify))
    elif args.rollback:
        if not args.reason:
            parser.error("--reason is required with --rollback")
        asyncio.run(run_rollback(args.rollback, args.reason))
    elif args.history:
        asyncio.run(run_history(args.entity_type))
    elif args.migrate_all:
        asyncio.run(run_all_migrations(dry_run, args.batch_size, args.admin_user_id))
    elif args.entity_type:
        asyncio.run(run_migration(args.entity_type, dry_run, args.batch_size, args.admin_user_id))
    else:
        parser.error("Specify --entity-type, --all, --verify, --rollback, or --history")


if __name__ == "__main__":
    main()
