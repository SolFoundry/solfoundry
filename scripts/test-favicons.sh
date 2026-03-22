#!/usr/bin/env bash
# test-favicons.sh — Verify favicon assets are present and correctly referenced
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FAVICONS="$REPO_ROOT/assets/favicons"
INDEX="$REPO_ROOT/index.html"
MANIFEST="$FAVICONS/site.webmanifest"
GENERATE="$REPO_ROOT/scripts/generate-favicons.sh"

PASS=0
FAIL=0

assert_file() {
  if [[ -f "$1" ]]; then
    echo "  ✔ $2"
    ((PASS++)) || true
  else
    echo "  ✗ $2 — MISSING: $1"
    ((FAIL++)) || true
  fi
}

assert_contains() {
  if grep -q "$2" "$1" 2>/dev/null; then
    echo "  ✔ $3"
    ((PASS++)) || true
  else
    echo "  ✗ $3 — not found in $1"
    ((FAIL++)) || true
  fi
}

assert_min_size() {
  local size
  size=$(wc -c < "$1" 2>/dev/null || echo 0)
  if [[ "$size" -ge "$2" ]]; then
    echo "  ✔ $3 (${size} bytes)"
    ((PASS++)) || true
  else
    echo "  ✗ $3 — too small (${size} bytes, expected ≥$2)"
    ((FAIL++)) || true
  fi
}

echo "=== Favicon Asset Tests ==="
echo ""
echo "── Files present ──────────────────────────────────"
assert_file "$FAVICONS/favicon.ico"            "favicon.ico exists"
assert_file "$FAVICONS/apple-touch-icon.png"   "apple-touch-icon.png exists (180x180)"
assert_file "$FAVICONS/favicon-192x192.png"    "favicon-192x192.png exists"
assert_file "$FAVICONS/favicon-512x512.png"    "favicon-512x512.png exists"
assert_file "$FAVICONS/site.webmanifest"       "site.webmanifest exists"

echo ""
echo "── File sizes (non-empty) ──────────────────────────"
[[ -f "$FAVICONS/favicon.ico" ]]          && assert_min_size "$FAVICONS/favicon.ico"           1024 "favicon.ico is non-trivial (≥1KB)"
[[ -f "$FAVICONS/apple-touch-icon.png" ]] && assert_min_size "$FAVICONS/apple-touch-icon.png"  5000 "apple-touch-icon.png is non-trivial (≥5KB)"
[[ -f "$FAVICONS/favicon-192x192.png" ]]  && assert_min_size "$FAVICONS/favicon-192x192.png"   5000 "favicon-192x192.png is non-trivial (≥5KB)"
[[ -f "$FAVICONS/favicon-512x512.png" ]]  && assert_min_size "$FAVICONS/favicon-512x512.png"  20000 "favicon-512x512.png is non-trivial (≥20KB)"

echo ""
echo "── Binary file count (must be ≤5) ─────────────────"
BINARY_COUNT=$(find "$FAVICONS" -maxdepth 1 \( -name '*.png' -o -name '*.ico' \) | wc -l | tr -d ' ')
if [[ "$BINARY_COUNT" -le 5 ]]; then
  echo "  ✔ Binary count = $BINARY_COUNT (≤5)"
  ((PASS++)) || true
else
  echo "  ✗ Binary count = $BINARY_COUNT — exceeds limit of 5!"
  ((FAIL++)) || true
fi

echo ""
echo "── index.html references ──────────────────────────"
assert_contains "$INDEX" 'favicon.ico'                     "index.html: favicon.ico link"
assert_contains "$INDEX" 'apple-touch-icon'                "index.html: apple-touch-icon link"
assert_contains "$INDEX" 'favicon-192x192'                 "index.html: favicon-192x192 link"
assert_contains "$INDEX" 'favicon-512x512'                 "index.html: favicon-512x512 link"
assert_contains "$INDEX" 'site.webmanifest'                "index.html: manifest link"
assert_contains "$INDEX" 'theme-color'                     "index.html: theme-color meta"

echo ""
echo "── site.webmanifest content ────────────────────────"
assert_contains "$MANIFEST" '"name"'                       "manifest: name field"
assert_contains "$MANIFEST" '"icons"'                      "manifest: icons array"
assert_contains "$MANIFEST" '"purpose"'                    "manifest: icon purpose field"
assert_contains "$MANIFEST" '"192x192"'                    "manifest: 192x192 icon entry"
assert_contains "$MANIFEST" '"512x512"'                    "manifest: 512x512 icon entry"
assert_contains "$MANIFEST" '"maskable"'                   "manifest: maskable purpose present"

echo ""
echo "── generate-favicons.sh ────────────────────────────"
assert_file "$GENERATE" "generate-favicons.sh exists"
assert_contains "$GENERATE" 'rsvg-convert'                 "script: uses rsvg-convert"
assert_contains "$GENERATE" 'IMAGEMAGICK_CMD'              "script: ImageMagick 6/7 compat var"
assert_contains "$GENERATE" 'magick'                       "script: detects magick (IM7)"
assert_contains "$GENERATE" 'convert'                      "script: fallback to convert (IM6)"
assert_contains "$GENERATE" 'logo-icon.svg'                "script: uses logo-icon.svg as source"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
