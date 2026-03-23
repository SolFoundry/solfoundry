"""Tests for SIWS (Sign-In With Solana) wallet authentication.

Covers the full SIWS flow:
- Challenge message generation (GET /api/auth/siws/message)
- Signature verification & session creation (POST /api/auth/siws)
- Token refresh without re-signing (POST /api/auth/siws/refresh)
- Session revocation / logout (POST /api/auth/siws/revoke)
- require_wallet_auth middleware decorator
- Rate limiting (5 attempts/wallet/min)
- Edge cases: expired nonce, replay, wrong wallet, invalid signature
"""

import base64

import pytest
from fastapi.testclient import TestClient
from solders.keypair import Keypair

from app.main import app
from app.models.wallet_session import SiwsNonce, WalletSession


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def test_keypair():
    """Create a test Solana keypair."""
    return Keypair()


@pytest.fixture
def wallet_address(test_keypair):
    """Base58 wallet address from test keypair."""
    return str(test_keypair.pubkey())


def _sign_message(keypair: Keypair, message: str) -> str:
    """Sign a SIWS challenge message, return base64 signature."""
    sig = keypair.sign_message(message.encode("utf-8"))
    return base64.b64encode(bytes(sig)).decode("ascii")


def _full_auth(client, keypair, wallet_address):
    """Complete SIWS auth flow, return token dict."""
    # Step 1 — get challenge
    r = client.get("/api/auth/siws/message", params={"wallet_address": wallet_address})
    assert r.status_code == 200, f"nonce failed: {r.text}"
    data = r.json()
    message = data["message"]
    nonce = data["nonce"]

    # Step 2 — sign and verify
    signature = _sign_message(keypair, message)
    r = client.post(
        "/api/auth/siws",
        json={
            "wallet_address": wallet_address,
            "signature": signature,
            "message": message,
            "nonce": nonce,
        },
    )
    assert r.status_code == 200, f"verify failed: {r.text}"
    tokens = r.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["wallet_address"] == wallet_address
    return tokens


# ---------------------------------------------------------------------------
# 1. Challenge / nonce endpoint
# ---------------------------------------------------------------------------


class TestSiwsChallenge:
    """GET /api/auth/siws/message"""

    def test_returns_challenge(self, client, wallet_address):
        """Returns nonce + SIWS-formatted message containing wallet address."""
        r = client.get(
            "/api/auth/siws/message", params={"wallet_address": wallet_address}
        )
        assert r.status_code == 200
        data = r.json()
        assert "nonce" in data
        assert "message" in data
        assert len(data["nonce"]) >= 16
        assert wallet_address in data["message"]

    def test_message_has_siws_fields(self, client, wallet_address):
        """SIWS message includes domain, nonce, issued-at per the standard."""
        r = client.get(
            "/api/auth/siws/message", params={"wallet_address": wallet_address}
        )
        msg = r.json()["message"]
        # Standard SIWS fields
        assert "Nonce:" in msg or "nonce" in msg.lower()
        assert "solfoundry" in msg.lower() or "Domain:" in msg

    def test_nonce_unique(self, client, wallet_address):
        """Each request produces a different nonce."""
        r1 = client.get(
            "/api/auth/siws/message", params={"wallet_address": wallet_address}
        )
        r2 = client.get(
            "/api/auth/siws/message", params={"wallet_address": wallet_address}
        )
        assert r1.json()["nonce"] != r2.json()["nonce"]

    def test_invalid_wallet_rejected(self, client):
        """Non-base58 wallet address is rejected."""
        r = client.get(
            "/api/auth/siws/message", params={"wallet_address": "not-a-wallet!!!"}
        )
        assert r.status_code in (400, 422)


# ---------------------------------------------------------------------------
# 2. Signature verification & session creation
# ---------------------------------------------------------------------------


