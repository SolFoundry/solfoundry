#!/usr/bin/env bash
# Test suite for README badges (Closes #488)
# Validates badge URLs, structure, and dynamic behavior.

set -euo pipefail

PASS=0
FAIL=0
README="README.md"

pass() { PASS=$((PASS + 1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌ $1"; }

echo "🔍 Running README badge tests..."
echo ""

# --- Section 1: Badge existence ---
echo "📌 Badge Presence"

grep -q "img.shields.io/github/actions/workflow/status" "$README" \
    && pass "CI build status badge present" \
    || fail "CI build status badge missing"

grep -q "img.shields.io/github/contributors" "$README" \
    && pass "Contributors badge present" \
    || fail "Contributors badge missing"

grep -q "img.shields.io/github/issues.*bounty" "$README" \
    && pass "Open bounties badge present" \
    || fail "Open bounties badge missing"

grep -q "img.shields.io/github/stars" "$README" \
    && pass "GitHub stars badge present" \
    || fail "GitHub stars badge missing"

grep -q "img.shields.io/github/forks" "$README" \
    && pass "Forks badge present" \
    || fail "Forks badge missing"

grep -q "img.shields.io/github/license" "$README" \
    && pass "License badge present" \
    || fail "License badge missing"

# --- Section 2: Badge links ---
echo ""
echo "🔗 Badge Link Targets"

grep "actions/workflow/status" "$README" | grep -q "actions/workflows/ci.yml" \
    && pass "CI badge links to CI workflow page" \
    || fail "CI badge does not link to workflow page"

grep "github/contributors" "$README" | grep -q "graphs/contributors" \
    && pass "Contributors badge links to contributors page" \
    || fail "Contributors badge link incorrect"

grep "github/issues.*bounty" "$README" | grep -q "label%3Abounty\|label=bounty" \
    && pass "Bounties badge links to filtered issues" \
    || fail "Bounties badge link incorrect"

grep "github/stars" "$README" | grep -q "stargazers" \
    && pass "Stars badge links to stargazers page" \
    || fail "Stars badge link incorrect"

grep "github/forks" "$README" | grep -q "network/members" \
    && pass "Forks badge links to forks page" \
    || fail "Forks badge link incorrect"

grep "github/license" "$README" | grep -q "LICENSE" \
    && pass "License badge links to LICENSE file" \
    || fail "License badge link incorrect"

# --- Section 3: Badge organization ---
echo ""
echo "📐 Layout & Structure"

BADGE_BLOCK=$(grep -c "img.shields.io" "$README")
[ "$BADGE_BLOCK" -ge 6 ] \
    && pass "At least 6 shields.io badges ($BADGE_BLOCK found)" \
    || fail "Expected at least 6 badges, found $BADGE_BLOCK"

# All badges should be inside a single <p align="center"> block
BADGE_LINES=$(grep -n "img.shields.io" "$README" | head -1 | cut -d: -f1)
BADGE_LINES_END=$(grep -n "img.shields.io" "$README" | tail -1 | cut -d: -f1)
SPREAD=$((BADGE_LINES_END - BADGE_LINES))
[ "$SPREAD" -le 10 ] \
    && pass "All badges grouped together (span: $SPREAD lines)" \
    || fail "Badges scattered across $SPREAD lines"

FIRST_BADGE_LINE=$(grep -n "img.shields.io" "$README" | head -1 | cut -d: -f1)
CONTEXT_START=$((FIRST_BADGE_LINE - 2))
[ "$CONTEXT_START" -lt 1 ] && CONTEXT_START=1
sed -n "${CONTEXT_START},${FIRST_BADGE_LINE}p" "$README" | grep -qi 'align.*center\|<p.*center' \
    && pass "Badge block is center-aligned" \
    || fail "Badge block not center-aligned"

# --- Section 4: Dynamic badges ---
echo ""
echo "⚡ Dynamic Badge Verification"

grep "img.shields.io" "$README" | grep -qv "\.png\|\.jpg\|\.svg.*static" \
    && pass "Badges use dynamic shields.io endpoints (not static images)" \
    || fail "Some badges appear to be static"

grep "img.shields.io.*SolFoundry/solfoundry" "$README" | wc -l | \
    xargs -I{} [ {} -ge 5 ] \
    && pass "Badges reference correct repo (SolFoundry/solfoundry)" \
    || fail "Some badges may reference wrong repo"

# Badges should have alt text
ALTS=$(grep -o 'alt="[^"]*"' "$README" | grep -i "status\|contributor\|bount\|star\|fork\|license" | wc -l)
[ "$ALTS" -ge 5 ] \
    && pass "Badges have descriptive alt text ($ALTS found)" \
    || fail "Missing alt text on some badges"

# --- Summary ---
echo ""
TOTAL=$((PASS + FAIL))
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS/$TOTAL passed"
[ "$FAIL" -eq 0 ] && echo "🎉 All tests passed!" || echo "⚠️  $FAIL test(s) failed"
exit "$FAIL"
