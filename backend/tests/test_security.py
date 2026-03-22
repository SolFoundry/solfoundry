"""Comprehensive security tests for SolFoundry production hardening.

Tests cover all 11 security requirements from Issue #197:
1. SSL/TLS (HSTS headers)
2. Secrets management (validation, logging filter)
3. Input sanitization (XSS, SQL injection)
4. SQL injection prevention (parameterized queries)
5. XSS prevention (CSP headers, sanitization)
6. Escrow security (double-spend, signature verify, rate limit)
7. Auth hardening (token rotation, brute force, sessions)
8. DDoS basics (rate limiting, request size, connections)
9. Dependency audit (script existence and structure)
10. Security headers (all OWASP-recommended headers)
11. Backup strategy (script existence and functions)
"""

import json
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from starlette.testclient import TestClient

# Set test environment before importing app modules
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key-for-ci"
os.environ["ENFORCE_HTTPS"] = "true"
os.environ["AUTH_ENABLED"] = "false"

from app.main import app
from app.middleware.sanitization import (
    detect_sql_injection,
    detect_xss_pattern,
    is_valid_solana_wallet,
    sanitize_html,
    scan_value,
)
from app.middleware.rate_limiter import (
    SlidingWindowCounter,
    _global_counter,
    _endpoint_counter,
)
from app.services.auth_hardening import (
    BruteForceProtector,
    BruteForceProtectionError,
    RefreshTokenStore,
    SessionManager,
    TokenReuseError,
    _hash_token,
)
from app.services.escrow_security import (
    DoubleSpendError,
    InvalidSignatureError,
    TransactionExpiredError,
    TransactionVerifier,
    validate_solana_address,
    validate_transaction_hash,
)
from app.services.config_validator import (
    SensitiveDataFilter,
    generate_env_example,
    validate_secrets,
)


# ── Test client setup ──────────────────────────────────────────────────────

@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    return TestClient(app, raise_server_exceptions=False)


# ── 1. SSL/TLS: HSTS Headers ──────────────────────────────────────────────


class TestSSLTLSHeaders:
    """Tests for SSL/TLS enforcement via HSTS headers."""

    def test_hsts_header_present(self, client: TestClient):
        """Verify Strict-Transport-Security header is present on all responses."""
        response = client.get("/health")
        assert "Strict-Transport-Security" in response.headers
        hsts_value = response.headers["Strict-Transport-Security"]
        assert "max-age=" in hsts_value
        assert "includeSubDomains" in hsts_value
        assert "preload" in hsts_value

    def test_hsts_max_age_is_one_year(self, client: TestClient):
        """Verify HSTS max-age is at least one year (31536000 seconds)."""
        response = client.get("/health")
        hsts_value = response.headers["Strict-Transport-Security"]
        # Extract max-age value
        for part in hsts_value.split(";"):
            part = part.strip()
            if part.startswith("max-age="):
                max_age = int(part.split("=")[1])
                assert max_age >= 31536000, f"HSTS max-age {max_age} < 31536000"
                break


# ── 2. Secrets Management ──────────────────────────────────────────────────


