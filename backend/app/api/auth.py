"""Authentication API routes."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth import auth_service
from app.middleware.auth import get_current_user
from app.schemas.auth import (
    GitHubCallback,
    WalletAuth,
    LinkWallet,
    Token,
    UserResponse,
)
from app.models.user import User
from app.config import settings
import secrets

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Store OAuth state for CSRF protection
oauth_states = {}


@router.post("/github")
async def github_auth_start():
    """Start GitHub OAuth flow."""
    state = secrets.token_urlsafe(32)
    oauth_states[state] = True  # In production, use Redis with expiration
    
    auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={settings.GITHUB_CLIENT_ID}&"
        f"redirect_uri={settings.GITHUB_CALLBACK_URL}&"
        f"state={state}&"
        f"scope=user:email"
    )
    
    return {"auth_url": auth_url, "state": state}


@router.post("/github/callback")
async def github_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """GitHub OAuth callback."""
    # Verify state (CSRF protection)
    if state not in oauth_states:
        raise HTTPException(status_code=400, detail="Invalid state")
    
    del oauth_states[state]
    
    try:
        user, access_token = await auth_service.github_login(code, db)
        refresh_token = auth_service.create_refresh_token(user.id)
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wallet")
async def wallet_auth(
    wallet_data: WalletAuth,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with Solana wallet."""
    try:
        user, access_token = await auth_service.wallet_login(
            wallet_data.wallet_address,
            wallet_data.message,
            wallet_data.signature,
            db,
        )
        refresh_token = auth_service.create_refresh_token(user.id)
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/link-wallet")
async def link_wallet(
    wallet_data: LinkWallet,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link Solana wallet to GitHub account."""
    if not current_user.github_id:
        raise HTTPException(status_code=400, detail="GitHub account not linked")
    
    try:
        user = await auth_service.link_wallet(
            current_user.github_id,
            wallet_data.wallet_address,
            wallet_data.message,
            wallet_data.signature,
            db,
        )
        return {"message": "Wallet linked successfully", "wallet_address": user.wallet_address}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Get current user info."""
    return UserResponse.model_validate(current_user)


@router.post("/refresh")
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token."""
    try:
        from jose import jwt, JWTError
        
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid token type")
        
        user_id = int(payload.get("sub"))
        if user_id is None:
            raise HTTPException(status_code=400, detail="Invalid token")
        
        # Generate new tokens
        new_access_token = auth_service.create_access_token(user_id)
        new_refresh_token = auth_service.create_refresh_token(user_id)
        
        return Token(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
        )
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired refresh token")
