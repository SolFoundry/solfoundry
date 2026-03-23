#!/usr/bin/env bash
# SolFoundry — One-Command Development Environment Setup
#
# Usage:
#   ./scripts/dev-setup.sh          # Full setup (Docker recommended)
#   ./scripts/dev-setup.sh --no-docker  # Manual setup without Docker
#   ./scripts/dev-setup.sh --check  # Verify prerequisites only
#
# Prerequisites:
#   Required: git, node (18+), python (3.10+)
#   Recommended: docker, docker compose
#
# What this script does:
#   1. Checks all prerequisites and versions
#   2. Copies .env.example → .env (if not exists)
#   3. Installs frontend dependencies (npm install)
#   4. Creates Python virtual environment and installs backend deps
#   5. Starts services via Docker Compose (or guides manual setup)
#   6. Runs a quick health check to verify everything works

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors and helpers
# ---------------------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC}  $*"; }
header()  { echo -e "\n${BOLD}$*${NC}"; }

# ---------------------------------------------------------------------------
# Find project root (where docker-compose.yml lives)
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

USE_DOCKER=true
CHECK_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --no-docker) USE_DOCKER=false ;;
    --check)     CHECK_ONLY=true ;;
    --help|-h)
      echo "Usage: $0 [--no-docker] [--check] [--help]"
      echo ""
      echo "Options:"
      echo "  --no-docker   Skip Docker, set up manually"
      echo "  --check       Only verify prerequisites"
      echo "  --help        Show this message"
      exit 0
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Prerequisite checks
# ---------------------------------------------------------------------------

ERRORS=0

check_cmd() {
  local cmd="$1"
  local min_version="$2"
  local install_hint="$3"

  if command -v "$cmd" &>/dev/null; then
    local version
    version=$("$cmd" --version 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
    success "$cmd found (v${version:-unknown})"
    return 0
  else
    error "$cmd not found — $install_hint"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
}

header "🔍 Checking prerequisites..."

check_cmd "git"    "2.0"  "https://git-scm.com/downloads"
check_cmd "node"   "18"   "https://nodejs.org (v18+ required)"
check_cmd "python3" "3.10" "https://python.org (v3.10+ required)"
check_cmd "npm"    "9"    "Comes with Node.js"

# Check Node version >= 18
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -v | grep -oE '^v([0-9]+)' | tr -d 'v')
  if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
    error "Node.js v18+ required (found v${NODE_MAJOR})"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check Python version >= 3.10
if command -v python3 &>/dev/null; then
  PY_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.minor}')" 2>/dev/null || echo "0")
  if [ "${PY_VERSION:-0}" -lt 10 ]; then
    error "Python 3.10+ required"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Docker (recommended but optional)
if $USE_DOCKER; then
  if command -v docker &>/dev/null; then
    success "docker found"
    if docker compose version &>/dev/null; then
      success "docker compose found"
    elif docker-compose --version &>/dev/null; then
      success "docker-compose (legacy) found"
    else
      warn "docker compose not found — install Docker Compose v2"
      USE_DOCKER=false
    fi
  else
    warn "docker not found — will set up without Docker"
    USE_DOCKER=false
  fi
fi

# Optional tools
for tool in "rust:Rust (optional, for smart contracts)" "anchor:Anchor (optional, for Solana programs)"; do
  cmd="${tool%%:*}"
  desc="${tool#*:}"
  if command -v "$cmd" &>/dev/null 2>&1 || command -v "${cmd}c" &>/dev/null 2>&1; then
    success "$desc — found"
  else
    info "$desc — not installed (not required for frontend/backend)"
  fi
done

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  error "$ERRORS missing prerequisite(s). Install them and re-run."
  exit 1
fi

success "All prerequisites satisfied!"

if $CHECK_ONLY; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Environment file
# ---------------------------------------------------------------------------

header "📋 Setting up environment..."

if [ -f .env ]; then
  info ".env already exists — keeping your settings"
else
  cp .env.example .env
  success "Created .env from .env.example"
  info "Edit .env to add GITHUB_TOKEN for full functionality"
fi

# ---------------------------------------------------------------------------
# Frontend setup
# ---------------------------------------------------------------------------

header "🎨 Setting up frontend..."

cd "$PROJECT_ROOT/frontend"

if [ -d "node_modules" ]; then
  info "node_modules exists — running npm install for updates..."
fi

npm install --no-audit --no-fund 2>&1 | tail -3
success "Frontend dependencies installed"

cd "$PROJECT_ROOT"

# ---------------------------------------------------------------------------
# Backend setup
# ---------------------------------------------------------------------------

header "🐍 Setting up backend..."

cd "$PROJECT_ROOT/backend"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  success "Created Python virtual environment"
else
  info "Virtual environment already exists"
fi

# shellcheck disable=SC1091
source .venv/bin/activate

pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt 2>&1 | tail -2
success "Backend dependencies installed"

cd "$PROJECT_ROOT"

# ---------------------------------------------------------------------------
# Start services
# ---------------------------------------------------------------------------

if $USE_DOCKER; then
  header "🐳 Starting services with Docker Compose..."

  docker compose up -d --build 2>&1 | tail -5
  success "Docker services started"

  # Wait for services to be ready
  info "Waiting for services to initialize..."
  sleep 5

  # Health check
  header "🏥 Running health check..."

  HEALTH_URL="http://localhost:${BACKEND_PORT:-8000}/health"
  RETRIES=0
  MAX_RETRIES=10

  while [ $RETRIES -lt $MAX_RETRIES ]; do
    if curl -sf "$HEALTH_URL" &>/dev/null; then
      HEALTH=$(curl -sf "$HEALTH_URL")
      STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
      if [ "$STATUS" = "healthy" ]; then
        success "Health check passed: $STATUS"
        break
      else
        warn "Health check returned: $STATUS"
        break
      fi
    fi
    RETRIES=$((RETRIES + 1))
    sleep 2
  done

  if [ $RETRIES -eq $MAX_RETRIES ]; then
    warn "Health check timed out — services may still be starting"
    info "Check logs: docker compose logs -f"
  fi
else
  header "📝 Manual setup instructions"
  echo ""
  info "Start PostgreSQL and Redis manually, then:"
  echo ""
  echo "  # Terminal 1 — Backend"
  echo "  cd backend && source .venv/bin/activate"
  echo "  uvicorn app.main:app --reload --port 8000"
  echo ""
  echo "  # Terminal 2 — Frontend"
  echo "  cd frontend && npm run dev"
  echo ""
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

header "🎉 SolFoundry dev environment is ready!"
echo ""
echo -e "  ${BOLD}Frontend:${NC}  http://localhost:${FRONTEND_PORT:-3000}"
echo -e "  ${BOLD}Backend:${NC}   http://localhost:${BACKEND_PORT:-8000}"
echo -e "  ${BOLD}API Docs:${NC}  http://localhost:${BACKEND_PORT:-8000}/docs"
echo -e "  ${BOLD}Health:${NC}    http://localhost:${BACKEND_PORT:-8000}/health"
echo ""
echo -e "  ${BOLD}Logs:${NC}      docker compose logs -f"
echo -e "  ${BOLD}Stop:${NC}      docker compose down"
echo ""
info "Read CONTRIBUTING.md to start building → earn \$FNDRY!"
