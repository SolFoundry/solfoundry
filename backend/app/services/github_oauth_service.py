"""GitHub OAuth completion service with PostgreSQL persistence.

Implements the full GitHub OAuth flow with production-grade security:
- CSRF protection via PostgreSQL-backed state parameters
- Token encryption at rest using Fernet symmetric encryption
- Re-authorization handling for already-linked accounts
- Token revocation with GitHub API integration
- Comprehensive error handling for denied auth, expired tokens, rate limits

The service uses the database as the single source of truth for all OAuth
state and token storage, ensuring consistency across workers and restarts.

Environment variables:
    GITHUB_CLIENT_ID: GitHub OAuth App client ID
    GITHUB_CLIENT_SECRET: GitHub OAuth App client secret
    GITHUB_REDIRECT_URI: Callback URL registered with GitHub
    JWT_SECRET_KEY: Key used to derive the Fernet encryption key
    TOKEN_ENCRYPTION_KEY: Optional explicit Fernet key (base64-encoded)

References:
    - GitHub OAuth Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
    - OWASP OAuth Security: https://cheatsheetseries.owasp.org/cheatsheets/OAuth_Security_Cheat_Sheet.html
"""

import base64
import hashlib
import logging
import os
import secrets
import uuid as uuid_module
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import httpx
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_event
from app.models.github_token import GitHubTokenDB
from app.models.oauth_state import OAuthStateDB
from app.models.user import User
from app.services.auth_service import (
    AuthError,
    GitHubOAuthError,
    InvalidStateError,
    create_access_token,
    create_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

logger = logging.getLogger(__name__)


def _to_uuid(value: Any) -> Any:
    """Convert a string to a UUID object if needed.

    Required because PG_UUID(as_uuid=True) columns expect UUID objects
    on SQLite/test backends, but our API passes user IDs as strings.

    Args:
        value: A string UUID or UUID object.

    Returns:
        A uuid.UUID instance if the input is a valid UUID string,
        otherwise returns the original value unchanged.
    """
    if isinstance(value, str):
        try:
            return uuid_module.UUID(value)
        except ValueError:
            return value
    return value


# GitHub OAuth configuration
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv(
    "GITHUB_REDIRECT_URI", "http://localhost:3000/auth/callback"
)

# GitHub API endpoints
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_USER_EMAILS_URL = "https://api.github.com/user/emails"
GITHUB_REVOKE_URL = "https://api.github.com/applications/{client_id}/token"

# OAuth state TTL
OAUTH_STATE_TTL_MINUTES = 10

# Minimum scope required for the OAuth flow
REQUIRED_SCOPE = "read:user"


class GitHubAccessDeniedError(AuthError):
    """Raised when the user denies the GitHub OAuth authorization request.

    This occurs when the user clicks "Cancel" on the GitHub authorization page
    or when the authorization is otherwise rejected by GitHub.
    """

    pass


class GitHubTokenRevokedError(AuthError):
    """Raised when attempting to use a revoked GitHub access token.

    This can happen when the user has disconnected their GitHub account
    or when an admin has revoked the token.
    """

    pass


class GitHubRateLimitError(AuthError):
    """Raised when the GitHub API rate limit has been exceeded.

    Includes the reset timestamp so callers can implement retry logic.

    Attributes:
        reset_at: UTC datetime when the rate limit resets.
        retry_after: Seconds until the rate limit resets.
    """

    def __init__(
        self, message: str, reset_at: Optional[datetime] = None, retry_after: int = 0
    ) -> None:
        """Initialize with rate limit details.

        Args:
            message: Human-readable error description.
            reset_at: When the rate limit resets.
            retry_after: Seconds until reset.
        """
        super().__init__(message)
        self.reset_at = reset_at
        self.retry_after = retry_after


class TokenEncryptionError(AuthError):
    """Raised when token encryption or decryption fails.

    This indicates a configuration issue with the encryption key
    or corrupted data in the database.
    """

    pass


def _get_fernet_key() -> bytes:
    """Derive a Fernet encryption key from configuration.

    Uses TOKEN_ENCRYPTION_KEY if set, otherwise derives a key from
    JWT_SECRET_KEY using SHA-256 and base64 encoding. The derived key
    is deterministic, so the same JWT_SECRET_KEY always produces the
    same Fernet key.

    Returns:
        A 32-byte base64-encoded key suitable for Fernet encryption.

    Raises:
        TokenEncryptionError: If no encryption key can be derived.
    """
    explicit_key = os.getenv("TOKEN_ENCRYPTION_KEY")
    if explicit_key:
        try:
            key_bytes = base64.urlsafe_b64decode(explicit_key)
            if len(key_bytes) == 32:
                return base64.urlsafe_b64encode(key_bytes)
            return explicit_key.encode()
        except Exception as exc:
            raise TokenEncryptionError(
                f"Invalid TOKEN_ENCRYPTION_KEY: {exc}"
            ) from exc

    jwt_secret = os.getenv("JWT_SECRET_KEY", "")
    if not jwt_secret:
        # Fall back to the runtime key generated by auth_service
        from app.services.auth_service import JWT_SECRET_KEY as runtime_jwt_key
        jwt_secret = runtime_jwt_key
    if not jwt_secret:
        raise TokenEncryptionError(
            "Neither TOKEN_ENCRYPTION_KEY nor JWT_SECRET_KEY is configured"
        )

    key_hash = hashlib.sha256(jwt_secret.encode()).digest()
    return base64.urlsafe_b64encode(key_hash)


def encrypt_token(plaintext_token: str) -> str:
    """Encrypt a GitHub access token for database storage.

    Uses Fernet symmetric encryption to protect the token at rest.
    The encrypted output includes a timestamp, so tokens can be
    identified as stale if needed.

    Args:
        plaintext_token: The raw GitHub OAuth access token.

    Returns:
        The encrypted token as a UTF-8 string.

    Raises:
        TokenEncryptionError: If encryption fails.
    """
    try:
        fernet = Fernet(_get_fernet_key())
        return fernet.encrypt(plaintext_token.encode()).decode()
    except TokenEncryptionError:
        raise
    except Exception as exc:
        raise TokenEncryptionError(f"Token encryption failed: {exc}") from exc


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a stored GitHub access token.

    Args:
        encrypted_token: The Fernet-encrypted token string from the database.

    Returns:
        The original plaintext GitHub access token.

    Raises:
        TokenEncryptionError: If decryption fails (wrong key or corrupted data).
    """
    try:
        fernet = Fernet(_get_fernet_key())
        return fernet.decrypt(encrypted_token.encode()).decode()
    except InvalidToken as exc:
        raise TokenEncryptionError(
            "Token decryption failed — key may have changed"
        ) from exc
    except TokenEncryptionError:
        raise
    except Exception as exc:
        raise TokenEncryptionError(f"Token decryption failed: {exc}") from exc


async def create_oauth_state(
    db: AsyncSession, ip_address: Optional[str] = None
) -> str:
    """Generate and persist a CSRF state token for the OAuth flow.

    Creates a cryptographically random state parameter and stores it in
    PostgreSQL with a 10-minute TTL. The state must be returned unchanged
    by GitHub on the callback to prevent CSRF attacks.

    Args:
        db: Async database session for persisting the state.
        ip_address: Optional IP address of the requesting client.

    Returns:
        The generated state token string.
    """
    state_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)

    oauth_state = OAuthStateDB(
        state_token=state_token,
        created_at=now,
        expires_at=now + timedelta(minutes=OAUTH_STATE_TTL_MINUTES),
        consumed=False,
        ip_address=ip_address,
    )
    db.add(oauth_state)
    await db.commit()

    logger.info(
        "OAuth state created (expires in %d min, ip=%s)",
        OAUTH_STATE_TTL_MINUTES,
        ip_address or "unknown",
    )
    return state_token


async def verify_and_consume_state(db: AsyncSession, state_token: str) -> bool:
    """Verify an OAuth state token and mark it as consumed.

    Validates that the state exists, has not expired, and has not been
    previously consumed. On success, marks the state as consumed to
    prevent reuse.

    Args:
        db: Async database session.
        state_token: The state parameter returned by GitHub.

    Returns:
        True if the state is valid.

    Raises:
        InvalidStateError: If the state is missing, expired, or already consumed.
    """
    if not state_token:
        raise InvalidStateError("Missing OAuth state parameter")

    result = await db.execute(
        select(OAuthStateDB).where(OAuthStateDB.state_token == state_token)
    )
    oauth_state = result.scalar_one_or_none()

    if not oauth_state:
        raise InvalidStateError(
            "Invalid OAuth state parameter — possible CSRF attack"
        )

    now = datetime.now(timezone.utc)

    if oauth_state.consumed:
        raise InvalidStateError("OAuth state already consumed — possible replay attack")

    # Ensure timezone-aware comparison (SQLite returns naive datetimes)
    expires_at = oauth_state.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if now > expires_at:
        oauth_state.consumed = True
        await db.commit()
        raise InvalidStateError(
            "OAuth state expired — please restart the authorization flow"
        )

    oauth_state.consumed = True
    await db.commit()

    logger.info("OAuth state verified and consumed: %s...", state_token[:8])
    return True


async def cleanup_expired_states(db: AsyncSession) -> int:
    """Remove expired OAuth state records from the database.

    Should be called periodically to prevent table bloat. States older
    than 1 hour are deleted regardless of consumption status.

    Args:
        db: Async database session.

    Returns:
        The number of expired state records deleted.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    result = await db.execute(
        delete(OAuthStateDB).where(OAuthStateDB.created_at < cutoff)
    )
    deleted_count = result.rowcount
    await db.commit()

    if deleted_count > 0:
        logger.info("Cleaned up %d expired OAuth states", deleted_count)
    return deleted_count


def build_authorize_url(state_token: str) -> str:
    """Build the GitHub OAuth authorization URL with all required parameters.

    Constructs the URL that the frontend should redirect the user to in order
    to begin the GitHub OAuth flow. Uses the minimal 'read:user' scope.

    Reads GITHUB_CLIENT_ID from the module-level variable first, falling
    back to the environment variable for compatibility with tests that
    set the env var after module import.

    Args:
        state_token: The CSRF state parameter to include in the URL.

    Returns:
        The complete GitHub authorization URL.

    Raises:
        GitHubOAuthError: If GITHUB_CLIENT_ID is not configured.
    """
    client_id = GITHUB_CLIENT_ID or os.getenv("GITHUB_CLIENT_ID", "")
    if not client_id:
        raise GitHubOAuthError(
            "GITHUB_CLIENT_ID is not configured — set it in environment variables"
        )

    params = {
        "client_id": client_id,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": REQUIRED_SCOPE,
        "state": state_token,
        "response_type": "code",
    }
    query_string = "&".join(f"{key}={value}" for key, value in params.items())
    return f"{GITHUB_AUTHORIZE_URL}?{query_string}"


async def exchange_code_for_token(code: str) -> Dict[str, Any]:
    """Exchange a GitHub authorization code for an access token and user info.

    Performs two GitHub API calls:
    1. POST to /login/oauth/access_token to exchange the code for a token
    2. GET to /user to fetch the authenticated user's profile

    If the user's email is not included in the profile (private email),
    falls back to the /user/emails endpoint.

    Args:
        code: The authorization code provided by GitHub on callback.

    Returns:
        A dictionary containing the GitHub user profile with keys:
        - id: GitHub user ID (integer)
        - login: GitHub username
        - avatar_url: Profile avatar URL
        - email: Primary email address (may be None)
        - access_token: The raw GitHub OAuth access token

    Raises:
        GitHubOAuthError: If the code exchange or user info fetch fails.
        GitHubAccessDeniedError: If the authorization was denied.
        GitHubRateLimitError: If the GitHub API rate limit is exceeded.
    """
    if not GITHUB_CLIENT_SECRET:
        raise GitHubOAuthError(
            "GITHUB_CLIENT_SECRET is not configured — set it in environment variables"
        )

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Exchange code for token
        token_response = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )

        if token_response.status_code != 200:
            raise GitHubOAuthError(
                f"GitHub token exchange failed with status {token_response.status_code}"
            )

        token_data = token_response.json()

        # Handle error responses from GitHub
        if "error" in token_data:
            error_code = token_data["error"]
            error_description = token_data.get(
                "error_description", "Unknown OAuth error"
            )

            if error_code == "access_denied":
                raise GitHubAccessDeniedError(
                    f"GitHub authorization denied: {error_description}"
                )
            if error_code == "bad_verification_code":
                raise GitHubOAuthError(
                    "Authorization code is invalid or expired — please try again"
                )
            raise GitHubOAuthError(f"GitHub OAuth error: {error_description}")

        github_access_token = token_data.get("access_token")
        if not github_access_token:
            raise GitHubOAuthError(
                "GitHub did not return an access token in the exchange response"
            )

        # Step 2: Fetch user profile
        auth_headers = {
            "Authorization": f"Bearer {github_access_token}",
            "Accept": "application/json",
        }

        user_response = await client.get(GITHUB_USER_URL, headers=auth_headers)
        _check_rate_limit(user_response)

        if user_response.status_code != 200:
            raise GitHubOAuthError(
                f"Failed to fetch GitHub user profile (status {user_response.status_code})"
            )

        user_data = user_response.json()

        # Step 3: Fetch primary email if not in profile
        if not user_data.get("email"):
            try:
                email_response = await client.get(
                    GITHUB_USER_EMAILS_URL, headers=auth_headers
                )
                if email_response.status_code == 200:
                    emails = email_response.json()
                    primary_email = next(
                        (
                            email_entry["email"]
                            for email_entry in emails
                            if email_entry.get("primary")
                        ),
                        emails[0]["email"] if emails else None,
                    )
                    user_data["email"] = primary_email
            except Exception as email_error:
                logger.warning(
                    "Failed to fetch GitHub emails: %s — continuing without email",
                    email_error,
                )

        # Include the access token in the return data for storage
        user_data["access_token"] = github_access_token
        return user_data


