"""Comprehensive tests for Sign-In With Solana (SIWS) session management.

Tests cover the full SIWS authentication lifecycle:
- Nonce generation and SIWS message format validation
- Signature verification for valid and invalid signatures
- Nonce replay prevention (used nonces rejected)
- Nonce expiration enforcement
- Wallet address validation
- JWT access token (24h) and refresh token (7d) issuance
- Session persistence in the database
- Token refresh without re-signing
- Session revocation (single and all)
- Active session listing
- Rate limiting (5 attempts per wallet per minute)
- ``require_wallet_auth`` middleware enforcement
- Edge cases: expired tokens, revoked sessions, wrong wallet, tampered messages

Each test uses a fresh database session and Solana keypair to ensure
isolation. The test client bypasses external middleware to focus on
the SIWS business logic.
"""

import asyncio
import base64
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from solders.keypair import Keypair

from app.database import async_session_factory
from app.main import app
from app.services import siws_service
from app.services.siws_service import (
    InvalidWalletAddressError,
    NonceAlreadyUsedError,
    NonceExpiredError,
    NonceNotFoundError,
    RateLimitExceededError,
    SignatureVerificationError,
    WalletMismatchError,
    _hash_token,
    build_siws_message,
    create_siws_access_token,
    create_siws_refresh_token,
    decode_siws_token,
    detect_wallet_type,
    verify_solana_signature,
    wallet_rate_limiter,
)


@pytest.fixture(scope="module", autouse=True)
def ensure_siws_tables():
    """Ensure SIWS database tables exist before running tests.

    The session-level ``init_test_db`` fixture may have already run
    before the wallet_session models were imported. This fixture
    guarantees the ``wallet_nonces`` and ``wallet_sessions`` tables
    are created in the in-memory SQLite database.
    """
    import asyncio
    from app.database import engine, Base
    from app.models.wallet_session import WalletNonceDB, WalletSessionDB  # noqa: F401

    async def _create_tables():
        """Create all tables including SIWS models."""
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    loop = asyncio.new_event_loop()
    loop.run_until_complete(_create_tables())
    loop.close()


@pytest.fixture
def client():
    """Create a fresh test client for each test."""
    return TestClient(app)


@pytest.fixture
def test_keypair():
    """Generate a fresh Solana keypair for wallet auth tests."""
    return Keypair()


@pytest.fixture(autouse=True)
def reset_siws_rate_limiter():
    """Reset the SIWS rate limiter between tests to prevent cross-test interference."""
    wallet_rate_limiter.reset()
    yield
    wallet_rate_limiter.reset()


def _sign_message(keypair: Keypair, message: str) -> str:
    """Sign a message with a Solana keypair and return base64-encoded signature.

    Args:
        keypair: The Solana keypair to sign with.
        message: The message string to sign.

    Returns:
        Base64-encoded Ed25519 signature string.
    """
    message_bytes = message.encode("utf-8")
    signature = keypair.sign_message(message_bytes)
    return base64.b64encode(bytes(signature)).decode()


# ---------------------------------------------------------------------------
# SIWS Message Format Tests
# ---------------------------------------------------------------------------


class TestSIWSMessageFormat:
    """Test SIWS-standard message generation."""

    def test_message_contains_required_fields(self, test_keypair):
        """Verify the SIWS message includes domain, address, nonce, issued-at, and expiration."""
        wallet_address = str(test_keypair.pubkey())
        nonce = "test-nonce-abc123"
        message, issued_at, expires_at = build_siws_message(wallet_address, nonce)

        assert "solfoundry.org wants you to sign in with your Solana account:" in message
        assert wallet_address in message
        assert f"Nonce: {nonce}" in message
        assert "Issued At:" in message
        assert "Expiration Time:" in message
        assert "URI: https://solfoundry.org" in message
        assert "Version: 1" in message
        assert "Chain ID: mainnet" in message

    def test_message_custom_domain(self, test_keypair):
        """Verify custom domain is used in the message when provided."""
        wallet_address = str(test_keypair.pubkey())
        message, _, _ = build_siws_message(wallet_address, "nonce", domain="custom.domain.com")

        assert "custom.domain.com wants you to sign in" in message
        assert "URI: https://custom.domain.com" in message

    def test_message_timestamps_are_valid(self, test_keypair):
        """Verify issued_at and expires_at timestamps are in the correct order."""
        wallet_address = str(test_keypair.pubkey())
        _, issued_at, expires_at = build_siws_message(wallet_address, "nonce")

        assert issued_at < expires_at
        assert (expires_at - issued_at).total_seconds() == 300  # 5 minutes default


