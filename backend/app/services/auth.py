"""Authentication service."""
import httpx
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.config import settings


class AuthService:
    """Authentication service."""
    
    @staticmethod
    async def github_login(code: str, session: AsyncSession) -> tuple[User, str]:
        """Login with GitHub OAuth."""
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                },
            )
            response.raise_for_status()
            data = response.json()
            access_token = data.get("access_token")
        
        # Get user info
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            github_user = response.json()
        
        # Find or create user
        stmt = select(User).where(User.github_id == str(github_user["id"]))
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(
                github_id=str(github_user["id"]),
                username=github_user["login"],
                avatar_url=github_user.get("avatar_url"),
                email=github_user.get("email"),
            )
            session.add(user)
            await session.flush()
        else:
            # Update user info
            user.username = github_user["login"]
            user.avatar_url = github_user.get("avatar_url")
            if github_user.get("email"):
                user.email = github_user["email"]
        
        await session.commit()
        await session.refresh(user)
        
        # Generate JWT token
        access_token = AuthService.create_access_token(user.id)
        
        return user, access_token
    
    @staticmethod
    async def wallet_login(wallet_address: str, message: str, signature: str, session: AsyncSession) -> tuple[User, str]:
        """Login with Solana wallet."""
        # Verify signature
        try:
            from nacl.signing import VerifyKey
            from nacl.exceptions import BadSignature
            import base58
            
            # Decode the public key and signature
            pubkey_bytes = base58.b58decode(wallet_address)
            signature_bytes = base58.b58decode(signature)
            message_bytes = message.encode('utf-8')
            
            # Verify the signature
            verify_key = VerifyKey(pubkey_bytes)
            verify_key.verify(message_bytes, signature_bytes)
            verified = True
        except (BadSignature, Exception) as e:
            raise ValueError(f"Invalid signature: {str(e)}")
        
        # Find or create user
        stmt = select(User).where(User.wallet_address == wallet_address)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            user = User(
                wallet_address=wallet_address,
                username=f"user_{wallet_address[:8]}",
            )
            session.add(user)
            await session.flush()
        
        await session.commit()
        await session.refresh(user)
        
        # Generate JWT token
        access_token = AuthService.create_access_token(user.id)
        
        return user, access_token
    
    @staticmethod
    async def link_wallet(github_id: str, wallet_address: str, message: str, signature: str, session: AsyncSession) -> User:
        """Link wallet to GitHub account."""
        # Verify signature
        try:
            from nacl.signing import VerifyKey
            from nacl.exceptions import BadSignature
            import base58
            
            # Decode the public key and signature
            pubkey_bytes = base58.b58decode(wallet_address)
            signature_bytes = base58.b58decode(signature)
            message_bytes = message.encode('utf-8')
            
            # Verify the signature
            verify_key = VerifyKey(pubkey_bytes)
            verify_key.verify(message_bytes, signature_bytes)
            verified = True
        except (BadSignature, Exception) as e:
            raise ValueError(f"Invalid signature: {str(e)}")
        
        # Find user
        stmt = select(User).where(User.github_id == github_id)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError("User not found")
        
        # Check if wallet is already linked
        stmt = select(User).where(User.wallet_address == wallet_address)
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise ValueError("Wallet already linked to another account")
        
        user.wallet_address = wallet_address
        await session.commit()
        await session.refresh(user)
        
        return user
    
    @staticmethod
    def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token."""
        to_encode = {"sub": str(user_id)}
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    @staticmethod
    def create_refresh_token(user_id: int) -> str:
        """Create JWT refresh token."""
        to_encode = {"sub": str(user_id), "type": "refresh"}
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    
    @staticmethod
    async def get_current_user(token: str, session: AsyncSession) -> Optional[User]:
        """Get current user from JWT token."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id: int = int(payload.get("sub"))
            if user_id is None:
                return None
        except JWTError:
            return None
        
        stmt = select(User).where(User.id == user_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


auth_service = AuthService()
