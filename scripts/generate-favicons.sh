#!/usr/bin/env bash
# generate-favicons.sh — Regenerates favicon assets from assets/logo-icon.svg
# Run: ./scripts/generate-favicons.sh  (from repo root)
# Requires: rsvg-convert (librsvg) or inkscape, and ImageMagick
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/.."
PUBLIC_DIR="$REPO_ROOT/frontend/public"
# Use the canonical source SVG
SVG_SRC="$REPO_ROOT/assets/logo-icon.svg"

if [ ! -f "$SVG_SRC" ]; then
  echo "Error: Source SVG not found at $SVG_SRC" >&2
  exit 1
fi

# Check dependencies
for cmd in convert; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' not found. Install ImageMagick." >&2
    exit 1
  fi
done

if command -v rsvg-convert &>/dev/null; then
  SVG_TOOL="rsvg-convert"
elif command -v inkscape &>/dev/null; then
  SVG_TOOL="inkscape"
else
  echo "Error: 'rsvg-convert' or 'inkscape' required for SVG rasterization." >&2
  exit 1
fi

rasterize() {
  local size="$1" out="$2"
  if [ "$SVG_TOOL" = "rsvg-convert" ]; then
    rsvg-convert -w "$size" -h "$size" -f png -o "$out" "$SVG_SRC"
  else
    inkscape --export-type=png --export-width="$size" --export-height="$size" \
      --export-filename="$out" "$SVG_SRC" 2>/dev/null
  fi
}

echo "Generating favicons from $SVG_SRC ..."

# Small PNG sizes for browser tab (explicit per spec)
rasterize 16 "$PUBLIC_DIR/favicon-16x16.png"
rasterize 32 "$PUBLIC_DIR/favicon-32x32.png"

# Larger PNG sizes
rasterize 180 "$PUBLIC_DIR/apple-touch-icon.png"
rasterize 192 "$PUBLIC_DIR/favicon-192x192.png"
rasterize 512 "$PUBLIC_DIR/favicon-512x512.png"

# Multi-size ICO (16x16 + 32x32 embedded)
convert "$PUBLIC_DIR/favicon-16x16.png" "$PUBLIC_DIR/favicon-32x32.png" "$PUBLIC_DIR/favicon.ico"

echo "Done. Generated files:"
ls -lh "$PUBLIC_DIR"/favicon-16x16.png "$PUBLIC_DIR"/favicon-32x32.png \
        "$PUBLIC_DIR"/apple-touch-icon.png "$PUBLIC_DIR"/favicon-192x192.png \
        "$PUBLIC_DIR"/favicon-512x512.png "$PUBLIC_DIR"/favicon.ico
