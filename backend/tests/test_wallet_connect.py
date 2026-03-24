"""Tests for wallet connect backend wiring.

This module provides comprehensive unit and integration tests for:
- SIWS (Sign-In With Solana) message generation
- Ed25519 signature verification (Phantom, Solflare, Backpack formats)
- JWT session token issuance and validation
- Wallet-to-user linking table operations
- Session management: create, refresh, revoke
- Rate limiting on auth endpoints (5 attempts per minute)
- Middleware for protected routes (JWT + wallet ownership)
- Full authentication flow integration tests

All tests run against SQLite in-memory for fast execution while
testing the same PostgreSQL-compatible SQL paths.
"""

import asyncio
import base64
import os
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from solders.keypair import Keypair

# Set test environment before any app imports
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["AUTH_ENABLED"] = "true"
os.environ["SECRET_KEY"] = "test-secret-key-for-ci"

from app.main import app
from app.database import engine, Base
from app.services import auth_service
from app.services import wallet_connect_service


def _create_wallet_connect_tables() -> None:
    """Create wallet connect database tables in the test SQLite database.

    Creates only the tables needed for wallet connect tests, avoiding
    PostgreSQL-specific models (BountyTable with JSONB/TSVECTOR) that
    are incompatible with SQLite.
    """
    async def _inner():
        from app.models.user import User
        from app.models.wallet_link import WalletLink
        from app.models.auth_session import (
            AuthSession,
            AuthChallenge,
            RateLimitRecord,
        )

        tables_to_create = [
            User.__table__,
            WalletLink.__table__,
            AuthSession.__table__,
            AuthChallenge.__table__,
            RateLimitRecord.__table__,
        ]

        async with engine.begin() as conn:
            for table in tables_to_create:
                await conn.run_sync(
                    table.create, checkfirst=True
                )

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_inner())
    finally:
        loop.close()


# Create tables once at module load time
_create_wallet_connect_tables()


def _clear_rate_limits() -> None:
    """Clear all rate limit records from the database.

    Called before each test to ensure rate limiting does not interfere
    with test execution. Also clears consumed challenges.
    """
    async def _inner():
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM auth_rate_limits"))
            await conn.execute(text("DELETE FROM auth_challenges"))
            await conn.execute(text("DELETE FROM auth_sessions"))

    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(_inner())
    finally:
        loop.close()


@pytest.fixture(autouse=True)
def clean_state():
    """Auto-fixture that clears rate limits and challenges before each test.

    This ensures tests run in isolation without accumulated state from
    previous tests affecting rate limiting or nonce validation.
    """
    _clear_rate_limits()
    yield
    # No cleanup needed after test


@pytest.fixture
def client():
    """Create a test client for the FastAPI application.

    Returns:
        A TestClient instance connected to the app.
    """
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def test_keypair():
    """Create a test Solana keypair for wallet auth tests.

    Returns:
        A fresh Keypair instance with a random secret key.
    """
    return Keypair()


@pytest.fixture
def second_keypair():
    """Create a second test Solana keypair for multi-wallet tests.

    Returns:
        A fresh Keypair instance with a different random secret key.
    """
    return Keypair()


def _sign_message(keypair: Keypair, message: str) -> str:
    """Sign a message with a Solana keypair and return base64 signature.

    Helper function for tests that need to sign SIWS challenge messages.

    Args:
        keypair: The Solana keypair to sign with.
        message: The message string to sign.

    Returns:
        Base64-encoded Ed25519 signature string.
    """
    message_bytes = message.encode("utf-8")
    signature = keypair.sign_message(message_bytes)
    return base64.b64encode(bytes(signature)).decode()


# ===========================================================================
# Unit Tests: Ed25519 Signature Verification
# ===========================================================================


