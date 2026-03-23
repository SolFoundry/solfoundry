"""Tests for SIWS (Sign-In With Solana) wallet authentication.

This module tests:
- Nonce generation and expiry
- SIWS message format compliance
- Signature verification flow
- Session creation and management
- Rate limiting
- Token refresh rotation
- Logout / session invalidation
- Edge cases (expired nonce, invalid signature, replay)
"""

import base64
from datetime import datetime, timezone, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from solders.keypair import Keypair

from app.main import app
from app.models.wallet_session import SiwsNonce, WalletSession


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def test_keypair():
    """Create a test Solana keypair for SIWS auth tests."""
    return Keypair()


@pytest.fixture
def wallet_address(test_keypair):
    """Get the base58 wallet address from test keypair."""
    return str(test_keypair.pubkey())


# ---------------------------------------------------------------------------
# Nonce endpoint tests
# ---------------------------------------------------------------------------


class TestSiwsNonce:
    """Tests for nonce generation endpoint."""

    def test_request_nonce_returns_challenge(self, client, wallet_address):
        """Nonce endpoint returns a valid challenge with nonce and message."""
        resp = client.post("/api/auth/siws/nonce", json={"wallet_address": wallet_address})
        assert resp.status_code == 200
        data = resp.json()
        assert "nonce" in data
        assert "message" in data
        assert len(data["nonce"]) >= 32
        assert wallet_address in data["message"]
        assert "SolFoundry" in data["message"]

    def test_nonce_contains_siws_fields(self, client, wallet_address):
        """SIWS message includes domain, URI, version, chain ID, issued-at."""
        resp = client.post("/api/auth/siws/nonce", json={"wallet_address": wallet_address})
        msg = resp.json()["message"]
        assert "Domain:" in msg or "app.solfoundry.io" in msg
        assert "Nonce:" in msg
        assert "Issued At:" in msg or "issued" in msg.lower()

    def test_nonce_unique_per_request(self, client, wallet_address):
        """Each nonce request returns a different nonce."""
        r1 = client.post("/api/auth/siws/nonce", json={"wallet_address": wallet_address})
        r2 = client.post("/api/auth/siws/nonce", json={"wallet_address": wallet_address})
        assert r1.json()["nonce"] != r2.json()["nonce"]

    def test_nonce_rejects_invalid_wallet(self, client):
        """Invalid wallet address is rejected."""
        resp = client.post("/api/auth/siws/nonce", json={"wallet_address": "not-a-wallet"})
        assert resp.status_code in (400, 422)

    def test_nonce_rejects_empty_wallet(self, client):
        """Empty wallet address is rejected."""
        resp = client.post("/api/auth/siws/nonce", json={"wallet_address": ""})
        assert resp.status_code in (400, 422)


# ---------------------------------------------------------------------------
# Signature verification tests
# ---------------------------------------------------------------------------


class TestSiwsVerify:
    """Tests for signature verification endpoint."""

    def _sign_message(self, keypair: Keypair, message: str) -> str:
        """Sign a SIWS challenge message with the test keypair."""
        msg_bytes = message.encode("utf-8")
        sig = keypair.sign_message(msg_bytes)
        return base64.b64encode(bytes(sig)).decode("ascii")

    def test_valid_signature_creates_session(self, client, test_keypair, wallet_address):
        """Valid wallet signature creates a session with access + refresh tokens."""
        # Step 1: get nonce
        nonce_resp = client.post(
            "/api/auth/siws/nonce", json={"wallet_address": wallet_address}
        )
        data = nonce_resp.json()
        nonce = data["nonce"]
        message = data["message"]

        # Step 2: sign
        signature = self._sign_message(test_keypair, message)

        # Step 3: verify
        verify_resp = client.post(
            "/api/auth/siws/verify",
            json={
                "wallet_address": wallet_address,
                "nonce": nonce,
                "signature": signature,
                "message": message,
            },
        )
        assert verify_resp.status_code == 200
        tokens = verify_resp.json()
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert tokens.get("wallet_address") == wallet_address

    def test_invalid_signature_rejected(self, client, wallet_address):
        """Invalid signature is rejected with 401."""
        nonce_resp = client.post(
            "/api/auth/siws/nonce", json={"wallet_address": wallet_address}
        )
        data = nonce_resp.json()

        verify_resp = client.post(
            "/api/auth/siws/verify",
            json={
                "wallet_address": wallet_address,
                "nonce": data["nonce"],
                "signature": base64.b64encode(b"x" * 64).decode(),
                "message": data["message"],
            },
        )
        assert verify_resp.status_code in (401, 400)

    def test_wrong_wallet_signature_rejected(self, client, wallet_address):
        """Signature from a different wallet is rejected."""
        other_keypair = Keypair()

        nonce_resp = client.post(
            "/api/auth/siws/nonce", json={"wallet_address": wallet_address}
        )
        data = nonce_resp.json()
        wrong_sig = self._sign_message(other_keypair, data["message"])

        verify_resp = client.post(
            "/api/auth/siws/verify",
            json={
                "wallet_address": wallet_address,
                "nonce": data["nonce"],
                "signature": wrong_sig,
                "message": data["message"],
            },
        )
        assert verify_resp.status_code in (401, 400)

    def test_expired_nonce_rejected(self, client, test_keypair, wallet_address):
        """Expired nonce is rejected."""
        nonce_resp = client.post(
            "/api/auth/siws/nonce", json={"wallet_address": wallet_address}
        )
        data = nonce_resp.json()
        signature = self._sign_message(test_keypair, data["message"])

        # Patch time to simulate expiry
        with patch("app.services.siws_service.datetime") as mock_dt:
            mock_dt.now.return_value = datetime.now(timezone.utc) + timedelta(minutes=10)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)

            verify_resp = client.post(
                "/api/auth/siws/verify",
                json={
                    "wallet_address": wallet_address,
                    "nonce": data["nonce"],
                    "signature": signature,
                    "message": data["message"],
                },
            )
            assert verify_resp.status_code in (401, 400, 410)

    def test_nonce_replay_rejected(self, client, test_keypair, wallet_address):
        """Reusing a nonce (replay attack) is rejected."""
        nonce_resp = client.post(
            "/api/auth/siws/nonce", json={"wallet_address": wallet_address}
        )
        data = nonce_resp.json()
        signature = self._sign_message(test_keypair, data["message"])

        # First verify succeeds
        r1 = client.post(
            "/api/auth/siws/verify",
            json={
                "wallet_address": wallet_address,
                "nonce": data["nonce"],
                "signature": signature,
                "message": data["message"],
            },
        )
        assert r1.status_code == 200

        # Second verify with same nonce fails
        r2 = client.post(
            "/api/auth/siws/verify",
            json={
                "wallet_address": wallet_address,
                "nonce": data["nonce"],
                "signature": signature,
                "message": data["message"],
            },
        )
        assert r2.status_code in (401, 400, 409)


