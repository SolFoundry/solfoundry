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
