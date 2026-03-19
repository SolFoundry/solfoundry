from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth.schemas import (
    GitHubAuthRequest,
    WalletAuthRequest,
    LinkWalletRequest,
    UserResponse,
    AuthResponse
)
from app.auth.service import AuthService
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.core.config import settings

router = APIRouter()

@router.get("/github/login")
async def github_login():
    """Redirect to GitHub OAuth authorization URL"""
    github_auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={settings.GITHUB_CLIENT_ID}&"
        f"redirect_uri={settings.GITHUB_REDIRECT_URI}&"
        f"scope=user:email"
    )
    return {"auth_url": github_auth_url}

@router.post("/github/callback", response_model=AuthResponse)
async def github_callback(
    auth_request: GitHubAuthRequest,
    db: Session = Depends(get_db)
):
    """Handle GitHub OAuth callback"""
    auth_service = AuthService(db)
    
    try:
        result = await auth_service.authenticate_github(auth_request.code)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub authentication failed: {str(e)}"
        )

@router.post("/wallet", response_model=AuthResponse)
async def wallet_auth(
    wallet_request: WalletAuthRequest,
    db: Session = Depends(get_db)
):
    """Authenticate with wallet signature"""
    auth_service = AuthService(db)
    
    try:
        result = await auth_service.authenticate_wallet(
            wallet_request.wallet_address,
            wallet_request.signature,
            wallet_request.message
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Wallet authentication failed: {str(e)}"
        )

@router.post("/link-wallet")
async def link_wallet(
    link_request: LinkWalletRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Link a wallet to the current user account"""
    auth_service = AuthService(db)
    
    try:
        await auth_service.link_wallet_to_user(
            current_user.id,
            link_request.wallet_address,
            link_request.signature,
            link_request.message
        )
        return {"message": "Wallet linked successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to link wallet: {str(e)}"
        )

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user information"""
    return UserResponse(
        id=current_user.id,
        github_id=current_user.github_id,
        github_username=current_user.github_username,
        email=current_user.email,
        wallet_address=current_user.wallet_address,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    )

@router.post("/logout")
async def logout():
    """Logout endpoint (client handles token removal)"""
    return {"message": "Logged out successfully"}

@router.get("/wallet/message/{wallet_address}")
async def get_wallet_message(wallet_address: str):
    """Get message to sign for wallet authentication"""
    auth_service = AuthService()
    message = auth_service.generate_wallet_message(wallet_address)
    return {"message": message}