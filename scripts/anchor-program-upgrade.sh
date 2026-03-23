#!/usr/bin/env bash
# Safe Anchor upgrade: build, local tests, deploy, then on-chain verification.
# Usage: ./scripts/anchor-program-upgrade.sh
# Env: SOLANA_DEPLOY_KEYPAIR (optional), same as scripts/deploy-devnet.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Running standard devnet deploy pipeline"
"$ROOT/scripts/deploy-devnet.sh"

echo ""
echo "==> Post-deploy verification"
"$ROOT/scripts/verify-devnet-programs.sh"

echo ""
echo "Upgrade complete and verified."
