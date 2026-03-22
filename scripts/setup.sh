#!/usr/bin/env bash
# SolFoundry — One-command development environment setup
# Usage: bash scripts/setup.sh
#
# Gets a new contributor from `git clone` to a running dev environment.
# Works on macOS and Ubuntu. Safe to run multiple times (idempotent).

set -euo pipefail

# ──────────────────────────── Configuration ────────────────────────────

REQUIRED_NODE_MAJOR=18
REQUIRED_PYTHON_MINOR=10          # 3.10+
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# ──────────────────────────── Helpers ──────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${BLUE}ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}✅${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠️${NC}  $*"; }
fail()  { echo -e "${RED}❌${NC} $*"; exit 1; }
header(){ echo -e "\n${BOLD}── $* ──${NC}"; }

# ──────────────────────────── Pre-flight checks ───────────────────────

header "Checking required tools"

# --- Node.js ---
if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version | sed 's/v//')
    NODE_MAJOR=${NODE_VERSION%%.*}
    if [ "$NODE_MAJOR" -ge "$REQUIRED_NODE_MAJOR" ]; then
        ok "Node.js $NODE_VERSION"
    else
        fail "Node.js $REQUIRED_NODE_MAJOR+ required (found $NODE_VERSION). Install via https://nodejs.org"
    fi
else
    fail "Node.js not found. Install $REQUIRED_NODE_MAJOR+ from https://nodejs.org"
fi

# --- npm ---
if command -v npm &>/dev/null; then
    ok "npm $(npm --version)"
else
    fail "npm not found (usually bundled with Node.js)"
fi

# --- Python ---
PYTHON=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        PY_VERSION=$("$cmd" --version 2>&1 | awk '{print $2}')
        PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
        if [ "$PY_MINOR" -ge "$REQUIRED_PYTHON_MINOR" ]; then
            PYTHON="$cmd"
            ok "Python $PY_VERSION ($cmd)"
            break
        fi
    fi
done
[ -z "$PYTHON" ] && fail "Python 3.$REQUIRED_PYTHON_MINOR+ required. Install from https://python.org"

# --- pip ---
if "$PYTHON" -m pip --version &>/dev/null; then
    ok "pip $("$PYTHON" -m pip --version | awk '{print $2}')"
else
    fail "pip not found. Run: $PYTHON -m ensurepip --upgrade"
fi

# --- Docker (optional) ---
DOCKER_AVAILABLE=false
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
    DOCKER_AVAILABLE=true
    ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
    if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
        ok "Docker Compose $(docker compose version --short 2>/dev/null || echo 'available')"
    fi
else
    warn "Docker not found — will use local services instead"
fi

# --- Rust / Anchor (optional, for smart contract work) ---
if command -v rustc &>/dev/null; then
    ok "Rust $(rustc --version | awk '{print $2}')"
else
    warn "Rust not installed — optional, needed only for smart contract development"
    warn "  Install: https://rustup.rs"
fi

if command -v anchor &>/dev/null; then
    ok "Anchor $(anchor --version 2>/dev/null | awk '{print $2}' || echo 'available')"
else
    warn "Anchor not installed — optional, needed only for Solana programs"
    warn "  Install: https://www.anchor-lang.com/docs/installation"
fi

# ──────────────────────────── Project root ────────────────────────────

# Navigate to repository root (script lives in scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"
info "Project root: $PROJECT_ROOT"

# ──────────────────────────── Environment file ────────────────────────

header "Setting up environment"

if [ -f .env ]; then
    ok ".env already exists (not overwriting)"
else
    if [ -f .env.example ]; then
        cp .env.example .env
        ok "Created .env from .env.example"
    else
        warn "No .env.example found — skipping .env creation (no safe defaults available)"
    fi
fi

# ──────────────────────────── Frontend dependencies ───────────────────

header "Installing frontend dependencies"

if [ -f frontend/package.json ]; then
    cd frontend
    if [ -d node_modules ] && [ -f package-lock.json ]; then
        info "node_modules exists, running npm ci for reproducible install..."
        npm ci --loglevel=warn 2>&1 | tail -3
    else
        npm install --loglevel=warn 2>&1 | tail -3
    fi
    ok "Frontend dependencies installed"
    cd "$PROJECT_ROOT"
else
    warn "No frontend/package.json found — skipping frontend setup"
fi

