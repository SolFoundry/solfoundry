#!/usr/bin/env bash
# ============================================================================
# SolFoundry — One-Command Development Setup
# ============================================================================
# Usage: ./scripts/setup.sh
#
# Gets a new contributor from git clone to running dev environment.
# Checks for required tools, installs dependencies, sets up environment,
# and starts all services.
#
# Works on macOS and Ubuntu. Idempotent — safe to run multiple times.
# ============================================================================

set -euo pipefail

# ============================================================================
# Colors and formatting
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }
header()  { echo -e "\n${BOLD}${CYAN}━━━ $* ━━━${NC}\n"; }

# ============================================================================
# Determine project root (script can be run from anywhere)
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

info "Project root: $PROJECT_ROOT"

# ============================================================================
# Detect OS
# ============================================================================

OS="$(uname -s)"
case "$OS" in
    Darwin) PLATFORM="macos" ;;
    Linux)  PLATFORM="linux" ;;
    *)      error "Unsupported OS: $OS (only macOS and Linux are supported)"; exit 1 ;;
esac

info "Detected platform: $PLATFORM"

# ============================================================================
# Tool version checks
# ============================================================================

MIN_NODE_VERSION=18
MIN_PYTHON_VERSION="3.11"

check_command() {
    local cmd="$1"
    local install_hint="$2"
    if ! command -v "$cmd" &> /dev/null; then
        error "$cmd is not installed."
        info "Install it: $install_hint"
        return 1
    fi
    return 0
}

check_node_version() {
    local version
    version="$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)"
    if [ -z "$version" ] || [ "$version" -lt "$MIN_NODE_VERSION" ]; then
        error "Node.js $MIN_NODE_VERSION+ required (found: v${version:-none})"
        info "Install via: https://nodejs.org or 'nvm install $MIN_NODE_VERSION'"
        return 1
    fi
    success "Node.js v$(node --version | sed 's/v//') detected"
}

check_python_version() {
    local version
    # Try python3 first, then python
    local py_cmd="python3"
    if ! command -v python3 &> /dev/null; then
        py_cmd="python"
    fi
    if ! command -v "$py_cmd" &> /dev/null; then
        error "Python $MIN_PYTHON_VERSION+ required (not found)"
        info "Install via: https://python.org or 'pyenv install 3.11'"
        return 1
    fi
    version="$($py_cmd --version 2>&1 | awk '{print $2}')"
    local major minor
    major="$(echo "$version" | cut -d. -f1)"
    minor="$(echo "$version" | cut -d. -f2)"
    if [ "$major" -lt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -lt 11 ]; }; then
        error "Python $MIN_PYTHON_VERSION+ required (found: $version)"
        return 1
    fi
    success "Python $version detected (using $py_cmd)"
    echo "$py_cmd"
}

header "Checking Required Tools"

MISSING_TOOLS=0

# Node.js
if check_command "node" "https://nodejs.org or 'nvm install $MIN_NODE_VERSION'"; then
    check_node_version || MISSING_TOOLS=1
else
    MISSING_TOOLS=1
fi

# npm
check_command "npm" "Comes with Node.js" || MISSING_TOOLS=1

# Python
PY_CMD="$(check_python_version)" || MISSING_TOOLS=1

# pip
if ! "$PY_CMD" -m pip --version &> /dev/null 2>&1; then
    warn "pip not found, trying to install..."
    "$PY_CMD" -m ensurepip --upgrade 2>/dev/null || {
        error "pip is required. Install it: $PY_CMD -m ensurepip or https://pip.pypa.io"
        MISSING_TOOLS=1
    }
fi

# Git (should be present since they cloned the repo, but check anyway)
check_command "git" "https://git-scm.com" && success "Git $(git --version | awk '{print $3}') detected" || MISSING_TOOLS=1

# Docker (optional but recommended)
if check_command "docker" "https://docs.docker.com/get-docker/"; then
    success "Docker $(docker --version | awk '{print $3}' | tr -d ',') detected"
    HAS_DOCKER=true
else
    warn "Docker not found — will set up services locally instead"
    HAS_DOCKER=false
fi

# Anchor / Rust (optional for smart contract work)
if check_command "anchor" "https://www.anchor-lang.com/docs/installation"; then
    success "Anchor CLI $(anchor --version 2>/dev/null | awk '{print $2}') detected"
    HAS_ANCHOR=true
else
    warn "Anchor CLI not found — skipping smart contract setup (optional)"
    HAS_ANCHOR=false
fi

if [ "$MISSING_TOOLS" -ne 0 ]; then
    error "Required tools are missing. Please install them and re-run this script."
    exit 1
fi

success "All required tools are present!"