def _check_rate_limit(response: httpx.Response) -> None:
    """Check a GitHub API response for rate limit errors.

    Extracts rate limit headers and raises GitHubRateLimitError if
    the limit has been exceeded.

    Args:
        response: The httpx response from a GitHub API call.

    Raises:
        GitHubRateLimitError: If the rate limit has been exceeded.
    """
    if response.status_code == 403:
        remaining = response.headers.get("X-RateLimit-Remaining", "")
        if remaining == "0":
            reset_timestamp = int(response.headers.get("X-RateLimit-Reset", "0"))
            reset_at = datetime.fromtimestamp(reset_timestamp, tz=timezone.utc)
            retry_after = max(0, int((reset_at - datetime.now(timezone.utc)).total_seconds()))
            raise GitHubRateLimitError(
                f"GitHub API rate limit exceeded — resets at {reset_at.isoformat()}",
                reset_at=reset_at,
                retry_after=retry_after,
            )


async def complete_github_oauth(
    db: AsyncSession,
    code: str,
    state: Optional[str] = None,
) -> Dict[str, Any]:
    """Complete the full GitHub OAuth flow and return JWT tokens.

    This is the main entry point for the OAuth callback handler. It:
    1. Verifies the CSRF state parameter (if provided)
    2. Exchanges the authorization code for a GitHub token and user info
    3. Creates or updates the user in the database
    4. Encrypts and stores the GitHub token for future use
    5. Handles re-authorization for already-linked accounts
    6. Returns JWT access and refresh tokens

    Args:
        db: Async database session.
        code: The GitHub authorization code from the callback.
        state: The CSRF state parameter from the callback (required for security).

    Returns:
        A dictionary containing:
        - access_token: JWT access token for SolFoundry API
        - refresh_token: JWT refresh token for token renewal
        - token_type: Always "bearer"
        - expires_in: Token TTL in seconds
        - user: UserResponse with the user's profile
        - is_new_user: Whether this is a first-time registration

    Raises:
        InvalidStateError: If the CSRF state is invalid or expired.
        GitHubOAuthError: If the code exchange fails.
        GitHubAccessDeniedError: If the user denied authorization.
        GitHubRateLimitError: If GitHub API rate limit is exceeded.
    """
    # Step 1: Verify CSRF state
    if state:
        await verify_and_consume_state(db, state)

    # Step 2: Exchange code for token + user info
    github_user = await exchange_code_for_token(code)
    github_id = str(github_user["id"])
    github_access_token = github_user.pop("access_token")

    # Step 3: Find or create user
    result = await db.execute(select(User).where(User.github_id == github_id))
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    is_new_user = user is None

    if user:
        # Re-authorization: update profile fields from GitHub
        user.username = github_user.get("login", user.username)
        user.email = github_user.get("email") or user.email
        user.avatar_url = github_user.get("avatar_url") or user.avatar_url
        user.last_login_at = now
        user.updated_at = now
        logger.info("Re-authorization for existing user: %s", user.username)
    else:
        # New user registration
        user = User(
            github_id=github_id,
            username=github_user.get("login", ""),
            email=github_user.get("email"),
            avatar_url=github_user.get("avatar_url"),
            last_login_at=now,
        )
        db.add(user)
        logger.info("New user registered via GitHub: %s", user.username)

    await db.flush()

    # Step 4: Store encrypted GitHub token
    await _store_github_token(
        db=db,
        user_id=user.id,
        github_access_token=github_access_token,
        github_user_id=github_id,
        github_username=github_user.get("login", ""),
        scopes=REQUIRED_SCOPE,
    )

    await db.commit()
    await db.refresh(user)

    audit_event(
        "github_oauth_complete",
        user_id=str(user.id),
        github_username=user.username,
        is_new_user=is_new_user,
    )

    # Step 5: Generate JWT tokens
    from app.services.auth_service import _user_to_response

    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": _user_to_response(user),
        "is_new_user": is_new_user,
    }