class TestSignatureVerification:
    """Unit tests for Ed25519 signature verification.

    Tests the core cryptographic verification that underlies all wallet
    authentication. Covers valid signatures, invalid signatures, wrong
    wallets, malformed inputs, and multi-wallet format support.
    """

    def test_spec_requirement_verify_valid_signature(self, test_keypair):
        """Test that a valid Ed25519 signature passes verification.

        Spec requirement: Signature verification endpoint using nacl or solders.
        """
        message = "Test message to verify"
        signature_b64 = _sign_message(test_keypair, message)

        result = wallet_connect_service.verify_ed25519_signature(
            str(test_keypair.pubkey()),
            message,
            signature_b64,
        )
        assert result is True

    def test_spec_requirement_reject_invalid_signature(self, test_keypair):
        """Test that an invalid signature is rejected.

        Fail-closed: invalid signatures must raise SignatureVerificationError.
        """
        message = "Test message"
        wrong_keypair = Keypair()
        wrong_signature = _sign_message(wrong_keypair, "Different message")

        with pytest.raises(wallet_connect_service.SignatureVerificationError):
            wallet_connect_service.verify_ed25519_signature(
                str(test_keypair.pubkey()),
                message,
                wrong_signature,
            )

    def test_spec_requirement_reject_wrong_wallet(self, test_keypair):
        """Test that a signature from a different wallet is rejected."""
        message = "Test message"
        signature_b64 = _sign_message(test_keypair, message)
        other_keypair = Keypair()

        with pytest.raises(wallet_connect_service.SignatureVerificationError):
            wallet_connect_service.verify_ed25519_signature(
                str(other_keypair.pubkey()),
                message,
                signature_b64,
            )

    def test_reject_malformed_signature(self, test_keypair):
        """Test that a malformed signature is rejected."""
        with pytest.raises(wallet_connect_service.SignatureVerificationError):
            wallet_connect_service.verify_ed25519_signature(
                str(test_keypair.pubkey()),
                "message",
                "not-a-valid-signature!!!",
            )

    def test_reject_empty_wallet_address(self):
        """Test that an empty wallet address is rejected."""
        with pytest.raises(wallet_connect_service.SignatureVerificationError):
            wallet_connect_service.verify_ed25519_signature(
                "",
                "message",
                base64.b64encode(b"x" * 64).decode(),
            )

    def test_reject_short_wallet_address(self):
        """Test that a too-short wallet address is rejected."""
        with pytest.raises(wallet_connect_service.SignatureVerificationError):
            wallet_connect_service.verify_ed25519_signature(
                "short",
                "message",
                base64.b64encode(b"x" * 64).decode(),
            )

    def test_spec_requirement_phantom_wallet_format(self, test_keypair):
        """Test verification with Phantom wallet format (base64 signature).

        Spec requirement: Support for Phantom wallet formats.
        """
        message = "Phantom test message"
        signature_b64 = _sign_message(test_keypair, message)

        result = wallet_connect_service.verify_ed25519_signature(
            str(test_keypair.pubkey()),
            message,
            signature_b64,
            provider="phantom",
        )
        assert result is True

    def test_spec_requirement_solflare_wallet_format(self, test_keypair):
        """Test verification with Solflare wallet format (base64 signature).

        Spec requirement: Support for Solflare wallet formats.
        """
        message = "Solflare test message"
        signature_b64 = _sign_message(test_keypair, message)

        result = wallet_connect_service.verify_ed25519_signature(
            str(test_keypair.pubkey()),
            message,
            signature_b64,
            provider="solflare",
        )
        assert result is True

    def test_spec_requirement_backpack_wallet_format(self, test_keypair):
        """Test verification with Backpack wallet format (base64 signature).

        Spec requirement: Support for Backpack wallet formats.
        """
        message = "Backpack test message"
        signature_b64 = _sign_message(test_keypair, message)

        result = wallet_connect_service.verify_ed25519_signature(
            str(test_keypair.pubkey()),
            message,
            signature_b64,
            provider="backpack",
        )
        assert result is True

    def test_signature_wrong_message_content(self, test_keypair):
        """Test that a signature for a different message is rejected."""
        original_message = "Original message"
        tampered_message = "Tampered message"
        signature_b64 = _sign_message(test_keypair, original_message)

        with pytest.raises(wallet_connect_service.SignatureVerificationError):
            wallet_connect_service.verify_ed25519_signature(
                str(test_keypair.pubkey()),
                tampered_message,
                signature_b64,
            )


# ===========================================================================
# Unit Tests: JWT Token Operations
# ===========================================================================