# ──────────────────────────── Backend dependencies ────────────────────

header "Installing backend dependencies"

if [ -f backend/requirements.txt ]; then
    cd backend

    # Create or reuse virtual environment
    if [ ! -d .venv ]; then
        "$PYTHON" -m venv .venv
        ok "Created Python virtual environment (backend/.venv)"
    else
        ok "Virtual environment already exists"
    fi

    # Activate and install
    # shellcheck disable=SC1091
    source .venv/bin/activate
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    ok "Backend dependencies installed"

    cd "$PROJECT_ROOT"
else
    warn "No backend/requirements.txt found — skipping backend setup"
fi

# ──────────────────────────── Start services ──────────────────────────

header "Starting services"

if [ "$DOCKER_AVAILABLE" = true ] && [ -f docker-compose.yml ]; then
    info "Docker detected — starting services with Docker Compose..."
    docker compose up -d --build 2>&1 | tail -5
    ok "Docker services started"

    # Wait for health checks — verify ALL services are healthy
    info "Waiting for services to become healthy..."
    RETRIES=30
    while [ $RETRIES -gt 0 ]; do
        TOTAL_SERVICES=$(docker compose ps --services 2>/dev/null | wc -l | tr -d ' ')
        HEALTHY_SERVICES=$(docker compose ps 2>/dev/null | grep -c "healthy" || true)
        if [ "$HEALTHY_SERVICES" -ge "$TOTAL_SERVICES" ] && [ "$TOTAL_SERVICES" -gt 0 ]; then
            break
        fi
        sleep 2
        RETRIES=$((RETRIES - 1))
    done

    if [ $RETRIES -gt 0 ]; then
        ok "All services healthy ($HEALTHY_SERVICES/$TOTAL_SERVICES)"
    else
        warn "Some services may still be starting — check with: docker compose ps"
    fi
else
    info "No Docker — starting services locally..."

    # Backend
    if [ -f backend/requirements.txt ]; then
        info "Starting backend server..."
        cd backend
        # shellcheck disable=SC1091
        [ -f .venv/bin/activate ] && source .venv/bin/activate
        uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
        BACKEND_PID=$!
        ok "Backend starting on http://localhost:$BACKEND_PORT (PID: $BACKEND_PID)"
        sleep 2
        if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            warn "Backend process may have exited early — check for errors"
        fi
        cd "$PROJECT_ROOT"
    fi

    # Frontend
    if [ -f frontend/package.json ]; then
        info "Starting frontend dev server..."
        cd frontend
        npm run dev &
        FRONTEND_PID=$!
        ok "Frontend starting on http://localhost:$FRONTEND_PORT (PID: $FRONTEND_PID)"
        sleep 2
        if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
            warn "Frontend process may have exited early — check for errors"
        fi
        cd "$PROJECT_ROOT"
    fi
fi

# ──────────────────────────── Summary ─────────────────────────────────

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  🚀 SolFoundry development environment ready!${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$DOCKER_AVAILABLE" = true ] && [ -f docker-compose.yml ]; then
    echo -e "  ${BOLD}Frontend:${NC}  http://localhost:3000"
    echo -e "  ${BOLD}Backend:${NC}   http://localhost:$BACKEND_PORT"
    echo -e "  ${BOLD}API docs:${NC}  http://localhost:$BACKEND_PORT/docs"
    echo -e "  ${BOLD}Database:${NC}  postgresql://localhost:5432/solfoundry"
    echo ""
    echo -e "  ${BOLD}Commands:${NC}"
    echo "    docker compose logs -f     # View logs"
    echo "    docker compose down        # Stop services"
    echo "    docker compose restart     # Restart services"
else
    echo -e "  ${BOLD}Frontend:${NC}  http://localhost:$FRONTEND_PORT"
    echo -e "  ${BOLD}Backend:${NC}   http://localhost:$BACKEND_PORT"
    echo -e "  ${BOLD}API docs:${NC}  http://localhost:$BACKEND_PORT/docs"
fi

echo ""
echo -e "  ${BOLD}Next steps:${NC}"
echo "    1. Browse bounties: https://github.com/SolFoundry/solfoundry/issues?q=label:bounty"
echo "    2. Pick a task, create a branch, and start coding"
echo "    3. Submit a PR with 'Closes #N' and your Solana wallet"
echo ""
echo -e "  Happy building! 🛠️"
echo ""