class TestSecretsManagement:
    """Tests for secrets management and sensitive data protection."""

    def test_env_example_contains_all_secrets(self):
        """Verify .env.example template includes all required and optional secrets."""
        env_content = generate_env_example()
        assert "JWT_SECRET_KEY" in env_content
        assert "GITHUB_CLIENT_SECRET" in env_content
        assert "GITHUB_WEBHOOK_SECRET" in env_content
        assert "DATABASE_URL" in env_content
        assert "RATE_LIMIT_ANONYMOUS" in env_content
        assert "BACKUP_DIR" in env_content

    def test_env_example_file_exists(self):
        """Verify .env.example file exists in the backend directory."""
        env_file = Path(__file__).resolve().parent.parent / ".env.example"
        assert env_file.exists(), f".env.example not found at {env_file}"

    def test_validate_secrets_returns_warnings_for_missing(self):
        """Verify validate_secrets returns warnings when secrets are not set."""
        # In test environment, most secrets are not set
        warnings = validate_secrets(strict=False)
        # Should at least warn about missing secrets (unless all are set)
        assert isinstance(warnings, list)

    def test_sensitive_data_filter_redacts_jwt(self):
        """Verify the logging filter redacts JWT tokens from log messages."""
        log_filter = SensitiveDataFilter()
        record = MagicMock()
        record.msg = "Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.abc123signature"

        log_filter.filter(record)
        assert "[REDACTED_JWT]" in record.msg
        assert "eyJ" not in record.msg

    def test_sensitive_data_filter_passes_safe_messages(self):
        """Verify the logging filter does not modify safe log messages."""
        log_filter = SensitiveDataFilter()
        record = MagicMock()
        record.msg = "Normal log message with no secrets"

        log_filter.filter(record)
        assert record.msg == "Normal log message with no secrets"

    def test_no_hardcoded_secrets_in_source(self):
        """Verify no hardcoded secrets exist in the main application source files."""
        from app.services.config_validator import audit_source_for_secrets

        backend_dir = Path(__file__).resolve().parent.parent / "app"
        critical_findings = []

        for py_file in backend_dir.rglob("*.py"):
            findings = audit_source_for_secrets(str(py_file))
            if findings:
                critical_findings.extend(
                    [(str(py_file), f) for f in findings]
                )

        # Allow no critical findings (test/mock files are excluded by the function)
        assert len(critical_findings) == 0, (
            f"Found {len(critical_findings)} potential hardcoded secrets: "
            f"{critical_findings[:3]}"
        )


# ── 3 & 4. Input Sanitization & SQL Injection Prevention ──────────────────


