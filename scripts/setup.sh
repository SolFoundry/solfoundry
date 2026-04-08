#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SolFoundry — One-Command Development Environment Setup
#
# Usage:  ./scripts/setup.sh
#
# This script is idempotent — safe to run multiple times.
# Supports macOS (Homebrew) and Ubuntu/Debian (apt).
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Constants ────────────────────────────────────────────────────────────────

readonly REQUIRED_NODE_MAJOR=18
readonly REQUIRED_PYTHON_MAJOR=3
readonly REQUIRED_PYTHON_MINOR=10
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Colors ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Helpers ──────────────────────────────────────────────────────────────────

info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC}  $*" >&2; }
step()    { echo -e "\n${CYAN}${BOLD}▸ $*${NC}"; }

command_exists() { command -v "$1" &>/dev/null; }

detect_os() {
    case "$(uname -s)" in
        Darwin*) echo "macos" ;;
        Linux*)
            if [ -f /etc/debian_version ] || command_exists apt-get; then
                echo "ubuntu"
            else
                echo "linux"
            fi
            ;;
        *) echo "unknown" ;;
    esac
}

# ── Version Checks ──────────────────────────────────────────────────────────

check_node() {
    if ! command_exists node; then
        return 1
    fi
    local version
    version=$(node --version | sed 's/v//' | cut -d. -f1)
    [ "$version" -ge "$REQUIRED_NODE_MAJOR" ]
}

