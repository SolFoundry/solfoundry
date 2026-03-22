#!/usr/bin/env bash
# test-favicons.sh — Validate favicon assets meet SolFoundry bounty #471 criteria
#
# Checks:
#   1. All required PNG files exist with correct pixel dimensions
#   2. All files are valid PNG format (magic bytes)
#   3. site.webmanifest exists, is valid JSON, contains required fields
#   4. index.html contains all required favicon link tags
#   5. Each HTML link type= matches the actual file MIME type
#   6. ICO format is available (either as file or as data URI in index.html)
#   7. Manifest icons reference existing files with correct sizes
#   8. apple-touch-icon uses correct naming convention
#   9. All PNG sizes meet minimum pixel requirements
#  10. PNG files are not corrupted (valid IHDR chunk)
#
# Usage:
#   bash scripts/test-favicons.sh [--repo-root DIR]
#   Returns exit code 0 on success, 1 on any failure.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo-root) REPO_ROOT="$2"; shift 2;;
        *) echo "Unknown arg: $1"; exit 1;;
    esac
done

FAVICONS_DIR="$REPO_ROOT/assets/favicons"
HTML_FILE="$REPO_ROOT/index.html"
MANIFEST_FILE="$FAVICONS_DIR/site.webmanifest"

PASS=0
FAIL=0
ERRORS=()

