#!/usr/bin/env bash
#
# test-favicons.sh — Validate favicon assets, HTML integration, and manifest.
#
# Runs 30+ assertions that verify every acceptance criterion from issue #471:
#   1. PNGs exist at 16×16, 32×32, 180×180, 192×192, 512×512
#   2. ICO file exists and has valid magic bytes
#   3. site.webmanifest references the correct icons
#   4. index.html <head> contains all required <link> tags (ICO + PNG)
#   5. Generation script is present and well-formed
#   6. No stale or mismatched references
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

assert_ico_magic() {
  # Verify ICO file has valid magic bytes: 00 00 01 00
  local file="$1"
  if [[ ! -f "$file" ]]; then
    printf '  ❌ ICO magic bytes — file not found: %s\n' "$file"
    FAIL=$((FAIL + 1))
    return
  fi
  local magic
  magic=$(dd if="$file" bs=1 count=4 2>/dev/null | od -A n -t x1 | tr -d ' \n')
  if [[ "$magic" == "00000100" ]]; then
    printf '  ✅ ICO has valid magic bytes (00 00 01 00)\n'
    PASS=$((PASS + 1))
  else
    printf '  ❌ ICO magic bytes invalid: %s\n' "$magic"
    FAIL=$((FAIL + 1))
  fi
}

# ── 1. PNG assets ─────────────────────────────────────────────────────────────

printf '\n[1/6] Favicon PNG files\n'
assert_file "$FAVICONS/favicon-16x16.png"
assert_file "$FAVICONS/favicon-32x32.png"
assert_file "$FAVICONS/favicon-180x180.png"
assert_file "$FAVICONS/favicon-192x192.png"
assert_file "$FAVICONS/favicon-512x512.png"
assert_min_bytes "$FAVICONS/favicon-16x16.png"   100 "16×16 PNG non-trivial"
assert_min_bytes "$FAVICONS/favicon-512x512.png" 1000 "512×512 PNG non-trivial"

# ── 2. ICO file ───────────────────────────────────────────────────────────────

printf '\n[2/6] Favicon ICO file\n'
assert_file "$FAVICONS/favicon.ico"
assert_min_bytes "$FAVICONS/favicon.ico" 200 "ICO non-trivial (embeds 16×16 + 32×32)"
assert_ico_magic "$FAVICONS/favicon.ico"

# ── 3. site.webmanifest ──────────────────────────────────────────────────────

printf '\n[3/6] Web app manifest\n'
assert_file "$MANIFEST"
assert_grep "Manifest → 192×192 icon"    "favicon-192x192.png" "$MANIFEST"
assert_grep "Manifest → 512×512 icon"    "favicon-512x512.png" "$MANIFEST"
assert_grep "Manifest → app name"        "SolFoundry"          "$MANIFEST"
assert_grep "Manifest → purpose field"   '"purpose"'           "$MANIFEST"
assert_grep "Manifest → display mode"    '"standalone"'        "$MANIFEST"
assert_grep "Manifest → theme_color"     "theme_color"         "$MANIFEST"

# ── 4. index.html <head> tags ────────────────────────────────────────────────

printf '\n[4/6] HTML <head> integration\n'
assert_file "$INDEX"
assert_grep "Link → ICO fallback"        'favicon\.ico'        "$INDEX"
assert_grep "Link → 16×16 PNG"          'favicon-16x16.png'   "$INDEX"
assert_grep "Link → 32×32 PNG"          'favicon-32x32.png'   "$INDEX"
assert_grep "Link → 192×192 PNG"        'favicon-192x192.png' "$INDEX"
assert_grep "Link → apple-touch-icon"   'apple-touch-icon'    "$INDEX"
assert_grep "Link → manifest"           'site.webmanifest'    "$INDEX"
assert_grep "Meta → theme-color"        'theme-color'         "$INDEX"
assert_grep "MIME type image/png on PNG link tags" 'image/png' "$INDEX"
assert_no_grep "No MIME mismatch (image/png on .ico link)" \
  'type="image/png"[^>]*favicon\.ico' "$INDEX"

# ── 5. Generation script ─────────────────────────────────────────────────────

printf '\n[5/6] Generation script\n'
assert_file "$GEN_SCRIPT"
assert "Script is executable" test -x "$GEN_SCRIPT"
assert_grep "Script uses rsvg-convert"       'rsvg-convert'      "$GEN_SCRIPT"
assert_grep "Script references logo-icon.svg" 'logo-icon.svg'    "$GEN_SCRIPT"
assert_grep "Script generates ICO"            'favicon\.ico'      "$GEN_SCRIPT"
assert_grep "Script uses ImageMagick convert" '\bconvert\b'       "$GEN_SCRIPT"

# ── 6. Consistency checks ────────────────────────────────────────────────────

printf '\n[6/6] Cross-file consistency\n'
assert_no_grep "No type mismatch (image/png on .ico <link>)" \
  'type="image/png".*favicon\.ico' "$INDEX"
assert_grep "Manifest paths start with /" '"/assets/favicons/' "$MANIFEST"

# ── summary ───────────────────────────────────────────────────────────────────

printf '\n══ Results: %d passed, %d failed ══\n' "$PASS" "$FAIL"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
printf 'All tests passed.\n'
