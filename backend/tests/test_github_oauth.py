"""Comprehensive tests for the GitHub OAuth completion flow.

Tests cover the full OAuth lifecycle with mocked GitHub API responses:
- CSRF state creation, verification, expiration, and replay prevention
- Authorization URL generation with correct parameters
- Code exchange with GitHub API (success, denied, expired, rate-limited)
- User creation and re-authorization (profile update)
- GitHub token encryption and storage in PostgreSQL
- Token revocation (local and remote)
- Connection status checking
- Error handling for all failure modes
- Full end-to-end OAuth flow integration

All GitHub API calls are mocked using unittest.mock to prevent actual
network requests during testing. Database operations use the test SQLite
backend configured in conftest.py.
"""

import base64
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import async_session_factory
from app.models.user import User
from app.models.oauth_state import OAuthStateDB
from app.models.github_token import GitHubTokenDB
from app.services import auth_service
from app.services.github_oauth_service import (
    create_oauth_state,
    verify_and_consume_state,
    cleanup_expired_states,
    build_authorize_url,
    exchange_code_for_token,
    complete_github_oauth,
    revoke_github_access,
    get_github_connection_status,
    encrypt_token,
    decrypt_token,
    GitHubAccessDeniedError,
    GitHubRateLimitError,
    GitHubOAuthError,
    TokenEncryptionError,
)
from app.services.auth_service import InvalidStateError
from tests.conftest import run_async

# Ensure test GITHUB_CLIENT_ID is set for URL generation
auth_service.GITHUB_CLIENT_ID = "test-client-id"

# Ensure new tables exist in the test database
from app.database import init_db as _init_db
run_async(_init_db())


def _get_error_message(resp) -> str:
    """Extract the error message from a response, handling both formats.

    The SolFoundry API uses a global exception handler that returns
    {"message": ..., "code": ...} rather than the standard FastAPI
    {"detail": ...} format. This helper handles both.

    Args:
        resp: The httpx/TestClient response object.

    Returns:
        The error message string, lowercased for easy assertion matching.
    """
    data = resp.json()
    return (data.get("detail") or data.get("message") or "").lower()


@pytest.fixture
def client():
    """Create a FastAPI test client for HTTP-level tests."""
    return TestClient(app)


@pytest.fixture
def test_user_id():
    """Generate a unique test user UUID."""
    return uuid.uuid4()


