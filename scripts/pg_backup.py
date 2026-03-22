#!/usr/bin/env python3
"""PostgreSQL automated backup script with point-in-time recovery support.

Provides automated database backup capabilities for the SolFoundry backend:
- Full database dumps using pg_dump in custom format
- Point-in-time recovery (PITR) via WAL archiving configuration
- Backup retention policy with automatic cleanup
- Backup verification (integrity check on created dump files)
- Backup scheduling via cron job generation

Usage:
    # Create a full backup
    python scripts/pg_backup.py backup

    # List existing backups
    python scripts/pg_backup.py list

    # Restore from a backup file
    python scripts/pg_backup.py restore --file backups/solfoundry_2026-03-21_120000.dump

    # Clean up old backups (retain last N days)
    python scripts/pg_backup.py cleanup --retain-days 30

    # Generate cron schedule
    python scripts/pg_backup.py cron

    # Verify a backup file
    python scripts/pg_backup.py verify --file backups/solfoundry_2026-03-21_120000.dump

Configuration:
    All settings are via environment variables:
    - DATABASE_URL: PostgreSQL connection string
    - BACKUP_DIR: Directory for backup files (default: /var/backups/solfoundry)
    - BACKUP_RETENTION_DAYS: Days to keep backups (default: 30)
    - PG_DUMP_PATH: Path to pg_dump binary (default: pg_dump)
    - PG_RESTORE_PATH: Path to pg_restore binary (default: pg_restore)

Point-in-Time Recovery (PITR):
    For PITR support, configure PostgreSQL WAL archiving:

    postgresql.conf:
        wal_level = replica
        archive_mode = on
        archive_command = 'cp %p /var/backups/solfoundry/wal/%f'
        archive_timeout = 60

    recovery.conf (or recovery.signal + postgresql.conf for PG12+):
        restore_command = 'cp /var/backups/solfoundry/wal/%f %p'
        recovery_target_time = '2026-03-21 12:00:00+00'

References:
    - PostgreSQL Backup: https://www.postgresql.org/docs/current/backup.html
    - PITR: https://www.postgresql.org/docs/current/continuous-archiving.html
"""

import argparse
import logging
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Configuration from environment
DATABASE_URL: str = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/solfoundry"
)
BACKUP_DIR: Path = Path(os.getenv("BACKUP_DIR", "/var/backups/solfoundry"))
WAL_ARCHIVE_DIR: Path = BACKUP_DIR / "wal"
BACKUP_RETENTION_DAYS: int = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
PG_DUMP_PATH: str = os.getenv("PG_DUMP_PATH", "pg_dump")
PG_RESTORE_PATH: str = os.getenv("PG_RESTORE_PATH", "pg_restore")
BACKUP_PREFIX: str = "solfoundry"


def parse_database_url(url: str) -> dict:
    """Parse a PostgreSQL connection URL into components.

    Handles both postgresql:// and postgresql+asyncpg:// URL formats.

    Args:
        url: The database connection URL.

    Returns:
        dict: Parsed components with keys: host, port, database, user, password.
    """
    # Strip async driver prefix if present
    clean_url = url.replace("+asyncpg", "").replace("+psycopg2", "")
    parsed = urlparse(clean_url)

    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "database": (parsed.path or "/solfoundry").lstrip("/"),
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
    }


def ensure_backup_dirs() -> None:
    """Create backup directories if they do not exist.

    Creates both the main backup directory and the WAL archive subdirectory.
    """
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    WAL_ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Backup directories ready: %s", BACKUP_DIR)


def create_backup() -> Path:
    """Create a full PostgreSQL database backup using pg_dump.

    Uses pg_dump in custom format (-Fc) for efficient compression and
    selective restore capability.

    Returns:
        Path: Path to the created backup file.

    Raises:
        subprocess.CalledProcessError: If pg_dump fails.
    """
    ensure_backup_dirs()

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    backup_file = BACKUP_DIR / f"{BACKUP_PREFIX}_{timestamp}.dump"

    db_config = parse_database_url(DATABASE_URL)

    env = os.environ.copy()
    env["PGPASSWORD"] = db_config["password"]

    cmd = [
        PG_DUMP_PATH,
        "--host", db_config["host"],
        "--port", db_config["port"],
        "--username", db_config["user"],
        "--dbname", db_config["database"],
        "--format", "custom",
        "--compress", "9",
        "--verbose",
        "--file", str(backup_file),
    ]

    logger.info(
        "Starting backup of database '%s' on %s:%s...",
        db_config["database"],
        db_config["host"],
        db_config["port"],
    )

    try:
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=3600,  # 1 hour timeout
        )

        if result.returncode != 0:
            logger.error("pg_dump stderr: %s", result.stderr)
            raise subprocess.CalledProcessError(result.returncode, cmd)

        file_size = backup_file.stat().st_size
        logger.info(
            "Backup created successfully: %s (%.2f MB)",
            backup_file,
            file_size / (1024 * 1024),
        )
        return backup_file

    except FileNotFoundError:
        logger.error(
            "pg_dump not found at '%s'. Install PostgreSQL client tools.", PG_DUMP_PATH
        )
        raise


