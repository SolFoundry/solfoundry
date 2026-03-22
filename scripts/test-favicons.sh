#!/usr/bin/env bash
# test-favicons.sh — Validates all required favicon assets are present and correct
# Run: ./scripts/test-favicons.sh  (from repo root)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../frontend/public"
PASS=0
FAIL=0

assert_file() {
  local file="$1" desc="$2"
  if [ -f "$file" ] && [ -s "$file" ]; then
    echo "  ✅ PASS: $desc"
    ((PASS++))
  else
    echo "  ❌ FAIL: $desc — file missing or empty: $file"
    ((FAIL++))
  fi
}

assert_png_size() {
  local file="$1" expected_w="$2" expected_h="$3"
  if ! command -v identify &>/dev/null; then
    echo "  ⚠️  SKIP: ImageMagick 'identify' not available for size check: $file"
    return
  fi
  local dims
  dims=$(identify -format "%wx%h" "$file" 2>/dev/null | head -1)
  local expected="${expected_w}x${expected_h}"
  if [ "$dims" = "$expected" ]; then
    echo "  ✅ PASS: $file dimensions are ${dims}"
    ((PASS++))
  else
    echo "  ❌ FAIL: $file expected ${expected}, got ${dims}"
    ((FAIL++))
  fi
}

assert_html_tag() {
  local file="$1" pattern="$2" desc="$3"
  if grep -q "$pattern" "$file" 2>/dev/null; then
    echo "  ✅ PASS: $desc"
    ((PASS++))
  else
    echo "  ❌ FAIL: $desc — pattern not found in $file: $pattern"
    ((FAIL++))
  fi
}

echo "=== Favicon Asset Tests ==="
echo ""
echo "--- Required PNG files ---"
assert_file "$PUBLIC_DIR/favicon-16x16.png" "favicon-16x16.png exists"
assert_file "$PUBLIC_DIR/favicon-32x32.png" "favicon-32x32.png exists"
assert_file "$PUBLIC_DIR/apple-touch-icon.png" "apple-touch-icon.png (180x180) exists"
assert_file "$PUBLIC_DIR/favicon-192x192.png" "favicon-192x192.png exists"
assert_file "$PUBLIC_DIR/favicon-512x512.png" "favicon-512x512.png exists"

echo ""
echo "--- Required ICO file ---"
assert_file "$PUBLIC_DIR/favicon.ico" "favicon.ico exists"

echo ""
echo "--- Required SVG file ---"
assert_file "$PUBLIC_DIR/favicon.svg" "favicon.svg exists"

echo ""
echo "--- PNG dimensions (requires ImageMagick) ---"
assert_png_size "$PUBLIC_DIR/favicon-16x16.png" 16 16
assert_png_size "$PUBLIC_DIR/favicon-32x32.png" 32 32
assert_png_size "$PUBLIC_DIR/apple-touch-icon.png" 180 180
assert_png_size "$PUBLIC_DIR/favicon-192x192.png" 192 192
assert_png_size "$PUBLIC_DIR/favicon-512x512.png" 512 512

echo ""
echo "--- HTML head link tags ---"
HTML="$SCRIPT_DIR/../frontend/index.html"
assert_html_tag "$HTML" 'sizes="16x16"' "HTML: 16x16 PNG link tag present"
assert_html_tag "$HTML" 'sizes="32x32"' "HTML: 32x32 PNG link tag present"
assert_html_tag "$HTML" 'sizes="180x180"' "HTML: apple-touch-icon link tag present"
assert_html_tag "$HTML" 'sizes="192x192"' "HTML: 192x192 PNG link tag present"
assert_html_tag "$HTML" 'sizes="512x512"' "HTML: 512x512 PNG link tag present"
assert_html_tag "$HTML" 'favicon.ico' "HTML: ICO link tag present"
assert_html_tag "$HTML" 'site.webmanifest' "HTML: webmanifest link tag present"

echo ""
echo "--- site.webmanifest ---"
MANIFEST="$PUBLIC_DIR/site.webmanifest"
assert_file "$MANIFEST" "site.webmanifest exists"
assert_html_tag "$MANIFEST" '"192x192"' "manifest: 192x192 icon entry"
assert_html_tag "$MANIFEST" '"512x512"' "manifest: 512x512 icon entry"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
