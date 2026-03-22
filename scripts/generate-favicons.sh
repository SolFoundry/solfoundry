#!/usr/bin/env bash
#
# generate-favicons.sh — Convert assets/logo-icon.svg into browser-ready
# favicon assets: PNGs at 16×16, 32×32, 180×180 (apple-touch), 192×192 and
# 512×512, plus a multi-size favicon.ico (16×16 + 32×32).
#
# Dependencies:
#   rsvg-convert  (librsvg2-bin on Debian, librsvg on Homebrew)
#   convert       (imagemagick — for ICO generation)
#
# Usage:
#   ./scripts/generate-favicons.sh
#
# Output:
#   assets/favicons/favicon-{16x16,32x32,180x180,192x192,512x512}.png
#   assets/favicons/favicon.ico

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SOURCE_SVG="$ROOT_DIR/assets/logo-icon.svg"
OUT_DIR="$ROOT_DIR/assets/favicons"

if [[ ! -f "$SOURCE_SVG" ]]; then
  printf 'Error: source SVG not found at %s\n' "$SOURCE_SVG" >&2
  exit 1
fi

if ! command -v rsvg-convert >/dev/null 2>&1; then
  printf 'Error: rsvg-convert is required.\n' >&2
  printf '  macOS:  brew install librsvg\n' >&2
  printf '  Debian: apt install librsvg2-bin\n' >&2
  exit 1
fi

if ! command -v convert >/dev/null 2>&1; then
  printf 'Error: ImageMagick convert is required for ICO generation.\n' >&2
  printf '  macOS:  brew install imagemagick\n' >&2
  printf '  Debian: apt install imagemagick\n' >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

SIZES=(16 32 180 192 512)

for size in "${SIZES[@]}"; do
  rsvg-convert -w "$size" -h "$size" "$SOURCE_SVG" \
    -o "$OUT_DIR/favicon-${size}x${size}.png"
  printf '  ✓ favicon-%sx%s.png\n' "$size" "$size"
done

# Generate multi-size ICO (16x16 + 32x32) for legacy browser support
convert \
  "$OUT_DIR/favicon-16x16.png" \
  "$OUT_DIR/favicon-32x32.png" \
  -colors 256 \
  "$OUT_DIR/favicon.ico"
printf '  ✓ favicon.ico (16x16 + 32x32)\n'

printf '\nDone — %d PNGs + 1 ICO written to %s/\n' "${#SIZES[@]}" "$OUT_DIR"