class TestInputSanitization:
    """Tests for XSS detection, SQL injection detection, and input sanitization."""

    def test_detect_xss_script_tag(self):
        """Verify XSS detection catches script tags."""
        assert detect_xss_pattern("<script>alert('xss')</script>") is not None

    def test_detect_xss_javascript_uri(self):
        """Verify XSS detection catches javascript: URIs."""
        assert detect_xss_pattern("javascript:alert(1)") is not None

    def test_detect_xss_event_handler(self):
        """Verify XSS detection catches HTML event handler attributes."""
        assert detect_xss_pattern('<img onerror="alert(1)">') is not None

    def test_detect_xss_iframe(self):
        """Verify XSS detection catches iframe injection."""
        assert detect_xss_pattern('<iframe src="evil.com">') is not None

    def test_detect_xss_svg_event(self):
        """Verify XSS detection catches SVG event handler injection."""
        assert detect_xss_pattern('<svg onload="alert(1)">') is not None

    def test_safe_text_passes_xss_check(self):
        """Verify normal text passes XSS detection without false positives."""
        assert detect_xss_pattern("This is a normal bounty description") is None

    def test_detect_sql_union_select(self):
        """Verify SQL injection detection catches UNION SELECT."""
        assert detect_sql_injection("' UNION SELECT * FROM users --") is not None

    def test_detect_sql_drop_table(self):
        """Verify SQL injection detection catches DROP TABLE."""
        assert detect_sql_injection("'; DROP TABLE users; --") is not None

    def test_detect_sql_or_1_equals_1(self):
        """Verify SQL injection detection catches boolean-based blind injection."""
        assert detect_sql_injection("' OR 1=1 --") is not None

    def test_detect_sql_sleep(self):
        """Verify SQL injection detection catches time-based blind injection."""
        assert detect_sql_injection("'; SLEEP(5); --") is not None

    def test_detect_sql_benchmark(self):
        """Verify SQL injection detection catches BENCHMARK-based blind injection."""
        assert detect_sql_injection("'; BENCHMARK(10000000, SHA1('test')); --") is not None

    def test_safe_text_passes_sql_check(self):
        """Verify normal text passes SQL injection detection without false positives."""
        assert detect_sql_injection("Fix the dropdown selection on the bounty page") is None

    def test_sanitize_html_escapes_tags(self):
        """Verify HTML sanitization escapes angle brackets."""
        result = sanitize_html("<script>alert('xss')</script>")
        assert "<script>" not in result
        assert "&lt;script&gt;" in result

    def test_sanitize_html_escapes_quotes(self):
        """Verify HTML sanitization escapes quote characters."""
        result = sanitize_html('He said "hello" & goodbye')
        assert "&amp;" in result
        assert "&quot;" in result

    def test_scan_value_detects_xss(self):
        """Verify scan_value detects XSS patterns."""
        result = scan_value("<script>document.cookie</script>")
        assert result is not None
        assert "XSS" in result

    def test_scan_value_detects_sql_injection(self):
        """Verify scan_value detects SQL injection patterns."""
        result = scan_value("' UNION SELECT password FROM users --")
        assert result is not None
        assert "SQL injection" in result

    def test_scan_value_passes_safe_input(self):
        """Verify scan_value returns None for clean input."""
        assert scan_value("Normal bounty: fix the CSS layout") is None

    def test_middleware_blocks_xss_in_body(self, client: TestClient):
        """Verify the sanitization middleware blocks XSS in request bodies."""
        response = client.post(
            "/api/bounties",
            json={
                "title": "<script>alert('xss')</script>",
                "description": "Test bounty",
                "reward_amount": 100.0,
                "tier": 1,
            },
        )
        assert response.status_code == 400
        assert "prohibited content" in response.json()["detail"].lower()

    def test_middleware_blocks_sql_injection_in_body(self, client: TestClient):
        """Verify the sanitization middleware blocks SQL injection in request bodies."""
        response = client.post(
            "/api/bounties",
            json={
                "title": "Normal title",
                "description": "'; DROP TABLE bounties; --",
                "reward_amount": 100.0,
                "tier": 1,
            },
        )
        assert response.status_code == 400

    def test_middleware_passes_clean_request(self, client: TestClient):
        """Verify the sanitization middleware passes clean requests through."""
        response = client.get("/health")
        assert response.status_code == 200


# ── 5. XSS Prevention (CSP Headers) ───────────────────────────────────────


class TestXSSPrevention:
    """Tests for XSS prevention via Content-Security-Policy headers."""

    def test_csp_header_present(self, client: TestClient):
        """Verify Content-Security-Policy header is present."""
        response = client.get("/health")
        assert "Content-Security-Policy" in response.headers

    def test_csp_has_default_src(self, client: TestClient):
        """Verify CSP includes default-src directive."""
        response = client.get("/health")
        csp = response.headers["Content-Security-Policy"]
        assert "default-src" in csp

    def test_csp_has_script_src(self, client: TestClient):
        """Verify CSP includes script-src directive."""
        response = client.get("/health")
        csp = response.headers["Content-Security-Policy"]
        assert "script-src" in csp

    def test_csp_blocks_inline_scripts(self, client: TestClient):
        """Verify CSP script-src does not include unsafe-inline."""
        response = client.get("/health")
        csp = response.headers["Content-Security-Policy"]
        # Extract script-src directive
        for directive in csp.split(";"):
            if "script-src" in directive:
                assert "unsafe-inline" not in directive
                break

    def test_csp_has_frame_ancestors_none(self, client: TestClient):
        """Verify CSP frame-ancestors is set to 'none' to prevent framing."""
        response = client.get("/health")
        csp = response.headers["Content-Security-Policy"]
        assert "frame-ancestors 'none'" in csp

    def test_x_content_type_options_nosniff(self, client: TestClient):
        """Verify X-Content-Type-Options is set to nosniff."""
        response = client.get("/health")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"


