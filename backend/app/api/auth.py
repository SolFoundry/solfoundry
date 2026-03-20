"""Authentication API endpoints.

This module provides REST API endpoints for:
- GitHub OAuth flow
- Solana wallet authentication
- Wallet linking
- Token refresh
- Current user info
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.user import (
    GitHubOAuthRequest,
    GitHubOAuthResponse,
    WalletAuthRequest,
    WalletAuthResponse,
    LinkWalletRequest,
    LinkWalletResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    UserResponse,
    AuthMessageResponse,
)
from app.services import auth_service
from app.services.auth_service import (
    AuthError,
    GitHubOAuthError,
    WalletVerificationError,
    TokenExpiredError,
    InvalidTokenError,
)

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Common response schemas reused across endpoints
# ---------------------------------------------------------------------------

_401 = {
    "description": "Missing or invalid authentication token",
    "content": {
        "application/json": {
            "example": {"detail": "Token has expired"}
        }
    },
}
_400_oauth = {
    "description": "OAuth error — invalid code, state mismatch, or GitHub API failure",
    "content": {
        "application/json": {
            "example": {"detail": "Invalid OAuth code or state mismatch"}
        }
    },
}
_400_wallet = {
    "description": "Wallet signature verification failed",
    "content": {
        "application/json": {
            "example": {"detail": "Signature verification failed: invalid signature bytes"}
        }
    },
}
_500 = {
    "description": "Internal server error",
    "content": {
        "application/json": {
            "example": {"detail": "GitHub API unavailable"}
        }
    },
}


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(None),
) -> str:
    """
    Extract and validate the current user ID from JWT token.

    This dependency is used to protect routes that require authentication.
    """
    token = None

    if credentials:
        token = credentials.credentials
    elif authorization:
        if authorization.startswith("Bearer "):
            token = authorization[7:]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = auth_service.decode_token(token, token_type="access")
        return user_id
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get(
    "/github/authorize",
    response_model=dict,
    summary="Get GitHub OAuth authorization URL",
    description="""
Returns the URL to redirect your user to in order to start the GitHub OAuth flow.

**Flow:**
1. Call this endpoint to get `authorize_url` and `state`
2. Store `state` in your session (CSRF protection)
3. Redirect the user to `authorize_url`
4. GitHub redirects back to your app with `?code=xxx&state=xxx`
5. Pass `code` (and optionally `state`) to `POST /auth/github`

The `state` parameter is a random token used to prevent CSRF attacks.
If you pass your own `state`, it will be returned unchanged.
""",
    responses={
        200: {
            "description": "Authorization URL generated",
            "content": {
                "application/json": {
                    "example": {
                        "authorize_url": "https://github.com/login/oauth/authorize?client_id=abc&state=xyz&scope=read:user,user:email",
                        "state": "a1b2c3d4e5f6",
                        "instructions": "Redirect user to authorize_url, then handle callback at /auth/github",
                    }
                }
            },
        },
        500: _500,
    },
)
async def get_github_authorize(state: Optional[str] = None):
    """
    Get GitHub OAuth authorization URL.

    Redirect the user to this URL to start the GitHub OAuth flow.
    After authorization, GitHub will redirect back with a code.
    """
    try:
        url, new_state = auth_service.get_github_authorize_url(state)
        return {
            "authorize_url": url,
            "state": new_state,
            "instructions": "Redirect user to authorize_url, then handle callback at /auth/github",
        }
    except GitHubOAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post(
    "/github",
    response_model=GitHubOAuthResponse,
    summary="Complete GitHub OAuth flow",
    description="""
Exchange the GitHub authorization `code` for JWT access and refresh tokens.

**Full flow:**
1. `GET /auth/github/authorize` → redirect user to `authorize_url`
2. GitHub redirects back to your app with `?code=xxx&state=xxx`
3. `POST /auth/github` with the `code` → receive JWT tokens

A new user record is created automatically on first login.
Subsequent logins update the user's GitHub profile (avatar, email) from GitHub.

**Token lifetimes:**
- `access_token`: 1 hour — include in `Authorization: Bearer <token>` header
- `refresh_token`: 7 days — use at `POST /auth/refresh` to get a new access token
""",
    responses={
        200: {
            "description": "Authentication successful — tokens returned",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                        "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                        "token_type": "bearer",
                        "expires_in": 3600,
                        "user": {
                            "id": "550e8400-e29b-41d4-a716-446655440000",
                            "github_id": "12345678",
                            "username": "alice",
                            "email": "alice@example.com",
                            "avatar_url": "https://avatars.githubusercontent.com/u/12345678",
                            "wallet_address": None,
                            "wallet_verified": False,
                            "created_at": "2024-01-15T10:30:00Z",
                            "updated_at": "2024-01-15T10:30:00Z",
                        },
                    }
                }
            },
        },
        400: _400_oauth,
        500: _500,
    },
)
async def github_oauth_callback(request: GitHubOAuthRequest):
    """
    Complete GitHub OAuth flow.

    Exchange the authorization code for JWT tokens.
    """
    try:
        result = await auth_service.github_oauth_login(request.code)
        return result
    except GitHubOAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get(
    "/wallet/message",
    response_model=AuthMessageResponse,
    summary="Get wallet authentication challenge",
    description="""
Returns a nonce-based challenge message that the user must sign with their Solana wallet
to prove ownership of the address.

**Flow:**
1. Call this endpoint with `?wallet_address=<base58-address>`
2. Sign the returned `message` string with the wallet (e.g., Phantom, Backpack)
3. Submit the `signature` + `message` + `wallet_address` to `POST /auth/wallet`

