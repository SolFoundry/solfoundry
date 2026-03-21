"""JWT Token Refresh with Rotation.

Implements secure refresh token rotation to prevent token replay attacks.
Each refresh token can only be used once, and a new refresh token is
issued with each access token refresh.
"""

import os
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict

from jose import jwt, JWTError
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)

# Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(32)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
REFRESH_TOKEN_FAMILY_SIZE = int(os.getenv("REFRESH_TOKEN_FAMILY_SIZE", "5"))

# Token family for rotation detection (stored in Redis or database)
# When a refresh token is used, the entire family should be invalidated
# if reuse is detected (replay attack)

# In-memory store for development (use Redis in production)
_refresh_token_store: Dict[str, dict] = {}
_token_families: Dict[str, list] = {}


def create_token_family_id(user_id: str) -> str:
    """Create a new token family ID.
    
    A token family groups all refresh tokens issued for a single
    authentication session. If any token in the family is reused
    after being rotated, the entire family is revoked.
    
    Args:
        user_id: The user's ID.
    
    Returns:
        A unique family ID.
    """
    return f"fam_{user_id}_{secrets.token_urlsafe(16)}"


def create_access_token(
    user_id: str,
    expires_delta: Optional[timedelta] = None,
    family_id: Optional[str] = None,
) -> str:
    """Generate a signed JWT access token.
    
    Args:
        user_id: The user's ID.
        expires_delta: Custom expiration time.
        family_id: Token family ID for refresh rotation.
    
    Returns:
        Encoded JWT access token.
    """
    expires_delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": secrets.token_urlsafe(16),
        "fam": family_id,  # Link to refresh token family
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(
    user_id: str,
    family_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> tuple[str, str]:
    """Generate a signed JWT refresh token with rotation support.
    
    Args:
        user_id: The user's ID.
        family_id: Existing family ID or None to create new.
        expires_delta: Custom expiration time.
    
    Returns:
        Tuple of (encoded JWT refresh token, family_id).
    """
    if not family_id:
        family_id = create_token_family_id(user_id)
    
    expires_delta = expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(16)
    
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": jti,  # Unique token ID for rotation tracking
        "fam": family_id,
    }
    
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    # Store token in family
    _store_token_in_family(family_id, jti, token)
    
    return token, family_id