# ============================================================================
# Environment setup
# ============================================================================

header "Setting Up Environment"

# Backend .env
if [ -f "backend/.env" ]; then
    success "backend/.env already exists (skipping)"
else
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        # Generate a random JWT secret for local development
        if command -v openssl &> /dev/null; then
            JWT_SECRET="$(openssl rand -hex 32)"
            if [ "$PLATFORM" = "macos" ]; then
                sed -i '' "s/your-jwt-secret-key-at-least-32-characters-long/$JWT_SECRET/" backend/.env
            else
                sed -i "s/your-jwt-secret-key-at-least-32-characters-long/$JWT_SECRET/" backend/.env
            fi
        fi
        # Set safe local defaults
        if [ "$PLATFORM" = "macos" ]; then
            sed -i '' 's/AUTH_ENABLED=true/AUTH_ENABLED=false/' backend/.env
            sed -i '' 's/ENFORCE_HTTPS=true/ENFORCE_HTTPS=false/' backend/.env
        else
            sed -i 's/AUTH_ENABLED=true/AUTH_ENABLED=false/' backend/.env
            sed -i 's/ENFORCE_HTTPS=true/ENFORCE_HTTPS=false/' backend/.env
        fi
        success "Created backend/.env from .env.example (with safe local defaults)"
    else
        warn "No backend/.env.example found — skipping .env creation"
    fi
fi

# ============================================================================
# Install dependencies
# ============================================================================

header "Installing Frontend Dependencies"

if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then
    cd frontend
    if [ -d "node_modules" ]; then
        info "node_modules exists — running npm install to sync..."
    fi
    npm install --no-audit --no-fund 2>&1 | tail -1
    success "Frontend dependencies installed"
    cd "$PROJECT_ROOT"
else
    warn "No frontend/package.json found — skipping frontend setup"
fi

header "Installing Backend Dependencies"

if [ -d "backend" ] && [ -f "backend/requirements.txt" ]; then
    cd backend

    # Create or reuse virtual environment
    if [ -d "venv" ]; then
        info "Virtual environment already exists"
    else
        info "Creating Python virtual environment..."
        "$PY_CMD" -m venv venv
    fi

    # Activate venv
    # shellcheck disable=SC1091
    source venv/bin/activate

    # Install dependencies
    pip install -q -r requirements.txt 2>&1 | tail -3
    success "Backend dependencies installed (venv at backend/venv/)"

    deactivate
    cd "$PROJECT_ROOT"
else
    warn "No backend/requirements.txt found — skipping backend setup"
fi

# Smart contracts (if Anchor is available)
if [ "$HAS_ANCHOR" = true ] && [ -d "contracts" ]; then
    header "Building Smart Contracts"
    cd contracts
    anchor build 2>&1 | tail -3
    success "Smart contracts built"
    cd "$PROJECT_ROOT"
fi

# ============================================================================
# Start services (Docker or local)
# ============================================================================

header "Starting Services"

if [ "$HAS_DOCKER" = true ] && [ -f "docker-compose.yml" ]; then
    info "Starting services with Docker Compose..."
    docker compose up -d --build 2>&1 | tail -5
    success "Docker services started"
else
    info "Docker not available — services need to be started manually."
    echo ""
    info "Start the backend:"
    echo "  cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
    echo ""
    info "Start the frontend:"
    echo "  cd frontend && npm run dev"
    echo ""
    warn "You'll also need PostgreSQL and Redis running locally."
    warn "  PostgreSQL: brew install postgresql (macOS) or apt install postgresql (Ubuntu)"
    warn "  Redis: brew install redis (macOS) or apt install redis-server (Ubuntu)"
fi

# ============================================================================
# Done!
# ============================================================================

header "Setup Complete!"

echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║                  SolFoundry Dev Environment                  ║"
echo "  ╠══════════════════════════════════════════════════════════════╣"
echo "  ║                                                              ║"
echo "  ║  Frontend:  http://localhost:5173                            ║"
echo "  ║  Backend:   http://localhost:8000                            ║"
echo "  ║  API Docs:  http://localhost:8000/docs                       ║"
echo "  ║                                                              ║"
echo "  ╠══════════════════════════════════════════════════════════════╣"
echo "  ║                                                              ║"
echo "  ║  Next steps:                                                 ║"
echo "  ║  1. Pick a bounty:  github.com/SolFoundry/solfoundry/issues  ║"
echo "  ║  2. Create a branch: git checkout -b feat/bounty-N-desc      ║"
echo "  ║  3. Build & submit a PR                                     ║"
echo "  ║  4. Read CONTRIBUTING.md for full details                    ║"
echo "  ║                                                              ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

success "Happy building! Ship code, earn \$FNDRY."