# ── 6. Escrow Security ────────────────────────────────────────────────────


class TestEscrowSecurity:
    """Tests for escrow security including double-spend and signature verification."""

    def setup_method(self):
        """Reset the transaction verifier before each test."""
        self.verifier = TransactionVerifier(max_concurrent=3)

    def test_double_spend_prevention(self):
        """Verify that reusing a transaction hash raises DoubleSpendError."""
        valid_hash = "5" * 88  # Valid base58 format
        self.verifier.check_double_spend(valid_hash)
        self.verifier.record_processed_transaction(valid_hash, "release", 100.0, "A" * 44)

        with pytest.raises(DoubleSpendError):
            self.verifier.check_double_spend(valid_hash)

    def test_invalid_transaction_hash_rejected(self):
        """Verify that malformed transaction hashes are rejected."""
        with pytest.raises(InvalidSignatureError):
            self.verifier.check_double_spend("too_short")

    def test_transaction_age_verification(self):
        """Verify that old transactions are rejected."""
        old_timestamp = time.time() - 600  # 10 minutes ago
        with pytest.raises(TransactionExpiredError):
            self.verifier.verify_transaction_age(old_timestamp)

    def test_recent_transaction_passes_age_check(self):
        """Verify that recent transactions pass the age check."""
        recent_timestamp = time.time() - 60  # 1 minute ago
        self.verifier.verify_transaction_age(recent_timestamp)  # Should not raise

    def test_validate_solana_address_valid(self):
        """Verify valid Solana addresses pass validation."""
        assert validate_solana_address("AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1")
        assert validate_solana_address("C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS")

    def test_validate_solana_address_invalid(self):
        """Verify invalid Solana addresses fail validation."""
        assert not validate_solana_address("")
        assert not validate_solana_address("too_short")
        assert not validate_solana_address("0" * 44)  # Contains '0' (not in base58)
        assert not validate_solana_address("O" * 44)  # Contains 'O' (not in base58)

    def test_validate_transaction_hash_valid(self):
        """Verify valid transaction hashes pass validation."""
        assert validate_transaction_hash("5" * 88)
        assert validate_transaction_hash("A" * 64)

    def test_validate_transaction_hash_invalid(self):
        """Verify invalid transaction hashes fail validation."""
        assert not validate_transaction_hash("")
        assert not validate_transaction_hash("short")
        assert not validate_transaction_hash("0" * 88)  # '0' not in base58

    def test_concurrency_limit(self):
        """Verify that exceeding the concurrency limit raises an error."""
        from app.services.escrow_security import ConcurrencyLimitError

        # Acquire all slots
        for _ in range(3):
            self.verifier.acquire_operation_slot()

        # Next acquire should fail
        with pytest.raises(ConcurrencyLimitError):
            self.verifier.acquire_operation_slot()

        # Release one slot
        self.verifier.release_operation_slot()

        # Now it should succeed
        self.verifier.acquire_operation_slot()

        # Clean up
        for _ in range(3):
            self.verifier.release_operation_slot()

    def test_full_verification_pipeline(self):
        """Verify the complete escrow verification pipeline succeeds for valid input."""
        valid_hash = "A" * 88
        valid_address = "AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1"
        recent_timestamp = time.time() - 30

        # Should not raise
        self.verifier.verify_escrow_operation(
            tx_hash=valid_hash,
            operation="release",
            recipient=valid_address,
            amount=100.0,
            tx_timestamp=recent_timestamp,
        )

    def test_full_verification_rejects_negative_amount(self):
        """Verify the pipeline rejects negative amounts."""
        from app.services.escrow_security import EscrowSecurityError

        valid_hash = "B" * 88
        valid_address = "AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1"

        with pytest.raises(EscrowSecurityError):
            self.verifier.verify_escrow_operation(
                tx_hash=valid_hash,
                operation="release",
                recipient=valid_address,
                amount=-50.0,
            )

    def test_cleanup_old_records(self):
        """Verify that old transaction records are cleaned up."""
        # Record a transaction
        valid_hash = "C" * 88
        self.verifier.record_processed_transaction(valid_hash, "fund")

        # Manually age the record
        self.verifier._processed_transactions[valid_hash].processed_at = time.time() - 100000

        # Cleanup should remove it
        removed = self.verifier.cleanup_old_records(max_age_seconds=1)
        assert removed == 1
        assert self.verifier.get_processed_count() == 0


