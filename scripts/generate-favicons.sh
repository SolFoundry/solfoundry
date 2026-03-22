#!/usr/bin/env bash
# generate-favicons.sh — Regenerates favicon assets from frontend/public/favicon.svg
# Run: ./scripts/generate-favicons.sh
# Requires: Inkscape (or rsvg-convert) and ImageMagick
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../frontend/public"
SVG_SRC="$PUBLIC_DIR/favicon.svg"

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

# PNG sizes
rasterize 180 "$PUBLIC_DIR/apple-touch-icon.png"
rasterize 192 "$PUBLIC_DIR/favicon-192x192.png"
rasterize 512 "$PUBLIC_DIR/favicon-512x512.png"

# Multi-size ICO (16x16 + 32x32 embedded)
TMP16=$(mktemp /tmp/favicon-16-XXXXXX.png)
TMP32=$(mktemp /tmp/favicon-32-XXXXXX.png)
rasterize 16 "$TMP16"
rasterize 32 "$TMP32"
convert "$TMP16" "$TMP32" "$PUBLIC_DIR/favicon.ico"
rm -f "$TMP16" "$TMP32"

echo "Done. Generated files:"
ls -lh "$PUBLIC_DIR"/apple-touch-icon.png "$PUBLIC_DIR"/favicon-192x192.png \
        "$PUBLIC_DIR"/favicon-512x512.png "$PUBLIC_DIR"/favicon.ico
