#!/usr/bin/env bash
# Roll back on-chain programs by rebuilding and deploying from a known-good git ref.
# Usage: ./scripts/anchor-program-rollback.sh v1.2.3
# Requires a clean working tree or stash; checks out REF in a detached state, deploys, returns to previous HEAD.

set -euo pipefail

REF="${1:-}"
if [[ -z "$REF" ]]; then
  echo "usage: $0 <git-ref>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree not clean — stash or commit before rollback" >&2
  exit 1
fi

PREV="$(git rev-parse HEAD)"
cleanup() {
  git checkout "$PREV" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Checkout $REF"
if [[ "$REF" == v*.* ]] || git ls-remote --tags origin "$REF" | grep -q .; then
  git fetch origin "refs/tags/${REF}:refs/tags/${REF}" 2>/dev/null || git fetch origin "$REF"
else
  git fetch origin "$REF"
fi
git checkout "$REF"

echo "==> Deploy from $REF"
"$ROOT/scripts/deploy-devnet.sh"

echo "==> Verify"
"$ROOT/scripts/verify-devnet-programs.sh"

trap - EXIT
git checkout "$PREV"
echo "Rollback deploy complete; repository back at $PREV"