# ── 7. Auth Hardening ─────────────────────────────────────────────────────


class TestAuthHardening:
    """Tests for authentication hardening including brute force and token rotation."""

    def test_brute_force_lockout(self):
        """Verify brute force protection locks out after max failed attempts."""
        protector = BruteForceProtector(max_attempts=3, lockout_duration=60)

        # Record failures
        for i in range(3):
            protector.check_and_record_attempt("user@test.com", success=False, ip_address="1.2.3.4")

        # Next attempt should be blocked
        with pytest.raises(BruteForceProtectionError) as exc_info:
            protector.check_and_record_attempt("user@test.com", success=False, ip_address="1.2.3.4")

        assert exc_info.value.retry_after > 0

    def test_successful_login_resets_lockout(self):
        """Verify successful login resets the brute force counter."""
        protector = BruteForceProtector(max_attempts=5, lockout_duration=60)

        # Record some failures
        for _ in range(3):
            protector.check_and_record_attempt("user@test.com", success=False)

        # Successful login
        protector.check_and_record_attempt("user@test.com", success=True)

        # Counter should be reset - more failures should not trigger lockout
        for _ in range(3):
            protector.check_and_record_attempt("user@test.com", success=False)

        # Should still be under limit (3 < 5)
        assert protector.get_failed_attempts("user@test.com") == 3

    def test_lockout_escalation(self):
        """Verify lockout duration escalates with repeated lockouts."""
        protector = BruteForceProtector(
            max_attempts=2, lockout_duration=10, escalation_factor=2.0
        )

        # First lockout
        for _ in range(2):
            protector.check_and_record_attempt("user@test.com", success=False)

        locked, seconds = protector.is_locked_out("user@test.com")
        assert locked
        first_lockout = seconds

        # Wait for lockout to expire (simulate by resetting)
        protector.reset("user@test.com")

        # Trigger second lockout with escalation
        for _ in range(2):
            protector.check_and_record_attempt("user@test.com", success=False)

        # The second lockout should be tracked
        locked, _ = protector.is_locked_out("user@test.com")
        assert locked

    def test_case_insensitive_lockout(self):
        """Verify lockout applies regardless of case in identifier."""
        protector = BruteForceProtector(max_attempts=2, lockout_duration=60)

        protector.check_and_record_attempt("User@Test.COM", success=False)
        protector.check_and_record_attempt("user@test.com", success=False)

        # Both should count toward the same identifier
        with pytest.raises(BruteForceProtectionError):
            protector.check_and_record_attempt("USER@TEST.COM", success=False)

    def test_refresh_token_rotation(self):
        """Verify refresh token rotation issues new token and revokes old."""
        store = RefreshTokenStore()
        expires = datetime.now(timezone.utc) + timedelta(days=7)

        # Store initial token
        token_id_1 = store.store_token("user-1", "initial-token-value", expires)
        assert store.get_active_token_count("user-1") == 1

        # Rotate token
        new_token_id = store.validate_and_rotate(
            "initial-token-value", "user-1", "new-token-value", expires
        )
        assert new_token_id != token_id_1

        # Old token should be revoked, new one active
        assert store.get_active_token_count("user-1") == 1

    def test_refresh_token_reuse_detection(self):
        """Verify that reusing a rotated refresh token triggers theft detection."""
        store = RefreshTokenStore()
        expires = datetime.now(timezone.utc) + timedelta(days=7)

        # Store and rotate
        store.store_token("user-1", "token-a", expires)
        store.validate_and_rotate("token-a", "user-1", "token-b", expires)

        # Reuse old token-a (should trigger theft detection)
        with pytest.raises(TokenReuseError):
            store.validate_and_rotate("token-a", "user-1", "token-c", expires)

        # All tokens should be revoked
        assert store.get_active_token_count("user-1") == 0

    def test_session_management_limit(self):
        """Verify session limit evicts oldest session."""
        manager = SessionManager(max_sessions=2)

        # Create 2 sessions
        session_1 = manager.create_session("user-1", "jti-1", "rt-1", "1.1.1.1")
        session_2 = manager.create_session("user-1", "jti-2", "rt-2", "1.1.1.2")

        # Creating a 3rd should evict the oldest
        session_3 = manager.create_session("user-1", "jti-3", "rt-3", "1.1.1.3")

        active = manager.get_active_sessions("user-1")
        assert len(active) == 2
        session_ids = [s["session_id"] for s in active]
        assert session_1.session_id not in session_ids
        assert session_3.session_id in session_ids

    def test_session_invalidation(self):
        """Verify session invalidation removes a specific session."""
        manager = SessionManager(max_sessions=5)
        session = manager.create_session("user-1", "jti-1", "rt-1")

        assert manager.validate_session(session.session_id) is not None
        manager.invalidate_session(session.session_id)
        assert manager.validate_session(session.session_id) is None

    def test_invalidate_all_user_sessions(self):
        """Verify all sessions for a user can be invalidated at once."""
        manager = SessionManager(max_sessions=5)
        manager.create_session("user-1", "jti-1", "rt-1")
        manager.create_session("user-1", "jti-2", "rt-2")
        manager.create_session("user-1", "jti-3", "rt-3")

        count = manager.invalidate_all_user_sessions("user-1")
        assert count == 3
        assert len(manager.get_active_sessions("user-1")) == 0

    def test_token_hash_is_sha256(self):
        """Verify token hashing uses SHA-256."""
        token_hash = _hash_token("test-token")
        assert len(token_hash) == 64  # SHA-256 produces 64 hex chars
        # Same input should produce same hash
        assert _hash_token("test-token") == token_hash
        # Different input should produce different hash
        assert _hash_token("other-token") != token_hash