@pytest.fixture
def auth_headers(test_user_id):
    """Create JWT auth headers for a test user in the database.

    Creates a real user record in the test database and generates
    a valid JWT access token for that user.

    Returns:
        Dictionary with Authorization header containing a Bearer JWT.
    """
    user_id = test_user_id

    async def _setup():
        """Insert a test user into the database."""
        async with async_session_factory() as session:
            user = User(
                id=user_id,
                github_id=f"gh_{user_id.hex[:12]}",
                username="oauth_testuser",
                email="oauth_test@example.com",
                avatar_url="https://avatars.githubusercontent.com/u/12345",
            )
            session.add(user)
            await session.commit()

    run_async(_setup())
    token = auth_service.create_access_token(str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _mock_github_token_response(access_token="gho_mock_token_abc123"):
    """Create a mock successful GitHub token exchange response.

    Args:
        access_token: The mock access token to include in the response.

    Returns:
        A mock httpx.Response for the token exchange endpoint.
    """
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {
        "access_token": access_token,
        "token_type": "bearer",
        "scope": "read:user",
    }
    return response


def _mock_github_user_response(
    github_id=67890,
    login="testdev",
    email="testdev@github.com",
    avatar_url="https://avatars.githubusercontent.com/u/67890",
):
    """Create a mock GitHub user profile response.

    Args:
        github_id: The GitHub user's numeric ID.
        login: The GitHub username.
        email: The user's email address.
        avatar_url: URL to the user's avatar image.

    Returns:
        A mock httpx.Response for the /user endpoint.
    """
    response = MagicMock()
    response.status_code = 200
    response.headers = {"X-RateLimit-Remaining": "4999"}
    response.json.return_value = {
        "id": github_id,
        "login": login,
        "email": email,
        "avatar_url": avatar_url,
        "name": "Test Developer",
    }
    return response


def _mock_github_error_response(error_code, description):
    """Create a mock GitHub OAuth error response.

    Args:
        error_code: The OAuth error code (e.g., 'access_denied').
        description: Human-readable error description.

    Returns:
        A mock httpx.Response with the error payload.
    """
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {
        "error": error_code,
        "error_description": description,
    }
    return response


def _mock_rate_limited_response():
    """Create a mock GitHub 403 rate-limited response.

    Returns:
        A mock httpx.Response with rate limit headers.
    """
    reset_time = int((datetime.now(timezone.utc) + timedelta(minutes=30)).timestamp())
    response = MagicMock()
    response.status_code = 403
    response.headers = {
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": str(reset_time),
    }
    response.json.return_value = {"message": "API rate limit exceeded"}
    return response


def _setup_mock_client(token_resp=None, user_resp=None):
    """Create a fully configured mock httpx.AsyncClient.

    Args:
        token_resp: Mock response for the token exchange POST.
        user_resp: Mock response for the user profile GET.

    Returns:
        An AsyncMock configured as an httpx.AsyncClient context manager.
    """
    mock = AsyncMock()
    mock.post.return_value = token_resp or _mock_github_token_response()
    mock.get.return_value = user_resp or _mock_github_user_response()
    mock.__aenter__ = AsyncMock(return_value=mock)
    mock.__aexit__ = AsyncMock(return_value=False)
    return mock


# ---------------------------------------------------------------------------
# OAuth State (CSRF Protection) Tests
# ---------------------------------------------------------------------------


class TestOAuthStateManagement:
    """Test PostgreSQL-backed OAuth CSRF state management."""

    def test_create_oauth_state(self):
        """Test that creating an OAuth state returns a valid token."""
        async def _run():
            """Execute the async state creation test."""
            async with async_session_factory() as db:
                state = await create_oauth_state(db, ip_address="127.0.0.1")
                assert isinstance(state, str)
                assert len(state) > 20
        run_async(_run())

    def test_verify_valid_state(self):
        """Test that a freshly created state can be verified."""
        async def _run():
            """Execute the async state verification test."""
            async with async_session_factory() as db:
                state = await create_oauth_state(db)
                result = await verify_and_consume_state(db, state)
                assert result is True
        run_async(_run())

    def test_verify_consumed_state_raises(self):
        """Test that using a state twice raises InvalidStateError."""
        async def _run():
            """Execute the async consumed state test."""
            async with async_session_factory() as db:
                state = await create_oauth_state(db)
                await verify_and_consume_state(db, state)
                with pytest.raises(InvalidStateError, match="already consumed"):
                    await verify_and_consume_state(db, state)
        run_async(_run())

    def test_verify_missing_state_raises(self):
        """Test that a nonexistent state raises InvalidStateError."""
        async def _run():
            """Execute the async missing state test."""
            async with async_session_factory() as db:
                with pytest.raises(InvalidStateError, match="Invalid"):
                    await verify_and_consume_state(db, "nonexistent_state_token")
        run_async(_run())

    def test_verify_empty_state_raises(self):
        """Test that an empty state parameter raises InvalidStateError."""
        async def _run():
            """Execute the async empty state test."""
            async with async_session_factory() as db:
                with pytest.raises(InvalidStateError, match="Missing"):
                    await verify_and_consume_state(db, "")
        run_async(_run())

    def test_verify_expired_state_raises(self):
        """Test that an expired state raises InvalidStateError."""
        async def _run():
            """Execute the async expired state test."""
            async with async_session_factory() as db:
                state = await create_oauth_state(db)
                from sqlalchemy import update
                await db.execute(
                    update(OAuthStateDB)
                    .where(OAuthStateDB.state_token == state)
                    .values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
                )
                await db.commit()
                with pytest.raises(InvalidStateError, match="expired"):
                    await verify_and_consume_state(db, state)
        run_async(_run())

    def test_cleanup_expired_states(self):
        """Test that expired state cleanup removes old records."""
        async def _run():
            """Execute the async cleanup test."""
            async with async_session_factory() as db:
                state = await create_oauth_state(db)
                from sqlalchemy import update
                await db.execute(
                    update(OAuthStateDB)
                    .where(OAuthStateDB.state_token == state)
                    .values(created_at=datetime.now(timezone.utc) - timedelta(hours=2))
                )
                await db.commit()
                deleted = await cleanup_expired_states(db)
                assert deleted >= 1
        run_async(_run())


# ---------------------------------------------------------------------------
# Authorization URL Tests
# ---------------------------------------------------------------------------


class TestBuildAuthorizeUrl:
    """Test GitHub OAuth authorization URL construction."""

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid_123")
    def test_build_authorize_url_contains_required_params(self):
        """Test that the URL includes client_id, state, scope, and redirect_uri."""
        url = build_authorize_url("test_state_abc")
        assert "client_id=test_cid_123" in url
        assert "state=test_state_abc" in url
        assert "scope=read:user" in url
        assert "redirect_uri=" in url
        assert "github.com/login/oauth/authorize" in url

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "")
    def test_build_authorize_url_missing_client_id_raises(self):
        """Test that missing GITHUB_CLIENT_ID raises GitHubOAuthError."""
        with pytest.raises(GitHubOAuthError, match="GITHUB_CLIENT_ID"):
            build_authorize_url("some_state")


