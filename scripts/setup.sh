#!/usr/bin/env bash
# scripts/setup.sh — One-command dev environment setup for SolFoundry
#
# Usage:
#   ./scripts/setup.sh          # full setup
#   ./scripts/setup.sh --help   # show usage
#
# Supports: macOS (Homebrew) and Ubuntu/Debian
# Idempotent: safe to run multiple times

set -euo pipefail

# ── colours ────────────────────────────────────────────────────────────────────
if [ -t 1 ] && command -v tput &>/dev/null && tput colors &>/dev/null; then
  RED=$(tput setaf 1)   GREEN=$(tput setaf 2)  YELLOW=$(tput setaf 3)
  CYAN=$(tput setaf 6)  BOLD=$(tput bold)      RESET=$(tput sgr0)
else
  RED="" GREEN="" YELLOW="" CYAN="" BOLD="" RESET=""
fi

log()     { echo "${CYAN}[setup]${RESET} $*"; }
success() { echo "${GREEN}[setup] ✔ $*${RESET}"; }
warn()    { echo "${YELLOW}[setup] ⚠ $*${RESET}"; }
error()   { echo "${RED}[setup] ✘ $*${RESET}" >&2; exit 1; }

# ── help ───────────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "${BOLD}SolFoundry Dev Setup${RESET}"
  echo ""
  echo "Usage: ./scripts/setup.sh [--help] [--no-services]"
  echo ""
  echo "  --no-services   Skip starting Docker Compose services"
  echo "  --help, -h      Show this help"
  echo ""
  echo "Requirements: Node.js >=18, Python >=3.11, Docker (optional for services)"
  exit 0
fi

NO_SERVICES=false
[[ "${1:-}" == "--no-services" ]] && NO_SERVICES=true

# ── detect OS ─────────────────────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)
      if grep -qi ubuntu /etc/os-release 2>/dev/null || grep -qi debian /etc/os-release 2>/dev/null; then
        echo "ubuntu"
      else
        echo "linux"
      fi
      ;;
    *) echo "unknown" ;;
  esac
}
OS=$(detect_os)
log "Detected OS: ${OS}"

# ── version helpers ────────────────────────────────────────────────────────────
version_gte() {
  # Returns 0 (true) if $1 >= $2 (both in MAJOR.MINOR format)
  local IFS=.
  # shellcheck disable=SC2206
  local a=($1) b=($2)
  [[ ${a[0]} -gt ${b[0]} ]] && return 0
  [[ ${a[0]} -eq ${b[0]} && ${a[1]:-0} -ge ${b[1]:-0} ]] && return 0
  return 1
}

# ── check required tools ───────────────────────────────────────────────────────
log "Checking required tools..."

# Node.js >= 18
if command -v node &>/dev/null; then
  NODE_VER=$(node --version | sed 's/v//')
  if version_gte "$NODE_VER" "18.0"; then
    success "Node.js ${NODE_VER}"
  else
    error "Node.js ${NODE_VER} found but >= 18.0 required. Please upgrade: https://nodejs.org"
  fi
else
  error "Node.js not found. Install it from https://nodejs.org (>= 18) or via nvm."
fi

# Python >= 3.11
PYTHON_BIN=""
for bin in python3.12 python3.11 python3 python; do
  if command -v "$bin" &>/dev/null; then
    PY_VER=$("$bin" --version 2>&1 | awk '{print $2}')
    if version_gte "$PY_VER" "3.11"; then
      PYTHON_BIN="$bin"
      success "Python ${PY_VER} (${bin})"
      break
    fi
  fi
done
if [[ -z "$PYTHON_BIN" ]]; then
  error "Python >= 3.11 not found. Install via https://python.org or your system package manager."
fi

# Rust / Cargo (optional — needed for Anchor/contracts only)
if command -v cargo &>/dev/null; then
  RUST_VER=$(rustc --version | awk '{print $2}')
  success "Rust ${RUST_VER}"
  HAVE_RUST=true
else
  warn "Rust/Cargo not found. Required only if working on Solana programs."
  warn "Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  HAVE_RUST=false
fi

# Anchor CLI (optional)
if command -v anchor &>/dev/null; then
  ANCHOR_VER=$(anchor --version 2>/dev/null | awk '{print $2}' || echo "unknown")
  success "Anchor ${ANCHOR_VER}"
