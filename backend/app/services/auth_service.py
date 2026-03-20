"""Auth service: JWT, GitHub OAuth, wallet verification, user store.

In-Memory MVP Stores: All user data, nonces, and refresh tokens use Python dicts.
Migration path: _users -> PostgreSQL users table, _nonces -> Redis TTL keys,
_refresh_tokens -> Redis or DB refresh_tokens table. Service API stays the same.
"""
import hashlib, os, secrets, time
from datetime import datetime, timezone
from typing import Optional
import httpx
from jose import JWTError, jwt
from app.models.auth import NonceResponse, TokenPair, User, UserResponse

JWT_SECRET = os.getenv("JWT_SECRET", "dev-jwt-secret-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL = int(os.getenv("ACCESS_TOKEN_TTL", "3600"))
REFRESH_TOKEN_TTL = int(os.getenv("REFRESH_TOKEN_TTL", "604800"))
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
NONCE_TTL = 300

_users: dict[str, User] = {}
_github_index: dict[int, str] = {}
_wallet_index: dict[str, str] = {}
_nonces: dict[str, tuple[str, float]] = {}
_refresh_tokens: dict[str, tuple[str, float]] = {}

def reset_stores():
    _users.clear(); _github_index.clear(); _wallet_index.clear(); _nonces.clear(); _refresh_tokens.clear()

# JWT helpers
def create_access_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "type": "access", "iat": int(time.time()), "exp": int(time.time()) + ACCESS_TOKEN_TTL}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    raw = secrets.token_urlsafe(48)
    _refresh_tokens[hashlib.sha256(raw.encode()).hexdigest()] = (user_id, time.time() + REFRESH_TOKEN_TTL)
    return raw

def create_token_pair(user_id: str) -> TokenPair:
    return TokenPair(access_token=create_access_token(user_id), refresh_token=create_refresh_token(user_id), expires_in=ACCESS_TOKEN_TTL)

def decode_access_token(token: str) -> Optional[str]:
    try:
        p = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return p.get("sub") if p.get("type") == "access" else None
    except JWTError: return None

def refresh_access_token(raw: str) -> Optional[TokenPair]:
    h = hashlib.sha256(raw.encode()).hexdigest()
    entry = _refresh_tokens.pop(h, None)
    if not entry: return None
    uid, exp = entry
    if time.time() > exp or uid not in _users: return None
    return create_token_pair(uid)

# Nonce management
def _prune_nonces():
    now = time.time()
    for k in [k for k, (_, ts) in _nonces.items() if now - ts > NONCE_TTL]: del _nonces[k]

def generate_nonce(wallet_address: str) -> NonceResponse:
    _prune_nonces(); nonce = secrets.token_urlsafe(24)
    _nonces[nonce] = (wallet_address, time.time())
    return NonceResponse(nonce=nonce, message=get_expected_message(nonce))

def validate_nonce(nonce: str, wallet_address: str) -> bool:
    _prune_nonces(); entry = _nonces.pop(nonce, None)
    if not entry: return False
    w, ts = entry
    return w == wallet_address and time.time() - ts <= NONCE_TTL

def get_expected_message(nonce: str) -> str:
    return f"Sign this message to authenticate with SolFoundry.\nNonce: {nonce}"

# Wallet signature verification
def verify_wallet_signature(wallet_address: str, signature: str, message: str) -> bool:
    try:
        import base58; from nacl.signing import VerifyKey; from nacl.exceptions import BadSignatureError
        VerifyKey(base58.b58decode(wallet_address)).verify(message.encode("utf-8"), base58.b58decode(signature))
        return True
    except Exception: return False

# GitHub OAuth -- state param provides CSRF protection per OAuth 2.0 spec (RFC 6749 s10.12)
async def exchange_github_code(code: str, state: Optional[str] = None) -> Optional[dict]:
    """Exchange GitHub OAuth code for user info. state param forwarded for CSRF verification."""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET: return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            body = {"client_id": GITHUB_CLIENT_ID, "client_secret": GITHUB_CLIENT_SECRET, "code": code}
            if state: body["state"] = state
            tr = await c.post(GITHUB_TOKEN_URL, json=body, headers={"Accept": "application/json"})
            if tr.status_code != 200: return None
            at = tr.json().get("access_token")
            if not at: return None
            ur = await c.get(GITHUB_USER_URL, headers={"Authorization": f"Bearer {at}", "Accept": "application/json"})
            if ur.status_code != 200: return None
            ud = ur.json()
            return ud if ud.get("id") and ud.get("login") else None
    except (httpx.TimeoutException, httpx.ConnectError, Exception): return None

# User CRUD
def get_user(user_id: str) -> Optional[User]: return _users.get(user_id)
def get_user_by_github_id(gid: int) -> Optional[User]:
    uid = _github_index.get(gid); return _users.get(uid) if uid else None
def get_user_by_wallet(addr: str) -> Optional[User]:
    uid = _wallet_index.get(addr); return _users.get(uid) if uid else None

def create_user_from_github(gid: int, username: str, avatar_url: Optional[str] = None) -> User:
    u = User(github_id=gid, username=username, avatar_url=avatar_url)
    _users[u.id] = u; _github_index[gid] = u.id; return u

def create_user_from_wallet(addr: str) -> User:
    u = User(wallet_address=addr, username=f"wallet_{addr[:8]}")
    _users[u.id] = u; _wallet_index[addr] = u.id; return u

def link_wallet_to_user(user_id: str, addr: str) -> Optional[User]:
    u = _users.get(user_id)
    if not u: return None
    existing = _wallet_index.get(addr)
    if existing and existing != user_id: return None
    if u.wallet_address and u.wallet_address != addr: _wallet_index.pop(u.wallet_address, None)
    u.wallet_address = addr; u.updated_at = datetime.now(timezone.utc)
    _wallet_index[addr] = user_id; return u