# ---------------------------------------------------------------------------
# Token Encryption Tests
# ---------------------------------------------------------------------------


class TestTokenEncryption:
    """Test Fernet token encryption and decryption."""

    @patch.dict("os.environ", {"JWT_SECRET_KEY": "test-secret-key-for-encryption-32"})
    def test_encrypt_decrypt_roundtrip(self):
        """Test that encrypting and decrypting produces the original token."""
        original = "gho_test_token_abc123xyz789"
        encrypted = encrypt_token(original)
        assert encrypted != original
        decrypted = decrypt_token(encrypted)
        assert decrypted == original

    @patch.dict("os.environ", {"JWT_SECRET_KEY": "test-secret-key-for-encryption-32"})
    def test_encrypted_token_is_not_plaintext(self):
        """Test that the encrypted output does not contain the original token."""
        original = "gho_secret_token"
        encrypted = encrypt_token(original)
        assert original not in encrypted

    @patch.dict("os.environ", {"JWT_SECRET_KEY": "different-key-will-fail-decrypt"})
    def test_decrypt_with_wrong_key_raises(self):
        """Test that decryption with a different key raises TokenEncryptionError."""
        import os
        os.environ["JWT_SECRET_KEY"] = "original-key-for-encryption-test"
        encrypted = encrypt_token("test_token")
        os.environ["JWT_SECRET_KEY"] = "different-key-will-fail-decrypt"
        with pytest.raises(TokenEncryptionError):
            decrypt_token(encrypted)


# ---------------------------------------------------------------------------
# Code Exchange Tests (Mocked GitHub API)
# ---------------------------------------------------------------------------