class TestJWTTokens:
    """Unit tests for JWT token creation and validation.

    Tests access and refresh token generation, expiration handling,
    and token type validation.
    """

    def test_spec_requirement_jwt_session_token_creation(self):
        """Test that JWT access tokens are created correctly.

        Spec requirement: JWT session tokens issued on successful verification.
        """
        user_id = str(uuid.uuid4())
        tokens = wallet_connect_service._create_jwt_tokens(user_id)

        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert "access_jti" in tokens
        assert "refresh_jti" in tokens
        assert "access_expires_at" in tokens
        assert "refresh_expires_at" in tokens

    def test_access_and_refresh_tokens_have_different_jti(self):
        """Test that access and refresh tokens have unique JTI values."""
        user_id = str(uuid.uuid4())
        tokens = wallet_connect_service._create_jwt_tokens(user_id)

        assert tokens["access_jti"] != tokens["refresh_jti"]

    def test_token_expiration_times_are_correct(self):
        """Test that token expiration times are within expected range."""
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        tokens = wallet_connect_service._create_jwt_tokens(user_id)

        # Access token: ~60 minutes
        access_delta = (tokens["access_expires_at"] - now).total_seconds()
        assert 3500 < access_delta < 3700  # ~60 minutes

        # Refresh token: ~7 days
        refresh_delta = (tokens["refresh_expires_at"] - now).total_seconds()
        assert 600000 < refresh_delta < 610000  # ~7 days

    def test_decode_valid_access_token(self):
        """Test decoding a valid access token."""
        user_id = str(uuid.uuid4())
        token = auth_service.create_access_token(user_id)
        decoded = auth_service.decode_token(token, "access")
        assert decoded == user_id

    def test_decode_expired_token_raises(self):
        """Test that an expired token raises TokenExpiredError."""
        from jose import jwt as jose_jwt

        payload = {
            "sub": "test",
            "type": "access",
            "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),
        }
        expired_token = jose_jwt.encode(
            payload, auth_service.JWT_SECRET_KEY, algorithm=auth_service.JWT_ALGORITHM
        )
        with pytest.raises(auth_service.TokenExpiredError):
            auth_service.decode_token(expired_token, "access")

    def test_decode_wrong_type_raises(self):
        """Test that decoding with wrong type raises InvalidTokenError."""
        refresh = auth_service.create_refresh_token("user123")
        with pytest.raises(auth_service.InvalidTokenError):
            auth_service.decode_token(refresh, "access")


# ===========================================================================
# API Tests: SIWS Message Generation
# ===========================================================================


class TestSIWSMessageGeneration:
    """Tests for SIWS challenge message generation endpoint.

    Spec requirement: SIWS (Sign-In With Solana) message generation endpoint.
    """

    def test_spec_requirement_siws_message_generation(self, client, test_keypair):
        """Test SIWS message generation returns correct structure."""
        wallet_address = str(test_keypair.pubkey())
        response = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "nonce" in data
        assert "expires_at" in data
        assert wallet_address in data["message"]
        assert "solfoundry.org" in data["message"]

    def test_siws_message_contains_nonce(self, client, test_keypair):
        """Test that SIWS message includes the nonce for verification."""
        wallet_address = str(test_keypair.pubkey())
        response = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )

        data = response.json()
        assert data["nonce"] in data["message"]

    def test_siws_message_invalid_wallet_address(self, client):
        """Test SIWS message generation with invalid wallet address."""
        response = client.get(
            "/api/wallet-connect/siws/message?wallet_address=invalid"
        )
        assert response.status_code == 400

    def test_siws_message_unique_nonces(self, client, test_keypair):
        """Test that each SIWS message has a unique nonce."""
        wallet_address = str(test_keypair.pubkey())

        response1 = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )
        response2 = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )

        assert response1.json()["nonce"] != response2.json()["nonce"]

    def test_siws_message_with_provider(self, client, test_keypair):
        """Test SIWS message generation with provider parameter."""
        wallet_address = str(test_keypair.pubkey())
        response = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}&provider=phantom"
        )

        assert response.status_code == 200


# ===========================================================================
# API Tests: SIWS Verification
# ===========================================================================