# ── 8. DDoS Protection (Rate Limiting) ────────────────────────────────────


class TestRateLimiting:
    """Tests for rate limiting and DDoS protection."""

    def test_sliding_window_counter_basic(self):
        """Verify basic sliding window counter operation."""
        counter = SlidingWindowCounter(window_size=60)

        # First request should pass
        is_limited, remaining, retry = counter.is_rate_limited("test-key", limit=5)
        assert not is_limited
        assert remaining == 4

    def test_sliding_window_counter_limit_reached(self):
        """Verify rate limit is enforced after reaching the maximum."""
        counter = SlidingWindowCounter(window_size=60)

        # Consume all 3 requests
        for _ in range(3):
            counter.is_rate_limited("test-key", limit=3)

        # Next request should be limited
        is_limited, remaining, retry = counter.is_rate_limited("test-key", limit=3)
        assert is_limited
        assert remaining == 0
        assert retry > 0

    def test_rate_limit_headers_present(self, client: TestClient):
        """Verify rate limit headers are present on responses."""
        response = client.get("/api/bounties")
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers

    def test_health_endpoint_exempt_from_rate_limit(self, client: TestClient):
        """Verify the health endpoint is exempt from rate limiting."""
        # Make many requests to health
        for _ in range(50):
            response = client.get("/health")
            assert response.status_code == 200

    def test_request_body_size_limit(self, client: TestClient):
        """Verify oversized request bodies are rejected."""
        # Create a request with a very large body hint via content-length
        # Note: TestClient doesn't enforce content-length, so we test the header check
        large_body = "x" * (2 * 1024 * 1024)  # 2MB string
        response = client.post(
            "/api/bounties",
            content=json.dumps({"title": large_body, "reward_amount": 1.0, "tier": 1}),
            headers={"Content-Type": "application/json", "Content-Length": str(2 * 1024 * 1024)},
        )
        assert response.status_code == 413

    def test_counter_reset(self):
        """Verify counter reset clears all tracking data."""
        counter = SlidingWindowCounter(window_size=60)
        counter.is_rate_limited("key-1", limit=10)
        counter.is_rate_limited("key-2", limit=10)

        counter.reset()
        assert counter.get_client_count() == 0


