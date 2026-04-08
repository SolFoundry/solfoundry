#!/usr/bin/env bash
# Logical backup of PostgreSQL (gzip SQL). Set DATABASE_URL to a postgres:// or postgresql:// URL.
# Usage: DATABASE_URL=... ./scripts/postgres-backup.sh [output-dir]

set -euo pipefail

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is required" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/solfoundry-$STAMP.sql.gz"

# Strip SQLAlchemy drivers for pg_dump URI
PGURL="${DATABASE_URL}"
PGURL="${PGURL//postgresql+asyncpg:\/\//postgresql:\/\/}"
PGURL="${PGURL//postgresql+psycopg2:\/\//postgresql:\/\/}"

echo "==> Writing $FILE"
pg_dump "$PGURL" | gzip -c >"$FILE"
ls -la "$FILE"
echo "Backup done."