# ---------------------------------------------------------------------------
# Nonce Generation Tests (API)
# ---------------------------------------------------------------------------


class TestNonceGeneration:
    """Test the /api/auth/siws/nonce endpoint."""

    def test_generate_nonce_success(self, client, test_keypair):
        """Verify nonce generation returns all required fields."""
        wallet_address = str(test_keypair.pubkey())
        response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "nonce" in data
        assert "expires_at" in data
        assert "domain" in data
        assert wallet_address in data["message"]
        assert data["domain"] == "solfoundry.org"

    def test_generate_nonce_invalid_wallet_address(self, client):
        """Verify nonce generation rejects invalid wallet addresses."""
        response = client.post(
            "/api/auth/siws/nonce?wallet_address=short"
        )
        assert response.status_code == 400

    def test_generate_nonce_custom_domain(self, client, test_keypair):
        """Verify nonce generation accepts a custom domain parameter."""
        wallet_address = str(test_keypair.pubkey())
        response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}&domain=test.example.com"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["domain"] == "test.example.com"
        assert "test.example.com" in data["message"]

    def test_generate_nonce_unique_per_request(self, client, test_keypair):
        """Verify each nonce request produces a unique nonce."""
        wallet_address = str(test_keypair.pubkey())
        response1 = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        response2 = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )

        assert response1.json()["nonce"] != response2.json()["nonce"]


# ---------------------------------------------------------------------------
# Signature Verification Tests (Unit)
# ---------------------------------------------------------------------------


class TestSignatureVerification:
    """Test Ed25519 signature verification for Solana wallets."""

    def test_valid_signature_verification(self, test_keypair):
        """Verify that a correctly signed message passes verification."""
        wallet_address = str(test_keypair.pubkey())
        message = "Test message for signing"
        signature_b64 = _sign_message(test_keypair, message)

        result = verify_solana_signature(wallet_address, message, signature_b64)
        assert result is True

    def test_invalid_signature_rejected(self, test_keypair):
        """Verify that an invalid signature is rejected."""
        wallet_address = str(test_keypair.pubkey())
        other_keypair = Keypair()
        other_signature = _sign_message(other_keypair, "Different message")

        with pytest.raises(SignatureVerificationError):
            verify_solana_signature(wallet_address, "Test message", other_signature)

    def test_wrong_message_rejected(self, test_keypair):
        """Verify that a signature for a different message is rejected."""
        wallet_address = str(test_keypair.pubkey())
        signature_b64 = _sign_message(test_keypair, "Original message")

        with pytest.raises(SignatureVerificationError):
            verify_solana_signature(wallet_address, "Tampered message", signature_b64)

    def test_invalid_base64_signature(self, test_keypair):
        """Verify that malformed base64 signatures are rejected."""
        wallet_address = str(test_keypair.pubkey())

        with pytest.raises(SignatureVerificationError):
            verify_solana_signature(wallet_address, "message", "not-valid-base64!!!")

    def test_wrong_length_signature(self, test_keypair):
        """Verify that signatures with wrong byte length are rejected."""
        wallet_address = str(test_keypair.pubkey())
        short_sig = base64.b64encode(b"tooshort").decode()

        with pytest.raises(SignatureVerificationError):
            verify_solana_signature(wallet_address, "message", short_sig)

    def test_invalid_wallet_address_format(self):
        """Verify that malformed wallet addresses are rejected."""
        with pytest.raises(InvalidWalletAddressError):
            verify_solana_signature(
                "invalid",
                "message",
                base64.b64encode(b"\x00" * 64).decode(),
            )


# ---------------------------------------------------------------------------
# Full Authentication Flow Tests (API)
# ---------------------------------------------------------------------------


