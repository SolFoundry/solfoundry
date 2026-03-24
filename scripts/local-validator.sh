#!/usr/bin/env bash
# =============================================================================
# local-validator.sh — SolFoundry Local Solana Validator
# =============================================================================
# Starts a local solana-test-validator pre-configured for SolFoundry
# development and testing. Deploys the bounty-registry program so that
# `anchor test` works end-to-end without touching devnet.
#
# Usage:
#   ./scripts/local-validator.sh [--reset] [--no-wait]
#
# Options:
#   --reset     Wipe ledger data before starting (fresh state)
#   --no-wait   Don't block waiting for validator to become healthy
#
# Requirements:
#   - Solana CLI (>= 1.18): https://docs.solana.com/cli/install-solana-cli-tools
#   - Anchor CLI (>= 0.30): https://www.anchor-lang.com/docs/installation
#   - Built program binary at contracts/bounty-registry/target/deploy/
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colours / logging helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log()  { echo -e "${CYAN}[$(date '+%H:%M:%S')] $*${RESET}"; }
info() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✔  $*${RESET}"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠  $*${RESET}"; }
err()  { echo -e "${RED}[$(date '+%H:%M:%S')] ✘  $*${RESET}" >&2; }
die()  { err "$*"; exit 1; }

# ---------------------------------------------------------------------------
# Resolve project root (script lives in <root>/scripts/)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTRACTS_DIR="${PROJECT_ROOT}/contracts/bounty-registry"
LEDGER_DIR="${PROJECT_ROOT}/.ledger"
FIXTURES_DIR="${CONTRACTS_DIR}/tests/fixtures"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
RPC_URL="http://127.0.0.1:8899"
WS_URL="ws://127.0.0.1:8900"
PROGRAM_ID="DwCJkFvRD7NJqzUnPo1njptVScDJsMS6ezZPNXxRrQxe"
PROGRAM_SO="${CONTRACTS_DIR}/target/deploy/bounty_registry.so"
KEYPAIR_PATH="${HOME}/.config/solana/id.json"
RESET_LEDGER=false
NO_WAIT=false
VALIDATOR_PID=""

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --reset)   RESET_LEDGER=true ;;
    --no-wait) NO_WAIT=true ;;
    --help|-h)
      sed -n '3,20p' "${BASH_SOURCE[0]}" | sed 's/^# //'
      exit 0
      ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

