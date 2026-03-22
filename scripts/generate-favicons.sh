#!/usr/bin/env bash
#
# generate-favicons.sh — Convert assets/logo-icon.svg into browser-ready
# favicon PNGs at 16×16, 32×32, 180×180 (apple-touch), 192×192 and 512×512.
#
# Dependencies:
#   rsvg-convert  (librsvg2-bin on Debian, librsvg on Homebrew)
#
# Usage:
#   ./scripts/generate-favicons.sh
#
# Output:  assets/favicons/favicon-{16x16,32x32,180x180,192x192,512x512}.png

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

mkdir -p "$OUT_DIR"

SIZES=(16 32 180 192 512)

for size in "${SIZES[@]}"; do
  rsvg-convert -w "$size" -h "$size" "$SOURCE_SVG" \
    -o "$OUT_DIR/favicon-${size}x${size}.png"
  printf '  ✓ favicon-%sx%s.png\n' "$size" "$size"
done

printf '\nDone — %d PNGs written to %s/\n' "${#SIZES[@]}" "$OUT_DIR"