class TestSIWSAuthentication:
    """Test the complete SIWS authentication flow via the API."""

    def test_full_authentication_flow(self, client, test_keypair):
        """Test the complete SIWS flow: nonce -> sign -> authenticate."""
        wallet_address = str(test_keypair.pubkey())

        # Step 1: Get nonce
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        assert nonce_response.status_code == 200
        nonce_data = nonce_response.json()
        message = nonce_data["message"]
        nonce = nonce_data["nonce"]

        # Step 2: Sign the message
        signature_b64 = _sign_message(test_keypair, message)

        # Step 3: Authenticate
        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
                "nonce": nonce,
            },
        )

        assert auth_response.status_code == 200
        auth_data = auth_response.json()
        assert "access_token" in auth_data
        assert "refresh_token" in auth_data
        assert auth_data["token_type"] == "bearer"
        assert auth_data["expires_in"] == 86400  # 24 hours
        assert "session_id" in auth_data
        assert "user" in auth_data
        assert auth_data["user"]["wallet_address"].lower() == wallet_address.lower()
        assert auth_data["user"]["wallet_verified"] is True

    def test_authenticate_invalid_signature(self, client, test_keypair):
        """Verify authentication fails with an invalid signature."""
        wallet_address = str(test_keypair.pubkey())

        # Get nonce
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_data = nonce_response.json()

        # Use invalid signature
        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": base64.b64encode(b"\x00" * 64).decode(),
                "message": nonce_data["message"],
                "nonce": nonce_data["nonce"],
            },
        )

        assert auth_response.status_code == 400
        assert "verification failed" in auth_response.json()["message"].lower()

    def test_authenticate_wrong_wallet(self, client, test_keypair):
        """Verify authentication fails when a different wallet signs the message."""
        wallet_address = str(test_keypair.pubkey())
        other_keypair = Keypair()

        # Get nonce for the original wallet
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_data = nonce_response.json()

        # Sign with the wrong keypair
        signature_b64 = _sign_message(other_keypair, nonce_data["message"])

        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": nonce_data["message"],
                "nonce": nonce_data["nonce"],
            },
        )

        assert auth_response.status_code == 400

    def test_authenticate_tampered_message(self, client, test_keypair):
        """Verify authentication fails when the message has been tampered with."""
        wallet_address = str(test_keypair.pubkey())

        # Get nonce
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_data = nonce_response.json()
        message = nonce_data["message"]

        # Sign the original message
        signature_b64 = _sign_message(test_keypair, message)

        # Submit with a tampered message
        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message + " TAMPERED",
                "nonce": nonce_data["nonce"],
            },
        )

        assert auth_response.status_code == 400

    def test_returning_user_updates_login_time(self, client, test_keypair):
        """Verify that a returning user's last_login_at is updated on re-auth."""
        wallet_address = str(test_keypair.pubkey())

        # First authentication
        nonce1 = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        ).json()
        sig1 = _sign_message(test_keypair, nonce1["message"])
        auth1 = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": sig1,
                "message": nonce1["message"],
                "nonce": nonce1["nonce"],
            },
        )
        assert auth1.status_code == 200
        user_id_1 = auth1.json()["user"]["id"]

        # Second authentication (same wallet, new nonce)
        nonce2 = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        ).json()
        sig2 = _sign_message(test_keypair, nonce2["message"])
        auth2 = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": sig2,
                "message": nonce2["message"],
                "nonce": nonce2["nonce"],
            },
        )
        assert auth2.status_code == 200
        user_id_2 = auth2.json()["user"]["id"]

        # Same user ID
        assert user_id_1 == user_id_2


# ---------------------------------------------------------------------------
# Nonce Replay Prevention Tests
# ---------------------------------------------------------------------------


class TestNonceReplayPrevention:
    """Test that nonces cannot be reused (replay attack prevention)."""

    def test_nonce_replay_rejected(self, client, test_keypair):
        """Verify that a nonce cannot be used twice."""
        wallet_address = str(test_keypair.pubkey())

        # Get nonce
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_data = nonce_response.json()
        message = nonce_data["message"]
        nonce = nonce_data["nonce"]

        # Sign the message
        signature_b64 = _sign_message(test_keypair, message)

        # First use: success
        auth1 = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
                "nonce": nonce,
            },
        )
        assert auth1.status_code == 200

        # Second use: rejected (replay)
        auth2 = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
                "nonce": nonce,
            },
        )
        assert auth2.status_code == 400
        assert "already been used" in auth2.json()["message"].lower()

    def test_fabricated_nonce_rejected(self, client, test_keypair):
        """Verify that a fabricated (non-existent) nonce is rejected."""
        wallet_address = str(test_keypair.pubkey())
        message = "Fake message"
        signature_b64 = _sign_message(test_keypair, message)

        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
                "nonce": "fabricated-nonce-12345",
            },
        )

        assert auth_response.status_code == 400
        assert "not found" in auth_response.json()["message"].lower()