class TestExchangeCodeForToken:
    """Test GitHub authorization code exchange with mocked API."""

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_successful_code_exchange(self):
        """Test successful code exchange returns user data with token."""
        async def _run():
            """Execute the async code exchange test."""
            mock = _setup_mock_client()
            with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
                result = await exchange_code_for_token("valid_code_123")
            assert result["id"] == 67890
            assert result["login"] == "testdev"
            assert result["email"] == "testdev@github.com"
            assert result["access_token"] == "gho_mock_token_abc123"
        run_async(_run())

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_access_denied_raises_specific_error(self):
        """Test that denied authorization raises GitHubAccessDeniedError."""
        async def _run():
            """Execute the async denied auth test."""
            mock = _setup_mock_client(
                token_resp=_mock_github_error_response("access_denied", "The user denied your request")
            )
            with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
                with pytest.raises(GitHubAccessDeniedError, match="denied"):
                    await exchange_code_for_token("denied_code")
        run_async(_run())

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_bad_verification_code_raises(self):
        """Test that an expired code raises GitHubOAuthError."""
        async def _run():
            """Execute the async bad code test."""
            mock = _setup_mock_client(
                token_resp=_mock_github_error_response("bad_verification_code", "The code has expired")
            )
            with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
                with pytest.raises(GitHubOAuthError, match="expired"):
                    await exchange_code_for_token("expired_code")
        run_async(_run())

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_rate_limit_raises_specific_error(self):
        """Test that GitHub rate limiting raises GitHubRateLimitError."""
        async def _run():
            """Execute the async rate limit test."""
            mock = _setup_mock_client(user_resp=_mock_rate_limited_response())
            with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
                with pytest.raises(GitHubRateLimitError, match="rate limit"):
                    await exchange_code_for_token("valid_code")
        run_async(_run())

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "")
    def test_missing_client_secret_raises(self):
        """Test that missing GITHUB_CLIENT_SECRET raises GitHubOAuthError."""
        async def _run():
            """Execute the async missing secret test."""
            with pytest.raises(GitHubOAuthError, match="GITHUB_CLIENT_SECRET"):
                await exchange_code_for_token("any_code")
        run_async(_run())

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_email_fallback_to_emails_endpoint(self):
        """Test that email is fetched from /user/emails when not in profile."""
        async def _run():
            """Execute the async email fallback test."""
            mock = AsyncMock()
            mock.post.return_value = _mock_github_token_response()
            user_resp = _mock_github_user_response(email=None)
            user_resp.json.return_value["email"] = None
            emails_resp = MagicMock()
            emails_resp.status_code = 200
            emails_resp.json.return_value = [
                {"email": "secondary@example.com", "primary": False},
                {"email": "primary@example.com", "primary": True},
            ]
            mock.get.side_effect = [user_resp, emails_resp]
            mock.__aenter__ = AsyncMock(return_value=mock)
            mock.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
                result = await exchange_code_for_token("code_no_email")
            assert result["email"] == "primary@example.com"
        run_async(_run())


# ---------------------------------------------------------------------------
# Complete OAuth Flow Tests
# ---------------------------------------------------------------------------


class TestCompleteGitHubOAuth:
    """Test the complete GitHub OAuth flow with database operations."""

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_new_user_creation(self):
        """Test that a new user is created on first OAuth login."""
        async def _run():
            """Execute the async new user creation test."""
            mock = _setup_mock_client(
                user_resp=_mock_github_user_response(github_id=99001, login="newuser_oauth")
            )
            async with async_session_factory() as db:
                with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
                    result = await complete_github_oauth(db, "new_code")
            assert "access_token" in result
            assert "refresh_token" in result
            assert result["token_type"] == "bearer"
            assert result["user"].username == "newuser_oauth"
            assert result["is_new_user"] is True
        run_async(_run())

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_reauthorization_updates_profile(self):
        """Test that re-authorizing updates the user's profile from GitHub."""
        async def _run():
            """Execute the async re-authorization test."""
            existing_github_id = "99002"
            user_uuid = uuid.uuid4()
            async with async_session_factory() as db:
                user = User(
                    id=user_uuid,
                    github_id=existing_github_id,
                    username="old_username",
                    email="old@example.com",
                    avatar_url="https://old-avatar.com",
                )
                db.add(user)
                await db.commit()
            mock = _setup_mock_client(
                user_resp=_mock_github_user_response(
                    github_id=int(existing_github_id),
                    login="updated_username",
                    email="new@example.com",
                    avatar_url="https://new-avatar.com",
                )
            )
            async with async_session_factory() as db:
                with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
                    result = await complete_github_oauth(db, "reauth_code")
            assert result["user"].username == "updated_username"
            assert result["user"].email == "new@example.com"
            assert result["is_new_user"] is False
        run_async(_run())

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_oauth_with_state_verification(self):
        """Test the full OAuth flow with CSRF state verification."""
        async def _run():
            """Execute the async stateful OAuth test."""
            mock = _setup_mock_client(
                user_resp=_mock_github_user_response(github_id=99003, login="stateful_user")
            )
            async with async_session_factory() as db:
                state = await create_oauth_state(db)
                with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
                    result = await complete_github_oauth(db, "code_with_state", state=state)
            assert result["user"].username == "stateful_user"
        run_async(_run())


# ---------------------------------------------------------------------------
# Token Revocation Tests
# ---------------------------------------------------------------------------


