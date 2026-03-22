#!/usr/bin/env bash
# monitor.sh — SolFoundry service health monitoring
# Usage: ./scripts/monitor.sh [--interval 30] [--alert-email ops@solfoundry.io]
#        Runs once by default; use --loop for continuous monitoring.

set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
INTERVAL=30               # seconds between checks (in loop mode)
LOOP=false
ALERT_EMAIL="${ALERT_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
LOG_FILE="${LOG_FILE:-/var/log/solfoundry-monitor.log}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
APP_DIR="${APP_DIR:-/opt/solfoundry}"

# Service endpoints to check
declare -A ENDPOINTS=(
  [backend_health]="http://localhost:8000/health"
  [backend_api]="http://localhost:8000/api/v1/bounties?page=1&page_size=1"
  [frontend]="http://localhost:3000/"
)

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()   { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
ok()    { echo -e "  ${GREEN}✅ $*${NC}"; }
fail()  { echo -e "  ${RED}❌ $*${NC}"; }
warn()  { echo -e "  ${YELLOW}⚠️  $*${NC}"; }

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval) INTERVAL="$2"; shift 2 ;;
    --loop)     LOOP=true; shift ;;
    --alert-email) ALERT_EMAIL="$2"; shift 2 ;;
    --slack)    SLACK_WEBHOOK="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Alert helpers ─────────────────────────────────────────────────────────────
send_slack_alert() {
  local message="$1"
  if [[ -n "$SLACK_WEBHOOK" ]]; then
    curl -sf -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\": \"🚨 SolFoundry Monitor: $message\"}" >/dev/null 2>&1 || true
  fi
}

send_email_alert() {
  local subject="$1" body="$2"
  if [[ -n "$ALERT_EMAIL" ]] && command -v mail >/dev/null 2>&1; then
    echo "$body" | mail -s "[SolFoundry] $subject" "$ALERT_EMAIL" || true
  fi
}

# ── HTTP health check ─────────────────────────────────────────────────────────
check_endpoint() {
  local name="$1" url="$2"
  local http_code response_time

  http_code=$(curl -o /dev/null -sf -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  response_time=$(curl -o /dev/null -sf -w "%{time_total}" --max-time 10 "$url" 2>/dev/null || echo "N/A")

  if [[ "$http_code" =~ ^2 ]]; then
    ok "$name — HTTP $http_code (${response_time}s)"
    return 0
  else
    fail "$name — HTTP $http_code (${response_time}s) — URL: $url"
    return 1
  fi
}

# ── Container health check ────────────────────────────────────────────────────
check_containers() {
  log "Checking Docker containers..."
  local all_ok=true

  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker not available, skipping container checks"
    return 0
  fi

  while IFS= read -r line; do
    local name status
    name=$(echo "$line" | awk '{print $1}')
    status=$(echo "$line" | awk '{print $NF}')
    if [[ "$status" == "running" ]]; then
      ok "Container $name — $status"
    else
      fail "Container $name — $status"
      all_ok=false
    fi
  done < <(docker ps --format "{{.Names}} {{.Status}}" 2>/dev/null | grep -i solfoundry || true)

  $all_ok || return 1
}

# ── Disk usage check ─────────────────────────────────────────────────────────
check_disk() {
  log "Checking disk usage..."
  local usage
  usage=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
  if (( usage < 80 )); then
    ok "Disk usage: ${usage}%"
  elif (( usage < 90 )); then
    warn "Disk usage: ${usage}% (approaching limit)"
  else
    fail "Disk usage: ${usage}% (critical!)"
    send_slack_alert "Disk usage at ${usage}% on $(hostname)"
    return 1
  fi
}

# ── Memory check ─────────────────────────────────────────────────────────────
check_memory() {
  log "Checking memory usage..."
  local used_pct
  used_pct=$(free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}')
  if (( used_pct < 85 )); then
    ok "Memory usage: ${used_pct}%"
  else
    warn "Memory usage: ${used_pct}% (high)"
  fi
}

# ── Full health check run ─────────────────────────────────────────────────────
run_checks() {
  local failures=0
  log "═══════════════════════════════════════════"
  log "SolFoundry Health Check — $(date)"
  log "═══════════════════════════════════════════"

  # Service endpoints
  log "Checking HTTP endpoints..."
  for name in "${!ENDPOINTS[@]}"; do
    check_endpoint "$name" "${ENDPOINTS[$name]}" || ((failures++))
  done

  # Containers
  check_containers || ((failures++))

  # System resources
  check_disk   || ((failures++))
  check_memory || true   # informational only

  # Summary
  log "───────────────────────────────────────────"
  if (( failures == 0 )); then
    log "All checks passed ✅"
  else
    log "$(echo -e "${RED}$failures check(s) FAILED ❌${NC}")"
    send_slack_alert "$failures health check(s) failed on $(hostname) at $(date)"
    send_email_alert "$failures checks failed" "$failures health check(s) failed on $(hostname). Check $LOG_FILE for details."
    return 1
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
if $LOOP; then
  log "Starting continuous monitoring (interval: ${INTERVAL}s)..."
  while true; do
    run_checks || true
    sleep "$INTERVAL"
  done
else
  run_checks
fi