# ---------------------------------------------------------------------------
# Nonce Expiry Tests
# ---------------------------------------------------------------------------


class TestNonceExpiry:
    """Test nonce expiration enforcement."""

    def test_expired_nonce_rejected(self, client, test_keypair):
        """Verify that an expired nonce is rejected during authentication."""
        wallet_address = str(test_keypair.pubkey())

        # Get nonce
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_data = nonce_response.json()
        message = nonce_data["message"]
        nonce = nonce_data["nonce"]
        signature_b64 = _sign_message(test_keypair, message)

        # Expire the nonce in the database
        async def _expire_nonce():
            """Force-expire the nonce for testing."""
            from app.models.wallet_session import WalletNonceDB
            from sqlalchemy import update

            async with async_session_factory() as session:
                await session.execute(
                    update(WalletNonceDB)
                    .where(WalletNonceDB.nonce == nonce)
                    .values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=10))
                )
                await session.commit()

        asyncio.get_event_loop().run_until_complete(_expire_nonce())

        # Try to authenticate with expired nonce
        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
                "nonce": nonce,
            },
        )

        assert auth_response.status_code == 400
        assert "expired" in auth_response.json()["message"].lower()


# ---------------------------------------------------------------------------
# Token Refresh Tests
# ---------------------------------------------------------------------------


class TestTokenRefresh:
    """Test token refresh flow (without re-signing)."""

    def _authenticate(self, client, keypair):
        """Helper to complete a full SIWS auth and return tokens.

        Args:
            client: The test client.
            keypair: The Solana keypair to authenticate with.

        Returns:
            Dictionary with auth response data.
        """
        wallet_address = str(keypair.pubkey())
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_data = nonce_response.json()
        signature_b64 = _sign_message(keypair, nonce_data["message"])

        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": nonce_data["message"],
                "nonce": nonce_data["nonce"],
            },
        )
        assert auth_response.status_code == 200
        return auth_response.json()

    def test_refresh_token_success(self, client, test_keypair):
        """Verify that a valid refresh token produces a new access token."""
        auth_data = self._authenticate(client, test_keypair)
        refresh_token = auth_data["refresh_token"]

        refresh_response = client.post(
            "/api/auth/siws/refresh",
            json={"refresh_token": refresh_token},
        )

        assert refresh_response.status_code == 200
        refresh_data = refresh_response.json()
        assert "access_token" in refresh_data
        assert refresh_data["token_type"] == "bearer"
        assert refresh_data["expires_in"] == 86400
        assert "session_id" in refresh_data

    def test_refresh_token_invalid(self, client):
        """Verify that an invalid refresh token is rejected."""
        refresh_response = client.post(
            "/api/auth/siws/refresh",
            json={"refresh_token": "invalid-token-value"},
        )

        assert refresh_response.status_code == 401

    def test_refresh_token_new_access_works(self, client, test_keypair):
        """Verify that the new access token from refresh is functional."""
        auth_data = self._authenticate(client, test_keypair)

        # Refresh
        refresh_response = client.post(
            "/api/auth/siws/refresh",
            json={"refresh_token": auth_data["refresh_token"]},
        )
        assert refresh_response.status_code == 200
        new_access_token = refresh_response.json()["access_token"]

        # Use new token to list sessions
        sessions_response = client.get(
            "/api/auth/siws/sessions",
            headers={"Authorization": f"Bearer {new_access_token}"},
        )
        assert sessions_response.status_code == 200


# ---------------------------------------------------------------------------
# Session Management Tests
# ---------------------------------------------------------------------------