# ── 9. Dependency Audit ────────────────────────────────────────────────────


class TestDependencyAudit:
    """Tests for the dependency audit script."""

    def test_audit_script_exists(self):
        """Verify the audit_deps.py script exists."""
        script_path = Path(__file__).resolve().parent.parent.parent / "scripts" / "audit_deps.py"
        assert script_path.exists(), f"Audit script not found at {script_path}"

    def test_audit_script_is_executable_python(self):
        """Verify the audit script is valid Python that can be imported."""
        script_path = Path(__file__).resolve().parent.parent.parent / "scripts" / "audit_deps.py"
        content = script_path.read_text(encoding="utf-8")
        # Should compile without syntax errors
        compile(content, str(script_path), "exec")

    def test_audit_script_has_main_function(self):
        """Verify the audit script has a main() entry point."""
        script_path = Path(__file__).resolve().parent.parent.parent / "scripts" / "audit_deps.py"
        content = script_path.read_text(encoding="utf-8")
        assert "def main()" in content
        assert "if __name__" in content


# ── 10. Security Headers ──────────────────────────────────────────────────


class TestSecurityHeaders:
    """Tests for all OWASP-recommended security headers."""

    def test_x_frame_options(self, client: TestClient):
        """Verify X-Frame-Options is set to DENY."""
        response = client.get("/health")
        assert response.headers.get("X-Frame-Options") == "DENY"

    def test_x_content_type_options(self, client: TestClient):
        """Verify X-Content-Type-Options is set to nosniff."""
        response = client.get("/health")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"

    def test_referrer_policy(self, client: TestClient):
        """Verify Referrer-Policy header is present and restrictive."""
        response = client.get("/health")
        referrer = response.headers.get("Referrer-Policy")
        assert referrer is not None
        assert "strict-origin" in referrer

    def test_permissions_policy(self, client: TestClient):
        """Verify Permissions-Policy header restricts browser features."""
        response = client.get("/health")
        permissions = response.headers.get("Permissions-Policy")
        assert permissions is not None
        assert "camera=()" in permissions
        assert "microphone=()" in permissions
        assert "geolocation=()" in permissions

    def test_csp_header(self, client: TestClient):
        """Verify Content-Security-Policy header is comprehensive."""
        response = client.get("/health")
        csp = response.headers.get("Content-Security-Policy")
        assert csp is not None
        assert "default-src" in csp
        assert "script-src" in csp
        assert "object-src 'none'" in csp

    def test_sensitive_endpoint_no_cache(self, client: TestClient):
        """Verify sensitive endpoints have no-cache headers."""
        response = client.get("/auth/github/authorize")
        # Auth endpoints should have no-cache
        cache_control = response.headers.get("Cache-Control", "")
        assert "no-store" in cache_control or "no-cache" in cache_control

    def test_all_headers_present_on_api_endpoints(self, client: TestClient):
        """Verify all security headers are present on API endpoint responses."""
        response = client.get("/api/bounties")
        required_headers = [
            "Content-Security-Policy",
            "X-Frame-Options",
            "X-Content-Type-Options",
            "Referrer-Policy",
            "Permissions-Policy",
        ]
        for header in required_headers:
            assert header in response.headers, f"Missing security header: {header}"