The nonce is time-limited and single-use — do not reuse messages across sessions.
""",
    responses={
        200: {
            "description": "Challenge message ready to sign",
            "content": {
                "application/json": {
                    "example": {
                        "message": "Sign in to SolFoundry\\n\\nWallet: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\\nNonce: a1b2c3d4\\nTimestamp: 2024-01-15T10:30:00Z",
                        "nonce": "a1b2c3d4e5f6",
                    }
                }
            },
        }
    },
)
async def get_wallet_auth_message(wallet_address: str):
    """
    Get a message for wallet authentication.

    The user must sign this message with their wallet to prove ownership.
    Then submit the signature to /auth/wallet.
    """
    return auth_service.generate_auth_message(wallet_address)


@router.post(
    "/wallet",
    response_model=WalletAuthResponse,
    summary="Authenticate with Solana wallet",
    description="""
Verify a wallet signature and return JWT tokens.

The signature must be a base64-encoded Ed25519 signature of the exact `message` string
returned by `GET /auth/wallet/message`, signed with the private key corresponding to
`wallet_address`.

**Supported wallets:** Phantom, Backpack, Solflare, and any wallet implementing
the Solana wallet adapter `signMessage` interface.

**Token lifetimes:**
- `access_token`: 1 hour
- `refresh_token`: 7 days
""",
    responses={
        200: {
            "description": "Wallet authenticated — tokens returned",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                        "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                        "token_type": "bearer",
                        "expires_in": 3600,
                        "user": {
                            "id": "550e8400-e29b-41d4-a716-446655440000",
                            "github_id": "",
                            "username": "7xKXtg...AsU",
                            "email": None,
                            "avatar_url": None,
                            "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                            "wallet_verified": True,
                            "created_at": "2024-01-15T10:30:00Z",
                            "updated_at": "2024-01-15T10:30:00Z",
                        },
                    }
                }
            },
        },
        400: _400_wallet,
        500: _500,
    },
)
async def wallet_authenticate(request: WalletAuthRequest):
    """
    Authenticate with Solana wallet signature.
    """
    try:
        result = await auth_service.wallet_authenticate(
            request.wallet_address,
            request.signature,
            request.message,
        )
        return result
    except WalletVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post(
    "/link-wallet",
    response_model=LinkWalletResponse,
    summary="Link a Solana wallet to your account",
    description="""
Link a Solana wallet address to an existing authenticated user account.

The user must prove ownership of the wallet by signing the same challenge-message
flow used for wallet-only auth.

**Requirements:**
- Must be authenticated via GitHub OAuth (or existing wallet auth)
- Each user account supports exactly one linked wallet (one-to-one mapping)
- The wallet address cannot already be associated with another account

**Use case:** Users who signed up via GitHub can link their Solana wallet to
enable on-chain reward payouts.
""",
    responses={
        200: {
            "description": "Wallet linked successfully",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                        "message": "Wallet linked successfully",
                    }
                }
            },
        },
        400: {
            "description": "Signature verification failed or wallet already linked",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_sig": {"value": {"detail": "Signature verification failed"}},
                        "already_linked": {"value": {"detail": "Wallet already linked to another account"}},
                    }
                }
            },
        },
        401: _401,
    },
)
async def link_wallet(
    request: LinkWalletRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Link a Solana wallet to the current user account.
    """
    try:
        result = await auth_service.link_wallet(
            user_id,
            request.wallet_address,
            request.signature,
            request.message,
        )
        return result
    except WalletVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/refresh",
    response_model=RefreshTokenResponse,
    summary="Refresh access token",
    description="""
Exchange a valid refresh token for a new access token.

Refresh tokens are valid for **7 days** and are single-use in production deployments
(each refresh issues a new refresh token).

Use this endpoint to silently re-authenticate users without requiring them to log in again.

**Client-side strategy:**
```javascript
// Intercept 401 responses and retry with a refreshed token
async function fetchWithAuth(url, options) {
  let res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) {
    const { access_token } = await fetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).then(r => r.json());
    accessToken = access_token;
    res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${accessToken}` } });
  }
  return res;
}
```
""",
    responses={
        200: {
            "description": "New access token issued",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                        "token_type": "bearer",
                        "expires_in": 3600,
                    }
                }
            },
        },
        401: {
            "description": "Refresh token expired or invalid",
            "content": {
                "application/json": {
                    "examples": {
                        "expired": {"value": {"detail": "Refresh token has expired"}},
                        "invalid": {"value": {"detail": "Invalid token signature"}},
                    }
                }
            },
        },
    },
)
async def refresh_token(request: RefreshTokenRequest):
    """
    Refresh an access token using a refresh token.
    """
    try:
        result = await auth_service.refresh_access_token(request.refresh_token)
        return result
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
    description="""
Returns the authenticated user's profile, including their GitHub identity and
linked Solana wallet (if any).

Use this endpoint to verify that a token is still valid and to fetch up-to-date
user information after profile changes.
""",
    responses={
        200: {
            "description": "Current user profile",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "github_id": "12345678",
                        "username": "alice",
                        "email": "alice@example.com",
                        "avatar_url": "https://avatars.githubusercontent.com/u/12345678",
                        "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                        "wallet_verified": True,
                        "created_at": "2024-01-15T10:30:00Z",
                        "updated_at": "2024-01-20T08:15:00Z",
                    }
                }
            },
        },
        401: _401,
        404: {
            "description": "User not found (token valid but account deleted)",
            "content": {
                "application/json": {
                    "example": {"detail": "User not found"}
                }
            },
        },
    },
)
async def get_current_user(user_id: str = Depends(get_current_user_id)):
    """
    Get the current authenticated user profile.
    """
    try:
        user = await auth_service.get_current_user(user_id)
        return user
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# Export the dependency for use in other modules
__all__ = ["router", "get_current_user_id"]