class TestSessionManagement:
    """Test session listing, revocation, and global logout."""

    def _authenticate(self, client, keypair):
        """Helper to complete full SIWS auth."""
        wallet_address = str(keypair.pubkey())
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_data = nonce_response.json()
        signature_b64 = _sign_message(keypair, nonce_data["message"])

        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": nonce_data["message"],
                "nonce": nonce_data["nonce"],
            },
        )
        assert auth_response.status_code == 200
        return auth_response.json()

    def test_list_active_sessions(self, client, test_keypair):
        """Verify that active sessions are listed correctly."""
        auth_data = self._authenticate(client, test_keypair)
        access_token = auth_data["access_token"]

        sessions_response = client.get(
            "/api/auth/siws/sessions",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert sessions_response.status_code == 200
        sessions_data = sessions_response.json()
        assert sessions_data["total"] >= 1
        assert len(sessions_data["sessions"]) >= 1

        session = sessions_data["sessions"][0]
        assert "session_id" in session
        assert "created_at" in session
        assert "wallet_type" in session

    def test_revoke_session(self, client, test_keypair):
        """Verify that a specific session can be revoked."""
        auth_data = self._authenticate(client, test_keypair)
        access_token = auth_data["access_token"]
        session_id = auth_data["session_id"]

        revoke_response = client.post(
            "/api/auth/siws/revoke",
            json={"session_id": session_id},
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert revoke_response.status_code == 200
        assert revoke_response.json()["success"] is True

    def test_revoke_all_sessions(self, client, test_keypair):
        """Verify that all sessions for a wallet can be revoked."""
        # Create multiple sessions
        auth_data1 = self._authenticate(client, test_keypair)
        auth_data2 = self._authenticate(client, test_keypair)

        access_token = auth_data2["access_token"]

        revoke_response = client.post(
            "/api/auth/siws/revoke-all",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        assert revoke_response.status_code == 200
        result = revoke_response.json()
        assert result["success"] is True
        assert result["revoked_count"] >= 2

    def test_list_sessions_unauthenticated(self, client):
        """Verify that listing sessions requires authentication."""
        response = client.get("/api/auth/siws/sessions")
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Rate Limiting Tests
# ---------------------------------------------------------------------------


class TestRateLimiting:
    """Test sign-in rate limiting (5 attempts per wallet per minute)."""

    def test_rate_limit_exceeded(self, client, test_keypair):
        """Verify that exceeding 5 sign-in attempts triggers rate limiting."""
        wallet_address = str(test_keypair.pubkey())

        # Make 5 failed attempts (use fabricated nonces that won't exist)
        for attempt_index in range(5):
            client.post(
                "/api/auth/siws/authenticate",
                json={
                    "wallet_address": wallet_address,
                    "signature": base64.b64encode(b"\x00" * 64).decode(),
                    "message": "fake message",
                    "nonce": f"fake-nonce-{attempt_index}",
                },
            )

        # 6th attempt should be rate limited
        response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": base64.b64encode(b"\x00" * 64).decode(),
                "message": "fake message",
                "nonce": "fake-nonce-final",
            },
        )

        assert response.status_code == 429
        assert "too many" in response.json()["message"].lower()

    def test_rate_limit_unit_check(self):
        """Test the rate limiter unit directly with 5 calls."""
        limiter = siws_service.WalletRateLimiter(max_attempts=3, window_seconds=60)
        wallet = "TestWallet123456789012345678901234"

        # 3 attempts should be fine
        limiter.check_rate_limit(wallet)
        limiter.check_rate_limit(wallet)
        limiter.check_rate_limit(wallet)

        # 4th should raise
        with pytest.raises(RateLimitExceededError):
            limiter.check_rate_limit(wallet)

    def test_rate_limit_resets_after_window(self):
        """Test that the rate limit resets after the window expires."""
        limiter = siws_service.WalletRateLimiter(max_attempts=2, window_seconds=1)
        wallet = "TestWallet123456789012345678901234"

        limiter.check_rate_limit(wallet)
        limiter.check_rate_limit(wallet)

        # Should be at limit
        with pytest.raises(RateLimitExceededError):
            limiter.check_rate_limit(wallet)

        # Wait for window to expire
        time.sleep(1.1)

        # Should work again
        limiter.check_rate_limit(wallet)

    def test_rate_limit_per_wallet_isolation(self):
        """Verify that rate limits are tracked per-wallet, not globally."""
        limiter = siws_service.WalletRateLimiter(max_attempts=2, window_seconds=60)
        wallet1 = "Wallet1_123456789012345678901234"
        wallet2 = "Wallet2_123456789012345678901234"

        limiter.check_rate_limit(wallet1)
        limiter.check_rate_limit(wallet1)

        # wallet1 is at limit
        with pytest.raises(RateLimitExceededError):
            limiter.check_rate_limit(wallet1)

        # wallet2 should still be fine
        limiter.check_rate_limit(wallet2)


# ---------------------------------------------------------------------------
# JWT Token Tests
# ---------------------------------------------------------------------------


class TestSIWSTokens:
    """Test SIWS JWT token creation and decoding."""

    def test_create_access_token(self):
        """Verify access token creation includes required claims."""
        token, jti = create_siws_access_token("test_wallet", "test_user_id")
        assert token is not None
        assert jti is not None

        claims = decode_siws_token(token, expected_type="access")
        assert claims["sub"] == "test_user_id"
        assert claims["wallet"] == "test_wallet"
        assert claims["type"] == "access"
        assert claims["auth_method"] == "siws"

    def test_create_refresh_token(self):
        """Verify refresh token creation includes required claims."""
        token, jti = create_siws_refresh_token("test_wallet", "test_user_id")
        assert token is not None

        claims = decode_siws_token(token, expected_type="refresh")
        assert claims["sub"] == "test_user_id"
        assert claims["type"] == "refresh"
        assert claims["auth_method"] == "siws"

    def test_access_token_24h_expiry(self):
        """Verify that the access token has a 24-hour expiry."""
        token, _ = create_siws_access_token("wallet", "user")
        claims = decode_siws_token(token, expected_type="access")

        issued_at = datetime.fromtimestamp(claims["iat"], tz=timezone.utc)
        expires_at = datetime.fromtimestamp(claims["exp"], tz=timezone.utc)
        delta = expires_at - issued_at

        assert abs(delta.total_seconds() - 86400) < 5  # 24 hours +/- 5s

    def test_refresh_token_7d_expiry(self):
        """Verify that the refresh token has a 7-day expiry."""
        token, _ = create_siws_refresh_token("wallet", "user")
        claims = decode_siws_token(token, expected_type="refresh")

        issued_at = datetime.fromtimestamp(claims["iat"], tz=timezone.utc)
        expires_at = datetime.fromtimestamp(claims["exp"], tz=timezone.utc)
        delta = expires_at - issued_at

        assert abs(delta.total_seconds() - 604800) < 5  # 7 days +/- 5s

    def test_decode_wrong_token_type(self):
        """Verify decoding with wrong expected type raises an error."""
        from app.services.siws_service import InvalidRefreshTokenError

        access_token, _ = create_siws_access_token("wallet", "user")
        with pytest.raises(InvalidRefreshTokenError):
            decode_siws_token(access_token, expected_type="refresh")

    def test_decode_expired_token(self):
        """Verify that an expired token raises SessionExpiredError."""
        from app.services.siws_service import SessionExpiredError

        token, _ = create_siws_access_token(
            "wallet", "user",
            expires_delta=timedelta(seconds=-1),
        )
        with pytest.raises(SessionExpiredError):
            decode_siws_token(token, expected_type="access")

    def test_decode_invalid_token(self):
        """Verify that a malformed token raises InvalidRefreshTokenError."""
        from app.services.siws_service import InvalidRefreshTokenError

        with pytest.raises(InvalidRefreshTokenError):
            decode_siws_token("not.a.valid.jwt", expected_type="access")


# ---------------------------------------------------------------------------
# Token Hashing Tests
# ---------------------------------------------------------------------------


class TestTokenHashing:
    """Test secure token hashing for database storage."""

    def test_hash_deterministic(self):
        """Verify that the same token always produces the same hash."""
        token = "test-token-value"
        hash1 = _hash_token(token)
        hash2 = _hash_token(token)
        assert hash1 == hash2

    def test_hash_different_tokens(self):
        """Verify that different tokens produce different hashes."""
        hash1 = _hash_token("token-one")
        hash2 = _hash_token("token-two")
        assert hash1 != hash2

    def test_hash_is_hex_string(self):
        """Verify that the hash is a valid hex string of expected length."""
        token_hash = _hash_token("test")
        assert len(token_hash) == 64  # SHA-256 = 64 hex chars
        assert all(c in "0123456789abcdef" for c in token_hash)


# ---------------------------------------------------------------------------
# Wallet Type Detection Tests
# ---------------------------------------------------------------------------


class TestWalletTypeDetection:
    """Test wallet provider detection from User-Agent."""

    def test_detect_phantom(self):
        """Verify Phantom wallet detection."""
        assert detect_wallet_type("Mozilla/5.0 Phantom/24.5") == "phantom"

    def test_detect_solflare(self):
        """Verify Solflare wallet detection."""
        assert detect_wallet_type("Mozilla/5.0 Solflare/1.0") == "solflare"

    def test_detect_backpack(self):
        """Verify Backpack wallet detection."""
        assert detect_wallet_type("Mozilla/5.0 Backpack/0.5") == "backpack"

    def test_detect_unknown(self):
        """Verify fallback to 'unknown' for unrecognized User-Agents."""
        assert detect_wallet_type("Mozilla/5.0 Chrome/120") == "unknown"

    def test_detect_none_user_agent(self):
        """Verify 'unknown' is returned when User-Agent is None."""
        assert detect_wallet_type(None) == "unknown"


# ---------------------------------------------------------------------------
# require_wallet_auth Middleware Tests
# ---------------------------------------------------------------------------


class TestRequireWalletAuth:
    """Test the require_wallet_auth dependency for protected endpoints."""

    def _authenticate(self, client, keypair):
        """Helper for full SIWS auth."""
        wallet_address = str(keypair.pubkey())
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_data = nonce_response.json()
        signature_b64 = _sign_message(keypair, nonce_data["message"])

        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": nonce_data["message"],
                "nonce": nonce_data["nonce"],
            },
        )
        assert auth_response.status_code == 200
        return auth_response.json()

    def test_protected_endpoint_with_valid_token(self, client, test_keypair):
        """Verify that a valid SIWS token grants access to protected endpoints."""
        auth_data = self._authenticate(client, test_keypair)
        access_token = auth_data["access_token"]

        response = client.get(
            "/api/auth/siws/sessions",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert response.status_code == 200

    def test_protected_endpoint_without_token(self, client):
        """Verify that protected endpoints reject requests without a token."""
        response = client.get("/api/auth/siws/sessions")
        assert response.status_code == 401
        assert "Missing wallet authentication token" in response.json()["message"]

    def test_protected_endpoint_with_invalid_token(self, client):
        """Verify that protected endpoints reject invalid tokens."""
        response = client.get(
            "/api/auth/siws/sessions",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Session Expiry Tests
# ---------------------------------------------------------------------------


class TestSessionExpiry:
    """Test session expiration enforcement."""

    def test_session_expiry_configuration(self):
        """Verify session expiry defaults match the spec (24h access, 7d refresh)."""
        assert siws_service.SIWS_SESSION_EXPIRY_HOURS == 24
        assert siws_service.SIWS_REFRESH_EXPIRY_DAYS == 7

    def test_nonce_expiry_configuration(self):
        """Verify nonce expiry default is 5 minutes."""
        assert siws_service.SIWS_NONCE_EXPIRY_MINUTES == 5


# ---------------------------------------------------------------------------
# Database Persistence Tests
# ---------------------------------------------------------------------------


class TestDatabasePersistence:
    """Test that nonces and sessions are persisted in PostgreSQL."""

    def test_nonce_persisted_in_database(self, client, test_keypair):
        """Verify that a generated nonce is stored in the database."""
        wallet_address = str(test_keypair.pubkey())
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_value = nonce_response.json()["nonce"]

        async def _check_nonce():
            """Verify nonce exists in the database."""
            from app.models.wallet_session import WalletNonceDB
            from sqlalchemy import select

            async with async_session_factory() as session:
                result = await session.execute(
                    select(WalletNonceDB).where(WalletNonceDB.nonce == nonce_value)
                )
                nonce_record = result.scalar_one_or_none()
                assert nonce_record is not None
                assert nonce_record.wallet_address == wallet_address.lower()
                assert nonce_record.used is False

        asyncio.get_event_loop().run_until_complete(_check_nonce())

    def test_session_persisted_in_database(self, client, test_keypair):
        """Verify that an authenticated session is stored in the database."""
        wallet_address = str(test_keypair.pubkey())

        # Authenticate
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_data = nonce_response.json()
        signature_b64 = _sign_message(test_keypair, nonce_data["message"])

        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": nonce_data["message"],
                "nonce": nonce_data["nonce"],
            },
        )
        session_id = auth_response.json()["session_id"]

        async def _check_session():
            """Verify session exists in the database."""
            from app.models.wallet_session import WalletSessionDB
            from sqlalchemy import select
            import uuid

            async with async_session_factory() as session:
                result = await session.execute(
                    select(WalletSessionDB).where(
                        WalletSessionDB.id == uuid.UUID(session_id)
                    )
                )
                session_record = result.scalar_one_or_none()
                assert session_record is not None
                assert session_record.wallet_address == wallet_address.lower()
                assert session_record.revoked is False
                assert session_record.token_hash is not None
                assert session_record.refresh_token_hash is not None

        asyncio.get_event_loop().run_until_complete(_check_session())

    def test_nonce_marked_used_after_auth(self, client, test_keypair):
        """Verify that a nonce is marked as used after successful authentication."""
        wallet_address = str(test_keypair.pubkey())

        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        nonce_data = nonce_response.json()
        nonce_value = nonce_data["nonce"]
        signature_b64 = _sign_message(test_keypair, nonce_data["message"])

        # Authenticate (consumes the nonce)
        client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": nonce_data["message"],
                "nonce": nonce_value,
            },
        )

        async def _check_nonce_used():
            """Verify nonce is marked as used."""
            from app.models.wallet_session import WalletNonceDB
            from sqlalchemy import select

            async with async_session_factory() as session:
                result = await session.execute(
                    select(WalletNonceDB).where(WalletNonceDB.nonce == nonce_value)
                )
                nonce_record = result.scalar_one_or_none()
                assert nonce_record is not None
                assert nonce_record.used is True
                assert nonce_record.used_at is not None

        asyncio.get_event_loop().run_until_complete(_check_nonce_used())


