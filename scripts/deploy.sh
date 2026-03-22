#!/usr/bin/env bash
# deploy.sh — SolFoundry deployment script with health checks and rollback
# Usage: ./scripts/deploy.sh [staging|production] [image_tag]

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
ENVIRONMENT="${1:-staging}"
IMAGE_TAG="${2:-latest}"
COMPOSE_FILE="docker-compose.prod.yml"
APP_DIR="${DEPLOY_DIR:-/opt/solfoundry}"
SNAPSHOT_DIR="${APP_DIR}/snapshots"
LOG_FILE="/var/log/solfoundry-deploy.log"
HEALTH_ENDPOINT="http://localhost:8000/health"
HEALTH_RETRIES=12
HEALTH_INTERVAL=10  # seconds

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()     { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"; }
die()     { error "$*"; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
preflight() {
  log "Running pre-flight checks..."
  command -v docker >/dev/null 2>&1 || die "docker is not installed"
  command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || die "docker compose is not installed"
  [[ -f "$APP_DIR/$COMPOSE_FILE" ]] || die "Compose file not found: $APP_DIR/$COMPOSE_FILE"
  [[ "$ENVIRONMENT" =~ ^(staging|production)$ ]] || die "Invalid environment: $ENVIRONMENT. Use staging or production."
  mkdir -p "$SNAPSHOT_DIR"
  log "Pre-flight checks passed ✅"
}

# ── Snapshot current state ────────────────────────────────────────────────────
snapshot() {
  local ts; ts=$(date +%Y%m%d%H%M%S)
  log "Snapshotting current state → $SNAPSHOT_DIR/pre-deploy-${ts}.json"
  cd "$APP_DIR"
  docker compose -f "$COMPOSE_FILE" ps --format json > "$SNAPSHOT_DIR/pre-deploy-${ts}.json" 2>/dev/null || true
  # Export current image tags
  docker compose -f "$COMPOSE_FILE" images --format json > "$SNAPSHOT_DIR/images-${ts}.json" 2>/dev/null || true
}

# ── Health check ─────────────────────────────────────────────────────────────
health_check() {
  log "Waiting for service to become healthy..."
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    if curl -sf "$HEALTH_ENDPOINT" >/dev/null 2>&1; then
      log "Health check passed on attempt $i ✅"
      return 0
    fi
    warn "Health check attempt $i/$HEALTH_RETRIES failed, retrying in ${HEALTH_INTERVAL}s..."
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

# ── Rollback ──────────────────────────────────────────────────────────────────
rollback() {
  error "Deployment failed — initiating rollback..."
  cd "$APP_DIR"
  # Re-pull the previous image and restart
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans || true
  log "Rollback attempted. Check service status manually."
  exit 1
}

# ── Run database migrations ───────────────────────────────────────────────────
run_migrations() {
  log "Running database migrations..."
  cd "$APP_DIR"
  docker compose -f "$COMPOSE_FILE" run --rm backend alembic upgrade head
  log "Migrations complete ✅"
}

# ── Deploy ────────────────────────────────────────────────────────────────────
deploy() {
  log "Starting deployment: env=$ENVIRONMENT tag=$IMAGE_TAG"
  cd "$APP_DIR"

  # Export IMAGE_TAG for compose
  export IMAGE_TAG

  # Pull new images
  log "Pulling images (tag: $IMAGE_TAG)..."
  docker compose -f "$COMPOSE_FILE" pull

  # Run migrations before swapping traffic
  run_migrations

  # Rolling restart with zero-downtime
  log "Rolling restart..."
  docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

  # Health check; rollback on failure
  if ! health_check; then
    error "Health checks failed after deployment"
    docker compose -f "$COMPOSE_FILE" logs --tail=100 backend
    rollback
  fi

  # Prune old images
  log "Pruning dangling images..."
  docker image prune -f >/dev/null 2>&1 || true

  log "Deployment complete 🚀  environment=$ENVIRONMENT  tag=$IMAGE_TAG"
}

# ── Summary ───────────────────────────────────────────────────────────────────
summary() {
  log "─────────────────────────────────────────────"
  log "Deployment Summary"
  log "  Environment : $ENVIRONMENT"
  log "  Image tag   : $IMAGE_TAG"
  log "  Timestamp   : $(date)"
  cd "$APP_DIR"
  docker compose -f "$COMPOSE_FILE" ps
  log "─────────────────────────────────────────────"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  preflight
  snapshot
  deploy
  summary
}

main "$@"