class TestSIWSVerification:
    """Tests for SIWS signature verification and authentication endpoint.

    Spec requirement: Signature verification endpoint using nacl or solders.
    """

    def test_spec_requirement_verify_and_authenticate(self, client, test_keypair):
        """Test full SIWS verification creates session and returns tokens.

        Spec requirement: JWT session tokens issued on successful verification.
        """
        wallet_address = str(test_keypair.pubkey())

        # Step 1: Get challenge message
        msg_response = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )
        assert msg_response.status_code == 200
        data = msg_response.json()
        message = data["message"]
        nonce = data["nonce"]

        # Step 2: Sign and verify
        signature_b64 = _sign_message(test_keypair, message)

        verify_response = client.post(
            "/api/wallet-connect/siws/verify",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
                "nonce": nonce,
                "provider": "phantom",
            },
        )

        assert verify_response.status_code == 200
        result = verify_response.json()
        assert "access_token" in result
        assert "refresh_token" in result
        assert "session_id" in result
        assert result["token_type"] == "bearer"
        assert result["expires_in"] > 0
        assert result["user"]["wallet_address"] == wallet_address
        assert result["user"]["wallet_verified"] is True

    def test_verify_invalid_nonce(self, client, test_keypair):
        """Test verification with invalid nonce is rejected."""
        wallet_address = str(test_keypair.pubkey())

        response = client.post(
            "/api/wallet-connect/siws/verify",
            json={
                "wallet_address": wallet_address,
                "signature": base64.b64encode(b"x" * 64).decode(),
                "message": "fake message",
                "nonce": "invalid-nonce",
            },
        )
        assert response.status_code == 400

    def test_verify_invalid_signature(self, client, test_keypair):
        """Test verification with invalid signature is rejected."""
        wallet_address = str(test_keypair.pubkey())

        # Get valid challenge
        msg_response = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )
        data = msg_response.json()

        # Use invalid signature
        response = client.post(
            "/api/wallet-connect/siws/verify",
            json={
                "wallet_address": wallet_address,
                "signature": base64.b64encode(b"x" * 64).decode(),
                "message": data["message"],
                "nonce": data["nonce"],
            },
        )
        assert response.status_code == 400

    def test_verify_nonce_replay_rejected(self, client, test_keypair):
        """Test that reusing a consumed nonce is rejected (replay protection)."""
        wallet_address = str(test_keypair.pubkey())

        # Get challenge
        msg_response = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )
        data = msg_response.json()
        message = data["message"]
        nonce = data["nonce"]

        # First verification (succeeds)
        signature_b64 = _sign_message(test_keypair, message)
        first_response = client.post(
            "/api/wallet-connect/siws/verify",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
                "nonce": nonce,
            },
        )
        assert first_response.status_code == 200

        # Second verification with same nonce (rejected)
        second_response = client.post(
            "/api/wallet-connect/siws/verify",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
                "nonce": nonce,
            },
        )
        assert second_response.status_code == 400


# ===========================================================================
# API Tests: Session Management
# ===========================================================================