# ---------------------------------------------------------------------------
# Integration: Full Lifecycle Test
# ---------------------------------------------------------------------------


class TestFullLifecycle:
    """Test the complete SIWS session lifecycle end-to-end."""

    def test_complete_lifecycle(self, client, test_keypair):
        """Test: nonce -> authenticate -> refresh -> list sessions -> revoke.

        This integration test exercises every major operation in sequence
        to verify they work together correctly.
        """
        wallet_address = str(test_keypair.pubkey())

        # 1. Generate nonce
        nonce_response = client.post(
            f"/api/auth/siws/nonce?wallet_address={wallet_address}"
        )
        assert nonce_response.status_code == 200
        nonce_data = nonce_response.json()

        # 2. Authenticate
        signature_b64 = _sign_message(test_keypair, nonce_data["message"])
        auth_response = client.post(
            "/api/auth/siws/authenticate",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": nonce_data["message"],
                "nonce": nonce_data["nonce"],
            },
        )
        assert auth_response.status_code == 200
        auth_data = auth_response.json()
        access_token = auth_data["access_token"]
        refresh_token = auth_data["refresh_token"]
        session_id = auth_data["session_id"]

        # 3. Refresh token
        refresh_response = client.post(
            "/api/auth/siws/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_response.status_code == 200
        new_access_token = refresh_response.json()["access_token"]

        # 4. List sessions with new token
        sessions_response = client.get(
            "/api/auth/siws/sessions",
            headers={"Authorization": f"Bearer {new_access_token}"},
        )
        assert sessions_response.status_code == 200
        assert sessions_response.json()["total"] >= 1

        # 5. Revoke the session
        revoke_response = client.post(
            "/api/auth/siws/revoke",
            json={"session_id": session_id},
            headers={"Authorization": f"Bearer {new_access_token}"},
        )
        assert revoke_response.status_code == 200
        assert revoke_response.json()["success"] is True
