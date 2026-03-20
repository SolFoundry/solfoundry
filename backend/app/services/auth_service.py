"""Auth service: JWT, GitHub OAuth, wallet verification, user store.

In-Memory MVP Storage
---------------------
All user data, nonces, and refresh tokens use Python dicts.
Migration path to production:

* ``_users``          -> PostgreSQL ``users`` table
* ``_github_index``   -> unique index on ``users.github_id``
* ``_wallet_index``   -> unique index on ``users.wallet_address``
* ``_nonces``         -> Redis keys with TTL (NONCE_TTL seconds)
* ``_refresh_tokens`` -> Redis or DB ``refresh_tokens`` table
* ``_oauth_states``   -> Redis keys with TTL (OAUTH_STATE_TTL seconds)

The service API (public function signatures) stays identical, so the
API layer requires zero changes when swapping storage backends.

Refresh-Token Rotation Strategy
-------------------------------
``refresh_access_token`` atomically deletes the presented token and issues
a brand-new pair.  Each refresh token is single-use; replay is rejected.
If a stolen token is used before the legitimate client, the legitimate
refresh fails -- signalling compromise and forcing a full re-login.
A future enhancement: store a family ID so reuse of any token in the
family revokes the entire lineage (OAuth 2.0 Security BCP).
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
OAUTH_STATE_TTL = 600  # 10 min for OAuth CSRF state tokens

_users: dict[str, User] = {}
_github_index: dict[int, str] = {}
_wallet_index: dict[str, str] = {}
_nonces: dict[str, tuple[str, float]] = {}
_refresh_tokens: dict[str, tuple[str, float]] = {}
_oauth_states: dict[str, float] = {}  # state -> expiry timestamp

def reset_stores():
    """Clear all in-memory stores. Used by the test harness between runs."""
    _users.clear(); _github_index.clear(); _wallet_index.clear()
    _nonces.clear(); _refresh_tokens.clear(); _oauth_states.clear()

# JWT helpers
def create_access_token(user_id: str) -> str:
    """Create a short-lived HS256 JWT containing the user ID as subject."""
    return jwt.encode({"sub": user_id, "type": "access", "iat": int(time.time()), "exp": int(time.time()) + ACCESS_TOKEN_TTL}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    """Create an opaque refresh token; only its SHA-256 hash is stored."""
    raw = secrets.token_urlsafe(48)
    _refresh_tokens[hashlib.sha256(raw.encode()).hexdigest()] = (user_id, time.time() + REFRESH_TOKEN_TTL)
    return raw

def create_token_pair(user_id: str) -> TokenPair:
    """Issue a fresh access + refresh token pair for the user."""
    return TokenPair(access_token=create_access_token(user_id), refresh_token=create_refresh_token(user_id), expires_in=ACCESS_TOKEN_TTL)

def decode_access_token(token: str) -> Optional[str]:
    """Validate an access JWT and return the user ID, or None on failure."""
    try:
        p = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return p.get("sub") if p.get("type") == "access" else None
    except JWTError: return None

def refresh_access_token(raw: str) -> Optional[TokenPair]:
    """Exchange a refresh token for a new pair (single-use rotation)."""
    h = hashlib.sha256(raw.encode()).hexdigest()
    entry = _refresh_tokens.pop(h, None)
    if not entry: return None
    uid, exp = entry
    if time.time() > exp or uid not in _users: return None
    return create_token_pair(uid)

# OAuth state (CSRF protection -- RFC 6749 s10.12)
def generate_oauth_state() -> str:
    """Generate a CSRF state token for the OAuth flow (stored server-side, TTL-limited)."""
    _prune_oauth_states()
    token = secrets.token_urlsafe(32)
    _oauth_states[token] = time.time() + OAUTH_STATE_TTL
    return token

def validate_oauth_state(state: str) -> bool:
    """Validate and consume an OAuth CSRF state token (single-use)."""
    _prune_oauth_states()
    exp = _oauth_states.pop(state, None)
    if exp is None: return False
    return time.time() < exp

def _prune_oauth_states() -> None:
    """Remove expired OAuth state tokens from the store."""
    now = time.time()
    for k in [k for k, exp in _oauth_states.items() if now >= exp]: del _oauth_states[k]

# Nonce management
def _prune_nonces():
    """Remove expired nonces from the store."""
    now = time.time()
    for k in [k for k, (_, ts) in _nonces.items() if now - ts > NONCE_TTL]: del _nonces[k]

def generate_nonce(wallet_address: str) -> NonceResponse:
    """Create a time-limited nonce bound to a wallet address."""
    _prune_nonces(); nonce = secrets.token_urlsafe(24)
    _nonces[nonce] = (wallet_address, time.time())
    return NonceResponse(nonce=nonce, message=get_expected_message(nonce))

def validate_nonce(nonce: str, wallet_address: str) -> bool:
    """Validate and consume a wallet nonce (single-use, wallet-bound)."""
    _prune_nonces(); entry = _nonces.pop(nonce, None)
    if not entry: return False
    w, ts = entry
    return w == wallet_address and time.time() - ts <= NONCE_TTL

def get_expected_message(nonce: str) -> str:
    """Build the human-readable message a wallet must sign."""
    return f"Sign this message to authenticate with SolFoundry.\nNonce: {nonce}"

# Wallet signature verification
def verify_wallet_signature(wallet_address: str, signature: str, message: str) -> bool:
    """Verify an Ed25519 signature from a Solana wallet (nacl + base58)."""
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

# User CRUD -- see module docstring for migration notes
def get_user(user_id: str) -> Optional[User]:
    """Look up a user by internal UUID."""
    return _users.get(user_id)
def get_user_by_github_id(gid: int) -> Optional[User]:
    """Look up a user by GitHub numeric ID."""
    uid = _github_index.get(gid); return _users.get(uid) if uid else None
def get_user_by_wallet(addr: str) -> Optional[User]:
    """Look up a user by linked Solana wallet address."""
    uid = _wallet_index.get(addr); return _users.get(uid) if uid else None

def create_user_from_github(gid: int, username: str, avatar_url: Optional[str] = None) -> User:
    """Create a new user from GitHub profile data."""
    u = User(github_id=gid, username=username, avatar_url=avatar_url)
    _users[u.id] = u; _github_index[gid] = u.id; return u

def create_user_from_wallet(addr: str) -> User:
    """Create a new user from a Solana wallet address."""
    u = User(wallet_address=addr, username=f"wallet_{addr[:8]}")
    _users[u.id] = u; _wallet_index[addr] = u.id; return u

def link_wallet_to_user(user_id: str, addr: str) -> Optional[User]:
    """Link a Solana wallet to an existing user; rejects if claimed by another."""
    u = _users.get(user_id)
    if not u: return None
    existing = _wallet_index.get(addr)
    if existing and existing != user_id: return None
    if u.wallet_address and u.wallet_address != addr: _wallet_index.pop(u.wallet_address, None)
    u.wallet_address = addr; u.updated_at = datetime.now(timezone.utc)
    _wallet_index[addr] = user_id; return u