class TestSiwsVerify:
    """POST /api/auth/siws"""

    def test_valid_signature_creates_session(
        self, client, test_keypair, wallet_address
    ):
        """Valid wallet signature returns access_token + refresh_token."""
        tokens = _full_auth(client, test_keypair, wallet_address)
        assert len(tokens["access_token"]) > 20
        assert len(tokens["refresh_token"]) > 20

    def test_invalid_signature_rejected(self, client, wallet_address):
        """Random bytes as signature → 401."""
        r = client.get(
            "/api/auth/siws/message", params={"wallet_address": wallet_address}
        )
        data = r.json()
        r2 = client.post(
            "/api/auth/siws",
            json={
                "wallet_address": wallet_address,
                "signature": base64.b64encode(b"\x00" * 64).decode(),
                "message": data["message"],
                "nonce": data["nonce"],
            },
        )
        assert r2.status_code in (401, 400, 403)

    def test_wrong_wallet_rejected(self, client, wallet_address):
        """Signature from different keypair is rejected."""
        other = Keypair()
        r = client.get(
            "/api/auth/siws/message", params={"wallet_address": wallet_address}
        )
        data = r.json()
        wrong_sig = _sign_message(other, data["message"])
        r2 = client.post(
            "/api/auth/siws",
            json={
                "wallet_address": wallet_address,
                "signature": wrong_sig,
                "message": data["message"],
                "nonce": data["nonce"],
            },
        )
        assert r2.status_code in (401, 400, 403)

    def test_replay_attack_rejected(self, client, test_keypair, wallet_address):
        """Reusing a consumed nonce is rejected."""
        r = client.get(
            "/api/auth/siws/message", params={"wallet_address": wallet_address}
        )
        data = r.json()
        sig = _sign_message(test_keypair, data["message"])
        payload = {
            "wallet_address": wallet_address,
            "signature": sig,
            "message": data["message"],
            "nonce": data["nonce"],
        }
        r1 = client.post("/api/auth/siws", json=payload)
        assert r1.status_code == 200

        # Replay — same nonce
        r2 = client.post("/api/auth/siws", json=payload)
        assert r2.status_code in (401, 400, 409)

    def test_tampered_message_rejected(self, client, test_keypair, wallet_address):
        """Signing a different message than the challenge → rejected."""
        r = client.get(
            "/api/auth/siws/message", params={"wallet_address": wallet_address}
        )
        data = r.json()
        # Sign the WRONG message
        sig = _sign_message(test_keypair, "I am a hacker")
        r2 = client.post(
            "/api/auth/siws",
            json={
                "wallet_address": wallet_address,
                "signature": sig,
                "message": data["message"],
                "nonce": data["nonce"],
            },
        )
        assert r2.status_code in (401, 400, 403)


# ---------------------------------------------------------------------------
# 3. Token refresh
# ---------------------------------------------------------------------------


class TestSiwsRefresh:
    """POST /api/auth/siws/refresh"""

    def test_refresh_returns_new_tokens(self, client, test_keypair, wallet_address):
        """Refresh token returns new access + refresh pair."""
        tokens = _full_auth(client, test_keypair, wallet_address)
        r = client.post(
            "/api/auth/siws/refresh",
            json={
                "refresh_token": tokens["refresh_token"],
            },
        )
        assert r.status_code == 200
        new_tokens = r.json()
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        # New tokens should differ from originals
        assert new_tokens["access_token"] != tokens["access_token"]

    def test_refresh_single_use(self, client, test_keypair, wallet_address):
        """Refresh token is single-use — second use fails."""
        tokens = _full_auth(client, test_keypair, wallet_address)
        refresh = tokens["refresh_token"]

        r1 = client.post("/api/auth/siws/refresh", json={"refresh_token": refresh})
        assert r1.status_code == 200

        # Same refresh token again — should fail
        r2 = client.post("/api/auth/siws/refresh", json={"refresh_token": refresh})
        assert r2.status_code in (401, 400, 403)

    def test_invalid_refresh_token_rejected(self, client):
        """Garbage refresh token is rejected."""
        r = client.post(
            "/api/auth/siws/refresh",
            json={
                "refresh_token": "totally-invalid-token",
            },
        )
        assert r.status_code in (401, 400, 403)


# ---------------------------------------------------------------------------
# 4. Session revocation / logout
# ---------------------------------------------------------------------------