def verify_backup(backup_file: Path) -> bool:
    """Verify the integrity of a backup file using pg_restore --list.

    Checks that the backup file is a valid pg_dump archive by listing
    its table of contents.

    Args:
        backup_file: Path to the backup file to verify.

    Returns:
        bool: True if the backup is valid and readable.
    """
    if not backup_file.exists():
        logger.error("Backup file not found: %s", backup_file)
        return False

    cmd = [PG_RESTORE_PATH, "--list", str(backup_file)]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode == 0:
            line_count = len(result.stdout.strip().splitlines())
            file_size = backup_file.stat().st_size
            logger.info(
                "Backup verified: %s (%d entries, %.2f MB)",
                backup_file.name,
                line_count,
                file_size / (1024 * 1024),
            )
            return True
        else:
            logger.error("Backup verification failed: %s", result.stderr)
            return False

    except FileNotFoundError:
        logger.error("pg_restore not found at '%s'", PG_RESTORE_PATH)
        return False
    except subprocess.TimeoutExpired:
        logger.error("Backup verification timed out")
        return False


def restore_backup(backup_file: Path, target_database: str = "") -> None:
    """Restore a PostgreSQL database from a backup file.

    Uses pg_restore with --clean to drop existing objects before restore.
    WARNING: This is a destructive operation that replaces existing data.

    Args:
        backup_file: Path to the backup dump file.
        target_database: Target database name. Defaults to the configured database.

    Raises:
        FileNotFoundError: If the backup file doesn't exist.
        subprocess.CalledProcessError: If pg_restore fails.
    """
    if not backup_file.exists():
        raise FileNotFoundError(f"Backup file not found: {backup_file}")

    db_config = parse_database_url(DATABASE_URL)
    target_db = target_database or db_config["database"]

    env = os.environ.copy()
    env["PGPASSWORD"] = db_config["password"]

    cmd = [
        PG_RESTORE_PATH,
        "--host", db_config["host"],
        "--port", db_config["port"],
        "--username", db_config["user"],
        "--dbname", target_db,
        "--clean",
        "--if-exists",
        "--verbose",
        str(backup_file),
    ]

    logger.warning(
        "Restoring database '%s' from %s. This will REPLACE existing data!",
        target_db,
        backup_file,
    )

    result = subprocess.run(
        cmd,
        env=env,
        capture_output=True,
        text=True,
        timeout=3600,
    )

    if result.returncode != 0:
        # pg_restore may return non-zero for warnings (e.g., roles don't exist)
        if "ERROR" in result.stderr:
            logger.error("Restore errors: %s", result.stderr)
            raise subprocess.CalledProcessError(result.returncode, cmd)
        else:
            logger.warning("Restore completed with warnings: %s", result.stderr[:500])

    logger.info("Database restored from %s", backup_file)


def list_backups() -> list[dict]:
    """List all backup files in the backup directory with metadata.

    Returns:
        list[dict]: List of backup info dicts sorted by date (newest first).
    """
    ensure_backup_dirs()

    backups = []
    for dump_file in BACKUP_DIR.glob(f"{BACKUP_PREFIX}_*.dump"):
        stat = dump_file.stat()
        backups.append({
            "file": str(dump_file),
            "name": dump_file.name,
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "created": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })

    backups.sort(key=lambda b: b["created"], reverse=True)
    return backups


