#!/usr/bin/env bash
# SolFoundry Post Bounty — invoked by .github/actions/post-bounty/action.yml
# Reads bounty-issue details from SOLFOUNDRY_* env vars, POSTs them to the
# SolFoundry API, and optionally adds a "synced" label back to the issue.
set -euo pipefail

# ---- resolve script dir (works both standalone and via composite action) ---
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$DIR/post-bounty.py"