class TestRevokeGitHubAccess:
    """Test GitHub access revocation."""

    @patch.dict("os.environ", {"JWT_SECRET_KEY": "test-key-for-revocation-test-32ch"})
    def test_revoke_active_token(self):
        """Test revoking an active GitHub token marks it as inactive."""
        async def _run():
            """Execute the async revocation test."""
            user_uuid = uuid.uuid4()
            async with async_session_factory() as db:
                user = User(id=user_uuid, github_id=f"gh_revoke_{user_uuid.hex[:8]}", username="revoke_test_user")
                db.add(user)
                await db.flush()
                encrypted = encrypt_token("gho_test_revoke_token")
                token_record = GitHubTokenDB(
                    user_id=user_uuid, encrypted_token=encrypted,
                    github_user_id="111", github_username="revoke_test_user",
                    scopes="read:user", is_active=True,
                )
                db.add(token_record)
                await db.commit()
                with patch("app.services.github_oauth_service._revoke_github_token_remote", new_callable=AsyncMock, return_value=True):
                    result = await revoke_github_access(db, str(user_uuid))
            assert result["success"] is True
            assert "revoked" in result["message"].lower()
        run_async(_run())

    def test_revoke_no_active_token_raises(self):
        """Test revoking when no active token exists raises AuthError."""
        async def _run():
            """Execute the async no-token revocation test."""
            user_uuid = uuid.uuid4()
            async with async_session_factory() as db:
                user = User(id=user_uuid, github_id=f"gh_notoken_{user_uuid.hex[:8]}", username="no_token_user")
                db.add(user)
                await db.commit()
                from app.services.auth_service import AuthError
                with pytest.raises(AuthError, match="No active GitHub connection"):
                    await revoke_github_access(db, str(user_uuid))
        run_async(_run())


# ---------------------------------------------------------------------------
# Connection Status Tests
# ---------------------------------------------------------------------------


class TestGitHubConnectionStatus:
    """Test GitHub connection status checking."""

    @patch.dict("os.environ", {"JWT_SECRET_KEY": "test-key-for-status-test-32chars"})
    def test_connected_user_status(self):
        """Test that a user with an active token shows as connected."""
        async def _run():
            """Execute the async connected status test."""
            user_uuid = uuid.uuid4()
            async with async_session_factory() as db:
                user = User(id=user_uuid, github_id=f"gh_status_{user_uuid.hex[:8]}", username="status_test_user")
                db.add(user)
                await db.flush()
                encrypted = encrypt_token("gho_status_test_token")
                token_record = GitHubTokenDB(
                    user_id=user_uuid, encrypted_token=encrypted,
                    github_user_id="222", github_username="status_test_user",
                    scopes="read:user", is_active=True,
                )
                db.add(token_record)
                await db.commit()
                status = await get_github_connection_status(db, str(user_uuid))
            assert status["connected"] is True
            assert status["github_username"] == "status_test_user"
        run_async(_run())

    def test_disconnected_user_status(self):
        """Test that a user without a token shows as not connected."""
        async def _run():
            """Execute the async disconnected status test."""
            async with async_session_factory() as db:
                status = await get_github_connection_status(db, str(uuid.uuid4()))
            assert status["connected"] is False
        run_async(_run())


# ---------------------------------------------------------------------------
# HTTP Endpoint Tests
# ---------------------------------------------------------------------------


class TestGitHubAuthorizeEndpoint:
    """Test the GET /auth/github/authorize endpoint."""

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_endpoint_cid")
    def test_authorize_returns_url_and_state(self, client):
        """Test that the authorize endpoint returns a valid URL with state."""
        response = client.get("/api/auth/github/authorize")
        assert response.status_code == 200
        data = response.json()
        assert "authorize_url" in data
        assert "state" in data
        assert "github.com" in data["authorize_url"]
        assert data["state"] in data["authorize_url"]

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_endpoint_cid")
    def test_authorize_url_has_read_user_scope(self, client):
        """Test that the URL requests only the read:user scope."""
        response = client.get("/api/auth/github/authorize")
        data = response.json()
        assert "scope=read:user" in data["authorize_url"]