async def _store_github_token(
    db: AsyncSession,
    user_id: Any,
    github_access_token: str,
    github_user_id: str,
    github_username: str,
    scopes: str,
) -> GitHubTokenDB:
    """Encrypt and store a GitHub access token, replacing any existing one.

    If the user already has a stored token, it is revoked and replaced.
    This handles the re-authorization case where the user goes through
    the OAuth flow again.

    Args:
        db: Async database session.
        user_id: The UUID of the user who owns the token.
        github_access_token: The plaintext GitHub access token to encrypt.
        github_user_id: The GitHub user's numeric ID.
        github_username: The GitHub user's login handle.
        scopes: Comma-separated OAuth scopes granted.

    Returns:
        The newly created GitHubTokenDB record.
    """
    now = datetime.now(timezone.utc)
    encrypted = encrypt_token(github_access_token)

    # Revoke any existing active token for this user
    result = await db.execute(
        select(GitHubTokenDB).where(
            GitHubTokenDB.user_id == _to_uuid(user_id),
            GitHubTokenDB.is_active == True,  # noqa: E712
        )
    )
    existing_token = result.scalar_one_or_none()

    if existing_token:
        existing_token.is_active = False
        existing_token.revoked_at = now
        logger.info(
            "Revoked previous GitHub token for user %s (re-authorization)",
            user_id,
        )

    # Create new token record
    new_token = GitHubTokenDB(
        user_id=user_id,
        encrypted_token=encrypted,
        github_user_id=github_user_id,
        github_username=github_username,
        scopes=scopes,
        created_at=now,
        updated_at=now,
        is_active=True,
    )
    db.add(new_token)
    return new_token