def _store_token_in_family(family_id: str, jti: str, token: str) -> None:
    """Store a refresh token in its family (in-memory, use Redis in production).
    
    Args:
        family_id: The token family ID.
        jti: The token's unique ID.
        token: The encoded token.
    """
    if family_id not in _token_families:
        _token_families[family_id] = []
    
    family = _token_families[family_id]
    family.append({
        "jti": jti,
        "token": token,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Limit family size to prevent memory bloat
    if len(family) > REFRESH_TOKEN_FAMILY_SIZE:
        # Remove oldest tokens
        family.pop(0)


def _mark_token_used(family_id: str, jti: str) -> bool:
    """Mark a refresh token as used.
    
    Args:
        family_id: The token family ID.
        jti: The token's unique ID.
    
    Returns:
        True if token was found and marked, False if already used (replay!).
    """
    family = _token_families.get(family_id, [])
    
    for token_record in family:
        if token_record["jti"] == jti:
            if token_record["used"]:
                # Token already used - potential replay attack!
                logger.warning(
                    f"Refresh token reuse detected for family {family_id}. "
                    f"Revoking entire family."
                )
                return False
            token_record["used"] = True
            return True
    
    return False


def _revoke_token_family(family_id: str) -> None:
    """Revoke all tokens in a family.
    
    Called when replay attack is detected.
    
    Args:
        family_id: The token family to revoke.
    """
    if family_id in _token_families:
        del _token_families[family_id]
    logger.warning(f"Token family {family_id} revoked due to potential replay attack")


def decode_token(token: str, token_type: str = "access") -> dict:
    """Decode and validate a JWT token.
    
    Args:
        token: The encoded JWT token.
        token_type: Expected token type ('access' or 'refresh').
    
    Returns:
        Decoded token payload.
    
    Raises:
        TokenExpiredError: Token has expired.
        InvalidTokenError: Token is invalid or wrong type.
    """
    from app.services.auth_service import TokenExpiredError, InvalidTokenError
    
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != token_type:
            raise InvalidTokenError(f"Expected {token_type} token")
        return payload
    except JWTError as e:
        if "expired" in str(e).lower():
            raise TokenExpiredError("Token expired")
        raise InvalidTokenError(f"Invalid token: {e}")


async def refresh_access_token_with_rotation(
    db: AsyncSession,
    refresh_token: str,
) -> dict:
    """Exchange a refresh token for new tokens with rotation.
    
    Implements refresh token rotation:
    1. Validates the refresh token
    2. Checks for replay attacks
    3. Issues new access and refresh tokens
    4. Invalidates the old refresh token
    
    Args:
        db: Database session.
        refresh_token: The refresh token to exchange.
    
    Returns:
        Dict with new access_token, refresh_token, and token_type.
    
    Raises:
        InvalidTokenError: Token is invalid or replay detected.
        TokenExpiredError: Token has expired.
    """
    from app.services.auth_service import InvalidTokenError, TokenExpiredError
    
    # Decode and validate
    payload = decode_token(refresh_token, "refresh")
    user_id = payload.get("sub")
    family_id = payload.get("fam")
    jti = payload.get("jti")
    
    if not user_id or not family_id or not jti:
        raise InvalidTokenError("Invalid token claims")
    
    # Check for replay attack
    if not _mark_token_used(family_id, jti):
        # Token was already used - revoke entire family
        _revoke_token_family(family_id)
        raise InvalidTokenError("Refresh token reuse detected. Session revoked for security.")
    
    # Verify user still exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise InvalidTokenError("User not found")
    
    # Generate new tokens with same family
    new_access_token = create_access_token(user_id, family_id=family_id)
    new_refresh_token, _ = create_refresh_token(user_id, family_id=family_id)
    
    logger.info(f"Token refreshed for user {user_id}, family {family_id}")
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


async def revoke_token_family(family_id: str) -> None:
    """Revoke all tokens in a family (logout all sessions).
    
    Args:
        family_id: The token family to revoke.
    """
    _revoke_token_family(family_id)
    logger.info(f"Token family {family_id} revoked (logout)")


async def revoke_all_user_sessions(user_id: str) -> None:
    """Revoke all sessions for a user.
    
    Args:
        user_id: The user's ID.
    """
    # Find and revoke all families for this user
    families_to_revoke = []
    for fam_id, family in _token_families.items():
        if fam_id.startswith(f"fam_{user_id}_"):
            families_to_revoke.append(fam_id)
    
    for fam_id in families_to_revoke:
        _revoke_token_family(fam_id)
    
    logger.info(f"All sessions revoked for user {user_id}")


# Redis-based implementation for production
class RedisTokenStore:
    """Redis-based token store for production deployments."""
    
    def __init__(self, redis_client):
        """Initialize with Redis client.
        
        Args:
            redis_client: Redis client instance.
        """
        self.redis = redis_client
    
    async def store_token_in_family(
        self,
        family_id: str,
        jti: str,
        token: str,
        ttl: int = None,
    ) -> None:
        """Store token in Redis with TTL.
        
        Args:
            family_id: Token family ID.
            jti: Token unique ID.
            token: Encoded token.
            ttl: Time to live in seconds.
        """
        key = f"rt:{family_id}:{jti}"
        ttl = ttl or REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600
        await self.redis.setex(key, ttl, token)
    
    async def is_token_used(self, family_id: str, jti: str) -> bool:
        """Check if token was already used.
        
        Args:
            family_id: Token family ID.
            jti: Token unique ID.
        
        Returns:
            True if token was used, False otherwise.
        """
        used_key = f"rt:used:{family_id}:{jti}"
        return bool(await self.redis.exists(used_key))
    
    async def mark_token_used(self, family_id: str, jti: str) -> bool:
        """Mark token as used, return False if already used.
        
        Args:
            family_id: Token family ID.
            jti: Token unique ID.
        
        Returns:
            True if successfully marked, False if already used.
        """
        used_key = f"rt:used:{family_id}:{jti}"
        
        # Only set if doesn't exist (NX)
        result = await self.redis.set(used_key, "1", nx=True)
        return result is not None
    
    async def revoke_family(self, family_id: str) -> None:
        """Revoke all tokens in a family.
        
        Args:
            family_id: Token family to revoke.
        """
        # Find all tokens in family and delete
        pattern = f"rt:{family_id}:*"
        used_pattern = f"rt:used:{family_id}:*"
        
        keys = await self.redis.keys(pattern)
        used_keys = await self.redis.keys(used_pattern)
        
        all_keys = keys + used_keys
        if all_keys:
            await self.redis.delete(*all_keys)