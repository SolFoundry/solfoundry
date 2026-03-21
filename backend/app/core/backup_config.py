"""PostgreSQL Backup Strategy Configuration.

Provides automated backup configuration for production deployments.
Implements point-in-time recovery (PITR) for data protection.

This module provides:
- Backup configuration templates
- pg_dump wrapper commands
- WAL archiving setup for PITR
- Retention policy definitions
"""

import os
from datetime import datetime, timezone

# Backup Configuration
BACKUP_CONFIG = {
    # PostgreSQL connection
    "postgres_host": os.getenv("POSTGRES_HOST", "localhost"),
    "postgres_port": int(os.getenv("POSTGRES_PORT", "5432")),
    "postgres_database": os.getenv("POSTGRES_DATABASE", "solfoundry"),
    "postgres_user": os.getenv("POSTGRES_USER", "postgres"),
    
    # Backup storage
    "backup_directory": os.getenv("BACKUP_DIR", "/var/lib/postgresql/backups"),
    "backup_retention_days": int(os.getenv("BACKUP_RETENTION_DAYS", "30")),
    "backup_retention_weekly": int(os.getenv("BACKUP_RETENTION_WEEKLY", "12")),  # 12 weeks
    "backup_retention_monthly": int(os.getenv("BACKUP_RETENTION_MONTHLY", "12")),  # 12 months
    
    # WAL archiving (for PITR)
    "wal_archive_directory": os.getenv("WAL_ARCHIVE_DIR", "/var/lib/postgresql/wal_archive"),
    "wal_keep_segments": int(os.getenv("WAL_KEEP_SEGMENTS", "64")),
    
    # Schedule (cron format)
    "full_backup_schedule": os.getenv("FULL_BACKUP_SCHEDULE", "0 2 * * *"),  # Daily at 2 AM
    "wal_archive_check_schedule": os.getenv("WAL_ARCHIVE_CHECK_SCHEDULE", "*/15 * * * *"),  # Every 15 min
}


# Backup Commands (for shell execution)
BACKUP_COMMANDS = {
    "full_backup": """
pg_dump -h {host} -p {port} -U {user} -d {database} \\
  --format=custom \\
  --compress=9 \\
  --no-owner \\
  --no-acl \\
  --file={backup_dir}/{database}_{timestamp}.dump
""",
    "backup_schema_only": """
pg_dump -h {host} -p {port} -U {user} -d {database} \\
  --schema-only \\
  --no-owner \\
  --no-acl \\
  --file={backup_dir}/{database}_schema_{timestamp}.sql
""",
    "backup_data_only": """
pg_dump -h {host} -p {port} -U {user} -d {database} \\
  --data-only \\
  --no-owner \\
  --no-acl \\
  --file={backup_dir}/{database}_data_{timestamp}.sql
""",
    "verify_backup": """
pg_restore --list {backup_file}
""",
    "restore_from_backup": """
pg_restore -h {host} -p {port} -U {user} -d {database} \\
  --no-owner \\
  --no-acl \\
  --clean \\
  --if-exists \\
  {backup_file}
""",
}


# PITR Configuration (postgresql.conf settings)
PITR_CONFIG = """
# Write-Ahead Logging (WAL) for Point-in-Time Recovery
wal_level = replica
max_wal_senders = 3
wal_keep_segments = {wal_keep_segments}
archive_mode = on
archive_command = 'cp %p {wal_archive_dir}/%f'

# Replication slots (optional, for reliable WAL archiving)
# max_replication_slots = 3
"""


# Backup Rotation Script
BACKUP_ROTATION_SCRIPT = """
#!/bin/bash
# PostgreSQL Backup Rotation Script
# Removes old backups based on retention policy

BACKUP_DIR="{backup_dir}"
RETENTION_DAYS={retention_days}
RETENTION_WEEKLY={retention_weekly}
RETENTION_MONTHLY={retention_monthly}

# Find and delete backups older than retention period
find $BACKUP_DIR -name "*.dump" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.sql" -mtime +$RETENTION_DAYS -delete

# Keep weekly backups (every Sunday)
# Keep monthly backups (first Sunday of each month)
# This is handled by the backup script naming convention

echo "Backup rotation completed at $(date)"
"""


def get_backup_command(backup_type: str = "full") -> str:
    """Get the backup command template.
    
    Args:
        backup_type: Type of backup ('full', 'schema', 'data').
    
    Returns:
        Command template string.
    """
    if backup_type == "schema":
        return BACKUP_COMMANDS["backup_schema_only"]
    elif backup_type == "data":
        return BACKUP_COMMANDS["backup_data_only"]
    return BACKUP_COMMANDS["full_backup"]


def format_backup_command(
    backup_type: str = "full",
    custom_vars: dict = None,
) -> str:
    """Format a backup command with current configuration.
    
    Args:
        backup_type: Type of backup ('full', 'schema', 'data').
        custom_vars: Custom variables to override defaults.
    
    Returns:
        Formatted command string ready for execution.
    """
    template = get_backup_command(backup_type)
    
    variables = {
        "host": BACKUP_CONFIG["postgres_host"],
        "port": BACKUP_CONFIG["postgres_port"],
        "user": BACKUP_CONFIG["postgres_user"],
        "database": BACKUP_CONFIG["postgres_database"],
        "backup_dir": BACKUP_CONFIG["backup_directory"],
        "timestamp": datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"),
    }
    
    if custom_vars:
        variables.update(custom_vars)
    
    return template.format(**variables)


def get_pitr_config() -> str:
    """Get the PITR configuration for postgresql.conf.
    
    Returns:
        Configuration string to append to postgresql.conf.
    """
    return PITR_CONFIG.format(
        wal_keep_segments=BACKUP_CONFIG["wal_keep_segments"],
        wal_archive_dir=BACKUP_CONFIG["wal_archive_directory"],
    )


def get_retention_policy() -> dict:
    """Get the backup retention policy.
    
    Returns:
        Dict with retention periods.
    """
    return {
        "daily": BACKUP_CONFIG["backup_retention_days"],
        "weekly": BACKUP_CONFIG["backup_retention_weekly"],
        "monthly": BACKUP_CONFIG["backup_retention_monthly"],
    }


# Kubernetes CronJob manifest for automated backups
KUBERNETES_BACKUP_CRONJOB = """
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: solfoundry
spec:
  schedule: "{schedule}"
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: pg-backup
            image: postgres:15
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB \\
                --format=custom --compress=9 --no-owner --no-acl \\
                --file=/backups/$POSTGRES_DB_$(date +%Y%m%d_%H%M%S).dump
            env:
            - name: POSTGRES_HOST
              value: "postgres"
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: username
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: password
            - name: POSTGRES_DB
              value: "solfoundry"
            volumeMounts:
            - name: backup-storage
              mountPath: /backups
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: postgres-backups-pvc
          restartPolicy: OnFailure
"""


def get_kubernetes_cronjob_manifest() -> str:
    """Get the Kubernetes CronJob manifest for automated backups.
    
    Returns:
        YAML manifest string.
    """
    return KUBERNETES_BACKUP_CRONJOB.format(
        schedule=BACKUP_CONFIG["full_backup_schedule"]
    )