# ---------------------------------------------------------------------------
# Cleanup on exit
# ---------------------------------------------------------------------------
cleanup() {
  local exit_code=$?
  if [[ -n "$VALIDATOR_PID" ]] && kill -0 "$VALIDATOR_PID" 2>/dev/null; then
    warn "Shutting down validator (PID ${VALIDATOR_PID})..."
    kill "$VALIDATOR_PID" 2>/dev/null || true
    wait "$VALIDATOR_PID" 2>/dev/null || true
    info "Validator stopped."
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------
log "Checking dependencies..."

if ! command -v solana &>/dev/null; then
  die "solana CLI not found. Install from https://docs.solana.com/cli/install-solana-cli-tools"
fi

if ! command -v solana-test-validator &>/dev/null; then
  die "solana-test-validator not found. Make sure Solana CLI is properly installed."
fi

if ! command -v anchor &>/dev/null; then
  warn "anchor CLI not found — skipping Anchor version check."
fi

info "Dependencies OK (solana $(solana --version | awk '{print $2}'))"

# ---------------------------------------------------------------------------
# Wallet check / create
# ---------------------------------------------------------------------------
if [[ ! -f "${KEYPAIR_PATH}" ]]; then
  warn "No wallet found at ${KEYPAIR_PATH}. Generating a test keypair..."
  mkdir -p "$(dirname "${KEYPAIR_PATH}")"
  solana-keygen new --no-bip39-passphrase --outfile "${KEYPAIR_PATH}" --force --silent
  info "Generated test keypair at ${KEYPAIR_PATH}"
fi

# ---------------------------------------------------------------------------
# Configure Solana CLI for localnet
# ---------------------------------------------------------------------------
log "Configuring Solana CLI for localnet..."
solana config set \
  --url "${RPC_URL}" \
  --keypair "${KEYPAIR_PATH}" \
  --commitment confirmed \
  >/dev/null
info "Solana CLI → ${RPC_URL} (commitment: confirmed)"

# ---------------------------------------------------------------------------
# Optional ledger reset
# ---------------------------------------------------------------------------
if [[ "${RESET_LEDGER}" == "true" ]]; then
  warn "Resetting ledger at ${LEDGER_DIR}..."
  rm -rf "${LEDGER_DIR}"
  info "Ledger wiped."
fi

mkdir -p "${LEDGER_DIR}"

# ---------------------------------------------------------------------------
# Build validator command
# ---------------------------------------------------------------------------
VALIDATOR_ARGS=(
  --ledger           "${LEDGER_DIR}"
  --rpc-port         8899
  --dynamic-port-range 8000-8010
  --bind-address     127.0.0.1
  --rpc-bind-address 127.0.0.1
  --log              "${LEDGER_DIR}/validator.log"
  --reset
)

# Deploy the bounty-registry program if the .so exists
if [[ -f "${PROGRAM_SO}" ]]; then
  VALIDATOR_ARGS+=(
    --bpf-program "${PROGRAM_ID}" "${PROGRAM_SO}"
  )
  info "Will deploy bounty-registry program (${PROGRAM_ID})"
else
  warn "Program binary not found at ${PROGRAM_SO}"
  warn "Run \`anchor build\` first to compile the program."
  warn "Starting validator without pre-deployed program."
fi

# Fund authority fixture keypair if it exists
if [[ -f "${FIXTURES_DIR}/authority.json" ]]; then
  AUTH_PUBKEY=$(solana-keygen pubkey "${FIXTURES_DIR}/authority.json" 2>/dev/null || true)
  if [[ -n "${AUTH_PUBKEY}" ]]; then
    VALIDATOR_ARGS+=(
      --account "${AUTH_PUBKEY}" "${FIXTURES_DIR}/authority.json"
    )
  fi
fi

# ---------------------------------------------------------------------------
# Start validator in background
# ---------------------------------------------------------------------------
log "Starting solana-test-validator..."
echo -e "${BOLD}  Ledger : ${LEDGER_DIR}${RESET}"
echo -e "${BOLD}  RPC    : ${RPC_URL}${RESET}"
echo -e "${BOLD}  WS     : ${WS_URL}${RESET}"
echo -e "${BOLD}  Log    : ${LEDGER_DIR}/validator.log${RESET}"

solana-test-validator "${VALIDATOR_ARGS[@]}" &>/dev/null &
VALIDATOR_PID=$!

if [[ "${NO_WAIT}" == "true" ]]; then
  info "Validator started (PID ${VALIDATOR_PID}) — not waiting for health."
  # Detach from process so cleanup doesn't kill it
  VALIDATOR_PID=""
  exit 0
fi

# ---------------------------------------------------------------------------
# Wait for validator to become healthy
# ---------------------------------------------------------------------------
log "Waiting for validator to be ready..."
MAX_WAIT=60   # seconds
ELAPSED=0
INTERVAL=2

while (( ELAPSED < MAX_WAIT )); do
  if solana cluster-version --url "${RPC_URL}" &>/dev/null 2>&1; then
    info "Validator is ready after ${ELAPSED}s!"
    break
  fi
  sleep "${INTERVAL}"
  ELAPSED=$(( ELAPSED + INTERVAL ))
done

if (( ELAPSED >= MAX_WAIT )); then
  die "Validator did not start within ${MAX_WAIT}s. Check ${LEDGER_DIR}/validator.log"
fi

# Airdrop to the local wallet for gas
WALLET_PUBKEY=$(solana-keygen pubkey "${KEYPAIR_PATH}")
log "Airdropping 100 SOL to local wallet (${WALLET_PUBKEY})..."
solana airdrop 100 "${WALLET_PUBKEY}" --url "${RPC_URL}" >/dev/null 2>&1 || \
  warn "Airdrop failed — validator may already have funded this wallet."

BALANCE=$(solana balance "${WALLET_PUBKEY}" --url "${RPC_URL}" 2>/dev/null || echo "unknown")
info "Wallet balance: ${BALANCE}"

echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  ✔  Local validator running! Press Ctrl+C to stop.${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  RPC    : ${BOLD}${RPC_URL}${RESET}"
echo -e "  WS     : ${BOLD}${WS_URL}${RESET}"
echo -e "  Logs   : ${BOLD}tail -f ${LEDGER_DIR}/validator.log${RESET}"
echo ""
echo -e "  Quick test: ${BOLD}cd contracts/bounty-registry && anchor test --skip-local-validator${RESET}"
echo ""

# Block until killed
wait "${VALIDATOR_PID}"
