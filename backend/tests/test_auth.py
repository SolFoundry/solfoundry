"""Tests for authentication API endpoints.

This module tests:
- GitHub OAuth flow
- Solana wallet authentication
- Wallet linking
- Token refresh
- Protected routes
"""

import pytest
import base64
from datetime import datetime, timezone, timedelta

from fastapi.testclient import TestClient
from solders.keypair import Keypair

from app.main import app
from app.services import auth_service

auth_service.GITHUB_CLIENT_ID = "test-client-id"


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


@pytest.fixture
def test_keypair():
    """Create a test Solana keypair for wallet auth tests."""
    return Keypair()


import asyncio
from app.database import async_session_factory, Base, engine, get_db

@pytest.fixture
def auth_headers(client):
    """Create auth headers by doing GitHub OAuth login (simulated)."""
    import uuid
    from app.models.user import User
    
    user_uuid = uuid.uuid4()
    user_id = str(user_uuid)
    
    async def _create_user():
        """The _create_user function."""
        async with async_session_factory() as session:
            user = User(
                id=user_uuid,
                github_id="test_github_123",
                username="testuser",
                email="test@example.com",
                avatar_url="https://example.com/avatar.png",
            )
            session.add(user)
            await session.commit()
            
    asyncio.run(_create_user())

    # Generate token
    token = auth_service.create_access_token(user_id)

    return {"Authorization": f"Bearer {token}"}


class TestGitHubOAuth:
    """Test GitHub OAuth flow."""

    def test_get_github_authorize_url(self, client):
        """Test getting GitHub authorization URL."""
        # This test requires GITHUB_CLIENT_ID to be set
        # For now, we'll test the structure

        # Mock the environment
        import os

        original_client_id = os.environ.get("GITHUB_CLIENT_ID")
        os.environ["GITHUB_CLIENT_ID"] = "test_client_id"

        try:
            response = client.get("/api/auth/github/authorize")
            assert response.status_code == 200
            data = response.json()
            assert "authorize_url" in data
            assert "state" in data
            assert "github.com" in data["authorize_url"]
        finally:
            if original_client_id:
                os.environ["GITHUB_CLIENT_ID"] = original_client_id
            else:
                os.environ.pop("GITHUB_CLIENT_ID", None)

    def test_github_oauth_callback_missing_code(self, client):
        """Test GitHub OAuth callback with missing code."""
        response = client.post("/api/auth/github", json={"code": ""})
        assert response.status_code == 422  # Validation error

    def test_github_oauth_callback_invalid_code(self, client):
        """Test GitHub OAuth callback with invalid code."""
        response = client.post("/api/auth/github", json={"code": "invalid_code"})
        # Should fail because the code is not valid
        assert response.status_code in [400, 500]