def cleanup_old_backups(retain_days: int = BACKUP_RETENTION_DAYS) -> int:
    """Remove backup files older than the retention period.

    Args:
        retain_days: Number of days to retain backups.

    Returns:
        int: Number of backup files deleted.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=retain_days)
    deleted = 0

    for dump_file in BACKUP_DIR.glob(f"{BACKUP_PREFIX}_*.dump"):
        file_time = datetime.fromtimestamp(
            dump_file.stat().st_mtime, tz=timezone.utc
        )
        if file_time < cutoff:
            dump_file.unlink()
            logger.info("Deleted old backup: %s (created: %s)", dump_file.name, file_time)
            deleted += 1

    logger.info(
        "Cleanup complete: removed %d backups older than %d days", deleted, retain_days
    )
    return deleted


def generate_cron_schedule() -> str:
    """Generate a cron job entry for automated daily backups.

    Returns:
        str: Cron schedule entry for the backup script.
    """
    script_path = Path(__file__).resolve()
    python_path = sys.executable

    cron_lines = [
        "# SolFoundry PostgreSQL automated backups",
        "# Full backup every day at 2:00 AM UTC",
        f"0 2 * * * {python_path} {script_path} backup 2>&1 | logger -t solfoundry-backup",
        "",
        "# Cleanup old backups every Sunday at 3:00 AM UTC",
        f"0 3 * * 0 {python_path} {script_path} cleanup --retain-days {BACKUP_RETENTION_DAYS} "
        f"2>&1 | logger -t solfoundry-backup",
        "",
        "# Verify latest backup every day at 4:00 AM UTC",
        f"0 4 * * * ls -t {BACKUP_DIR}/{BACKUP_PREFIX}_*.dump | head -1 | "
        f"xargs {python_path} {script_path} verify --file "
        f"2>&1 | logger -t solfoundry-backup",
    ]

    return "\n".join(cron_lines)


def generate_pitr_config() -> str:
    """Generate PostgreSQL configuration for point-in-time recovery.

    Returns:
        str: PostgreSQL configuration snippet for WAL archiving and PITR.
    """
    return f"""# ── Point-in-Time Recovery (PITR) Configuration ──
# Add these settings to postgresql.conf

# Enable WAL archiving
wal_level = replica
archive_mode = on
archive_command = 'cp %p {WAL_ARCHIVE_DIR}/%f'
archive_timeout = 60

# Retention (optional, for pg_archivecleanup)
# Run periodically: pg_archivecleanup {WAL_ARCHIVE_DIR} <oldest_needed_wal>

# ── Recovery Configuration ──
# To perform point-in-time recovery:
# 1. Stop PostgreSQL
# 2. Restore the base backup: pg_restore --dbname=solfoundry <backup_file>
# 3. Create recovery.signal (PostgreSQL 12+) or recovery.conf
# 4. Add to postgresql.conf:
#    restore_command = 'cp {WAL_ARCHIVE_DIR}/%f %p'
#    recovery_target_time = '<target_timestamp>'
# 5. Start PostgreSQL - it will replay WAL up to the target time
"""


def main() -> int:
    """Parse arguments and execute the requested backup operation.

    Returns:
        int: Exit code (0 for success, 1 for failure).
    """
    parser = argparse.ArgumentParser(
        description="PostgreSQL backup management for SolFoundry"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # backup command
    subparsers.add_parser("backup", help="Create a full database backup")

    # list command
    subparsers.add_parser("list", help="List existing backups")

    # restore command
    restore_parser = subparsers.add_parser("restore", help="Restore from backup")
    restore_parser.add_argument("--file", required=True, help="Backup file path")
    restore_parser.add_argument("--database", default="", help="Target database name")

    # cleanup command
    cleanup_parser = subparsers.add_parser("cleanup", help="Remove old backups")
    cleanup_parser.add_argument(
        "--retain-days", type=int, default=BACKUP_RETENTION_DAYS,
        help="Days to retain"
    )

    # verify command
    verify_parser = subparsers.add_parser("verify", help="Verify a backup file")
    verify_parser.add_argument("--file", required=True, help="Backup file path")

    # cron command
    subparsers.add_parser("cron", help="Generate cron schedule")

    # pitr command
    subparsers.add_parser("pitr", help="Show PITR configuration")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    try:
        if args.command == "backup":
            backup_file = create_backup()
            if verify_backup(backup_file):
                logger.info("Backup created and verified: %s", backup_file)
            else:
                logger.warning("Backup created but verification failed")
                return 1

        elif args.command == "list":
            backups = list_backups()
            if not backups:
                print("No backups found.")
            else:
                print(f"\n{'Name':<50} {'Size':>10} {'Created'}")
                print("-" * 80)
                for backup in backups:
                    print(
                        f"{backup['name']:<50} {backup['size_mb']:>8.2f} MB "
                        f"{backup['created']}"
                    )
                print(f"\nTotal: {len(backups)} backups")

        elif args.command == "restore":
            restore_backup(Path(args.file), args.database)

        elif args.command == "cleanup":
            deleted = cleanup_old_backups(args.retain_days)
            print(f"Removed {deleted} old backups")

        elif args.command == "verify":
            if verify_backup(Path(args.file)):
                print("Backup is valid")
            else:
                print("Backup verification FAILED")
                return 1

        elif args.command == "cron":
            print(generate_cron_schedule())

        elif args.command == "pitr":
            print(generate_pitr_config())

        return 0

    except Exception as error:
        logger.error("Command failed: %s", error)
        return 1


if __name__ == "__main__":
    sys.exit(main())
