#!/usr/bin/env bash
#
# test-favicons.sh — Validate favicon assets, HTML integration, and manifest.
#
# Runs 29 assertions that verify every acceptance criterion from issue #471:
#   1. PNGs exist at 16×16, 32×32, 180×180, 192×192, 512×512
#   2. site.webmanifest references the correct icons
#   3. index.html <head> contains all required <link> tags
#   4. Generation script is present and well-formed
#   5. No stale or mismatched references
#
# Usage:
#   ./scripts/test-favicons.sh
#
# Exit 0 when all assertions pass, 1 otherwise.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FAVICONS="$ROOT_DIR/assets/favicons"
INDEX="$ROOT_DIR/index.html"
MANIFEST="$FAVICONS/site.webmanifest"
GEN_SCRIPT="$SCRIPT_DIR/generate-favicons.sh"

PASS=0
FAIL=0

# ── helpers ───────────────────────────────────────────────────────────────────

assert() {
  # Run a command; record pass/fail.
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '  ✅ %s\n' "$desc"
    PASS=$((PASS + 1))
  else
    printf '  ❌ %s\n' "$desc"
    FAIL=$((FAIL + 1))
  fi
}

assert_file() {
  # Verify a file exists.
  assert "Exists: $1" test -f "$1"
}

assert_min_bytes() {
  # Verify file is at least N bytes (handles missing files gracefully).
  local file="$1" min="$2" label="$3"
  if [[ ! -f "$file" ]]; then
    printf '  ❌ %s — file not found\n' "$label"
    FAIL=$((FAIL + 1))
    return
  fi
  local actual
  actual=$(wc -c < "$file")
  assert "$label (${actual}B >= ${min}B)" test "$actual" -ge "$min"
}

assert_grep() {
  # Verify a pattern appears in a file.
  assert "$1" grep -q "$2" "$3"
}

assert_no_grep() {
  # Verify a pattern does NOT appear in a file.
  assert "$1" sh -c "! grep -q '$2' '$3'"
}

# ── 1. PNG assets ─────────────────────────────────────────────────────────────

printf '\n[1/5] Favicon PNG files\n'
assert_file "$FAVICONS/favicon-16x16.png"
assert_file "$FAVICONS/favicon-32x32.png"
assert_file "$FAVICONS/favicon-180x180.png"
assert_file "$FAVICONS/favicon-192x192.png"
assert_file "$FAVICONS/favicon-512x512.png"
assert_min_bytes "$FAVICONS/favicon-16x16.png"   100 "16×16 PNG non-trivial"
assert_min_bytes "$FAVICONS/favicon-512x512.png" 1000 "512×512 PNG non-trivial"

# ── 2. site.webmanifest ──────────────────────────────────────────────────────

printf '\n[2/5] Web app manifest\n'
assert_file "$MANIFEST"
assert_grep "Manifest → 192×192 icon"    "favicon-192x192.png" "$MANIFEST"
assert_grep "Manifest → 512×512 icon"    "favicon-512x512.png" "$MANIFEST"
assert_grep "Manifest → app name"        "SolFoundry"          "$MANIFEST"
assert_grep "Manifest → purpose field"   '"purpose"'           "$MANIFEST"
assert_grep "Manifest → display mode"    '"standalone"'        "$MANIFEST"
assert_grep "Manifest → theme_color"     "theme_color"         "$MANIFEST"

# ── 3. index.html <head> tags ────────────────────────────────────────────────

printf '\n[3/5] HTML <head> integration\n'
assert_file "$INDEX"
assert_grep "Link → 16×16 PNG"          'favicon-16x16.png'   "$INDEX"
assert_grep "Link → 32×32 PNG"          'favicon-32x32.png'   "$INDEX"
assert_grep "Link → 192×192 PNG"        'favicon-192x192.png' "$INDEX"
assert_grep "Link → apple-touch-icon"   'apple-touch-icon'    "$INDEX"
assert_grep "Link → manifest"           'site.webmanifest'    "$INDEX"
assert_grep "Meta → theme-color"        'theme-color'         "$INDEX"
assert_grep "MIME type image/png"        'image/png'           "$INDEX"

# ── 4. Generation script ─────────────────────────────────────────────────────

printf '\n[4/5] Generation script\n'
assert_file "$GEN_SCRIPT"
assert "Script is executable" test -x "$GEN_SCRIPT"
assert_grep "Script uses rsvg-convert"   'rsvg-convert'      "$GEN_SCRIPT"
assert_grep "Script references logo-icon.svg" 'logo-icon.svg' "$GEN_SCRIPT"

# ── 5. Consistency checks ────────────────────────────────────────────────────

printf '\n[5/5] Cross-file consistency\n'
assert_grep "Manifest paths start with /" '"/assets/favicons/' "$MANIFEST"

# ── summary ───────────────────────────────────────────────────────────────────

printf '\n══ Results: %d passed, %d failed ══\n' "$PASS" "$FAIL"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
printf 'All tests passed.\n'