elif [[ "$HAVE_RUST" == true ]]; then
  warn "Anchor CLI not found. Install via: cargo install --git https://github.com/coral-xyz/anchor avm --locked"
fi

# Docker (for services)
HAVE_DOCKER=false
if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version | awk '{print $3}' | tr -d ',')
  success "Docker ${DOCKER_VER}"
  HAVE_DOCKER=true
else
  warn "Docker not found. Services won't start automatically."
  warn "Install Docker: https://docs.docker.com/get-docker/"
fi

# ── resolve repo root ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"
log "Working in: ${REPO_ROOT}"

# ── .env setup ────────────────────────────────────────────────────────────────
log "Setting up environment file..."
if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    success "Created .env from .env.example"
  else
    warn ".env.example not found — skipping .env creation"
  fi
else
  success ".env already exists (not overwritten)"
fi

# ── frontend dependencies ──────────────────────────────────────────────────────
if [[ -f frontend/package.json ]]; then
  log "Installing frontend dependencies (npm install)..."
  if [[ -f frontend/package-lock.json ]]; then
    (cd frontend && npm ci --prefer-offline 2>&1) \
      && success "Frontend dependencies installed" \
      || { warn "npm ci failed, retrying with npm install..."; (cd frontend && npm install) && success "Frontend dependencies installed"; }
  else
    (cd frontend && npm install) && success "Frontend dependencies installed"
  fi
else
  warn "frontend/package.json not found — skipping frontend install"
fi

# ── backend dependencies ───────────────────────────────────────────────────────
if [[ -f backend/requirements.txt ]]; then
  log "Installing backend dependencies (pip install)..."
  # Use a virtual environment if available, otherwise install to user
  if [[ -d backend/.venv ]]; then
    # shellcheck source=/dev/null
    source backend/.venv/bin/activate 2>/dev/null || true
    "$PYTHON_BIN" -m pip install --quiet -r backend/requirements.txt \
      && success "Backend dependencies installed (existing venv)"
  else
    "$PYTHON_BIN" -m pip install --quiet --user -r backend/requirements.txt \
      && success "Backend dependencies installed (user)"
    warn "Tip: create a virtual environment with: python3 -m venv backend/.venv && source backend/.venv/bin/activate"
  fi
else
  warn "backend/requirements.txt not found — skipping backend install"
fi

# ── services ───────────────────────────────────────────────────────────────────
if [[ "$NO_SERVICES" == true ]]; then
  warn "Skipping services (--no-services flag set)"
elif [[ "$HAVE_DOCKER" == true ]]; then
  if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    log "Starting services with Docker Compose..."
    docker compose up -d --build 2>&1 \
      && success "Services started via Docker Compose" \
      || error "Docker Compose failed. Check 'docker compose logs' for details."
  elif docker-compose version &>/dev/null 2>&1; then
    log "Starting services with docker-compose (legacy)..."
    docker-compose up -d --build 2>&1 \
      && success "Services started via docker-compose" \
      || error "docker-compose failed. Check 'docker-compose logs' for details."
  else
    warn "Docker found but 'docker compose' not available. Start services manually."
  fi
else
  warn "Skipping services: Docker not available."
  warn "Start PostgreSQL and Redis manually, then update DATABASE_URL and REDIS_URL in .env"
fi

# ── success banner ─────────────────────────────────────────────────────────────
echo ""
echo "${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo "${GREEN}${BOLD}║       SolFoundry dev environment is ready! 🚀        ║${RESET}"
echo "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
echo ""
echo "  ${BOLD}Frontend:${RESET}  http://localhost:${FRONTEND_PORT:-3000}"
echo "  ${BOLD}Backend:${RESET}   http://localhost:${BACKEND_PORT:-8000}"
echo "  ${BOLD}API docs:${RESET}  http://localhost:${BACKEND_PORT:-8000}/docs"
echo ""
echo "  ${CYAN}Start dev servers:${RESET}"
echo "    Frontend: cd frontend && npm run dev"
echo "    Backend:  cd backend && uvicorn app.main:app --reload"
echo ""
echo "  ${CYAN}Useful commands:${RESET}"
echo "    docker compose logs -f    # tail all service logs"
echo "    docker compose down       # stop services"
echo ""