class TestGitHubCallbackEndpoint:
    """Test the POST /auth/github endpoint."""

    def test_callback_missing_code_returns_422(self, client):
        """Test that missing code returns a validation error."""
        response = client.post("/api/auth/github", json={"code": ""})
        assert response.status_code == 422

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_callback_with_mocked_github_success(self, client):
        """Test successful callback with mocked GitHub responses."""
        mock = _setup_mock_client(
            user_resp=_mock_github_user_response(github_id=55001, login="endpoint_user")
        )
        with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
            response = client.post("/api/auth/github", json={"code": "valid_test_code"})
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["username"] == "endpoint_user"

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_callback_denied_auth_returns_400(self, client):
        """Test that denied authorization returns 400 with clear message."""
        mock = _setup_mock_client(
            token_resp=_mock_github_error_response("access_denied", "The user denied your request")
        )
        with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
            response = client.post("/api/auth/github", json={"code": "denied_code"})
        assert response.status_code == 400
        assert "denied" in _get_error_message(response)

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_callback_rate_limited_returns_429(self, client):
        """Test that GitHub rate limiting returns 429 with Retry-After."""
        mock = _setup_mock_client(user_resp=_mock_rate_limited_response())
        with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
            response = client.post("/api/auth/github", json={"code": "code_rate_limited"})
        assert response.status_code == 429
        assert "rate limit" in _get_error_message(response)