class TestWalletAuth:
    """Test Solana wallet authentication."""

    def test_get_wallet_auth_message(self, client, test_keypair):
        """Test getting wallet auth message."""
        wallet_address = str(test_keypair.pubkey())
        response = client.get(
            f"/api/auth/wallet/message?wallet_address={wallet_address}"
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "nonce" in data
        assert "expires_at" in data
        assert wallet_address[:8] in data["message"]

    def test_wallet_authenticate_invalid_signature(self, client, test_keypair):
        """Test wallet auth with invalid signature."""
        wallet_address = str(test_keypair.pubkey())

        # Get auth message first
        msg_response = client.get(
            f"/api/auth/wallet/message?wallet_address={wallet_address}"
        )
        message = msg_response.json()["message"]

        # Use invalid signature
        response = client.post(
            "/api/auth/wallet",
            json={
                "wallet_address": wallet_address,
                "signature": base64.b64encode(b"invalid_signature").decode(),
                "message": message,
            },
        )

        assert response.status_code == 400
        assert "Failed to verify signature" in response.json()["message"]

    def test_wallet_authenticate_valid_signature(self, client, test_keypair):
        """Test wallet auth with valid signature."""
        wallet_address = str(test_keypair.pubkey())

        # Get auth message
        msg_response = client.get(
            f"/api/auth/wallet/message?wallet_address={wallet_address}"
        )
        message = msg_response.json()["message"]

        # Sign the message with the keypair
        message_bytes = message.encode("utf-8")
        signature = test_keypair.sign_message(message_bytes)
        signature_b64 = base64.b64encode(bytes(signature)).decode()

        response = client.post(
            "/api/auth/wallet",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        assert data["user"]["wallet_address"].lower() == wallet_address.lower()
        assert data["user"]["wallet_verified"] is True


class TestWalletLinking:
    """Test wallet linking functionality."""

    def test_link_wallet_unauthenticated(self, client):
        """Test linking wallet without authentication."""
        response = client.post(
            "/api/auth/link-wallet",
            json={
                "wallet_address": "DummyWalletAddress123456789",
                "signature": "invalid",
                "message": "test message",
            },
        )

        assert response.status_code == 401

    def test_link_wallet_authenticated(self, client, auth_headers, test_keypair):
        """Test linking wallet to authenticated user."""
        wallet_address = str(test_keypair.pubkey())

        # Get auth message
        msg_response = client.get(
            f"/api/auth/wallet/message?wallet_address={wallet_address}",
            headers=auth_headers,
        )
        message = msg_response.json()["message"]

        # Sign the message
        message_bytes = message.encode("utf-8")
        signature = test_keypair.sign_message(message_bytes)
        signature_b64 = base64.b64encode(bytes(signature)).decode()

        response = client.post(
            "/api/auth/link-wallet",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["user"]["wallet_address"].lower() == wallet_address.lower()


class TestTokenRefresh:
    """Test token refresh functionality."""

    def test_refresh_token_invalid(self, client):
        """Test refresh with invalid token."""
        response = client.post(
            "/api/auth/refresh", json={"refresh_token": "invalid_token"}
        )

        assert response.status_code == 401

    def test_refresh_token_valid(self, client, auth_headers):
        """Test refresh with valid token."""
        # The user was created in auth_headers fixture
        # We can extract the user_id from the token
        token = auth_headers["Authorization"].split(" ")[1]
        user_id = auth_service.decode_token(token)

        refresh_token = auth_service.create_refresh_token(user_id)

        response = client.post(
            "/api/auth/refresh", json={"refresh_token": refresh_token}
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"


class TestProtectedRoutes:
    """Test protected route functionality."""

    def test_get_me_unauthenticated(self, client):
        """Test /auth/me without authentication."""
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_get_me_authenticated(self, client, auth_headers):
        """Test getting current user with valid token."""
        response = client.get("/api/auth/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert "id" in data
        assert "username" in data
        assert "created_at" in data


class TestJWTToken:
    """Test JWT token generation and validation."""

    def test_create_access_token(self):
        """Test creating access token."""
        token = auth_service.create_access_token("test_user_id")
        assert token is not None
        assert isinstance(token, str)

    def test_create_refresh_token(self):
        """Test creating refresh token."""
        token = auth_service.create_refresh_token("test_user_id")
        assert token is not None
        assert isinstance(token, str)

    def test_decode_valid_token(self):
        """Test decoding valid token."""
        user_id = "test_user_123"
        token = auth_service.create_access_token(user_id)

        decoded_user_id = auth_service.decode_token(token, token_type="access")
        assert decoded_user_id == user_id

    def test_decode_expired_token(self):
        """Test decoding expired token."""
        from jose import jwt

        # Create an expired token
        expired_payload = {
            "sub": "test_user",
            "type": "access",
            "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),
        }
        expired_token = jwt.encode(
            expired_payload,
            auth_service.JWT_SECRET_KEY,
            algorithm=auth_service.JWT_ALGORITHM,
        )

        with pytest.raises(auth_service.TokenExpiredError):
            auth_service.decode_token(expired_token, token_type="access")

    def test_decode_wrong_type_token(self):
        """Test decoding token with wrong type."""
        refresh_token = auth_service.create_refresh_token("test_user")

        with pytest.raises(auth_service.InvalidTokenError):
            auth_service.decode_token(refresh_token, token_type="access")


class TestWalletSignatureVerification:
    """Test Solana wallet signature verification."""

    def test_verify_valid_signature(self, test_keypair):
        """Test verifying a valid signature."""
        message = "Test message to sign"
        message_bytes = message.encode("utf-8")

        signature = test_keypair.sign_message(message_bytes)
        signature_b64 = base64.b64encode(bytes(signature)).decode()

        result = auth_service.verify_wallet_signature(
            str(test_keypair.pubkey()), message, signature_b64
        )

        assert result is True

    def test_verify_invalid_signature(self, test_keypair):
        """Test verifying an invalid signature."""
        message = "Test message to sign"

        # Use a different keypair's signature
        other_keypair = Keypair()
        other_message_bytes = b"Different message"
        other_signature = other_keypair.sign_message(other_message_bytes)
        signature_b64 = base64.b64encode(bytes(other_signature)).decode()

        with pytest.raises(auth_service.WalletVerificationError):
            auth_service.verify_wallet_signature(
                str(test_keypair.pubkey()), message, signature_b64
            )

    def test_verify_invalid_wallet_address(self):
        """Test verifying with invalid wallet address."""
        with pytest.raises(auth_service.WalletVerificationError):
            auth_service.verify_wallet_signature(
                "invalid_wallet_address",
                "message",
                base64.b64encode(b"signature").decode(),
            )


# Integration test for full auth flow
class TestFullAuthFlow:
    """Test complete authentication flows."""

    def test_full_wallet_auth_flow(self, client, test_keypair):
        """Test complete wallet authentication flow."""
        wallet_address = str(test_keypair.pubkey())

        # Step 1: Get auth message
        msg_response = client.get(
            f"/api/auth/wallet/message?wallet_address={wallet_address}"
        )
        assert msg_response.status_code == 200
        message = msg_response.json()["message"]

        # Step 2: Sign and authenticate
        message_bytes = message.encode("utf-8")
        signature = test_keypair.sign_message(message_bytes)
        signature_b64 = base64.b64encode(bytes(signature)).decode()

        auth_response = client.post(
            "/api/auth/wallet",
            json={
                "wallet_address": wallet_address,
                "signature": signature_b64,
                "message": message,
            },
        )
        assert auth_response.status_code == 200

        tokens = auth_response.json()
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]

        # Step 3: Access protected route
        me_response = client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {access_token}"}
        )
        assert me_response.status_code == 200
        user = me_response.json()
        assert user["wallet_address"].lower() == wallet_address.lower()

        # Step 4: Refresh token
        refresh_response = client.post(
            "/api/auth/refresh", json={"refresh_token": refresh_token}
        )
        assert refresh_response.status_code == 200
        new_access_token = refresh_response.json()["access_token"]

        # Step 5: Use new token
        me_response2 = client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {new_access_token}"}
        )
        assert me_response2.status_code == 200
        assert me_response2.json()["id"] == user["id"]
