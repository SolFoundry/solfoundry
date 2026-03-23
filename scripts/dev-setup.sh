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
    *)
      error "Unknown option: $arg"
      echo "Run '$0 --help' for usage"
      exit 1
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
    local major minor
    major=$(echo "${version:-0.0}" | cut -d. -f1)
    minor=$(echo "${version:-0.0}" | cut -d. -f2)
    local min_major min_minor
    min_major=$(echo "${min_version:-0.0}" | cut -d. -f1)
    min_minor=$(echo "${min_version:-0.0}" | cut -d. -f2)
    if [ "${major:-0}" -lt "${min_major:-0}" ] || \
       { [ "${major:-0}" -eq "${min_major:-0}" ] && [ "${minor:-0}" -lt "${min_minor:-0}" ]; }; then
      warn "$cmd v${min_version}+ recommended (found v${version:-unknown})"
    else
      success "$cmd found (v${version:-unknown})"
    fi
    return 0
  else
    error "$cmd not found — $install_hint"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
}

header "🔍 Checking prerequisites..."

check_cmd "git"    "2.0"  "https://git-scm.com/downloads"
check_cmd "node"   "18.0" "https://nodejs.org (v18+ required)"
check_cmd "python3" "3.10" "https://python.org (v3.10+ required)"
check_cmd "npm"    "9.0"  "Comes with Node.js"

# Check Node version >= 18
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -v | grep -oE '^v([0-9]+)' | tr -d 'v')
  if [ "${NODE_MAJOR:-0}" -lt 18 ]; then
    error "Node.js v18+ required (found v${NODE_MAJOR})"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Check Python version >= 3.10 (validate both major and minor)
if command -v python3 &>/dev/null; then
  PY_VERSION=$(python3 -c "import sys; v=sys.version_info; print(f'{v.major}.{v.minor}')" 2>/dev/null || echo "0.0")
  PY_MAJOR="${PY_VERSION%%.*}"
  PY_MINOR="${PY_VERSION##*.}"
  if [ "${PY_MAJOR:-0}" -lt 3 ] || { [ "${PY_MAJOR:-0}" -eq 3 ] && [ "${PY_MINOR:-0}" -lt 10 ]; }; then
    error "Python 3.10+ required (found ${PY_VERSION})"
    ERRORS=$((ERRORS + 1))
  fi
fi

# Docker (recommended but optional)
COMPOSE_CMD=""
if $USE_DOCKER; then
  if command -v docker &>/dev/null; then
    success "docker found"
    if docker compose version &>/dev/null 2>&1; then
      success "docker compose found"
      COMPOSE_CMD="docker compose"
    elif docker-compose --version &>/dev/null 2>&1; then
      success "docker-compose (legacy) found"
      COMPOSE_CMD="docker-compose"
    else
      warn "docker compose not found — install Docker Compose v2"
      USE_DOCKER=false
    fi
  else
    warn "docker not found — will set up without Docker"
    USE_DOCKER=false
  fi
fi

# Optional tools (rust uses 'rustc' binary, anchor uses 'anchor')
for tool in "rust:rustc:Rust (optional, for smart contracts)" "anchor:anchor:Anchor (optional, for Solana programs)"; do
  name="${tool%%:*}"
  rest="${tool#*:}"
  binary="${rest%%:*}"
  desc="${rest#*:}"
  if command -v "$binary" &>/dev/null 2>&1; then
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
  if [ ! -f .env.example ]; then
    error ".env.example not found — cannot create .env"
    exit 1
  fi
  cp .env.example .env
  success "Created .env from .env.example"
  info "Edit .env to add GITHUB_TOKEN for full functionality"
fi

# Source .env so BACKEND_PORT / FRONTEND_PORT are available if set there
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# ---------------------------------------------------------------------------
# Frontend setup
# ---------------------------------------------------------------------------

header "🎨 Setting up frontend..."

if [ ! -d "$PROJECT_ROOT/frontend" ]; then
  error "frontend/ directory not found"
  exit 1
fi
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

if [ ! -d "$PROJECT_ROOT/backend" ]; then
  error "backend/ directory not found"
  exit 1
fi
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

  $COMPOSE_CMD up -d --build 2>&1 | tail -5
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
    HEALTH=$(curl -sf "$HEALTH_URL" 2>/dev/null) && {
      STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
      if [ "$STATUS" = "healthy" ]; then
        success "Health check passed: $STATUS"
        break
      else
        warn "Health check returned: $STATUS — retrying..."
        RETRIES=$((RETRIES + 1))
        sleep 2
        continue
      fi
    }
    RETRIES=$((RETRIES + 1))
    sleep 2
  done

  if [ $RETRIES -eq $MAX_RETRIES ]; then
    warn "Health check timed out — services may still be starting"
    info "Check logs: $COMPOSE_CMD logs -f"
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
if $USE_DOCKER; then
  echo -e "  ${BOLD}Logs:${NC}      $COMPOSE_CMD logs -f"
  echo -e "  ${BOLD}Stop:${NC}      $COMPOSE_CMD down"
  echo ""
fi
info "Read CONTRIBUTING.md to start building → earn \$FNDRY!"
