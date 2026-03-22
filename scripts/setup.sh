#!/usr/bin/env bash
# =============================================================================
# SolFoundry — one-command dev environment setup
# Usage: ./scripts/setup.sh
# Works on: macOS, Ubuntu/Debian
# Idempotent: safe to run multiple times.
# =============================================================================

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET}  $*"; }
error()   { echo -e "${RED}[error]${RESET} $*" >&2; }
step()    { echo -e "\n${BOLD}$*${RESET}"; }

# ── Repo root ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

# ── Helper: compare semver-style version numbers ─────────────────────────────
# Usage: version_ge <actual> <minimum>   (returns 0 if actual >= minimum)
version_ge() {
  # Sort the two versions; if the minimum sorts first (or they're equal) we're good.
  local sorted
  sorted=$(printf '%s\n%s\n' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | head -1)
  [ "$sorted" = "$2" ]
}

# ── 1. Check required tools ───────────────────────────────────────────────────
step "1/5  Checking required tools"

MISSING_TOOLS=()

# Node.js v18+
if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version | sed 's/^v//')
  NODE_MAJOR=$(echo "${NODE_VERSION}" | cut -d. -f1)
  if [[ "${NODE_MAJOR}" -ge 18 ]]; then
    success "Node.js ${NODE_VERSION} found"
  else
    error "Node.js ${NODE_VERSION} is too old (need v18+)."
    MISSING_TOOLS+=("node>=18")
  fi
else
  error "Node.js not found (need v18+)."
  MISSING_TOOLS+=("node>=18")
fi

# Python 3.11+
PYTHON_BIN=""
for candidate in python3.11 python3.12 python3.13 python3 python; do
  if command -v "${candidate}" &>/dev/null; then
    PY_VERSION=$("${candidate}" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    if version_ge "${PY_VERSION}" "3.11.0"; then
      PYTHON_BIN="${candidate}"
      success "Python ${PY_VERSION} found (${candidate})"
      break
    fi
  fi
done
if [[ -z "${PYTHON_BIN}" ]]; then
  error "Python 3.11+ not found."
  MISSING_TOOLS+=("python>=3.11")
fi

# git
if command -v git &>/dev/null; then
  GIT_VERSION=$(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  success "git ${GIT_VERSION} found"
else
  error "git not found."
  MISSING_TOOLS+=("git")
fi

# Suggest how to install missing tools
if [[ ${#MISSING_TOOLS[@]} -gt 0 ]]; then
  echo
  warn "Missing tools: ${MISSING_TOOLS[*]}"
  echo
  if [[ "$(uname)" == "Darwin" ]]; then
    cat <<'EOF'
  Install suggestions (macOS):
    brew install node@20          # Node.js
    brew install python@3.11      # Python
    brew install git              # git
EOF
  else
    cat <<'EOF'
  Install suggestions (Ubuntu/Debian):
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs      # Node.js

    sudo apt-get install -y python3.11 python3.11-venv  # Python
    sudo apt-get install -y git                          # git
EOF
  fi
  echo
  error "Please install the missing tools and re-run this script."
  exit 1
fi

# ── 2. Create .env from .env.example ─────────────────────────────────────────
step "2/5  Configuring environment"

if [[ -f ".env" ]]; then
  success ".env already exists — skipping (delete it to regenerate)"
else
  if [[ -f ".env.example" ]]; then
    cp .env.example .env
    success ".env created from .env.example"
    warn "Review .env and set any required secrets (GITHUB_TOKEN, SECRET_KEY, etc.)"
  else
    warn ".env.example not found — skipping .env creation"
  fi
fi

# ── 3. Frontend dependencies ──────────────────────────────────────────────────
step "3/5  Installing frontend dependencies (npm)"

FRONTEND_DIR="${REPO_ROOT}/frontend"
if [[ ! -d "${FRONTEND_DIR}" ]]; then
  warn "frontend/ directory not found — skipping"
else
  cd "${FRONTEND_DIR}"
  if [[ -d "node_modules" ]]; then
    success "node_modules already present — running npm install to sync"
  else
    info "Installing frontend packages…"
  fi
  npm install
  success "Frontend dependencies installed"
  cd "${REPO_ROOT}"
fi

# ── 4. Backend dependencies ───────────────────────────────────────────────────
step "4/5  Installing backend dependencies (pip)"

BACKEND_DIR="${REPO_ROOT}/backend"
if [[ ! -d "${BACKEND_DIR}" ]]; then
  warn "backend/ directory not found — skipping"
else
  cd "${BACKEND_DIR}"

  VENV_DIR="${BACKEND_DIR}/.venv"

  # Create venv if it doesn't exist
  if [[ ! -d "${VENV_DIR}" ]]; then
    info "Creating Python virtual environment at backend/.venv …"
    "${PYTHON_BIN}" -m venv "${VENV_DIR}"
    success "Virtual environment created"
  else
    success "Virtual environment already exists at backend/.venv"
  fi

  # Use the venv's pip
  VENV_PIP="${VENV_DIR}/bin/pip"
  VENV_PYTHON="${VENV_DIR}/bin/python"

  info "Installing/syncing backend packages…"
  "${VENV_PIP}" install --upgrade pip --quiet
  "${VENV_PIP}" install -r requirements.txt --quiet
  success "Backend dependencies installed"

  cd "${REPO_ROOT}"
fi

# ── 5. Local services ─────────────────────────────────────────────────────────
step "5/5  Starting local services"

DOCKER_AVAILABLE=false
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  DOCKER_AVAILABLE=true
fi

if $DOCKER_AVAILABLE; then
  # Prefer docker compose (v2) over docker-compose (v1)
  if docker compose version &>/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    COMPOSE_CMD=""
  fi

  if [[ -n "${COMPOSE_CMD}" && -f "${REPO_ROOT}/docker-compose.yml" ]]; then
    info "Starting services with: ${COMPOSE_CMD} up -d"
    cd "${REPO_ROOT}"
    ${COMPOSE_CMD} up -d
    success "Docker services started (postgres, redis, backend, frontend)"
  else
    warn "docker-compose.yml not found or compose plugin unavailable"
    DOCKER_AVAILABLE=false
  fi
fi

if ! $DOCKER_AVAILABLE; then
  echo
  warn "Docker is not available. Start services manually:"
  echo
  cat <<'MANUAL'
  PostgreSQL:
    docker run -d --name sf-postgres \
      -e POSTGRES_USER=solfoundry \
      -e POSTGRES_PASSWORD=solfoundry_dev \
      -e POSTGRES_DB=solfoundry \
      -p 5432:5432 postgres:16-alpine

  Redis:
    docker run -d --name sf-redis -p 6379:6379 redis:7-alpine

  Backend (in a separate terminal):
    cd backend
    source .venv/bin/activate
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

  Frontend (in a separate terminal):
    cd frontend
    npm run dev
MANUAL
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║         SolFoundry setup complete!           ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo
echo -e "  Frontend  →  ${CYAN}http://localhost:5173${RESET}"
echo -e "  Backend   →  ${CYAN}http://localhost:8000${RESET}"
echo -e "  API docs  →  ${CYAN}http://localhost:8000/docs${RESET}"
echo
echo -e "  ${YELLOW}Tip:${RESET} Review ${BOLD}.env${RESET} and set GITHUB_TOKEN / SECRET_KEY for full functionality."
echo
