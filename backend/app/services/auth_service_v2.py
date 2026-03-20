"""Security-hardened auth service with OAuth state verification and nonce binding."""

import os, secrets, base64, logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import httpx
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from solders.signature import Signature
from solders.pubkey import Pubkey
from app.models.user import User, UserResponse

logger = logging.getLogger(__name__)
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:3000/auth/callback")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(32)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7
_oauth_states: Dict[str, Dict] = {}
_auth_challenges: Dict[str, Dict] = {}

class AuthError(Exception): pass
class GitHubOAuthError(AuthError): pass
class WalletVerificationError(AuthError): pass
class TokenExpiredError(AuthError): pass
class InvalidTokenError(AuthError): pass
class InvalidStateError(AuthError): pass
class InvalidNonceError(AuthError): pass

def _user_to_response(user): return UserResponse(id=str(user.id), github_id=user.github_id, username=user.username, email=user.email, avatar_url=user.avatar_url, wallet_address=user.wallet_address, wallet_verified=user.wallet_verified, created_at=user.created_at, updated_at=user.updated_at)

def create_access_token(user_id: str, expires_delta=None) -> str:
    expires_delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "type": "access", "iat": int(now.timestamp()), "exp": int((now + expires_delta).timestamp()), "jti": secrets.token_urlsafe(16)}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str, expires_delta=None) -> str:
    expires_delta = expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "type": "refresh", "iat": int(now.timestamp()), "exp": int((now + expires_delta).timestamp()), "jti": secrets.token_urlsafe(16)}, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def decode_token(token: str, token_type="access") -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != token_type: raise InvalidTokenError(f"Expected {token_type}")
        if not payload.get("sub"): raise InvalidTokenError("Missing sub")
        return payload["sub"]
    except JWTError as e:
        if "expired" in str(e).lower(): raise TokenExpiredError("Token expired")
        raise InvalidTokenError(f"Invalid: {e}")

def get_github_authorize_url(state=None) -> tuple:
    if not GITHUB_CLIENT_ID: raise GitHubOAuthError("GITHUB_CLIENT_ID not configured")
    state = state or secrets.token_urlsafe(32)
    _oauth_states[state] = {"created_at": datetime.now(timezone.utc), "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)}
    params = {"client_id": GITHUB_CLIENT_ID, "redirect_uri": GITHUB_REDIRECT_URI, "scope": "read:user user:email", "state": state, "response_type": "code"}
    return f"https://github.com/login/oauth/authorize?{'&'.join(f'{k}={v}' for k,v in params.items())}", state

def verify_oauth_state(state: str) -> bool:
    if not state: raise InvalidStateError("Missing state")
    data = _oauth_states.get(state)
    if not data: raise InvalidStateError("Invalid state")
    if datetime.now(timezone.utc) > data["expires_at"]: del _oauth_states[state]; raise InvalidStateError("Expired")
    del _oauth_states[state]
    return True

def generate_auth_message(wallet_address: str) -> Dict:
    nonce = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=5)
    msg = f"SolFoundry Auth\nWallet: {wallet_address}\nNonce: {nonce}\nIssued: {now.isoformat()}\nExpires: {expires.isoformat()}"
    _auth_challenges[nonce] = {"wallet_address": wallet_address.lower(), "message": msg, "expires_at": expires}
    return {"message": msg, "nonce": nonce, "expires_at": expires}

def verify_auth_challenge(nonce: str, wallet: str, msg: str) -> bool:
    if not nonce: raise InvalidNonceError("Missing nonce")
    c = _auth_challenges.get(nonce)
    if not c: raise InvalidNonceError("Invalid nonce")
    if datetime.now(timezone.utc) > c["expires_at"]: del _auth_challenges[nonce]; raise InvalidNonceError("Expired")
    if c["wallet_address"] != wallet.lower(): raise InvalidNonceError("Wallet mismatch")
    if c["message"] != msg: raise InvalidNonceError("Message mismatch")
    del _auth_challenges[nonce]
    return True

def verify_wallet_signature(wallet: str, msg: str, sig: str) -> bool:
    try:
        if not wallet or len(wallet) < 32 or len(wallet) > 48: raise WalletVerificationError("Invalid wallet")
        pubkey = Pubkey.from_string(wallet)
        sig_bytes = base64.b64decode(sig)
        if len(sig_bytes) != 64: raise WalletVerificationError("Invalid sig length")
        Signature(sig_bytes).verify(pubkey, msg.encode())
        return True
    except WalletVerificationError: raise
    except Exception as e: raise WalletVerificationError(f"Failed: {e}")

async def github_oauth_login(db: AsyncSession, code: str, state=None) -> Dict:
    if state: verify_oauth_state(state)
    if not GITHUB_CLIENT_SECRET: raise GitHubOAuthError("No secret")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post("https://github.com/login/oauth/access_token", data={"client_id": GITHUB_CLIENT_ID, "client_secret": GITHUB_CLIENT_SECRET, "code": code, "redirect_uri": GITHUB_REDIRECT_URI}, headers={"Accept": "application/json"})
        if r.status_code != 200: raise GitHubOAuthError(f"Token failed: {r.status_code}")
        td = r.json()
        if "error" in td: raise GitHubOAuthError(td.get("error_description", td["error"]))
        token = td.get("access_token")
        if not token: raise GitHubOAuthError("No token")
        u = await client.get("https://api.github.com/user", headers={"Authorization": f"Bearer {token}"})
        if u.status_code != 200: raise GitHubOAuthError("User fetch failed")
        gh = u.json()
    gid = str(gh["id"])
    result = await db.execute(select(User).where(User.github_id == gid))
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if user:
        user.username, user.email, user.avatar_url, user.last_login_at = gh.get("login", ""), gh.get("email"), gh.get("avatar_url"), now
    else:
        user = User(github_id=gid, username=gh.get("login",""), email=gh.get("email"), avatar_url=gh.get("avatar_url"), last_login_at=now)
        db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"access_token": create_access_token(str(user.id)), "refresh_token": create_refresh_token(str(user.id)), "token_type": "bearer", "expires_in": 3600, "user": _user_to_response(user)}

async def wallet_authenticate(db: AsyncSession, wallet: str, sig: str, msg: str, nonce=None) -> Dict:
    if nonce: verify_auth_challenge(nonce, wallet, msg)
    verify_wallet_signature(wallet, msg, sig)
    result = await db.execute(select(User).where(User.wallet_address == wallet.lower()))
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if user: user.last_login_at = now
    else:
        user = User(github_id=f"wallet_{wallet[:16]}", username=f"wallet_{wallet[:8]}", wallet_address=wallet.lower(), wallet_verified=True, last_login_at=now)
        db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"access_token": create_access_token(str(user.id)), "refresh_token": create_refresh_token(str(user.id)), "token_type": "bearer", "expires_in": 3600, "user": _user_to_response(user)}