#!/usr/bin/env bash
# =============================================================================
# setup-test-accounts.sh — SolFoundry Test Account Setup
# =============================================================================
# Creates and funds test wallets for local development.
# Uses pre-generated fixture keypairs from tests/fixtures/ so that PDAs
# and test expectations remain deterministic across runs.
#
# Usage:
#   ./scripts/setup-test-accounts.sh [--rpc <url>] [--airdrop <sol>]
#
# Options:
#   --rpc <url>      RPC endpoint (default: http://127.0.0.1:8899)
#   --airdrop <sol>  SOL to airdrop per account (default: 10)
#
# Requirements:
#   - solana CLI >= 1.18
#   - A running local validator (run scripts/local-validator.sh first)
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
# Resolve paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURES_DIR="${PROJECT_ROOT}/contracts/bounty-registry/tests/fixtures"

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
RPC_URL="http://127.0.0.1:8899"
AIRDROP_AMOUNT=10
COMMITMENT="confirmed"

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --rpc)
      RPC_URL="$2"
      shift 2
      ;;
    --airdrop)
      AIRDROP_AMOUNT="$2"
      shift 2
      ;;
    --help|-h)
      sed -n '3,20p' "${BASH_SOURCE[0]}" | sed 's/^# //'
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------
log "Checking dependencies..."
if ! command -v solana &>/dev/null; then
  die "solana CLI not found. Install from https://docs.solana.com/cli/install-solana-cli-tools"
fi
info "solana CLI found ($(solana --version | awk '{print $2}'))"

# ---------------------------------------------------------------------------
# Validator connectivity check
# ---------------------------------------------------------------------------
log "Checking validator at ${RPC_URL}..."
if ! solana cluster-version --url "${RPC_URL}" &>/dev/null; then
  die "Cannot reach validator at ${RPC_URL}. Run scripts/local-validator.sh first."
fi
info "Validator reachable."

# ---------------------------------------------------------------------------
# Ensure fixtures directory exists
# ---------------------------------------------------------------------------
mkdir -p "${FIXTURES_DIR}"

# ---------------------------------------------------------------------------
# Account definitions
# ---------------------------------------------------------------------------
# Format: "label:filename:description"
declare -a ACCOUNTS=(
  "authority:authority.json:Admin/authority wallet (program upgrade authority)"
  "contributor1:contributor1.json:Test contributor account #1"
  "contributor2:contributor2.json:Test contributor account #2"
)

# ---------------------------------------------------------------------------
# Helper: create or load a keypair, then airdrop
# ---------------------------------------------------------------------------
setup_account() {
  local label="$1"
  local filename="$2"
  local description="$3"
  local keypair_path="${FIXTURES_DIR}/${filename}"

  echo ""
  log "Setting up account: ${BOLD}${label}${RESET} (${description})"

  if [[ -f "${keypair_path}" ]]; then
    info "Fixture keypair exists: ${keypair_path}"
  else
    warn "Fixture not found — generating new keypair..."
    solana-keygen new \
      --no-bip39-passphrase \
      --outfile "${keypair_path}" \
      --force \
      --silent
    info "Generated: ${keypair_path}"
    warn "⚠ This is a test-only keypair. Do NOT use for mainnet."
  fi

  # Derive public key
  local pubkey
  pubkey=$(solana-keygen pubkey "${keypair_path}" 2>/dev/null) || \
    die "Failed to read public key from ${keypair_path}"

  echo -e "  ${BOLD}Public key:${RESET} ${pubkey}"

  # Airdrop SOL
  log "Airdropping ${AIRDROP_AMOUNT} SOL to ${label} (${pubkey})..."
  local attempt=1
  local max_attempts=3
  while (( attempt <= max_attempts )); do
    if solana airdrop "${AIRDROP_AMOUNT}" "${pubkey}" \
        --url "${RPC_URL}" \
        --commitment "${COMMITMENT}" \
        >/dev/null 2>&1; then
      break
    fi
    warn "Airdrop attempt ${attempt}/${max_attempts} failed. Retrying..."
    sleep 2
    (( attempt++ ))
  done

  if (( attempt > max_attempts )); then
    warn "Could not airdrop to ${label} — may already be funded or rate-limited."
  fi

  # Verify balance
  local balance
  balance=$(solana balance "${pubkey}" --url "${RPC_URL}" --commitment "${COMMITMENT}" 2>/dev/null || echo "unknown")
  info "${label} balance: ${BOLD}${balance}${RESET}"
}

# ---------------------------------------------------------------------------
# Also fund the default wallet
# ---------------------------------------------------------------------------
DEFAULT_KEYPAIR="${HOME}/.config/solana/id.json"
if [[ -f "${DEFAULT_KEYPAIR}" ]]; then
  DEFAULT_PUBKEY=$(solana-keygen pubkey "${DEFAULT_KEYPAIR}" 2>/dev/null || echo "")
  if [[ -n "${DEFAULT_PUBKEY}" ]]; then
    log "Funding default wallet (${DEFAULT_PUBKEY})..."
    solana airdrop "${AIRDROP_AMOUNT}" "${DEFAULT_PUBKEY}" \
      --url "${RPC_URL}" \
      --commitment "${COMMITMENT}" \
      >/dev/null 2>&1 || warn "Default wallet airdrop failed (may already be funded)."
    balance=$(solana balance "${DEFAULT_PUBKEY}" --url "${RPC_URL}" 2>/dev/null || echo "unknown")
    info "Default wallet balance: ${balance}"
  fi
fi

# ---------------------------------------------------------------------------
# Setup all fixture accounts
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Setting up ${#ACCOUNTS[@]} test accounts${RESET}"
echo -e "${BOLD}════════════════════════════════════════════════${RESET}"

for account_def in "${ACCOUNTS[@]}"; do
  IFS=':' read -r label filename description <<< "${account_def}"
  setup_account "${label}" "${filename}" "${description}"
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  ✔  Test accounts ready!${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  Fixtures: ${BOLD}${FIXTURES_DIR}${RESET}"
echo ""
echo -e "  Accounts:"
for account_def in "${ACCOUNTS[@]}"; do
  IFS=':' read -r label filename description <<< "${account_def}"
  keypair_path="${FIXTURES_DIR}/${filename}"
  if [[ -f "${keypair_path}" ]]; then
    pubkey=$(solana-keygen pubkey "${keypair_path}" 2>/dev/null || echo "N/A")
    echo -e "    ${BOLD}${label}${RESET}: ${pubkey}"
  fi
done
echo ""
echo -e "  Load in tests: ${BOLD}anchor.web3.Keypair.fromSecretKey(Uint8Array.from(require('./fixtures/authority.json')))${RESET}"
echo ""