async def revoke_github_access(
    db: AsyncSession, user_id: str
) -> Dict[str, Any]:
    """Revoke a user's GitHub OAuth access and clean up stored tokens.

    Performs three operations:
    1. Looks up the user's active GitHub token in the database
    2. Attempts to revoke the token with GitHub's API (best-effort)
    3. Marks the token as revoked in the database

    The GitHub API revocation is best-effort because the user may have
    already revoked access through GitHub's settings page.

    Args:
        db: Async database session.
        user_id: The UUID of the user whose access should be revoked.

    Returns:
        A dictionary with:
        - success: Whether the revocation completed
        - message: Human-readable status message
        - github_revoked: Whether the token was also revoked on GitHub's side

    Raises:
        AuthError: If the user has no active GitHub token to revoke.
    """
    result = await db.execute(
        select(GitHubTokenDB).where(
            GitHubTokenDB.user_id == _to_uuid(user_id),
            GitHubTokenDB.is_active == True,  # noqa: E712
        )
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise AuthError(
            "No active GitHub connection found — nothing to revoke"
        )

    now = datetime.now(timezone.utc)
    github_revoked = False

    # Attempt to revoke on GitHub's side (best-effort)
    if GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET:
        try:
            plaintext_token = decrypt_token(token_record.encrypted_token)
            github_revoked = await _revoke_github_token_remote(plaintext_token)
        except (TokenEncryptionError, Exception) as revoke_error:
            logger.warning(
                "Failed to revoke GitHub token remotely for user %s: %s",
                user_id,
                revoke_error,
            )

    # Mark as revoked in database regardless
    token_record.is_active = False
    token_record.revoked_at = now
    await db.commit()

    audit_event(
        "github_access_revoked",
        user_id=user_id,
        github_username=token_record.github_username,
        github_revoked=github_revoked,
    )

    logger.info(
        "GitHub access revoked for user %s (github_revoked=%s)",
        user_id,
        github_revoked,
    )

    return {
        "success": True,
        "message": "GitHub access has been revoked",
        "github_revoked": github_revoked,
    }


async def _revoke_github_token_remote(plaintext_token: str) -> bool:
    """Attempt to revoke a GitHub token via the GitHub Applications API.

    Uses HTTP Basic auth with client_id:client_secret as required by
    GitHub's token revocation endpoint.

    Args:
        plaintext_token: The decrypted GitHub access token to revoke.

    Returns:
        True if GitHub confirmed the revocation, False otherwise.
    """
    revoke_url = GITHUB_REVOKE_URL.format(client_id=GITHUB_CLIENT_ID)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.delete(
                revoke_url,
                auth=(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET),
                json={"access_token": plaintext_token},
                headers={"Accept": "application/json"},
            )
            # GitHub returns 204 on successful revocation
            if response.status_code == 204:
                return True
            logger.warning(
                "GitHub token revocation returned status %d", response.status_code
            )
            return False
    except Exception as request_error:
        logger.warning("GitHub token revocation request failed: %s", request_error)
        return False


async def get_github_connection_status(
    db: AsyncSession, user_id: str
) -> Dict[str, Any]:
    """Check whether a user has an active GitHub connection.

    Args:
        db: Async database session.
        user_id: The UUID of the user to check.

    Returns:
        A dictionary with:
        - connected: Whether the user has an active GitHub token
        - github_username: The linked GitHub username (if connected)
        - github_user_id: The linked GitHub user ID (if connected)
        - connected_at: When the connection was established (if connected)
    """
    result = await db.execute(
        select(GitHubTokenDB).where(
            GitHubTokenDB.user_id == _to_uuid(user_id),
            GitHubTokenDB.is_active == True,  # noqa: E712
        )
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        return {"connected": False}

    return {
        "connected": True,
        "github_username": token_record.github_username,
        "github_user_id": token_record.github_user_id,
        "connected_at": token_record.created_at,
    }
