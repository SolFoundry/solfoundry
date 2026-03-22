#!/usr/bin/env bash
# generate-favicons.sh — Generate browser-ready favicons from assets/logo-icon.svg
#
# Produces all required sizes from the canonical SVG source:
#   - favicon-16x16.png    (browser tab, standard)
#   - favicon-32x32.png    (browser tab, HiDPI)
#   - apple-touch-icon.png (iOS Safari, 180×180)
#   - favicon-192x192.png  (Android home screen / PWA)
#   - favicon-512x512.png  (PWA splash screen)
#   - favicon.ico          (legacy fallback, embeds 16×16 + 32×32)
#   - site.webmanifest     (PWA manifest with icon references)
#
# Usage:
#   bash scripts/generate-favicons.sh [--out DIR]
#
# Requirements (any one of):
#   - rsvg-convert (librsvg) — fastest, best quality
#   - magick / convert (ImageMagick 7/6) with rsvg/cairo delegate
#   - inkscape
#   - node + sharp (npm)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SVG_SOURCE="$REPO_ROOT/assets/logo-icon.svg"
OUT_DIR="$REPO_ROOT/assets/favicons"

# Allow --out override
while [[ $# -gt 0 ]]; do
    case "$1" in
        --out) OUT_DIR="$2"; shift 2;;
        *) echo "Unknown arg: $1"; exit 1;;
    esac
done

mkdir -p "$OUT_DIR"

if [[ ! -f "$SVG_SOURCE" ]]; then
    echo "ERROR: SVG source not found: $SVG_SOURCE" >&2
    exit 1
fi

echo "Generating favicons from: $SVG_SOURCE"
echo "Output directory:         $OUT_DIR"

# ── Detect SVG renderer ─────────────────────────────────────────────────────
render_svg() {
    local size="$1" outfile="$2"
    if command -v rsvg-convert &>/dev/null; then
        rsvg-convert -w "$size" -h "$size" -o "$outfile" "$SVG_SOURCE"
    elif command -v magick &>/dev/null; then
        magick -background none -density 300 "$SVG_SOURCE" -resize "${size}x${size}" "$outfile"
    elif command -v convert &>/dev/null; then
        convert -background none -density 300 "$SVG_SOURCE" -resize "${size}x${size}" "$outfile"
    elif command -v inkscape &>/dev/null; then
        inkscape --export-type=png --export-width="$size" --export-height="$size" \
                 --export-filename="$outfile" "$SVG_SOURCE" 2>/dev/null
    elif command -v node &>/dev/null; then
        node -e "
const sharp = require('sharp');
sharp(require('fs').readFileSync('$SVG_SOURCE'))
  .resize($size, $size).png().toFile('$outfile')
  .then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });"
    else
        echo "ERROR: No SVG renderer found. Install rsvg-convert, ImageMagick, Inkscape, or node+sharp." >&2
        exit 1
    fi
}

# ── Generate PNG sizes ───────────────────────────────────────────────────────
render_svg 16  "$OUT_DIR/favicon-16x16.png"
echo "  ✓ favicon-16x16.png"

render_svg 32  "$OUT_DIR/favicon-32x32.png"
echo "  ✓ favicon-32x32.png"

render_svg 180 "$OUT_DIR/apple-touch-icon.png"
echo "  ✓ apple-touch-icon.png (180×180)"

render_svg 192 "$OUT_DIR/favicon-192x192.png"
echo "  ✓ favicon-192x192.png"

render_svg 512 "$OUT_DIR/favicon-512x512.png"
echo "  ✓ favicon-512x512.png"

# ── Generate favicon.ico (16×16 + 32×32 embedded) ───────────────────────────
# Uses Python struct for portable ICO creation without extra dependencies.
python3 - "$OUT_DIR/favicon-16x16.png" "$OUT_DIR/favicon-32x32.png" "$OUT_DIR/favicon.ico" << 'PYEOF'
"""Build a multi-size ICO file from pre-generated PNG inputs.

ICO file layout:
  6-byte ICONDIR header
  N × 16-byte ICONDIRENTRY records
  N × raw PNG/BMP image data blobs
"""
import struct
import sys

def build_ico(png_paths, out_path):
    images = [open(p, 'rb').read() for p in png_paths]
    num = len(images)
    header_size = 6 + num * 16
    offsets = []
    off = header_size
    for img in images:
        offsets.append(off)
        off += len(img)

    parts = [struct.pack('<HHH', 0, 1, num)]  # ICONDIR
    for img, offset in zip(images, offsets):
        # Detect dimensions from PNG IHDR (bytes 16-24)
        w = struct.unpack('>I', img[16:20])[0]
        h = struct.unpack('>I', img[20:24])[0]
        # Clamp to ICO byte field (0 means 256)
        w_byte = w if w < 256 else 0
        h_byte = h if h < 256 else 0
        parts.append(struct.pack('<BBBBHHII',
            w_byte, h_byte, 0, 0, 1, 32,
            len(img), offset))
    for img in images:
        parts.append(img)
    with open(out_path, 'wb') as f:
        f.write(b''.join(parts))
    print(f'  ✓ favicon.ico ({len(images)} sizes embedded)')

build_ico(sys.argv[1:-1], sys.argv[-1])
PYEOF

# ── Write site.webmanifest ───────────────────────────────────────────────────
cat > "$OUT_DIR/site.webmanifest" << 'JSON'
{
  "name": "SolFoundry",
  "short_name": "SolFoundry",
  "description": "Autonomous AI Software Factory on Solana",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#9945FF",
  "icons": [
    {
      "src": "/assets/favicons/favicon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/assets/favicons/favicon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
JSON
echo "  ✓ site.webmanifest"

echo ""
echo "All favicon assets generated successfully in: $OUT_DIR"
echo ""
ls -lh "$OUT_DIR"
