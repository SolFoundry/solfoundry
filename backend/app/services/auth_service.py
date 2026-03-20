"""Authentication service for GitHub OAuth and Solana wallet auth.

This module provides:
- GitHub OAuth flow (authorize → callback → JWT session)
- Solana wallet authentication (signature verification)
- Wallet linking to GitHub accounts
- JWT token generation and refresh
"""

import os
import secrets
import base64
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import httpx
from jose import jwt, JWTError
from solders.message import Message
from solders.signature import Signature
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.signature import verify

from app.models.user import (
    UserDB, UserCreate, UserResponse, UserWithWalletResponse,
    GitHubOAuthRequest, GitHubOAuthResponse,
    WalletAuthRequest, WalletAuthResponse,
    LinkWalletRequest, LinkWalletResponse,
    RefreshTokenRequest, RefreshTokenResponse,
    AuthMessageResponse
)
from app.database import get_db_session

# Configuration from environment
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:3000/auth/callback")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 7 days

# In-memory stores for MVP (replace with Redis/DB in production)
_user_store: Dict[str, UserDB] = {}
_wallet_to_user: Dict[str, str] = {}  # wallet_address -> user_id
_github_to_user: Dict[str, str] = {}  # github_id -> user_id
_auth_messages: Dict[str, Dict[str, Any]] = {}  # nonce -> {message, expires_at, wallet_address}


class AuthError(Exception):
    """Base exception for authentication errors."""
    pass


class GitHubOAuthError(AuthError):
    """Error during GitHub OAuth flow."""
    pass


class WalletVerificationError(AuthError):
    """Error during wallet signature verification."""
    pass


class TokenExpiredError(AuthError):
    """JWT token has expired."""
    pass


class InvalidTokenError(AuthError):
    """JWT token is invalid."""
    pass


def _db_to_response(db: UserDB) -> UserResponse:
    """Convert database model to response model."""
    return UserResponse(
        id=str(db.id),
        github_id=db.github_id,
        username=db.username,
        email=db.email,
        avatar_url=db.avatar_url,
        wallet_address=db.wallet_address,
        wallet_verified=db.wallet_verified,
        created_at=db.created_at,
        updated_at=db.updated_at,
    )


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token for a user."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT refresh token for a user."""
    if expires_delta is None:
        expires_delta = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    now = datetime.now(timezone.utc)
    expire = now + expires_delta
    
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str, token_type: str = "access") -> str:
    """Decode and validate a JWT token, returning the user ID."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        
        if payload.get("type") != token_type:
            raise InvalidTokenError(f"Expected {token_type} token, got {payload.get('type')}")
        
        user_id = payload.get("sub")
        if not user_id:
            raise InvalidTokenError("Token missing subject claim")
        
        return user_id
        
    except JWTError as e:
        if "expired" in str(e).lower():
            raise TokenExpiredError("Token has expired")
        raise InvalidTokenError(f"Invalid token: {str(e)}")


def get_github_authorize_url(state: Optional[str] = None) -> str:
    """Generate GitHub OAuth authorization URL."""
    if not GITHUB_CLIENT_ID:
        raise GitHubOAuthError("GITHUB_CLIENT_ID not configured")
    
    if state is None:
        state = secrets.token_urlsafe(32)
    
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "read:user user:email",
        "state": state,
        "response_type": "code",
    }
    
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"https://github.com/login/oauth/authorize?{query}", state


async def exchange_github_code(code: str) -> Dict[str, Any]:
    """Exchange GitHub OAuth code for access token."""
    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
        
        if token_response.status_code != 200:
            raise GitHubOAuthError(f"Failed to exchange code: {token_response.text}")
        
        token_data = token_response.json()
        
        if "error" in token_data:
            raise GitHubOAuthError(f"GitHub OAuth error: {token_data.get('error_description', token_data['error'])}")
        
        github_token = token_data.get("access_token")
        if not github_token:
            raise GitHubOAuthError("No access token in GitHub response")
        
        # Get user info
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {github_token}",
                "Accept": "application/json",
            },
        )
        
        if user_response.status_code != 200:
            raise GitHubOAuthError(f"Failed to get user info: {user_response.text}")
        
        user_data = user_response.json()
        
        # Get user email if not public
        if not user_data.get("email"):
            email_response = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": f"Bearer {github_token}",
                    "Accept": "application/json",
                },
            )
            if email_response.status_code == 200:
                emails = email_response.json()
                primary_email = next(
                    (e["email"] for e in emails if e.get("primary")),
                    emails[0]["email"] if emails else None
                )
                user_data["email"] = primary_email
        
        return user_data


async def github_oauth_login(code: str) -> GitHubOAuthResponse:
    """
    Complete GitHub OAuth flow and return JWT tokens.
    
    Flow:
    1. Exchange code for GitHub access token
    2. Get user info from GitHub
    3. Create or update user in database
    4. Generate JWT tokens
    """
    # Get user info from GitHub
    github_user = await exchange_github_code(code)
    
    github_id = str(github_user["id"])
    username = github_user.get("login", "")
    email = github_user.get("email")
    avatar_url = github_user.get("avatar_url")
    
    # Check if user already exists
    user_id = _github_to_user.get(github_id)
    
    if user_id:
        # Update existing user
        user = _user_store.get(user_id)
        if user:
            user.username = username
            user.email = email
            user.avatar_url = avatar_url
            user.last_login_at = datetime.now(timezone.utc)
    else:
        # Create new user
        import uuid
        user = UserDB(
            id=uuid.uuid4(),
            github_id=github_id,
            username=username,
            email=email,
            avatar_url=avatar_url,
            last_login_at=datetime.now(timezone.utc),
        )
        user_id = str(user.id)
        _user_store[user_id] = user
        _github_to_user[github_id] = user_id
    
    # Generate tokens
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    
    return GitHubOAuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_db_to_response(user),
    )


def generate_auth_message(wallet_address: str) -> AuthMessageResponse:
    """Generate a message for wallet authentication signing."""
    nonce = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    message = f"""SolFoundry Authentication

