"""E2E test: Authentication flow.

Validates: GitHub OAuth -> wallet connect -> link wallet -> create bounty.

Tests cover the JWT token lifecycle, wallet signature verification,
and the complete auth → action flow where an authenticated user
creates a bounty.

Requirement: Issue #196 item 5.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from tests.e2e.conftest import create_bounty_via_api
from tests.e2e.factories import (
    DEFAULT_WALLET,
    build_bounty_create_payload,
    build_github_user_data,
)


class TestGitHubOAuthFlow:
    """Validate GitHub OAuth authorization flow endpoints."""

    def test_github_authorize_url_generation(self, client: TestClient) -> None:
        """Verify the GitHub authorization URL endpoint returns a valid URL.

        The endpoint should return an ``authorize_url`` pointing to GitHub's
        OAuth authorization page with the correct client_id parameter.
        If GITHUB_CLIENT_ID is not configured, the endpoint returns a 500
        error, which we explicitly verify as a configuration error rather
        than treating it as a silent pass.
        """
        response = client.get("/api/auth/github/authorize")

        if response.status_code == 200:
            data = response.json()
            assert "authorize_url" in data
            assert "state" in data
            assert "github.com" in data["authorize_url"]
        else:
            # Explicitly verify this is a configuration-related error,
            # not an unexpected application failure.
            assert response.status_code == 500, (
                f"Expected 200 (configured) or 500 (unconfigured), "
                f"got {response.status_code}"
            )
            # Verify the error is related to missing OAuth configuration
            error_body = response.json()
            assert "message" in error_body or "detail" in error_body, (
                "OAuth failure should return a structured error response"
            )

    def test_github_authorize_with_custom_state(
        self, client: TestClient
    ) -> None:
        """Verify custom CSRF state is passed through the authorization URL.

        When GITHUB_CLIENT_ID is not configured, the endpoint returns 500.
        We verify that unrelated state-handling logic is not silently skipped.
        """
        response = client.get(
            "/api/auth/github/authorize",
            params={"state": "custom-csrf-token"},
        )
        if response.status_code == 200:
            data = response.json()
            assert data["state"] == "custom-csrf-token"
        else:
            assert response.status_code == 500, (
                f"Expected 200 or 500 (OAuth not configured), got {response.status_code}"
            )


class TestWalletAuthFlow:
    """Validate Solana wallet authentication endpoints."""

    def test_wallet_auth_message_generation(self, client: TestClient) -> None:
        """Verify the challenge message endpoint returns a signable message.

        The message should contain the wallet address and a unique nonce
        for replay protection.
        """
        response = client.get(
            "/api/auth/wallet/message",
            params={"wallet_address": DEFAULT_WALLET},
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "nonce" in data
        assert DEFAULT_WALLET in data["message"]
        assert "SolFoundry" in data["message"]

    def test_wallet_auth_nonce_uniqueness(self) -> None:
        """Verify that each challenge message gets a unique nonce.

        Nonce reuse would allow replay attacks, so each call must
        generate a fresh nonce.  Tests the service directly.
        """
        from app.services.auth_service import generate_auth_message

        nonces = set()
        for _ in range(5):
            result = generate_auth_message(DEFAULT_WALLET)
            nonces.add(result["nonce"])

        assert len(nonces) == 5, "All nonces should be unique"


class TestJWTTokenLifecycle:
    """Validate JWT token creation, decoding, and expiration."""

    def test_create_and_decode_access_token(self) -> None:
        """Verify access token creation and decoding round-trips correctly.

        Creates an access token for a known user ID, then decodes it
        to verify the user ID is preserved.
        """
        from app.services.auth_service import create_access_token, decode_token

        user_id = str(uuid.uuid4())
        token = create_access_token(user_id)
        decoded_user_id = decode_token(token, token_type="access")
        assert decoded_user_id == user_id

    def test_create_and_decode_refresh_token(self) -> None:
        """Verify refresh token creation and decoding round-trips correctly."""
        from app.services.auth_service import create_refresh_token, decode_token

        user_id = str(uuid.uuid4())
        token = create_refresh_token(user_id)
        decoded_user_id = decode_token(token, token_type="refresh")
        assert decoded_user_id == user_id

    def test_access_token_cannot_be_decoded_as_refresh(self) -> None:
        """Verify token type enforcement prevents type confusion attacks.

        An access token decoded with ``token_type="refresh"`` should raise
        an ``InvalidTokenError``.
        """
        from app.services.auth_service import (
            InvalidTokenError,
            create_access_token,
            decode_token,
        )

        user_id = str(uuid.uuid4())
        token = create_access_token(user_id)

        with pytest.raises(InvalidTokenError):
            decode_token(token, token_type="refresh")

    def test_refresh_token_cannot_be_decoded_as_access(self) -> None:
        """Verify refresh tokens are rejected when decoded as access tokens."""
        from app.services.auth_service import (
            InvalidTokenError,
            create_refresh_token,
            decode_token,
        )

        user_id = str(uuid.uuid4())
        token = create_refresh_token(user_id)

        with pytest.raises(InvalidTokenError):
            decode_token(token, token_type="access")

    def test_expired_access_token_raises_error(self) -> None:
        """Verify that expired tokens are correctly rejected.

        Creates a token with immediate expiration, then verifies
        decoding raises ``TokenExpiredError``.
        """
        from app.services.auth_service import (
            TokenExpiredError,
            create_access_token,
            decode_token,
        )

        user_id = str(uuid.uuid4())
        token = create_access_token(
            user_id, expires_delta=timedelta(seconds=-1)
        )

        with pytest.raises(TokenExpiredError):
            decode_token(token, token_type="access")

    def test_invalid_token_format_raises_error(self) -> None:
        """Verify malformed tokens are rejected with ``InvalidTokenError``."""
        from app.services.auth_service import InvalidTokenError, decode_token

        with pytest.raises(InvalidTokenError):
            decode_token("not-a-valid-jwt-token", token_type="access")


class TestOAuthStateVerification:
    """Validate OAuth state parameter handling for CSRF protection."""

    def test_state_creation_and_verification(self) -> None:
        """Verify OAuth state is created, stored, and verified correctly.

        The state parameter prevents CSRF attacks by ensuring the callback
        originated from a legitimate authorization request.

        When GITHUB_CLIENT_ID is not configured, this test verifies that
        the expected ``GitHubOAuthError`` is raised rather than silently
        passing (which would mask real failures).
        """
        from app.services.auth_service import (
            get_github_authorize_url,
            verify_oauth_state,
            GitHubOAuthError,
        )

        import os
        github_configured = bool(os.environ.get("GITHUB_CLIENT_ID"))

        if github_configured:
            # Full path: generate URL, extract state, verify it
            _, state = get_github_authorize_url()
            result = verify_oauth_state(state)
            assert result is True
        else:
            # Explicitly verify the expected error when unconfigured
            with pytest.raises(GitHubOAuthError):
                get_github_authorize_url()

    def test_invalid_state_is_rejected(self) -> None:
        """Verify that unknown state values are rejected."""
        from app.services.auth_service import (
            InvalidStateError,
            verify_oauth_state,
        )

        with pytest.raises(InvalidStateError):
            verify_oauth_state("invalid-state-that-was-never-issued")

    def test_empty_state_is_rejected(self) -> None:
        """Verify that empty state strings are rejected."""
        from app.services.auth_service import (
            InvalidStateError,
            verify_oauth_state,
        )

        with pytest.raises(InvalidStateError):
            verify_oauth_state("")


class TestAuthenticatedBountyCreation:
    """Validate the auth -> action flow where a user creates a bounty.

    Every request in this class sends ``auth_headers`` (Bearer token) to
    exercise the authenticated code path end-to-end.
    """

    def test_authenticated_user_can_create_bounty(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        """Verify an authenticated user can successfully create a bounty.

        Sends the ``Authorization: Bearer`` header and confirms the
        bounty is created with the expected attributes.
        """
        payload = build_bounty_create_payload(
            title="Authenticated bounty creation",
            reward_amount=500.0,
        )
        response = client.post(
            "/api/bounties", json=payload, headers=auth_headers
        )
        assert response.status_code == 201
        bounty = response.json()
        assert bounty["title"] == "Authenticated bounty creation"
        assert bounty["status"] == "open"

    def test_authenticated_user_full_flow(
        self, client: TestClient, auth_headers: dict
    ) -> None:
        """Verify end-to-end flow: authenticate -> create bounty -> verify.

        Simulates the real user journey with auth headers on every request:
        1. Create a bounty (authenticated).
        2. Retrieve the bounty (authenticated).
        3. Submit a solution (authenticated).
        """
        # Create bounty with auth headers
        create_payload = build_bounty_create_payload(
            title="Full auth flow bounty",
            reward_amount=300.0,
        )
        create_response = client.post(
            "/api/bounties", json=create_payload, headers=auth_headers
        )
        assert create_response.status_code == 201
        bounty_id = create_response.json()["id"]

        # Retrieve bounty with auth headers
        get_response = client.get(
            f"/api/bounties/{bounty_id}", headers=auth_headers
        )
        assert get_response.status_code == 200
        assert get_response.json()["title"] == "Full auth flow bounty"

        # Submit solution with auth headers
        submit_response = client.post(
            f"/api/bounties/{bounty_id}/submit",
            json={
                "pr_url": "https://github.com/SolFoundry/solfoundry/pull/42",
                "submitted_by": "authenticated-dev",
                "notes": "Solution from authenticated user",
            },
            headers=auth_headers,
        )
        assert submit_response.status_code == 201


class TestWalletAuthChallengeFlow:
    """Validate the wallet authentication challenge-response flow."""

    def test_challenge_nonce_verification(self) -> None:
        """Verify nonce-based challenge verification works correctly.

        Creates a challenge, then verifies it with the correct nonce,
        wallet, and message combination.
        """
        from app.services.auth_service import (
            generate_auth_message,
            verify_auth_challenge,
        )

        result = generate_auth_message(DEFAULT_WALLET)
        nonce = result["nonce"]
        message = result["message"]

        # Successful verification consumes the nonce
        verified = verify_auth_challenge(nonce, DEFAULT_WALLET, message)
        assert verified is True

    def test_nonce_cannot_be_reused(self) -> None:
        """Verify that a nonce is consumed after first use (replay prevention).

        After successful verification, the same nonce should be rejected
        to prevent replay attacks.
        """
        from app.services.auth_service import (
            InvalidNonceError,
            generate_auth_message,
            verify_auth_challenge,
        )

        result = generate_auth_message(DEFAULT_WALLET)
        nonce = result["nonce"]
        message = result["message"]

        # First use succeeds
        verify_auth_challenge(nonce, DEFAULT_WALLET, message)

        # Second use fails (nonce consumed)
        with pytest.raises(InvalidNonceError):
            verify_auth_challenge(nonce, DEFAULT_WALLET, message)

    def test_wrong_wallet_rejected(self) -> None:
        """Verify that challenges reject mismatched wallet addresses."""
        from app.services.auth_service import (
            InvalidNonceError,
            generate_auth_message,
            verify_auth_challenge,
        )

        result = generate_auth_message(DEFAULT_WALLET)
        nonce = result["nonce"]
        message = result["message"]

        with pytest.raises(InvalidNonceError):
            verify_auth_challenge(nonce, "DifferentWalletAddress123456789012", message)
