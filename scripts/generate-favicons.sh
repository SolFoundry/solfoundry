#!/usr/bin/env bash
# generate-favicons.sh — Regenerate favicon assets from assets/logo-icon.svg
# Usage: ./scripts/generate-favicons.sh
# Requires: rsvg-convert (librsvg) and ImageMagick 6 (convert) or 7 (magick)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_SVG="$REPO_ROOT/assets/logo-icon.svg"
OUT_DIR="$REPO_ROOT/assets/favicons"

# ── Dependency checks ────────────────────────────────────────────────────────

if ! command -v rsvg-convert &>/dev/null; then
  echo "ERROR: rsvg-convert not found. Install with: apt install librsvg2-bin  /  brew install librsvg" >&2
  exit 1
fi

if command -v magick &>/dev/null; then
  IMAGEMAGICK_CMD="magick"
elif command -v convert &>/dev/null; then
  IMAGEMAGICK_CMD="convert"
else
  echo "ERROR: ImageMagick not found (need 'magick' or 'convert'). Install with: apt install imagemagick  /  brew install imagemagick" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_SVG" ]]; then
  echo "ERROR: Source SVG not found: $SOURCE_SVG" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "Generating favicons from $SOURCE_SVG using $IMAGEMAGICK_CMD …"

# ── PNG sizes ────────────────────────────────────────────────────────────────

rsvg-convert -w 16  -h 16  "$SOURCE_SVG" -o /tmp/_favicon-16.png
rsvg-convert -w 32  -h 32  "$SOURCE_SVG" -o /tmp/_favicon-32.png
rsvg-convert -w 180 -h 180 "$SOURCE_SVG" -o "$OUT_DIR/apple-touch-icon.png"
rsvg-convert -w 192 -h 192 "$SOURCE_SVG" -o "$OUT_DIR/favicon-192x192.png"
rsvg-convert -w 512 -h 512 "$SOURCE_SVG" -o "$OUT_DIR/favicon-512x512.png"

echo "  ✔ apple-touch-icon.png (180x180)"
echo "  ✔ favicon-192x192.png (192x192)"
echo "  ✔ favicon-512x512.png (512x512)"

# ── Multi-size ICO (embeds 16x16 + 32x32) ────────────────────────────────────

"$IMAGEMAGICK_CMD" /tmp/_favicon-16.png /tmp/_favicon-32.png "$OUT_DIR/favicon.ico"
rm -f /tmp/_favicon-16.png /tmp/_favicon-32.png

echo "  ✔ favicon.ico (16x16 + 32x32 embedded)"
echo ""
echo "Done. 4 files in $OUT_DIR"
echo "Binary count: $(find "$OUT_DIR" -maxdepth 1 \( -name '*.png' -o -name '*.ico' \) | wc -l | tr -d ' ')"
