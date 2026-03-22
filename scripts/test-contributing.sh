#!/usr/bin/env bash
# Test suite for CONTRIBUTING.md (Closes #489)
# Validates all acceptance criteria via content analysis.

set -euo pipefail

PASS=0
FAIL=0
FILE="CONTRIBUTING.md"

pass() { PASS=$((PASS + 1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌ $1"; }

echo "🔍 Running CONTRIBUTING.md tests..."
echo ""

# ──── Section 1: Required sections ────

echo "📑 Required Sections"

grep -qi "Getting Started" "$FILE" \
    && pass "Section: Getting Started" \
    || fail "Missing section: Getting Started"

grep -qi "How Bounties Work\|Bounty Tier System" "$FILE" \
    && pass "Section: How Bounties Work / Tier System" \
    || fail "Missing section: How Bounties Work"

grep -qi "Tier.*System\|Tier 1.*Tier 2.*Tier 3\|tier-1\|Tier 1" "$FILE" \
    && pass "Section: Tier System explained" \
    || fail "Missing Tier System explanation"

grep -qi "Claim\|claiming" "$FILE" \
    && pass "Section: Claim Process" \
    || fail "Missing Claim Process"

grep -qi "PR.*Rules\|PR.*Guidelines\|Pull Request" "$FILE" \
    && pass "Section: PR Guidelines" \
    || fail "Missing PR Guidelines"

# ──── Section 2: Local dev setup ────

echo ""
echo "💻 Local Development Setup"

grep -qi "Local.*Development\|Local.*Setup\|dev.*setup" "$FILE" \
    && pass "Local dev setup section present" \
    || fail "Missing local dev setup section"

grep -qi "npm install\|npm ci" "$FILE" \
    && pass "Frontend setup instructions (npm)" \
    || fail "Missing frontend setup instructions"

grep -qi "pip install\|requirements.txt\|venv" "$FILE" \
    && pass "Backend setup instructions (pip/venv)" \
    || fail "Missing backend setup instructions"

grep -qi "anchor\|rust\|solana" "$FILE" \
    && pass "Anchor/Rust mentioned" \
    || fail "Missing Anchor/Rust setup mention"

# ──── Section 3: Code style & naming ────

echo ""
echo "🎨 Code Style & PR Naming"

grep -qi "code.*style\|style.*guide\|naming.*convention\|conventional.*commit" "$FILE" \
    && pass "Code style / naming conventions section" \
    || fail "Missing code style section"

grep -qi "ruff\|eslint\|lint" "$FILE" \
    && pass "Linter references (ruff/eslint)" \
    || fail "Missing linter references"

grep -qi "feat:\|fix:\|docs:" "$FILE" \
    && pass "PR title format examples" \
    || fail "Missing PR title format examples"

# ──── Section 4: Review pipeline ────

echo ""
echo "🤖 5-LLM Review Pipeline"

grep -qi "5.*model\|five.*model\|5 AI\|multi-LLM" "$FILE" \
    && pass "5-LLM review pipeline explained" \
    || fail "Missing 5-LLM review explanation"

grep -qi "trimmed.*mean" "$FILE" \
    && pass "Trimmed mean scoring explained" \
    || fail "Missing trimmed mean explanation"

grep -qi "GPT.*5\|Gemini\|Grok\|Sonnet\|DeepSeek" "$FILE" \
    && pass "Model names listed" \
    || fail "Missing model names"

grep -qi "6\.0\|score.*threshold\|pass.*threshold" "$FILE" \
    && pass "Score thresholds documented" \
    || fail "Missing score thresholds"

# ──── Section 5: Wallet registration ────

echo ""
echo "💰 Wallet & Payouts"

grep -qi "wallet" "$FILE" \
    && pass "Wallet registration explained" \
    || fail "Missing wallet instructions"

grep -qi "phantom\|solana.*wallet\|solflare" "$FILE" \
    && pass "Wallet provider recommended" \
    || fail "Missing wallet provider recommendation"

grep -qi "\\\$FNDRY\|FNDRY.*token" "$FILE" \
    && pass "FNDRY token mentioned" \
    || fail "Missing FNDRY token reference"

# ──── Section 6: FAQ ────

echo ""
echo "❓ FAQ Section"

grep -qi "FAQ\|frequently.*ask\|common.*question" "$FILE" \
    && pass "FAQ section present" \
    || fail "Missing FAQ section"

FAQ_COUNT=$(grep -c "^**Q:" "$FILE" 2>/dev/null || echo 0)
[ "$FAQ_COUNT" -ge 5 ] \
    && pass "At least 5 FAQ entries ($FAQ_COUNT found)" \
    || fail "Not enough FAQ entries ($FAQ_COUNT found, need 5+)"

# ──── Section 7: Links ────

echo ""
echo "🔗 Links & References"

grep -qi "github.com/SolFoundry/solfoundry/issues" "$FILE" \
    && pass "Link to bounty listing" \
    || fail "Missing bounty listing link"

grep -qi "tier.*requirement\|tier-1\|tier.*label" "$FILE" \
    && pass "Tier requirements referenced" \
    || fail "Missing tier requirements reference"

# ──── Section 8: Tone ────

echo ""
echo "💬 Tone & Accessibility"

WORD_COUNT=$(wc -w < "$FILE")
[ "$WORD_COUNT" -ge 500 ] \
    && pass "Comprehensive length ($WORD_COUNT words)" \
    || fail "Too short ($WORD_COUNT words, need 500+)"

grep -qi "welcome\|friendly\|start here\|anyone\|no.*application\|no.*interview" "$FILE" \
    && pass "Welcoming tone for newcomers" \
    || fail "Missing welcoming language"

grep -qi "tip\|💡\|example\|template" "$FILE" \
    && pass "Includes tips and examples" \
    || fail "Missing tips or examples"

# ──── Summary ────

echo ""
TOTAL=$((PASS + FAIL))
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS/$TOTAL passed"
[ "$FAIL" -eq 0 ] && echo "🎉 All tests passed!" || echo "⚠️  $FAIL test(s) failed"
exit "$FAIL"
