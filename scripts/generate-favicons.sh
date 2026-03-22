#!/usr/bin/env bash
# Generate favicons from logo-icon.svg in all required sizes and formats.
# Dependencies: rsvg-convert (librsvg), ImageMagick (convert)
#
# Usage:
#   ./scripts/generate-favicons.sh
#
# Output directory: assets/favicons/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC_SVG="$ROOT_DIR/assets/logo-icon.svg"
OUT_DIR="$ROOT_DIR/assets/favicons"

if [ ! -f "$SRC_SVG" ]; then
  echo "Error: $SRC_SVG not found" >&2
  exit 1
fi

command -v rsvg-convert >/dev/null 2>&1 || {
  echo "Error: rsvg-convert not found. Install librsvg:" >&2
  echo "  macOS: brew install librsvg" >&2
  echo "  Ubuntu/Debian: apt install librsvg2-bin" >&2
  exit 1
}

command -v convert >/dev/null 2>&1 || {
  echo "Error: ImageMagick convert not found. Install ImageMagick:" >&2
  echo "  macOS: brew install imagemagick" >&2
  echo "  Ubuntu/Debian: apt install imagemagick" >&2
  exit 1
}

mkdir -p "$OUT_DIR"

echo "Generating PNGs from $SRC_SVG..."

for size in 16 32 180 192 512; do
  rsvg-convert -w "$size" -h "$size" "$SRC_SVG" > "$OUT_DIR/favicon-${size}x${size}.png"
  echo "  ✓ favicon-${size}x${size}.png"
done

echo "Generating favicon.ico (16x16 + 32x32)..."
convert "$OUT_DIR/favicon-16x16.png" "$OUT_DIR/favicon-32x32.png" "$OUT_DIR/favicon.ico"
echo "  ✓ favicon.ico"

echo ""
echo "Done. Favicons written to $OUT_DIR/"
echo "Files:"
ls -lh "$OUT_DIR/"
