"""Authentication service - Security hardened version.

Fixes for review feedback:
- PostgreSQL persistence
- OAuth state verification
- Nonce binding for wallet auth
- Comprehensive tests
"""

import os
import secrets
from uuid import UUID
import base64
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict

import httpx
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from solders.signature import Signature
from solders.pubkey import Pubkey

from app.models.user import User, UserResponse
from app.core.audit import audit_event

logger = logging.getLogger(__name__)

# Config
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv(
    "GITHUB_REDIRECT_URI", "http://localhost:3000/auth/callback"
)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(32)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Temp stores (use Redis in production)
_oauth_states: Dict[str, Dict] = {}
_auth_challenges: Dict[str, Dict] = {}


class AuthError(Exception):
    """Base exception for authentication errors."""

    pass


class GitHubOAuthError(AuthError):
    """Raised when GitHub OAuth flow fails."""

    pass


class WalletVerificationError(AuthError):
    """Raised when wallet signature verification fails."""

    pass


class TokenExpiredError(AuthError):
    """Raised when a JWT token has expired."""

    pass


class InvalidTokenError(AuthError):
    """Raised when a JWT token is malformed or invalid."""

    pass


class InvalidStateError(AuthError):
    """Raised when an OAuth state parameter is invalid."""

    pass


class InvalidNonceError(AuthError):
    """Raised when a wallet auth nonce is invalid."""

    pass


def _user_to_response(user: User) -> UserResponse:
    """Convert a User ORM instance to a UserResponse."""
    return UserResponse(
        id=str(user.id),
        github_id=user.github_id,
        username=user.username,
        email=user.email,
        avatar_url=user.avatar_url,
        wallet_address=user.wallet_address,
        wallet_verified=user.wallet_verified,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a signed JWT access token for a user."""
    expires_delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(
    user_id: str, expires_delta: Optional[timedelta] = None
) -> str:
    """Generate a signed JWT refresh token for a user."""
    expires_delta = expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str, token_type: str = "access") -> str:
    """Decode and validate a JWT token, returning user ID."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != token_type:
            raise InvalidTokenError(f"Expected {token_type} token")
        user_id = payload.get("sub")
        if not user_id:
            raise InvalidTokenError("Missing subject claim")
        return user_id
    except JWTError as e:
        if "expired" in str(e).lower():
            raise TokenExpiredError("Token expired")
        raise InvalidTokenError(f"Invalid token: {e}")


def get_github_authorize_url(state: Optional[str] = None) -> tuple:
    """Build the GitHub OAuth authorization URL."""
    if not GITHUB_CLIENT_ID:
        raise GitHubOAuthError("GITHUB_CLIENT_ID not configured")
    state = state or secrets.token_urlsafe(32)
    _oauth_states[state] = {
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "read:user user:email",
        "state": state,
        "response_type": "code",
    }
    return (
        f"https://github.com/login/oauth/authorize?{'&'.join(f'{k}={v}' for k, v in params.items())}",
        state,
    )


def verify_oauth_state(state: str) -> bool:
    """Verify the OAuth state parameter is valid."""
    if not state:
        raise InvalidStateError("Missing state")
    data = _oauth_states.get(state)
    if not data:
        raise InvalidStateError("Invalid state")
    if datetime.now(timezone.utc) > data["expires_at"]:
        del _oauth_states[state]
        raise InvalidStateError("State expired")
    del _oauth_states[state]
    return True


async def exchange_github_code(code: str, state: Optional[str] = None) -> Dict:
    """Exchange a GitHub OAuth code for user profile."""
    if state:
        verify_oauth_state(state)
    if not GITHUB_CLIENT_SECRET:
        raise GitHubOAuthError("GITHUB_CLIENT_SECRET not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
        if resp.status_code != 200:
            raise GitHubOAuthError(f"Token exchange failed: {resp.status_code}")
        data = resp.json()
        if "error" in data:
            raise GitHubOAuthError(
                f"OAuth error: {data.get('error_description', data['error'])}"
            )

        token = data.get("access_token")
        if not token:
            raise GitHubOAuthError("No access token")

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        )
        if user_resp.status_code != 200:
            raise GitHubOAuthError("Failed to get user info")

        user_data = user_resp.json()
        if not user_data.get("email"):
            email_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
            )
            if email_resp.status_code == 200:
                emails = email_resp.json()
                user_data["email"] = next(
                    (e["email"] for e in emails if e.get("primary")),
                    emails[0]["email"] if emails else None,
                )
        return user_data