check_python() {
    local python_cmd=""
    for cmd in python3 python; do
        if command_exists "$cmd"; then
            python_cmd="$cmd"
            break
        fi
    done
    [ -z "$python_cmd" ] && return 1

    local version
    version=$("$python_cmd" --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
    local major minor
    major=$(echo "$version" | cut -d. -f1)
    minor=$(echo "$version" | cut -d. -f2)

    [ "$major" -ge "$REQUIRED_PYTHON_MAJOR" ] && [ "$minor" -ge "$REQUIRED_PYTHON_MINOR" ]
}

check_docker() {
    command_exists docker && command_exists docker-compose || command_exists docker && docker compose version &>/dev/null
}

# ── Installation Helpers ────────────────────────────────────────────────────

install_missing_macos() {
    if ! command_exists brew; then
        warn "Homebrew not found. Install it from https://brew.sh"
        return 1
    fi

    if ! check_node; then
        info "Installing Node.js via Homebrew..."
        brew install node
    fi

    if ! check_python; then
        info "Installing Python 3 via Homebrew..."
        brew install python@3.12
    fi

    if ! check_docker; then
        warn "Docker not found. Install Docker Desktop from https://docker.com/products/docker-desktop"
    fi
}

install_missing_ubuntu() {
    if ! check_node; then
        info "Installing Node.js..."
        if command_exists curl; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null
            sudo apt-get install -y nodejs 2>/dev/null
        else
            sudo apt-get update -qq && sudo apt-get install -y nodejs npm 2>/dev/null
        fi
    fi

    if ! check_python; then
        info "Installing Python 3..."
        sudo apt-get update -qq && sudo apt-get install -y python3 python3-pip python3-venv 2>/dev/null
    fi

    if ! check_docker; then
        warn "Docker not found. Install from https://docs.docker.com/engine/install/ubuntu/"
    fi
}

# ── Main Setup ──────────────────────────────────────────────────────────────

main() {
    echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║     SolFoundry Development Setup         ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${NC}\n"

    local os
    os=$(detect_os)
    info "Detected OS: ${BOLD}$os${NC}"

    cd "$PROJECT_ROOT"

    # ── Step 1: Check required tools ─────────────────────────────────────
    step "Checking required tools"

    local missing=0

    if check_node; then
        success "Node.js $(node --version)"
    else
        warn "Node.js >= $REQUIRED_NODE_MAJOR not found"
        missing=1
    fi

    if check_python; then
        local py_cmd=""
        for cmd in python3 python; do command_exists "$cmd" && py_cmd="$cmd" && break; done
        success "Python $($py_cmd --version 2>&1 | grep -oP '\d+\.\d+\.\d+')"
    else
        warn "Python >= $REQUIRED_PYTHON_MAJOR.$REQUIRED_PYTHON_MINOR not found"
        missing=1
    fi

    if check_docker; then
        success "Docker $(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)"
    else
        warn "Docker not found (recommended but optional)"
    fi

    if command_exists git; then
        success "Git $(git --version | grep -oP '\d+\.\d+\.\d+')"
    else
        error "Git is required but not installed"
        exit 1
    fi

    # Attempt auto-install on supported platforms
    if [ "$missing" -eq 1 ]; then
        step "Attempting to install missing tools"
        case "$os" in
            macos)  install_missing_macos ;;
            ubuntu) install_missing_ubuntu ;;
            *)      warn "Auto-install not supported on $os. Please install manually." ;;
        esac

        # Re-check after install
        if ! check_node; then
            error "Node.js >= $REQUIRED_NODE_MAJOR is required. Install from https://nodejs.org"
            exit 1
        fi
        if ! check_python; then
            error "Python >= $REQUIRED_PYTHON_MAJOR.$REQUIRED_PYTHON_MINOR is required. Install from https://python.org"
            exit 1
        fi
    fi

    # ── Step 2: Create .env from .env.example ────────────────────────────
    step "Setting up environment"

    if [ -f .env ]; then
        success ".env already exists (not overwriting)"
    elif [ -f .env.example ]; then
        cp .env.example .env
        success "Created .env from .env.example with safe defaults"
    else
        warn ".env.example not found — skipping .env creation"
    fi

    # ── Step 3: Install frontend dependencies ────────────────────────────
    step "Installing frontend dependencies"

    if [ -d frontend ]; then
        cd frontend
        if [ -f package-lock.json ]; then
            npm ci --loglevel=warn 2>&1 | tail -3
        else
            npm install --loglevel=warn 2>&1 | tail -3
        fi
        success "Frontend dependencies installed"
        cd "$PROJECT_ROOT"
    else
        warn "frontend/ directory not found — skipping"
    fi

    # ── Step 4: Install backend dependencies ─────────────────────────────
    step "Installing backend dependencies"

    if [ -d backend ]; then
        cd backend
        if [ -f requirements.txt ]; then
            # Create virtual environment if it doesn't exist
            if [ ! -d .venv ]; then
                python3 -m venv .venv
                info "Created Python virtual environment at backend/.venv"
            fi
            # shellcheck disable=SC1091
            source .venv/bin/activate
            pip install -q -r requirements.txt 2>&1 | tail -3
            deactivate
            success "Backend dependencies installed (venv: backend/.venv)"
        fi
        cd "$PROJECT_ROOT"
    else
        warn "backend/ directory not found — skipping"
    fi

    # ── Step 5: Install SDK dependencies (if present) ────────────────────
    if [ -d sdk ] && [ -f sdk/package.json ]; then
        step "Installing SDK dependencies"
        cd sdk
        npm install --loglevel=warn 2>&1 | tail -3
        success "SDK dependencies installed"
        cd "$PROJECT_ROOT"
    fi

    # ── Step 6: Install contract dependencies (if Rust/Anchor present) ───
    if [ -d contracts ]; then
        step "Checking smart contract tooling"
        if command_exists rustc; then
            success "Rust $(rustc --version | grep -oP '\d+\.\d+\.\d+')"
        else
            info "Rust not installed (only needed for smart contract work)"
            info "Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
        fi
        if command_exists anchor; then
            success "Anchor $(anchor --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' || echo 'installed')"
        else
            info "Anchor not installed (only needed for smart contract work)"
            info "Install: cargo install --git https://github.com/coral-xyz/anchor avm"
        fi
    fi

    # ── Step 7: Start services (Docker if available) ─────────────────────
    step "Starting services"

    if check_docker && [ -f docker-compose.yml ]; then
        info "Starting Docker services (PostgreSQL, Redis)..."
        if docker compose up -d postgres redis 2>/dev/null; then
            success "PostgreSQL and Redis started via Docker"
        elif docker-compose up -d postgres redis 2>/dev/null; then
            success "PostgreSQL and Redis started via docker-compose"
        else
            warn "Could not start Docker services. Start manually: docker compose up -d"
        fi
    else
        info "Docker not available — start PostgreSQL and Redis manually"
        info "  PostgreSQL: port ${POSTGRES_PORT:-5432}"
        info "  Redis: port ${REDIS_PORT:-6379}"
    fi

    # ── Done ─────────────────────────────────────────────────────────────
    echo ""
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║       Setup complete! 🚀                 ║${NC}"
    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BOLD}Frontend:${NC}  cd frontend && npm run dev     → http://localhost:${FRONTEND_PORT:-3000}"
    echo -e "  ${BOLD}Backend:${NC}   cd backend && source .venv/bin/activate && uvicorn app.main:app --reload"
    echo -e "             → http://localhost:${BACKEND_PORT:-8000}"
    echo -e "  ${BOLD}API Docs:${NC}  http://localhost:${BACKEND_PORT:-8000}/docs"
    echo -e "  ${BOLD}Docker:${NC}    docker compose up --build       → All services"
    echo ""
    echo -e "  ${CYAN}Read CONTRIBUTING.md to start earning \$FNDRY!${NC}"
    echo ""
}

main "$@"
