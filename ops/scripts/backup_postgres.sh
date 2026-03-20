#!/bin/bash
set -e

DB_NAME=${POSTGRES_DB:-foundry_db}
DB_USER=${POSTGRES_USER:-foundry_user}
DB_HOST=${POSTGRES_HOST:-localhost}
DB_PORT=${POSTGRES_PORT:-5432}
BACKUP_DIR=/var/lib/postgresql/backups
WAL_ARCHIVE_DIR=/var/lib/postgresql/wal_archive
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${DB_NAME}_${TIMESTAMP}.sqlc"

mkdir -p ${BACKUP_DIR}
mkdir -p ${WAL_ARCHIVE_DIR}

echo "Starting PostgreSQL base backup for ${DB_NAME} at ${TIMESTAMP}..."
export PGPASSWORD=${POSTGRES_PASSWORD}
pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} -Fc > ${BACKUP_DIR}/${FILENAME}
unset PGPASSWORD
echo "Backup complete: ${BACKUP_DIR}/${FILENAME}"

echo "Ensure PostgreSQL WAL archiving is configured in postgresql.conf for Point-In-Time Recovery (PITR):"
echo "wal_level = replica"
echo "archive_mode = on"
echo "archive_command = 'cp %p ${WAL_ARCHIVE_DIR}/%f' # Adjust path as needed"
echo "max_wal_size = 1GB # Or appropriate size"
echo "This script should be scheduled via cron (e.g., daily). WAL files should be continuously archived and moved to off-site storage." 