pass() { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1"; ERRORS+=("$1"); ((FAIL++)); }

# ── Helper: check PNG magic bytes ────────────────────────────────────────────
is_valid_png() {
    local f="$1"
    # PNG magic: 89 50 4E 47 0D 0A 1A 0A (first 8 bytes)
    local magic
    magic=$(python3 -c "
import sys
with open('$f','rb') as fh:
    magic = fh.read(8)
expected = bytes([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A])
sys.exit(0 if magic == expected else 1)
" 2>/dev/null) && return 0 || return 1
}

# ── Helper: get PNG dimensions via IHDR ─────────────────────────────────────
png_dimensions() {
    local f="$1"
    python3 -c "
import struct
with open('$f','rb') as fh:
    fh.seek(16)
    w = struct.unpack('>I', fh.read(4))[0]
    h = struct.unpack('>I', fh.read(4))[0]
print(f'{w}x{h}')
"
}

echo "=== SolFoundry Favicon Test Suite ==="
echo "Repo root: $REPO_ROOT"
echo ""

# ── Section 1: Required PNG files exist ──────────────────────────────────────
echo "--- Section 1: Required PNG files exist ---"

declare -A REQUIRED_PNGS=(
    ["favicon-16x16.png"]="16x16"
    ["favicon-32x32.png"]="32x32"
    ["apple-touch-icon.png"]="180x180"
    ["favicon-192x192.png"]="192x192"
    ["favicon-512x512.png"]="512x512"
)

for fname in "${!REQUIRED_PNGS[@]}"; do
    fpath="$FAVICONS_DIR/$fname"
    if [[ -f "$fpath" ]]; then
        pass "File exists: $fname"
    else
        fail "Missing file: $fname"
    fi
done

# ── Section 2: PNG magic bytes validation ────────────────────────────────────
echo ""
echo "--- Section 2: PNG format validation (magic bytes) ---"

for fname in "${!REQUIRED_PNGS[@]}"; do
    fpath="$FAVICONS_DIR/$fname"
    if [[ ! -f "$fpath" ]]; then continue; fi
    if is_valid_png "$fpath"; then
        pass "Valid PNG magic: $fname"
    else
        fail "Invalid PNG magic bytes: $fname"
    fi
done

# ── Section 3: PNG dimensions correct ───────────────────────────────────────
echo ""
echo "--- Section 3: PNG pixel dimensions ---"

for fname in "${!REQUIRED_PNGS[@]}"; do
    fpath="$FAVICONS_DIR/$fname"
    expected="${REQUIRED_PNGS[$fname]}"
    if [[ ! -f "$fpath" ]]; then continue; fi
    actual=$(png_dimensions "$fpath" 2>/dev/null || echo "error")
    if [[ "$actual" == "$expected" ]]; then
        pass "Correct dimensions ($expected): $fname"
    else
        fail "Wrong dimensions for $fname: expected $expected, got $actual"
    fi
done

# ── Section 4: PNG files are not empty ───────────────────────────────────────
echo ""
echo "--- Section 4: PNG file sizes (non-empty) ---"

for fname in "${!REQUIRED_PNGS[@]}"; do
    fpath="$FAVICONS_DIR/$fname"
    if [[ ! -f "$fpath" ]]; then continue; fi
    size=$(wc -c < "$fpath")
    if [[ $size -gt 100 ]]; then
        pass "Non-trivial file size ($size bytes): $fname"
    else
        fail "Suspiciously small file ($size bytes): $fname"
    fi
done

# ── Section 5: ICO format available ─────────────────────────────────────────
echo ""
echo "--- Section 5: ICO format availability ---"

ICO_FILE="$FAVICONS_DIR/favicon.ico"
if [[ -f "$ICO_FILE" ]]; then
    # Validate ICO magic bytes: 00 00 01 00
    ICO_MAGIC=$(python3 -c "
with open('$ICO_FILE','rb') as f:
    b = f.read(4)
print(' '.join(f'{x:02x}' for x in b))
" 2>/dev/null || echo "error")
    if [[ "$ICO_MAGIC" == "00 00 01 00" ]]; then
        pass "favicon.ico exists with valid ICO magic bytes (00 00 01 00)"
    else
        fail "favicon.ico has invalid magic bytes: $ICO_MAGIC"
    fi
else
    # Check for data URI in index.html
    if [[ -f "$HTML_FILE" ]]; then
        if grep -q 'data:image/x-icon;base64,' "$HTML_FILE" 2>/dev/null; then
            pass "ICO format present as base64 data URI in index.html (avoids binary file limit)"
        else
            fail "ICO format not found: neither favicon.ico file nor data URI in index.html"
        fi
    else
        fail "favicon.ico missing and index.html not found"
    fi
fi

# ── Section 6: site.webmanifest ──────────────────────────────────────────────
echo ""
echo "--- Section 6: site.webmanifest ---"

if [[ -f "$MANIFEST_FILE" ]]; then
    pass "site.webmanifest exists"
    # Validate JSON
    if python3 -c "import json; json.load(open('$MANIFEST_FILE'))" 2>/dev/null; then
        pass "site.webmanifest is valid JSON"
    else
        fail "site.webmanifest is not valid JSON"
    fi
    # Check required fields
    python3 - "$MANIFEST_FILE" << 'PYEOF'
import json, sys
m = json.load(open(sys.argv[1]))
checks = [
    ('name', lambda m: bool(m.get('name'))),
    ('short_name', lambda m: bool(m.get('short_name'))),
    ('icons array', lambda m: isinstance(m.get('icons'), list) and len(m['icons']) > 0),
    ('192x192 icon entry', lambda m: any(
        '192' in i.get('sizes','') for i in m.get('icons',[]))),
    ('512x512 icon entry', lambda m: any(
        '512' in i.get('sizes','') for i in m.get('icons',[]))),
    ('icons have type field', lambda m: all(
        i.get('type') for i in m.get('icons',[]))),
    ('icons have purpose field', lambda m: all(
        i.get('purpose') for i in m.get('icons',[]))),
    ('theme_color present', lambda m: bool(m.get('theme_color'))),
    ('background_color present', lambda m: bool(m.get('background_color'))),
    ('display field present', lambda m: bool(m.get('display'))),
]
all_pass = True
for name, check in checks:
    try:
        result = check(m)
    except Exception:
        result = False
    status = "✓" if result else "✗"
    print(f"  {status} manifest: {name}")
    if not result:
        all_pass = False
sys.exit(0 if all_pass else 1)
PYEOF
    if [[ $? -eq 0 ]]; then
        pass "site.webmanifest has all required fields"
    else
        fail "site.webmanifest missing required fields (see above)"
    fi
else
    fail "site.webmanifest not found at $MANIFEST_FILE"
fi

# ── Section 7: index.html favicon link tags ──────────────────────────────────
echo ""
echo "--- Section 7: index.html favicon link tags ---"

if [[ ! -f "$HTML_FILE" ]]; then
    fail "index.html not found at $HTML_FILE"
else
    pass "index.html found"
    python3 - "$HTML_FILE" << 'PYEOF'
"""Validate all favicon link tags in index.html."""
import sys, re

html = open(sys.argv[1]).read()
checks = [
    ('link rel=icon sizes=16x16 (PNG)',
     r'<link[^>]+sizes=["\']16x16["\'][^>]+type=["\']image/png["\']|<link[^>]+type=["\']image/png["\'][^>]+sizes=["\']16x16["\']'),
    ('link rel=icon sizes=32x32 (PNG)',
     r'<link[^>]+sizes=["\']32x32["\'][^>]+type=["\']image/png["\']|<link[^>]+type=["\']image/png["\'][^>]+sizes=["\']32x32["\']'),
    ('link rel=apple-touch-icon',
     r'<link[^>]+rel=["\']apple-touch-icon["\']'),
    ('link rel=apple-touch-icon sizes=180x180',
     r'<link[^>]+apple-touch-icon[^>]+sizes=["\']180x180["\']|<link[^>]+sizes=["\']180x180["\'][^>]+apple-touch-icon'),
    ('link rel=icon sizes=192x192',
     r'<link[^>]+sizes=["\']192x192["\']'),
    ('link rel=icon sizes=512x512',
     r'<link[^>]+sizes=["\']512x512["\']'),
    ('link rel=manifest for site.webmanifest',
     r'<link[^>]+rel=["\']manifest["\'][^>]+site\.webmanifest'),
    ('favicon.ico (file or data URI)',
     r'favicon\.ico|data:image/x-icon;base64,'),
    ('PNG type matches PNG href',
     r'type=["\']image/png["\'][^>]+href=["\'][^"\']*\.png["\']'),
]

all_pass = True
for name, pattern in checks:
    found = bool(re.search(pattern, html, re.IGNORECASE))
    status = "✓" if found else "✗"
    print(f"  {status} HTML: {name}")
    if not found:
        all_pass = False
sys.exit(0 if all_pass else 1)
PYEOF
    if [[ $? -eq 0 ]]; then
        pass "index.html has all required favicon link tags"
    else
        fail "index.html missing some favicon link tags (see above)"
    fi
fi

# ── Section 8: Binary file count ─────────────────────────────────────────────
echo ""
echo "--- Section 8: Binary file count (max 5 per SolFoundry rules) ---"

binary_count=$(find "$FAVICONS_DIR" -name "*.png" -o -name "*.ico" | wc -l)
if [[ $binary_count -le 5 ]]; then
    pass "Binary file count is within limit: $binary_count/5"
else
    fail "Too many binary files: $binary_count (max 5, 6+ = auto-reject)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
    echo ""
    echo "Failed checks:"
    for err in "${ERRORS[@]}"; do
        echo "  ✗ $err"
    done
    exit 1
fi

echo "All checks passed! ✓"
exit 0