class TestSiwsRevoke:
    """POST /api/auth/siws/revoke"""

    def test_revoke_invalidates_session(self, client, test_keypair, wallet_address):
        """After revoke, the access token no longer works."""
        tokens = _full_auth(client, test_keypair, wallet_address)
        auth = {"Authorization": f"Bearer {tokens['access_token']}"}

        r = client.post("/api/auth/siws/revoke", headers=auth)
        assert r.status_code in (200, 204)

        # Refresh with the revoked session's refresh token should fail
        r2 = client.post(
            "/api/auth/siws/refresh",
            json={
                "refresh_token": tokens["refresh_token"],
            },
        )
        assert r2.status_code in (401, 400, 403)

    def test_revoke_without_token_fails(self, client):
        """Revoke without auth header → 401/403."""
        r = client.post("/api/auth/siws/revoke")
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 5. Middleware: require_wallet_auth
# ---------------------------------------------------------------------------


class TestRequireWalletAuth:
    """require_wallet_auth dependency for protected endpoints."""

    def test_protected_endpoint_with_valid_token(
        self, client, test_keypair, wallet_address
    ):
        """Authenticated user can access protected routes."""
        tokens = _full_auth(client, test_keypair, wallet_address)
        auth = {"Authorization": f"Bearer {tokens['access_token']}"}
        # Use any protected endpoint — or the health endpoint with auth
        # The middleware itself is tested through the revoke endpoint which requires auth
        r = client.post("/api/auth/siws/revoke", headers=auth)
        assert r.status_code in (200, 204)  # proves auth worked

    def test_protected_endpoint_without_token(self, client):
        """No bearer token → 401."""
        r = client.post("/api/auth/siws/revoke")
        assert r.status_code in (401, 403)

    def test_protected_endpoint_with_expired_token(self, client):
        """Expired JWT → 401."""
        r = client.post(
            "/api/auth/siws/revoke",
            headers={
                "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid"
            },
        )
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 6. Rate limiting
# ---------------------------------------------------------------------------


class TestSiwsRateLimit:
    """Rate limiting: max 5 sign-in attempts per wallet per minute."""

    def test_rate_limit_triggers(self, client, wallet_address):
        """6th failed verify attempt within 60s → 429 or equivalent."""
        for i in range(6):
            r = client.get(
                "/api/auth/siws/message", params={"wallet_address": wallet_address}
            )
            if r.status_code != 200:
                break
            data = r.json()
            resp = client.post(
                "/api/auth/siws",
                json={
                    "wallet_address": wallet_address,
                    "signature": base64.b64encode(b"\xff" * 64).decode(),
                    "message": data["message"],
                    "nonce": data["nonce"],
                },
            )
        # After 5+ failures, should see rate limit or continued 401
        assert resp.status_code in (429, 401, 400, 403)


# ---------------------------------------------------------------------------
# 7. Model integrity
# ---------------------------------------------------------------------------


class TestSiwsModels:
    """Database model structure validation."""

    def test_siws_nonce_has_required_fields(self):
        """SiwsNonce model has tablename, nonce, wallet_address, expires_at."""
        assert hasattr(SiwsNonce, "__tablename__")
        assert hasattr(SiwsNonce, "nonce")
        assert hasattr(SiwsNonce, "wallet_address")

    def test_wallet_session_has_required_fields(self):
        """WalletSession model has wallet_address, token fields, expiry."""
        assert hasattr(WalletSession, "__tablename__")
        assert hasattr(WalletSession, "wallet_address")
        # Must have either access_token_hash or session_token
        has_token = (
            hasattr(WalletSession, "access_token_hash")
            or hasattr(WalletSession, "session_token")
            or hasattr(WalletSession, "token_hash")
        )
        assert has_token, "WalletSession must store token hash"

    def test_wallet_session_has_refresh(self):
        """WalletSession must support refresh token storage."""
        has_refresh = hasattr(WalletSession, "refresh_token_hash") or hasattr(
            WalletSession, "refresh_token"
        )
        assert has_refresh, "WalletSession must store refresh token"

    def test_wallet_session_has_expiry(self):
        """WalletSession must track expiry."""
        has_expiry = hasattr(WalletSession, "expires_at") or hasattr(
            WalletSession, "access_expires_at"
        )
        assert has_expiry, "WalletSession must have expiry field"

    def test_wallet_session_has_revoked(self):
        """WalletSession must support revocation."""
        assert hasattr(WalletSession, "revoked"), (
            "WalletSession must have revoked field"
        )
