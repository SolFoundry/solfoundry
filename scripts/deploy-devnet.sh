#!/usr/bin/env bash
# SolFoundry Devnet Deploy Script
#
# Usage:
#   ./scripts/deploy-devnet.sh
#
# Environment variables:
#   SOLANA_DEPLOY_KEYPAIR  — JSON array of the deploy wallet's secret key bytes.
#                            When set, the keypair is written to a temp file, used
#                            for deployment, and securely deleted on exit.
#                            If unset, the default Solana CLI wallet is used.
#
# Prerequisites:
#   solana-cli  https://docs.solana.com/cli/install-solana-cli-tools
#   anchor-cli  cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="${REPO_ROOT}/contracts"
KEYPAIR_TMP="/tmp/solfoundry-deploy-$(date +%s).json"

# ── dependency checks ────────────────────────────────────────────────────────

check_deps() {
  local missing=0
  for cmd in solana anchor; do
    if ! command -v "$cmd" &>/dev/null; then
      echo "error: '$cmd' not found — install it before running this script" >&2
      missing=1
    fi
  done
  [[ $missing -eq 0 ]] || exit 1
}

# ── keypair setup ────────────────────────────────────────────────────────────

setup_keypair() {
  if [[ -n "${SOLANA_DEPLOY_KEYPAIR:-}" ]]; then
    printf '%s' "$SOLANA_DEPLOY_KEYPAIR" > "$KEYPAIR_TMP"
    chmod 600 "$KEYPAIR_TMP"
    # Remove the temp file on any exit (clean, error, or signal).
    trap 'rm -f "$KEYPAIR_TMP"' EXIT
    solana config set --keypair "$KEYPAIR_TMP"
    echo "Using deploy keypair from SOLANA_DEPLOY_KEYPAIR"
  else
    echo "SOLANA_DEPLOY_KEYPAIR not set — using default Solana CLI wallet"
  fi

  solana config set --url devnet
  echo "Configured for devnet"
  solana balance || true
}

# ── build ────────────────────────────────────────────────────────────────────

build() {
  echo ""
  echo "==> anchor build"
  anchor build
}

# ── test ─────────────────────────────────────────────────────────────────────

run_tests() {
  echo ""
  echo "==> anchor test (local validator)"
  anchor test
}

# ── deploy ───────────────────────────────────────────────────────────────────

deploy() {
  echo ""
  echo "==> anchor deploy --provider.cluster devnet"
  anchor deploy --provider.cluster devnet

  echo ""
  echo "Deployed programs:"
  anchor keys list
}

# ── main ─────────────────────────────────────────────────────────────────────

main() {
  echo "SolFoundry devnet deploy"
  echo "Workspace: ${WORKSPACE}"
  echo ""

  check_deps
  setup_keypair

  cd "$WORKSPACE"

  build
  run_tests
  deploy

  echo ""
  echo "Deploy complete."
}

main "$@"