class TestGitHubRevokeEndpoint:
    """Test the POST /auth/github/revoke endpoint."""

    def test_revoke_unauthenticated_returns_401(self, client):
        """Test that revoking without authentication returns 401."""
        response = client.post("/api/auth/github/revoke")
        assert response.status_code == 401

    def test_revoke_no_connection_returns_404(self, client, auth_headers):
        """Test that revoking without a GitHub connection returns 404."""
        response = client.post("/api/auth/github/revoke", headers=auth_headers)
        assert response.status_code == 404

    @patch.dict("os.environ", {"JWT_SECRET_KEY": "test-key-for-revoke-endpoint-32ch"})
    def test_revoke_active_connection_returns_200(self, client, test_user_id, auth_headers):
        """Test that revoking an active connection succeeds."""
        async def _setup():
            """Store a test token for the revoke endpoint test."""
            async with async_session_factory() as db:
                encrypted = encrypt_token("gho_endpoint_revoke_test")
                token = GitHubTokenDB(
                    user_id=test_user_id, encrypted_token=encrypted,
                    github_user_id="333", github_username="revoke_endpoint_user",
                    scopes="read:user", is_active=True,
                )
                db.add(token)
                await db.commit()
        run_async(_setup())
        with patch("app.services.github_oauth_service._revoke_github_token_remote", new_callable=AsyncMock, return_value=True):
            response = client.post("/api/auth/github/revoke", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestGitHubStatusEndpoint:
    """Test the GET /auth/github/status endpoint."""

    def test_status_unauthenticated_returns_401(self, client):
        """Test that checking status without auth returns 401."""
        response = client.get("/api/auth/github/status")
        assert response.status_code == 401

    def test_status_no_connection(self, client, auth_headers):
        """Test that a user without GitHub connection shows disconnected."""
        response = client.get("/api/auth/github/status", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["connected"] is False


# ---------------------------------------------------------------------------
# Full End-to-End Flow Test
# ---------------------------------------------------------------------------


class TestFullGitHubOAuthFlow:
    """End-to-end integration test for the complete GitHub OAuth lifecycle."""

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "e2e_test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "e2e_test_secret")
    def test_complete_oauth_lifecycle(self, client):
        """Test the full flow: authorize -> callback -> status -> revoke.

        Simulates a user going through:
        1. GET /auth/github/authorize to get the OAuth URL
        2. POST /auth/github to complete the callback
        3. GET /auth/me to verify their identity
        4. GET /auth/github/status to check connection
        5. POST /auth/github/revoke to disconnect
        6. GET /auth/github/status to confirm disconnection
        """
        # Step 1: Get authorization URL
        auth_resp = client.get("/api/auth/github/authorize")
        assert auth_resp.status_code == 200
        state = auth_resp.json()["state"]

        # Step 2: Complete callback with mocked GitHub
        mock = _setup_mock_client(
            user_resp=_mock_github_user_response(github_id=77001, login="e2e_flow_user")
        )
        with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
            callback_resp = client.post("/api/auth/github", json={"code": "e2e_valid_code", "state": state})
        assert callback_resp.status_code == 200
        tokens = callback_resp.json()
        user_headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        # Step 3: Verify identity
        me_resp = client.get("/api/auth/me", headers=user_headers)
        assert me_resp.status_code == 200
        assert me_resp.json()["username"] == "e2e_flow_user"

        # Step 4: Check connection status
        status_resp = client.get("/api/auth/github/status", headers=user_headers)
        assert status_resp.status_code == 200
        assert status_resp.json()["connected"] is True

        # Step 5: Revoke access
        with patch("app.services.github_oauth_service._revoke_github_token_remote", new_callable=AsyncMock, return_value=True):
            revoke_resp = client.post("/api/auth/github/revoke", headers=user_headers)
        assert revoke_resp.status_code == 200
        assert revoke_resp.json()["success"] is True

        # Step 6: Confirm disconnection
        status_after = client.get("/api/auth/github/status", headers=user_headers)
        assert status_after.status_code == 200
        assert status_after.json()["connected"] is False


# ---------------------------------------------------------------------------
# Edge Case and Error Handling Tests
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """Test edge cases and error scenarios."""

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_github_500_on_token_exchange(self, client):
        """Test handling of a 500 response from GitHub during code exchange."""
        mock = AsyncMock()
        error_resp = MagicMock()
        error_resp.status_code = 500
        mock.post.return_value = error_resp
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
            response = client.post("/api/auth/github", json={"code": "code_github_500"})
        assert response.status_code == 400
        assert "failed" in _get_error_message(response)

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "test_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "test_secret")
    def test_github_returns_no_access_token(self, client):
        """Test handling when GitHub returns success but no token."""
        mock = AsyncMock()
        empty_resp = MagicMock()
        empty_resp.status_code = 200
        empty_resp.json.return_value = {"token_type": "bearer"}
        mock.post.return_value = empty_resp
        mock.__aenter__ = AsyncMock(return_value=mock)
        mock.__aexit__ = AsyncMock(return_value=False)
        with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
            response = client.post("/api/auth/github", json={"code": "code_no_token"})
        assert response.status_code == 400
        assert "access token" in _get_error_message(response)

    def test_invalid_state_on_callback(self, client):
        """Test that an invalid state parameter on callback returns 400."""
        mock = _setup_mock_client()
        with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
            response = client.post("/api/auth/github", json={"code": "valid_code", "state": "forged_state_token"})
        assert response.status_code == 400
        assert "state" in _get_error_message(response)

    @patch("app.services.github_oauth_service.GITHUB_CLIENT_ID", "e2e_cid")
    @patch("app.services.github_oauth_service.GITHUB_CLIENT_SECRET", "e2e_secret")
    def test_reused_state_rejected(self, client):
        """Test that reusing an OAuth state parameter is rejected."""
        auth_resp = client.get("/api/auth/github/authorize")
        state = auth_resp.json()["state"]

        mock = _setup_mock_client(
            user_resp=_mock_github_user_response(github_id=88001, login="state_reuse_user")
        )
        with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
            first_resp = client.post("/api/auth/github", json={"code": "code_first", "state": state})
        assert first_resp.status_code == 200

        with patch("app.services.github_oauth_service.httpx.AsyncClient", return_value=mock):
            second_resp = client.post("/api/auth/github", json={"code": "code_second", "state": state})
        assert second_resp.status_code == 400
        assert "consumed" in _get_error_message(second_resp)

    def test_refresh_with_expired_token(self, client):
        """Test that refreshing with an expired token returns 401."""
        response = client.post("/api/auth/refresh", json={"refresh_token": "expired.jwt.token"})
        assert response.status_code == 401

    def test_me_endpoint_without_auth(self, client):
        """Test that /auth/me without auth returns 401."""
        response = client.get("/api/auth/me")
        assert response.status_code == 401