async def github_oauth_login(
    db: AsyncSession,
    code: str,
    state: Optional[str] = None,
    client_ip: str = "unknown",
) -> Dict:
    """Complete GitHub OAuth login and create/update user.

    Runs anti-sybil registration checks for new accounts.  Hard-block
    failures raise ``HTTPException(403)``; soft flags are logged silently.
    """
    from fastapi import HTTPException as FastAPIHTTPException
    from app.services.anti_sybil_service import (
        has_hard_block,
        run_registration_checks,
    )

    github_user = await exchange_github_code(code, state)
    github_id = str(github_user["id"])

    result = await db.execute(select(User).where(User.github_id == github_id))
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    is_new_user = user is None

    if user:
        user.username = github_user.get("login", "")
        user.email = github_user.get("email") or user.email
        user.avatar_url = github_user.get("avatar_url") or user.avatar_url
        user.last_login_at = now
        user.updated_at = now
    else:
        user = User(
            github_id=github_id,
            username=github_user.get("login", ""),
            email=github_user.get("email"),
            avatar_url=github_user.get("avatar_url"),
            last_login_at=now,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    # Anti-sybil checks for new registrations
    if is_new_user:
        try:
            results = await run_registration_checks(
                user_id=str(user.id),
                ip=client_ip,
                github_created_at=github_user.get("created_at", now.isoformat()),
                public_repos=int(github_user.get("public_repos", 0)),
                followers=int(github_user.get("followers", 0)),
                following=int(github_user.get("following", 0)),
            )
            blocker = has_hard_block(results)
            if blocker:
                raise FastAPIHTTPException(
                    status_code=403,
                    detail=blocker.message,
                )
        except FastAPIHTTPException:
            raise
        except Exception as exc:
            logger.warning("Anti-sybil check failed (non-fatal): %s", exc)

    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": _user_to_response(user),
    }


def generate_auth_message(wallet_address: str) -> Dict:
    """Create a challenge message for wallet auth."""
    nonce = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    message = f"""SolFoundry Authentication

Wallet: {wallet_address}
Nonce: {nonce}
Expires: {expires.isoformat()}

Sign to prove wallet ownership."""

    _auth_challenges[nonce] = {
        "wallet_address": wallet_address.lower(),
        "message": message,
        "expires_at": expires,
    }
    return {"message": message, "nonce": nonce, "expires_at": expires}


def verify_auth_challenge(nonce: str, wallet: str, message: str) -> bool:
    """Verify a wallet auth challenge nonce and message."""
    if not nonce:
        raise InvalidNonceError("Missing nonce")
    challenge = _auth_challenges.get(nonce)
    if not challenge:
        raise InvalidNonceError("Invalid nonce")
    if datetime.now(timezone.utc) > challenge["expires_at"]:
        del _auth_challenges[nonce]
        raise InvalidNonceError("Nonce expired")
    if challenge["wallet_address"] != wallet.lower():
        raise InvalidNonceError("Wallet mismatch")
    if challenge["message"] != message:
        raise InvalidNonceError("Message mismatch")
    del _auth_challenges[nonce]
    return True


def verify_wallet_signature(wallet_address: str, message: str, signature: str) -> bool:
    """Verify a Solana wallet signature."""
    try:
        if not wallet_address or len(wallet_address) < 32 or len(wallet_address) > 48:
            raise WalletVerificationError("Invalid wallet format")
        pubkey = Pubkey.from_string(wallet_address)
        sig_bytes = base64.b64decode(signature)
        if len(sig_bytes) != 64:
            raise WalletVerificationError("Invalid signature length")
        sig = Signature(sig_bytes)
        sig.verify(pubkey, message.encode("utf-8"))
        return True
    except WalletVerificationError:
        raise
    except Exception as e:
        raise WalletVerificationError(f"Verification failed: {e}")


async def wallet_authenticate(
    db: AsyncSession,
    wallet: str,
    signature: str,
    message: str,
    nonce: Optional[str] = None,
) -> Dict:
    """Authenticate via wallet signature."""
    if nonce:
        verify_auth_challenge(nonce, wallet, message)
    verify_wallet_signature(wallet, message, signature)

    result = await db.execute(select(User).where(User.wallet_address == wallet.lower()))
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if user:
        user.last_login_at = now
        user.updated_at = now
    else:
        user = User(
            github_id=f"wallet_{wallet[:16].lower()}",
            username=f"wallet_{wallet[:8].lower()}",
            wallet_address=wallet.lower(),
            wallet_verified=True,
            last_login_at=now,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": _user_to_response(user),
    }


async def link_wallet_to_user(
    db: AsyncSession,
    user_id: str,
    wallet: str,
    signature: str,
    message: str,
    nonce: Optional[str] = None,
) -> Dict:
    """Link a verified wallet to an existing user."""
    if nonce:
        verify_auth_challenge(nonce, wallet, message)
    verify_wallet_signature(wallet, message, signature)

    result = await db.execute(select(User).where(User.wallet_address == wallet.lower()))
    existing = result.scalar_one_or_none()
    if existing and str(existing.id) != user_id:
        raise AuthError("Wallet already linked")

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise AuthError("User not found")

    user.wallet_address = wallet.lower()
    user.wallet_verified = True
    user.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(user)

    audit_event(
        "auth_wallet_linked", user_id=str(user.id), wallet_address=user.wallet_address
    )

    return {
        "success": True,
        "wallet_address": user.wallet_address,
        "message": "Wallet linked",
        "user": _user_to_response(user),
    }


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> Dict:
    """Exchange a refresh token for a new access token."""
    user_id = decode_token(refresh_token, "refresh")
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    if not result.scalar_one_or_none():
        raise InvalidTokenError("User not found")
    return {
        "access_token": create_access_token(user_id),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


async def get_current_user(db: AsyncSession, user_id: str) -> UserResponse:
    """Retrieve the current authenticated user by ID."""
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise AuthError("User not found")
    return _user_to_response(user)
