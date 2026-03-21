#!/bin/bash
# PostgreSQL Backup Script for SolFoundry
# 
# Usage: ./scripts/backup-postgres.sh
# 
# Required environment variables:
#   DATABASE_URL - PostgreSQL connection string
#   BACKUP_S3_BUCKET - S3 bucket for backups (optional)
#   BACKUP_S3_PREFIX - S3 prefix (optional)
#   BACKUP_RETENTION_DAYS - Days to keep backups (default: 30)

set -e

# Configuration
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BACKUP_S3_PREFIX=${BACKUP_S3_PREFIX:-solfoundry/}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="solfoundry_${TIMESTAMP}.sql.gz"
BACKUP_DIR="/tmp/solfoundry_backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check dependencies
check_dependencies() {
    local missing=()
    
    command -v pg_dump >/dev/null 2>&1 || missing+=("pg_dump")
    command -v gzip >/dev/null 2>&1 || missing+=("gzip")
    
    if [ -n "$BACKUP_S3_BUCKET" ]; then
        command -v aws >/dev/null 2>&1 || missing+=("aws-cli")
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing[*]}"
        exit 1
    fi
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    log_info "Created backup directory: $BACKUP_DIR"
}

# Perform database backup
perform_backup() {
    local output_path="${BACKUP_DIR}/${BACKUP_FILE}"
    
    log_info "Starting database backup..."
    log_info "Output: $output_path"
    
    # Perform backup with pg_dump
    # Using --no-owner and --no-acl to avoid permission issues on restore
    # Using --clean to include DROP statements for clean restore
    if pg_dump "$DATABASE_URL" \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        --verbose \
        | gzip > "$output_path"; then
        log_info "Backup completed successfully"
        log_info "File size: $(du -h "$output_path" | cut -f1)"
    else
        log_error "Backup failed"
        rm -f "$output_path"
        exit 1
    fi
    
    echo "$output_path"
}

# Upload to S3
upload_to_s3() {
    local backup_path="$1"
    
    if [ -z "$BACKUP_S3_BUCKET" ]; then
        log_warn "S3 bucket not configured, skipping upload"
        return 0
    fi
    
    local s3_uri="s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}${BACKUP_FILE}"
    
    log_info "Uploading to S3: $s3_uri"
    
    if aws s3 cp "$backup_path" "$s3_uri" \
        --storage-class STANDARD_IA \
        --metadata "timestamp=${TIMESTAMP},retention=${BACKUP_RETENTION_DAYS}"; then
        log_info "S3 upload completed"
    else
        log_error "S3 upload failed"
        return 1
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than $BACKUP_RETENTION_DAYS days"
    
    # Local cleanup
    find "$BACKUP_DIR" -name "solfoundry_*.sql.gz" -type f \
        -mtime +$BACKUP_RETENTION_DAYS \
        -exec rm -f {} \; 2>/dev/null || true
    
    # S3 cleanup (if configured)
    if [ -n "$BACKUP_S3_BUCKET" ]; then
        local cutoff_date=$(date -d "-${BACKUP_RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -v-${BACKUP_RETENTION_DAYS}d +%Y%m%d)
        
        # List and delete old objects
        aws s3 ls "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}" \
            | grep -E "solfoundry_[0-9]{8}_[0-9]{6}\.sql\.gz" \
            | while read -r line; do
                local file_date=$(echo "$line" | awk '{print $4}' | grep -oE '[0-9]{8}')
                if [ "${file_date:-99999999}" -lt "$cutoff_date" ]; then
                    local old_file=$(echo "$line" | awk '{print $4}')
                    log_info "Deleting old backup: $old_file"
                    aws s3 rm "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}${old_file}" 2>/dev/null || true
                fi
            done
    fi
    
    log_info "Cleanup completed"
}

# Verify backup integrity
verify_backup() {
    local backup_path="$1"
    
    log_info "Verifying backup integrity..."
    
    # Check file exists and has content
    if [ ! -s "$backup_path" ]; then
        log_error "Backup file is empty or missing"
        return 1
    fi
    
    # Test gzip integrity
    if gzip -t "$backup_path" 2>/dev/null; then
        log_info "Backup integrity check passed"
    else
        log_error "Backup file is corrupted"
        return 1
    fi
    
    # Verify SQL content by checking for expected patterns
    if zcat "$backup_path" | head -100 | grep -q "PostgreSQL database dump"; then
        log_info "Backup contains valid PostgreSQL dump"
    else
        log_warn "Backup may not be a valid PostgreSQL dump"
    fi
}

# Send notification (optional)
send_notification() {
    local status="$1"
    local message="$2"
    
    # Can be extended to send Slack/Discord/email notifications
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        [ "$status" != "success" ] && color="danger"
        
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"attachments\":[{\"color\":\"$color\",\"title\":\"SolFoundry Backup\",\"text\":\"$message\",\"ts\":$(date +%s)}]}" \
            >/dev/null 2>&1 || true
    fi
}

# Main execution
main() {
    log_info "Starting SolFoundry backup process"
    log_info "Timestamp: $TIMESTAMP"
    
    check_dependencies
    create_backup_dir
    
    backup_path=$(perform_backup)
    
    if [ -n "$backup_path" ]; then
        verify_backup "$backup_path"
        upload_to_s3 "$backup_path"
        cleanup_old_backups
        
        log_info "Backup process completed successfully"
        send_notification "success" "Backup completed: $BACKUP_FILE"
    else
        log_error "Backup process failed"
        send_notification "error" "Backup failed"
        exit 1
    fi
}

# Run main
main "$@"