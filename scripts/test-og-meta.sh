#!/usr/bin/env bash
# Test suite for OG/meta social preview cards (Closes #472)
# Validates meta tags, OG image, and backend endpoint via static analysis.

set -euo pipefail

PASS=0
FAIL=0
HTML="frontend/index.html"
OG_API="backend/app/api/og.py"
MAIN="backend/app/main.py"

pass() { PASS=$((PASS + 1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌ $1"; }

echo "🔍 Running OG/meta social preview tests..."
echo ""

# ──── Section 1: OG tags in index.html ────

echo "🏷️ Open Graph Tags (index.html)"

grep -q 'property="og:title"' "$HTML" \
    && pass "og:title present" \
    || fail "og:title missing"

grep -q 'property="og:description"' "$HTML" \
    && pass "og:description present" \
    || fail "og:description missing"

grep -q 'property="og:image"' "$HTML" \
    && pass "og:image present" \
    || fail "og:image missing"

grep -q 'property="og:url"' "$HTML" \
    && pass "og:url present" \
    || fail "og:url missing"

grep -q 'property="og:type"' "$HTML" \
    && pass "og:type present" \
    || fail "og:type missing"

grep -q 'property="og:site_name"' "$HTML" \
    && pass "og:site_name present" \
    || fail "og:site_name missing"

grep -q 'og:image:width.*1200' "$HTML" \
    && pass "og:image:width set to 1200" \
    || fail "og:image:width missing or wrong"

grep -q 'og:image:height.*630' "$HTML" \
    && pass "og:image:height set to 630" \
    || fail "og:image:height missing or wrong"

# ──── Section 2: Twitter Card tags ────

echo ""
echo "🐦 Twitter Card Tags (index.html)"

grep -q 'name="twitter:card".*summary_large_image' "$HTML" \
    && pass "twitter:card = summary_large_image" \
    || fail "twitter:card missing or wrong type"

grep -q 'name="twitter:site"' "$HTML" \
    && pass "twitter:site present" \
    || fail "twitter:site missing"

grep -q 'name="twitter:title"' "$HTML" \
    && pass "twitter:title present" \
    || fail "twitter:title missing"

grep -q 'name="twitter:description"' "$HTML" \
    && pass "twitter:description present" \
    || fail "twitter:description missing"

grep -q 'name="twitter:image"' "$HTML" \
    && pass "twitter:image present" \
    || fail "twitter:image missing"

# ──── Section 3: Default OG image ────

echo ""
echo "🖼️ Default OG Image"

[ -f "frontend/public/og-default.png" ] \
    && pass "og-default.png exists in public/" \
    || fail "og-default.png not found"

SIZE=$(stat -c%s "frontend/public/og-default.png" 2>/dev/null || stat -f%z "frontend/public/og-default.png" 2>/dev/null || echo 0)
[ "$SIZE" -gt 1000 ] \
    && pass "og-default.png is non-trivial ($SIZE bytes)" \
    || fail "og-default.png too small ($SIZE bytes)"

grep -q "og-default.png" "$HTML" \
    && pass "index.html references og-default.png" \
    || fail "index.html does not reference og-default.png"

# ──── Section 4: Dynamic OG endpoint ────

echo ""
echo "⚡ Dynamic OG API Endpoint"

[ -f "$OG_API" ] \
    && pass "Backend OG module exists (app/api/og.py)" \
    || fail "Backend OG module not found"

grep -q "og:title" "$OG_API" \
    && pass "Dynamic endpoint generates og:title" \
    || fail "Dynamic endpoint missing og:title"

grep -q "og:description" "$OG_API" \
    && pass "Dynamic endpoint generates og:description" \
    || fail "Dynamic endpoint missing og:description"

grep -q "og:image" "$OG_API" \
    && pass "Dynamic endpoint generates og:image" \
    || fail "Dynamic endpoint missing og:image"

grep -q "twitter:card" "$OG_API" \
    && pass "Dynamic endpoint generates twitter:card" \
    || fail "Dynamic endpoint missing twitter:card"

grep -q "bounty_id" "$OG_API" \
    && pass "Dynamic endpoint accepts bounty_id parameter" \
    || fail "Dynamic endpoint missing bounty_id"

grep -qi "bot\|crawler\|user.agent" "$OG_API" \
    && pass "Bot detection for crawler-specific rendering" \
    || fail "Missing bot detection"

# ──── Section 5: Integration ────

echo ""
echo "🔌 Integration"

grep -q "og_router\|og import" "$MAIN" \
    && pass "OG router registered in main.py" \
    || fail "OG router not registered in main.py"

grep -q "include_router.*og" "$MAIN" \
    && pass "OG router included in app" \
    || fail "OG router not included in app"

grep -q "@foundrysol\|@SolFoundry" "$HTML" \
    && pass "Twitter handle referenced" \
    || fail "Twitter handle missing"

# ──── Summary ────

echo ""
TOTAL=$((PASS + FAIL))
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS/$TOTAL passed"
[ "$FAIL" -eq 0 ] && echo "🎉 All tests passed!" || echo "⚠️  $FAIL test(s) failed"
exit "$FAIL"
