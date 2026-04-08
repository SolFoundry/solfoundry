#!/usr/bin/env bash
# Test restore procedure against a disposable local Postgres (Docker).
# Usage: ./scripts/postgres-restore-test.sh path/to/backup.sql.gz
# Starts postgres:16 on port 55432, restores, runs SELECT 1, tears down.

set -euo pipefail

BACKUP="${1:-}"
if [[ -z "$BACKUP" || ! -f "$BACKUP" ]]; then
  echo "usage: $0 backup.sql.gz" >&2
  exit 1
fi

NAME="solfoundry-restore-test-$$"
export PGPASSWORD="restoretest"

cleanup() {
  docker rm -f "$NAME" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Start temp Postgres"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PGPASSWORD" -e POSTGRES_DB=solfoundry \
  -p 55432:5432 postgres:16-alpine >/dev/null

echo "==> Wait for ready"
for _ in $(seq 1 30); do
  if docker exec "$NAME" pg_isready -U postgres -d solfoundry &>/dev/null; then
    break
  fi
  sleep 1
done

CONN="postgresql://postgres:${PGPASSWORD}@127.0.0.1:55432/solfoundry"
echo "==> Restore"
gunzip -c "$BACKUP" | docker exec -i "$NAME" psql -U postgres -d solfoundry -v ON_ERROR_STOP=1 -f - >/dev/null

echo "==> Verify"
docker exec "$NAME" psql -U postgres -d solfoundry -tAc "SELECT 1" | grep -q 1

echo "Restore test succeeded."
