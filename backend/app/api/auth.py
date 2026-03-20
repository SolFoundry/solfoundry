<<<<<<< HEAD
"""Auth API: GitHub OAuth, wallet auth, link wallet, token refresh, user profile.

Endpoints: GET /github/state, POST /github, POST /wallet/nonce,
POST /wallet/verify, POST /me/wallet, POST /refresh, GET /me.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from app.middleware.auth import get_current_user
from app.models.auth import (GitHubAuthRequest, LinkWalletRequest, NonceRequest,
                              NonceResponse, OAuthStateResponse, RefreshTokenRequest,
                              TokenPair, User, UserResponse, WalletAuthRequest)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.get("/github/state", response_model=OAuthStateResponse)
async def github_oauth_state():
    """Generate a CSRF state token for the GitHub OAuth authorize redirect."""
    return OAuthStateResponse(state=auth_service.generate_oauth_state())

@router.post("/github", response_model=TokenPair)
async def github_auth(body: GitHubAuthRequest):
    """Exchange GitHub OAuth code + state for JWT tokens.

    The state parameter is validated server-side (single-use, TTL-limited)
    before exchanging the code, providing CSRF protection (RFC 6749 s10.12).
    """
    if not auth_service.validate_oauth_state(body.state):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Invalid or expired OAuth state token (possible CSRF)")
    gh_user = await auth_service.exchange_github_code(body.code, state=body.state)
    if gh_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="GitHub authentication failed")
    user = auth_service.get_user_by_github_id(gh_user["id"])
    if user is None:
        user = auth_service.create_user_from_github(gh_user["id"], gh_user["login"], gh_user.get("avatar_url"))
    return auth_service.create_token_pair(user.id)

@router.post("/wallet/nonce", response_model=NonceResponse)
async def get_nonce(body: NonceRequest):
    """Generate a time-limited challenge nonce for wallet authentication."""
    return auth_service.generate_nonce(body.wallet_address)

@router.post("/wallet/verify", response_model=TokenPair)
async def wallet_auth(body: WalletAuthRequest):
    """Verify a wallet signature and issue JWT tokens."""
    if not auth_service.validate_nonce(body.nonce, body.wallet_address):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired nonce")
    message = auth_service.get_expected_message(body.nonce)
    if not auth_service.verify_wallet_signature(body.wallet_address, body.signature, message):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid wallet signature")
    user = auth_service.get_user_by_wallet(body.wallet_address)
    if user is None:
        user = auth_service.create_user_from_wallet(body.wallet_address)
    return auth_service.create_token_pair(user.id)

@router.post("/me/wallet", response_model=UserResponse)
async def link_wallet(body: LinkWalletRequest, current_user: User = Depends(get_current_user)):
    """Link a Solana wallet to the currently authenticated user."""
    if not auth_service.validate_nonce(body.nonce, body.wallet_address):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired nonce")
    message = auth_service.get_expected_message(body.nonce)
    if not auth_service.verify_wallet_signature(body.wallet_address, body.signature, message):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid wallet signature")
    existing = auth_service.get_user_by_wallet(body.wallet_address)
    if existing and existing.id != current_user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Wallet already linked to another account")
    updated = auth_service.link_wallet_to_user(current_user.id, body.wallet_address)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to link wallet")
    return updated.to_response()

@router.post("/refresh", response_model=TokenPair)
async def refresh_token(body: RefreshTokenRequest):
    """Exchange a refresh token for a new token pair (rotation)."""
    pair = auth_service.refresh_access_token(body.refresh_token)
    if pair is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    return pair

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user.to_response()
=======
"""Authentication API endpoints.

This module provides REST API endpoints for:
- GitHub OAuth flow
- Solana wallet authentication
- Wallet linking
- Token refresh
- Current user info
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.user import (
    GitHubOAuthRequest, GitHubOAuthResponse,
    WalletAuthRequest, WalletAuthResponse,
    LinkWalletRequest, LinkWalletResponse,
    RefreshTokenRequest, RefreshTokenResponse,
    UserResponse, AuthMessageResponse,
)
from app.services import auth_service
from app.services.auth_service import (
    AuthError, GitHubOAuthError, WalletVerificationError,
    TokenExpiredError, InvalidTokenError,
)

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer(auto_error=False)


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


@router.get("/github/authorize", response_model=dict)
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


@router.post("/github", response_model=GitHubOAuthResponse)
async def github_oauth_callback(request: GitHubOAuthRequest):
    """
    Complete GitHub OAuth flow.
    
    Exchange the authorization code for JWT tokens.
    
    Flow:
    1. User is redirected from GitHub with a code
    2. Exchange code for GitHub access token
    3. Get user info from GitHub
    4. Create/update user in database
    5. Return JWT tokens
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


@router.get("/wallet/message", response_model=AuthMessageResponse)
async def get_wallet_auth_message(wallet_address: str):
    """
    Get a message for wallet authentication.
    
    The user must sign this message with their wallet to prove ownership.
    Then submit the signature to /auth/wallet.
    """
    return auth_service.generate_auth_message(wallet_address)


@router.post("/wallet", response_model=WalletAuthResponse)
async def wallet_authenticate(request: WalletAuthRequest):
    """
    Authenticate with Solana wallet signature.
    
    Flow:
    1. Get a message from /auth/wallet/message
    2. Sign the message with your wallet
    3. Submit the signature, message, and wallet address
    
    The signature proves you own the wallet address.
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


@router.post("/link-wallet", response_model=LinkWalletResponse)
async def link_wallet(
    request: LinkWalletRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Link a Solana wallet to the current user account.
    
    The user must sign a message to prove wallet ownership.
    Each user can only have one wallet linked (one-to-one mapping).
    
    Requires authentication (GitHub OAuth or existing wallet auth).
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


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(request: RefreshTokenRequest):
    """
    Refresh an access token.
    
    Use the refresh token received during login to get a new access token.
    Refresh tokens are valid for 7 days.
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


@router.get("/me", response_model=UserResponse)
async def get_current_user(user_id: str = Depends(get_current_user_id)):
    """
    Get the current authenticated user.
    
    Returns the user profile including wallet address if linked.
    Requires authentication.
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
>>>>>>> upstream/main