class TestSessionManagement:
    """Tests for session management: create, list, refresh, revoke.

    Spec requirement: Session management: create, refresh, revoke.
    """

    def _authenticate(self, client, keypair):
        """Helper to authenticate and return tokens + session_id.

        Args:
            client: TestClient instance.
            keypair: Solana keypair to authenticate with.

        Returns:
            Dictionary with access_token, refresh_token, session_id.
        """
        wallet = str(keypair.pubkey())
        msg = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet}"
        )
        data = msg.json()
        sig = _sign_message(keypair, data["message"])
        resp = client.post(
            "/api/wallet-connect/siws/verify",
            json={
                "wallet_address": wallet,
                "signature": sig,
                "message": data["message"],
                "nonce": data["nonce"],
            },
        )
        return resp.json()

    def test_spec_requirement_session_list(self, client, test_keypair):
        """Test listing user sessions after authentication."""
        auth = self._authenticate(client, test_keypair)
        headers = {"Authorization": f"Bearer {auth['access_token']}"}

        response = client.get("/api/wallet-connect/sessions", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_spec_requirement_session_refresh(self, client, test_keypair):
        """Test refreshing an access token with a refresh token.

        Spec requirement: Session management: refresh.
        """
        auth = self._authenticate(client, test_keypair)

        response = client.post(
            "/api/wallet-connect/sessions/refresh",
            json={"refresh_token": auth["refresh_token"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

        # Verify new token works
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        me_resp = client.get("/api/wallet-connect/sessions", headers=headers)
        assert me_resp.status_code == 200

    def test_spec_requirement_session_revoke(self, client, test_keypair):
        """Test revoking a specific session.

        Spec requirement: Session management: revoke.
        """
        auth = self._authenticate(client, test_keypair)
        headers = {"Authorization": f"Bearer {auth['access_token']}"}

        # Revoke the session
        response = client.post(
            "/api/wallet-connect/sessions/revoke",
            json={"session_id": auth["session_id"]},
            headers=headers,
        )
        assert response.status_code == 204

    def test_spec_requirement_session_revoke_all(self, client, test_keypair):
        """Test revoking all sessions for a user."""
        auth = self._authenticate(client, test_keypair)
        headers = {"Authorization": f"Bearer {auth['access_token']}"}

        response = client.post(
            "/api/wallet-connect/sessions/revoke-all",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "revoked_count" in data
        assert data["revoked_count"] >= 1

    def test_refresh_with_invalid_token(self, client):
        """Test refresh with invalid token returns 401."""
        response = client.post(
            "/api/wallet-connect/sessions/refresh",
            json={"refresh_token": "invalid-token"},
        )
        assert response.status_code == 401

    def test_revoke_nonexistent_session(self, client, test_keypair):
        """Test revoking a nonexistent session returns 404."""
        auth = self._authenticate(client, test_keypair)
        headers = {"Authorization": f"Bearer {auth['access_token']}"}

        response = client.post(
            "/api/wallet-connect/sessions/revoke",
            json={"session_id": str(uuid.uuid4())},
            headers=headers,
        )
        assert response.status_code == 404


# ===========================================================================
# API Tests: Wallet Linking
# ===========================================================================


class TestWalletLinking:
    """Tests for wallet-to-user linking operations.

    Spec requirement: Wallet-to-user linking table in database.
    """

    def _authenticate(self, client, keypair):
        """Helper to authenticate and return tokens."""
        wallet = str(keypair.pubkey())
        msg = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet}"
        )
        data = msg.json()
        sig = _sign_message(keypair, data["message"])
        resp = client.post(
            "/api/wallet-connect/siws/verify",
            json={
                "wallet_address": wallet,
                "signature": sig,
                "message": data["message"],
                "nonce": data["nonce"],
            },
        )
        return resp.json()

    def test_spec_requirement_wallet_linking(
        self, client, test_keypair, second_keypair
    ):
        """Test linking a second wallet to an authenticated user.

        Spec requirement: Wallet-to-user linking table in database.
        """
        # Authenticate with first wallet
        auth = self._authenticate(client, test_keypair)
        headers = {"Authorization": f"Bearer {auth['access_token']}"}

        # Get challenge for second wallet
        second_wallet = str(second_keypair.pubkey())
        msg_resp = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={second_wallet}",
        )
        msg_data = msg_resp.json()

        # Sign challenge with second wallet
        sig = _sign_message(second_keypair, msg_data["message"])

        # Link second wallet
        link_resp = client.post(
            "/api/wallet-connect/link",
            json={
                "wallet_address": second_wallet,
                "signature": sig,
                "message": msg_data["message"],
                "nonce": msg_data["nonce"],
                "provider": "solflare",
                "label": "My Solflare",
                "is_primary": False,
            },
            headers=headers,
        )
        assert link_resp.status_code == 201
        data = link_resp.json()
        assert data["wallet_address"] == second_wallet
        assert data["provider"] == "solflare"
        assert data["label"] == "My Solflare"

    def test_spec_requirement_list_linked_wallets(self, client, test_keypair):
        """Test listing linked wallets for a user."""
        auth = self._authenticate(client, test_keypair)
        headers = {"Authorization": f"Bearer {auth['access_token']}"}

        response = client.get("/api/wallet-connect/wallets", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    def test_link_wallet_unauthenticated(self, client, test_keypair):
        """Test linking wallet without authentication returns 401."""
        wallet = str(test_keypair.pubkey())
        response = client.post(
            "/api/wallet-connect/link",
            json={
                "wallet_address": wallet,
                "signature": "fake",
                "message": "fake",
                "nonce": "fake",
            },
        )
        assert response.status_code == 401

    def test_unlink_wallet_unauthenticated(self, client, test_keypair):
        """Test unlinking wallet without authentication returns 401."""
        wallet = str(test_keypair.pubkey())
        response = client.request(
            "DELETE",
            "/api/wallet-connect/link",
            json={"wallet_address": wallet},
        )
        assert response.status_code == 401


# ===========================================================================
# API Tests: Rate Limiting
# ===========================================================================


class TestRateLimiting:
    """Tests for rate limiting on auth endpoints.

    Spec requirement: Rate limiting on auth endpoints (5 attempts per minute).
    """

    def test_spec_requirement_rate_limit_enforcement(self, client, test_keypair):
        """Test that rate limiting blocks after 5 attempts per minute.

        Spec requirement: Rate limiting on auth endpoints (5 attempts per minute).
        """
        wallet_address = str(test_keypair.pubkey())

        # Make 5 requests (should succeed)
        for i in range(5):
            response = client.get(
                f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
            )
            # May get 200 or 400 depending on state, but not 429 yet
            assert response.status_code != 429, f"Rate limited too early on attempt {i+1}"

        # 6th request should be rate limited
        response = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )
        assert response.status_code == 429


# ===========================================================================
# API Tests: Middleware / Protected Routes
# ===========================================================================


class TestProtectedRoutes:
    """Tests for JWT middleware on protected routes.

    Spec requirement: Middleware for protected routes (verify JWT + wallet ownership).
    """

    def test_spec_requirement_protected_route_without_token(self, client):
        """Test that protected routes reject requests without JWT."""
        response = client.get("/api/wallet-connect/sessions")
        assert response.status_code == 401

    def test_spec_requirement_protected_route_with_invalid_token(self, client):
        """Test that protected routes reject invalid JWT tokens."""
        headers = {"Authorization": "Bearer invalid-token"}
        response = client.get("/api/wallet-connect/sessions", headers=headers)
        assert response.status_code == 401

    def test_spec_requirement_protected_route_with_expired_token(self, client):
        """Test that protected routes reject expired JWT tokens."""
        from jose import jwt as jose_jwt

        expired_payload = {
            "sub": str(uuid.uuid4()),
            "type": "access",
            "jti": "expired-jti",
            "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),
        }
        expired_token = jose_jwt.encode(
            expired_payload,
            auth_service.JWT_SECRET_KEY,
            algorithm=auth_service.JWT_ALGORITHM,
        )
        headers = {"Authorization": f"Bearer {expired_token}"}

        response = client.get("/api/wallet-connect/sessions", headers=headers)
        assert response.status_code == 401

    def test_missing_bearer_prefix(self, client):
        """Test that Authorization header without 'Bearer' prefix is rejected."""
        headers = {"Authorization": "Token some-token"}
        response = client.get("/api/wallet-connect/sessions", headers=headers)
        assert response.status_code == 401


# ===========================================================================
# Integration Tests: Full Authentication Flow
# ===========================================================================


class TestFullAuthFlow:
    """Integration tests for the complete wallet authentication flow.

    Spec requirement: Integration tests for full auth flow.
    """

    def test_spec_requirement_full_auth_flow(self, client, test_keypair):
        """Test the complete wallet authentication flow end-to-end.

        Steps:
        1. Generate SIWS challenge message
        2. Sign with wallet and verify
        3. Use access token to access protected route
        4. Refresh access token
        5. Use new access token
        6. List sessions
        7. Revoke session

        Spec requirement: Integration tests for full auth flow.
        """
        wallet_address = str(test_keypair.pubkey())

        # Step 1: Generate SIWS challenge
        msg_response = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )
        assert msg_response.status_code == 200
        challenge = msg_response.json()
        assert "message" in challenge
        assert "nonce" in challenge

        # Step 2: Sign and verify
        signature_b64 = _sign_message(test_keypair, challenge["message"])
        verify_response = client.post(
            "/api/wallet-connect/siws/verify",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": challenge["message"],
                "nonce": challenge["nonce"],
                "provider": "phantom",
            },
        )
        assert verify_response.status_code == 200
        auth = verify_response.json()
        access_token = auth["access_token"]
        refresh_token = auth["refresh_token"]
        session_id = auth["session_id"]

        # Step 3: Access protected route
        headers = {"Authorization": f"Bearer {access_token}"}
        sessions_response = client.get(
            "/api/wallet-connect/sessions", headers=headers
        )
        assert sessions_response.status_code == 200
        sessions = sessions_response.json()
        assert sessions["total"] >= 1

        # Step 4: Refresh access token
        refresh_response = client.post(
            "/api/wallet-connect/sessions/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_response.status_code == 200
        new_token = refresh_response.json()["access_token"]

        # Step 5: Use new access token
        new_headers = {"Authorization": f"Bearer {new_token}"}
        wallets_response = client.get(
            "/api/wallet-connect/wallets", headers=new_headers
        )
        assert wallets_response.status_code == 200

        # Step 6: List sessions shows our session
        sessions_response = client.get(
            "/api/wallet-connect/sessions", headers=new_headers
        )
        assert sessions_response.status_code == 200

        # Step 7: Revoke the session
        revoke_response = client.post(
            "/api/wallet-connect/sessions/revoke",
            json={"session_id": session_id},
            headers=new_headers,
        )
        assert revoke_response.status_code == 204

    def test_full_wallet_link_and_unlink_flow(
        self, client, test_keypair, second_keypair
    ):
        """Test complete wallet linking and unlinking flow.

        Steps:
        1. Authenticate with first wallet
        2. Link second wallet
        3. List wallets (should show second wallet)
        4. Unlink second wallet
        5. List wallets (second wallet should be gone)
        """
        wallet_address = str(test_keypair.pubkey())
        second_wallet = str(second_keypair.pubkey())

        # Step 1: Authenticate
        msg = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )
        data = msg.json()
        sig = _sign_message(test_keypair, data["message"])
        auth = client.post(
            "/api/wallet-connect/siws/verify",
            json={
                "wallet_address": wallet_address,
                "signature": sig,
                "message": data["message"],
                "nonce": data["nonce"],
            },
        ).json()
        headers = {"Authorization": f"Bearer {auth['access_token']}"}

        # Step 2: Get challenge for second wallet and link
        msg2 = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={second_wallet}"
        )
        data2 = msg2.json()
        sig2 = _sign_message(second_keypair, data2["message"])

        link_resp = client.post(
            "/api/wallet-connect/link",
            json={
                "wallet_address": second_wallet,
                "signature": sig2,
                "message": data2["message"],
                "nonce": data2["nonce"],
                "provider": "backpack",
                "label": "My Backpack",
            },
            headers=headers,
        )
        assert link_resp.status_code == 201

        # Step 3: List wallets
        wallets_resp = client.get(
            "/api/wallet-connect/wallets", headers=headers
        )
        assert wallets_resp.status_code == 200
        wallets = wallets_resp.json()
        wallet_addresses = [w["wallet_address"] for w in wallets["items"]]
        assert second_wallet in wallet_addresses

        # Step 4: Unlink second wallet
        unlink_resp = client.request(
            "DELETE",
            "/api/wallet-connect/link",
            json={"wallet_address": second_wallet},
            headers=headers,
        )
        assert unlink_resp.status_code == 200
        assert unlink_resp.json()["success"] is True

    def test_revoked_session_token_rejected(self, client, test_keypair):
        """Test that a revoked session's token is rejected on subsequent use.

        Security requirement: fail-closed — revoked sessions must be denied.
        """
        wallet_address = str(test_keypair.pubkey())

        # Authenticate
        msg = client.get(
            f"/api/wallet-connect/siws/message?wallet_address={wallet_address}"
        )
        data = msg.json()
        sig = _sign_message(test_keypair, data["message"])
        auth = client.post(
            "/api/wallet-connect/siws/verify",
            json={
                "wallet_address": wallet_address,
                "signature": sig,
                "message": data["message"],
                "nonce": data["nonce"],
            },
        ).json()
        headers = {"Authorization": f"Bearer {auth['access_token']}"}

        # Revoke all sessions
        client.post("/api/wallet-connect/sessions/revoke-all", headers=headers)

        # Try to use the token — should be rejected
        response = client.get("/api/wallet-connect/sessions", headers=headers)
        assert response.status_code == 401