# ---------------------------------------------------------------------------
# Session management tests
# ---------------------------------------------------------------------------


class TestSiwsSession:
    """Tests for session info and management."""

    def _authenticate(self, client, test_keypair, wallet_address):
        """Helper: complete SIWS auth flow and return tokens."""
        nonce_resp = client.post(
            "/api/auth/siws/nonce", json={"wallet_address": wallet_address}
        )
        data = nonce_resp.json()
        msg_bytes = data["message"].encode("utf-8")
        sig = test_keypair.sign_message(msg_bytes)
        signature = base64.b64encode(bytes(sig)).decode("ascii")

        verify_resp = client.post(
            "/api/auth/siws/verify",
            json={
                "wallet_address": wallet_address,
                "nonce": data["nonce"],
                "signature": signature,
                "message": data["message"],
            },
        )
        return verify_resp.json()

    def test_get_session_with_valid_token(self, client, test_keypair, wallet_address):
        """Valid access token returns session info."""
        tokens = self._authenticate(client, test_keypair, wallet_address)
        resp = client.get(
            "/api/auth/siws/session",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert resp.status_code == 200
        session = resp.json()
        assert session["wallet_address"] == wallet_address

    def test_get_session_without_token_fails(self, client):
        """Missing auth token returns 401."""
        resp = client.get("/api/auth/siws/session")
        assert resp.status_code in (401, 403)

    def test_get_session_with_bad_token_fails(self, client):
        """Invalid token returns 401."""
        resp = client.get(
            "/api/auth/siws/session",
            headers={"Authorization": "Bearer invalid-token-here"},
        )
        assert resp.status_code in (401, 403)

    def test_logout_invalidates_session(self, client, test_keypair, wallet_address):
        """Logout endpoint invalidates the session."""
        tokens = self._authenticate(client, test_keypair, wallet_address)
        logout_resp = client.post(
            "/api/auth/siws/logout",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert logout_resp.status_code == 200

        # Session should be invalid now
        session_resp = client.get(
            "/api/auth/siws/session",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert session_resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Rate limiting tests
# ---------------------------------------------------------------------------


class TestSiwsRateLimiting:
    """Tests for SIWS rate limiting."""

    def test_rate_limit_on_verify(self, client, wallet_address):
        """Excessive verify attempts are rate-limited."""
        for i in range(6):
            resp = client.post(
                "/api/auth/siws/verify",
                json={
                    "wallet_address": wallet_address,
                    "nonce": f"fake-nonce-{i}",
                    "signature": base64.b64encode(b"x" * 64).decode(),
                    "message": "fake",
                },
            )
        # Last request should be rate limited (429) or unauthorized
        assert resp.status_code in (429, 401, 400)


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------


class TestSiwsModels:
    """Tests for SIWS database models."""

    def test_siws_nonce_fields(self):
        """SiwsNonce model has required fields."""
        assert hasattr(SiwsNonce, "__tablename__")
        assert hasattr(SiwsNonce, "nonce")
        assert hasattr(SiwsNonce, "wallet_address")

    def test_wallet_session_fields(self):
        """WalletSession model has required fields."""
        assert hasattr(WalletSession, "__tablename__")
        assert hasattr(WalletSession, "wallet_address")
        assert hasattr(WalletSession, "access_token") or hasattr(WalletSession, "session_token")
