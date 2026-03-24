#!/usr/bin/env bash
# Verify every program ID under [programs.devnet] in contracts/Anchor.toml is deployed on-chain.
# Usage: from repo root: ./scripts/verify-devnet-programs.sh
# Env: SOLANA_CLUSTER_URL (default https://api.devnet.solana.com)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL="${SOLANA_CLUSTER_URL:-https://api.devnet.solana.com}"

if ! command -v solana &>/dev/null; then
  echo "error: solana CLI not found" >&2
  exit 1
fi
if ! command -v python3 &>/dev/null; then
  echo "error: python3 not found" >&2
  exit 1
fi

cd "$ROOT/contracts"

mapfile -t IDS < <(python3 -c "
import tomllib
with open('Anchor.toml', 'rb') as f:
    c = tomllib.load(f)
dev = c.get('programs', {}).get('devnet', {})
if not dev:
    raise SystemExit('no [programs.devnet] entries in Anchor.toml')
for v in dev.values():
    print(v)
")

for id in "${IDS[@]}"; do
  echo "==> solana program show $id"
  solana program show "$id" --url "$URL"
done

echo "All devnet program IDs resolve on-chain."