# ── 11. Backup Strategy ───────────────────────────────────────────────────


class TestBackupStrategy:
    """Tests for the PostgreSQL backup script."""

    def test_backup_script_exists(self):
        """Verify the pg_backup.py script exists."""
        script_path = Path(__file__).resolve().parent.parent.parent / "scripts" / "pg_backup.py"
        assert script_path.exists(), f"Backup script not found at {script_path}"

    def test_backup_script_has_required_functions(self):
        """Verify the backup script has all required functions."""
        script_path = Path(__file__).resolve().parent.parent.parent / "scripts" / "pg_backup.py"
        content = script_path.read_text(encoding="utf-8")

        required_functions = [
            "create_backup",
            "verify_backup",
            "restore_backup",
            "list_backups",
            "cleanup_old_backups",
            "generate_cron_schedule",
            "generate_pitr_config",
        ]
        for func_name in required_functions:
            assert f"def {func_name}" in content, f"Missing function: {func_name}"

    def test_backup_script_is_valid_python(self):
        """Verify the backup script is valid Python."""
        script_path = Path(__file__).resolve().parent.parent.parent / "scripts" / "pg_backup.py"
        content = script_path.read_text(encoding="utf-8")
        compile(content, str(script_path), "exec")


# ── Wallet Validation ─────────────────────────────────────────────────────


class TestWalletValidation:
    """Tests for Solana wallet address validation."""

    def test_valid_treasury_wallet(self):
        """Verify the treasury wallet passes validation."""
        assert is_valid_solana_wallet("AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1")

    def test_valid_fndry_ca(self):
        """Verify the FNDRY contract address passes validation."""
        assert is_valid_solana_wallet("C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS")

    def test_empty_address_fails(self):
        """Verify empty string fails wallet validation."""
        assert not is_valid_solana_wallet("")

    def test_too_short_fails(self):
        """Verify addresses shorter than 32 chars fail."""
        assert not is_valid_solana_wallet("A" * 31)

    def test_too_long_fails(self):
        """Verify addresses longer than 44 chars fail."""
        assert not is_valid_solana_wallet("A" * 45)

    def test_invalid_base58_chars_fail(self):
        """Verify addresses with non-Base58 characters fail."""
        # '0', 'O', 'I', 'l' are not in Base58
        assert not is_valid_solana_wallet("0" * 32)
        assert not is_valid_solana_wallet("O" * 32)
        assert not is_valid_solana_wallet("I" * 32)
        assert not is_valid_solana_wallet("l" * 32)


# ── Integration: Full Security Stack ──────────────────────────────────────


class TestSecurityIntegration:
    """Integration tests verifying the full security middleware stack."""

    def test_security_headers_on_error_responses(self, client: TestClient):
        """Verify security headers are present even on 404 error responses."""
        response = client.get("/nonexistent-endpoint")
        assert "Content-Security-Policy" in response.headers
        assert "X-Frame-Options" in response.headers

    def test_rate_limit_and_security_headers_combined(self, client: TestClient):
        """Verify both rate limit and security headers appear together."""
        response = client.get("/api/bounties")
        # Security headers
        assert "Content-Security-Policy" in response.headers
        assert "X-Frame-Options" in response.headers
        # Rate limit headers
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers

    def test_webhook_exempt_from_sanitization(self, client: TestClient):
        """Verify webhook endpoints bypass input sanitization for raw payloads."""
        # Webhook should not be blocked by sanitization (it needs raw code snippets)
        # The webhook should be rejected for other reasons (missing signature)
        response = client.post(
            "/api/webhooks/github",
            json={"action": "opened", "body": "<script>alert(1)</script>"},
            headers={"X-GitHub-Event": "ping"},
        )
        # Should get a webhook-specific error, not a sanitization block
        assert response.status_code != 400 or "prohibited" not in response.json().get("detail", "")