Sign this message to authenticate your wallet.

Wallet: {wallet_address[:8]}...{wallet_address[-8:]}
Nonce: {nonce}
Timestamp: {datetime.now(timezone.utc).isoformat()}
Expires: {expires_at.isoformat()}

This signature will prove you own this wallet address."""
    
    _auth_messages[nonce] = {
        "message": message,
        "wallet_address": wallet_address,
        "expires_at": expires_at,
    }
    
    return AuthMessageResponse(
        message=message,
        nonce=nonce,
        expires_at=expires_at,
    )


def verify_wallet_signature(wallet_address: str, message: str, signature: str) -> bool:
    """
    Verify a Solana wallet signature.
    
    Args:
        wallet_address: The Solana public key (base58)
        message: The message that was signed
        signature: Base64-encoded signature
    
    Returns:
        True if signature is valid
    
    Raises:
        WalletVerificationError: If signature is invalid
    """
    try:
        # Decode the public key
        pubkey = Pubkey.from_string(wallet_address)
        
        # Decode the signature from base64
        signature_bytes = base64.b64decode(signature)
        sig = Signature(signature_bytes)
        
        # Encode the message
        message_bytes = message.encode('utf-8')
        
        # Verify the signature
        # The verify method checks if the signature matches the pubkey and message
        sig.verify(pubkey, message_bytes)
        
        return True
        
    except Exception as e:
        raise WalletVerificationError(f"Failed to verify signature: {str(e)}")


async def wallet_authenticate(wallet_address: str, signature: str, message: str) -> WalletAuthResponse:
    """
    Authenticate a user via Solana wallet signature.
    
    Flow:
    1. Verify the signature
    2. Check if wallet is linked to an existing user
    3. If not, create a new user with wallet only
    4. Generate JWT tokens
    """
    # Verify the signature
    verify_wallet_signature(wallet_address, message, signature)
    
    # Check if wallet is linked to a user
    user_id = _wallet_to_user.get(wallet_address)
    
    if user_id:
        # Existing user
        user = _user_store.get(user_id)
        if user:
            user.last_login_at = datetime.now(timezone.utc)
    else:
        # Create new wallet-only user
        import uuid
        user = UserDB(
            id=uuid.uuid4(),
            github_id=f"wallet_{wallet_address[:16]}",  # Placeholder
            username=f"wallet_{wallet_address[:8]}",
            wallet_address=wallet_address,
            wallet_verified=True,
            last_login_at=datetime.now(timezone.utc),
        )
        user_id = str(user.id)
        _user_store[user_id] = user
        _wallet_to_user[wallet_address] = user_id
    
    # Generate tokens
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    
    return WalletAuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_db_to_response(user),
    )


async def link_wallet(user_id: str, wallet_address: str, signature: str, message: str) -> LinkWalletResponse:
    """
    Link a Solana wallet to an existing user account.
    
    Args:
        user_id: The existing user's ID
        wallet_address: The wallet address to link
        signature: Signature proving ownership
        message: The message that was signed
    
    Returns:
        LinkWalletResponse with updated user
    
    Raises:
        AuthError: If wallet is already linked to another account
    """
    # Verify the signature
    verify_wallet_signature(wallet_address, message, signature)
    
    # Check if wallet is already linked
    existing_user_id = _wallet_to_user.get(wallet_address)
    if existing_user_id and existing_user_id != user_id:
        raise AuthError("Wallet already linked to another account")
    
    # Get the user
    user = _user_store.get(user_id)
    if not user:
        raise AuthError("User not found")
    
    # Update user with wallet
    if existing_user_id == user_id:
        # Already linked to this user
        pass
    else:
        # Link the wallet
        user.wallet_address = wallet_address
        user.wallet_verified = True
        user.updated_at = datetime.now(timezone.utc)
        _wallet_to_user[wallet_address] = user_id
    
    return LinkWalletResponse(
        success=True,
        message="Wallet linked successfully",
        user=_db_to_response(user),
    )


async def refresh_access_token(refresh_token: str) -> RefreshTokenResponse:
    """
    Refresh an access token using a refresh token.
    
    Args:
        refresh_token: Valid refresh token
    
    Returns:
        New access token
    
    Raises:
        InvalidTokenError: If refresh token is invalid
        TokenExpiredError: If refresh token has expired
    """
    user_id = decode_token(refresh_token, token_type="refresh")
    
    # Verify user still exists
    user = _user_store.get(user_id)
    if not user:
        raise InvalidTokenError("User not found")
    
    # Generate new access token
    access_token = create_access_token(user_id)
    
    return RefreshTokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def get_current_user(user_id: str) -> UserResponse:
    """Get the current user by ID."""
    user = _user_store.get(user_id)
    if not user:
        raise AuthError("User not found")
    return _db_to_response(user)


# Export functions for testing and external use
__all__ = [
    # Token functions
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "refresh_access_token",
    
    # GitHub OAuth
    "get_github_authorize_url",
    "exchange_github_code",
    "github_oauth_login",
    
    # Wallet auth
    "generate_auth_message",
    "verify_wallet_signature",
    "wallet_authenticate",
    "link_wallet",
    
    # User management
    "get_current_user",
    
    # Exceptions
    "AuthError",
    "GitHubOAuthError",
    "WalletVerificationError",
    "TokenExpiredError",
    "InvalidTokenError",
]