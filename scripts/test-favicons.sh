#!/usr/bin/env bash
# Test suite for favicon generation and integration.
# Validates that all required favicon files exist with correct properties,
# index.html references them properly, and site.webmanifest is well-formed.
#
# Usage:
#   ./scripts/test-favicons.sh
#
# Exit 0 on success, 1 on any failure.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FAVICONS_DIR="$ROOT_DIR/assets/favicons"
INDEX_HTML="$ROOT_DIR/index.html"
MANIFEST="$FAVICONS_DIR/site.webmanifest"

PASS=0
FAIL=0

assert() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✅ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $desc"
    FAIL=$((FAIL + 1))
  fi
}

assert_file_exists() {
  assert "File exists: $1" test -f "$1"
}

assert_file_min_size() {
  local file="$1" min_bytes="$2"
  assert "File $file >= ${min_bytes} bytes" test "$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)" -ge "$min_bytes"
}

assert_grep() {
  local desc="$1" pattern="$2" file="$3"
  assert "$desc" grep -q "$pattern" "$file"
}

echo "=== Favicon Test Suite ==="
echo ""

echo "[1/5] Checking PNG files exist in all required sizes..."
assert_file_exists "$FAVICONS_DIR/favicon-16x16.png"
assert_file_exists "$FAVICONS_DIR/favicon-32x32.png"
assert_file_exists "$FAVICONS_DIR/favicon-180x180.png"
assert_file_exists "$FAVICONS_DIR/favicon-192x192.png"
assert_file_exists "$FAVICONS_DIR/favicon-512x512.png"

echo ""
echo "[2/5] Checking ICO file..."
assert_file_exists "$FAVICONS_DIR/favicon.ico"
assert_file_min_size "$FAVICONS_DIR/favicon.ico" 100

echo ""
echo "[3/5] Checking site.webmanifest..."
assert_file_exists "$MANIFEST"
assert_grep "Manifest references 192x192" "192x192" "$MANIFEST"
assert_grep "Manifest references 512x512" "512x512" "$MANIFEST"
assert_grep "Manifest has app name" "SolFoundry" "$MANIFEST"
assert_grep "Manifest has purpose field" "purpose" "$MANIFEST"

echo ""
echo "[4/5] Checking index.html <head> tags..."
assert_file_exists "$INDEX_HTML"
assert_grep "favicon.ico link tag" 'favicon.ico' "$INDEX_HTML"
assert_grep "16x16 PNG link tag" 'favicon-16x16.png' "$INDEX_HTML"
assert_grep "32x32 PNG link tag" 'favicon-32x32.png' "$INDEX_HTML"
assert_grep "192x192 PNG link tag" 'favicon-192x192.png' "$INDEX_HTML"
assert_grep "apple-touch-icon (180x180)" 'apple-touch-icon' "$INDEX_HTML"
assert_grep "manifest link tag" 'site.webmanifest' "$INDEX_HTML"

echo ""
echo "[5/5] Checking generation script..."
assert_file_exists "$SCRIPT_DIR/generate-favicons.sh"
assert "Script is executable" test -x "$SCRIPT_DIR/generate-favicons.sh"
assert_grep "Script supports magick (IM7)" "magick" "$SCRIPT_DIR/generate-favicons.sh"
assert_grep "Script supports convert (IM6 fallback)" "convert" "$SCRIPT_DIR/generate-favicons.sh"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
echo "All tests passed."
