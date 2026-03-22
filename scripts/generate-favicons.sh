#!/usr/bin/env bash
# Generate favicon PNGs and ICO from logo-icon.svg
# Requires: librsvg2-bin (rsvg-convert) or inkscape, and imagemagick (convert)
#
# Usage: ./scripts/generate-favicons.sh
#
# Output goes to frontend/public/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$ROOT_DIR/assets/logo-icon.svg"
OUT="$ROOT_DIR/frontend/public"

mkdir -p "$OUT"

# Check for rsvg-convert or inkscape
if command -v rsvg-convert &>/dev/null; then
  SVG_CMD="rsvg"
elif command -v inkscape &>/dev/null; then
  SVG_CMD="inkscape"
else
  echo "Error: Install librsvg2-bin (rsvg-convert) or inkscape to generate PNGs."
  echo "  Ubuntu/Debian: sudo apt install librsvg2-bin"
  echo "  macOS: brew install librsvg"
  exit 1
fi

svg_to_png() {
  local size=$1
  local output=$2
  if [ "$SVG_CMD" = "rsvg" ]; then
    rsvg-convert -w "$size" -h "$size" "$SRC" -o "$output"
  else
    inkscape -w "$size" -h "$size" "$SRC" -o "$output"
  fi
}

echo "Generating favicons from $SRC..."

# Generate PNGs
for pair in "16:favicon-16x16.png" "32:favicon-32x32.png" "180:apple-touch-icon.png" "192:android-chrome-192x192.png" "512:android-chrome-512x512.png"; do
  size="${pair%%:*}"
  name="${pair#*:}"
  svg_to_png "$size" "$OUT/$name"
  echo "  ✓ $name (${size}x${size})"
done

# Generate ICO (multi-size)
if command -v convert &>/dev/null; then
  convert "$OUT/favicon-16x16.png" "$OUT/favicon-32x32.png" \
    \( "$SRC" -resize 48x48 \) \
    "$OUT/favicon.ico"
  echo "  ✓ favicon.ico (16, 32, 48)"
else
  echo "  ⚠ Skipping favicon.ico (install imagemagick for ICO generation)"
fi

# Update webmanifest with PNG icons
cat > "$OUT/site.webmanifest" << 'EOF'
{
  "name": "SolFoundry",
  "short_name": "SolFoundry",
  "description": "Autonomous AI Software Factory on Solana",
  "icons": [
    {
      "src": "/android-chrome-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/android-chrome-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    },
    {
      "src": "/favicon.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    }
  ],
  "theme_color": "#0a0a0a",
  "background_color": "#0a0a0a",
  "display": "standalone",
  "start_url": "/"
}
EOF

echo "Done! Favicons generated in $OUT"
