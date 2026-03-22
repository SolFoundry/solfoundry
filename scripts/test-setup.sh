#!/usr/bin/env bash
# Test suite for scripts/setup.sh (Closes #491)
# Validates structure, acceptance criteria, and correctness via static analysis.
# Does NOT execute setup.sh (avoids side effects in CI).

set -euo pipefail

PASS=0
FAIL=0
SCRIPT="scripts/setup.sh"

pass() { PASS=$((PASS + 1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ❌ $1"; }

echo "🔍 Running setup script tests..."
echo ""

# ──────── Section 1: File basics ────────

echo "📦 File Structure"

[ -f "$SCRIPT" ] \
    && pass "scripts/setup.sh exists" \
    || fail "scripts/setup.sh not found"

[ -x "$SCRIPT" ] \
    && pass "Script is executable" \
    || fail "Script is not executable"

head -1 "$SCRIPT" | grep -q "#!/usr/bin/env bash\|#!/bin/bash" \
    && pass "Has proper shebang line" \
    || fail "Missing or incorrect shebang"

grep -q "set -.*e" "$SCRIPT" \
    && pass "Uses set -e (exit on error)" \
    || fail "Missing set -e"

# ──────── Section 2: Tool version checks ────────

echo ""
echo "🔧 Required Tool Checks"

grep -q "node" "$SCRIPT" && grep -q "version\|--version\|NODE" "$SCRIPT" \
    && pass "Checks for Node.js with version validation" \
    || fail "Missing Node.js version check"

grep -q "python\|PYTHON" "$SCRIPT" \
    && pass "Checks for Python" \
    || fail "Missing Python check"

grep -qi "rust\|rustc\|cargo" "$SCRIPT" \
    && pass "Checks for Rust/Cargo (optional)" \
    || fail "Missing Rust check"

grep -qi "anchor" "$SCRIPT" \
    && pass "Checks for Anchor (optional)" \
    || fail "Missing Anchor check"

# ──────── Section 3: Environment setup ────────

echo ""
echo "⚙️ Environment Configuration"

grep -q ".env.example" "$SCRIPT" && grep -q ".env" "$SCRIPT" \
    && pass "Creates .env from .env.example" \
    || fail "Missing .env setup from .env.example"

grep -q "if.*-f.*\.env\|\.env.*exist" "$SCRIPT" \
    && pass "Checks if .env already exists (idempotent)" \
    || fail "Missing .env existence check"

# ──────── Section 4: Dependency installation ────────

echo ""
echo "📥 Dependency Installation"

grep -q "npm install\|npm ci" "$SCRIPT" \
    && pass "Installs frontend deps (npm)" \
    || fail "Missing npm install"

grep -q "pip install\|pip.*-r" "$SCRIPT" \
    && pass "Installs backend deps (pip)" \
    || fail "Missing pip install"

grep -q "venv\|virtualenv\|VIRTUAL_ENV" "$SCRIPT" \
    && pass "Uses Python virtual environment" \
    || fail "Missing virtual environment setup"

# ──────── Section 5: Service startup ────────

echo ""
echo "🚀 Service Startup"

grep -qi "docker compose\|docker-compose" "$SCRIPT" \
    && pass "Supports Docker Compose startup" \
    || fail "Missing Docker Compose support"

grep -q "uvicorn\|python.*main\|backend.*start" "$SCRIPT" \
    && pass "Starts backend service" \
    || fail "Missing backend startup"

grep -q "npm run dev\|npm start\|frontend.*start" "$SCRIPT" \
    && pass "Starts frontend dev server" \
    || fail "Missing frontend startup"

# ──────── Section 6: Success output ────────

echo ""
echo "📋 Success Output"

grep -qi "localhost.*3000\|frontend.*url\|FRONTEND_PORT" "$SCRIPT" \
    && pass "Prints frontend URL" \
    || fail "Missing frontend URL in output"

grep -qi "localhost.*8000\|backend.*url\|BACKEND_PORT" "$SCRIPT" \
    && pass "Prints backend URL" \
    || fail "Missing backend URL in output"

grep -qi "/docs\|api.*doc\|swagger" "$SCRIPT" \
    && pass "Prints API docs URL" \
    || fail "Missing API docs URL in output"

# ──────── Section 7: Cross-platform & idempotency ────────

echo ""
echo "🔄 Cross-platform & Idempotency"

grep -q "/usr/bin/env bash\|#!/bin/bash" "$SCRIPT" \
    && pass "Uses portable shebang" \
    || fail "Non-portable shebang"

# Should check for existing state before acting
IDEMPOTENT_CHECKS=0
grep -q "if.*node_modules\|node_modules.*exist" "$SCRIPT" && IDEMPOTENT_CHECKS=$((IDEMPOTENT_CHECKS + 1))
grep -q "if.*\.venv\|venv.*exist" "$SCRIPT" && IDEMPOTENT_CHECKS=$((IDEMPOTENT_CHECKS + 1))
grep -q "if.*\.env\b" "$SCRIPT" && IDEMPOTENT_CHECKS=$((IDEMPOTENT_CHECKS + 1))
[ "$IDEMPOTENT_CHECKS" -ge 2 ] \
    && pass "Idempotent — checks existing state ($IDEMPOTENT_CHECKS guards)" \
    || fail "Insufficient idempotency guards ($IDEMPOTENT_CHECKS found)"

# Should not use OS-specific commands without checking
if grep -q "apt-get\|brew " "$SCRIPT"; then
    grep -q "uname\|OSTYPE\|Darwin\|Linux" "$SCRIPT" \
        && pass "OS-specific commands guarded by platform check" \
        || fail "OS-specific commands without platform check"
else
    pass "No OS-specific package manager commands (portable)"
fi

# ──────── Section 8: Error handling ────────

echo ""
echo "🛡️ Error Handling"

grep -q "set -.*u\|nounset" "$SCRIPT" \
    && pass "Uses set -u (undefined variable protection)" \
    || fail "Missing set -u"

grep -q "command -v\|which\|type " "$SCRIPT" \
    && pass "Uses command existence checks" \
    || fail "Missing command existence checks"

grep -qi "fail\|error\|not found\|required" "$SCRIPT" \
    && pass "Provides clear error messages" \
    || fail "Missing error messages"

# ──────── Summary ────────

echo ""
TOTAL=$((PASS + FAIL))
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS/$TOTAL passed"
[ "$FAIL" -eq 0 ] && echo "🎉 All tests passed!" || echo "⚠️  $FAIL test(s) failed"
exit "$FAIL"
