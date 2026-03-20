"""Tests for GitHub OAuth + Wallet auth system (Issue #11)."""
import hashlib, time
from unittest.mock import AsyncMock, MagicMock, patch
import httpx, pytest
from fastapi.testclient import TestClient
from jose import jwt
from app.main import app
from app.models.auth import User
from app.services import auth_service

client = TestClient(app)
WA = "So11111111111111111111111111111111111111112"
WB = "So11111111111111111111111111111111111111113"

@pytest.fixture(autouse=True)
def clear(): auth_service.reset_stores(); yield; auth_service.reset_stores()

def _gh(gid=12345, name="testuser"): return auth_service.create_user_from_github(gid, name, "https://a.test/1")
def _wl(addr=WA): return auth_service.create_user_from_wallet(addr)
def _hdr(uid): return {"Authorization": f"Bearer {auth_service.create_access_token(uid)}"}

class TestJWT:
    def test_create_decode(self):
        u = _gh(); tok = auth_service.create_access_token(u.id)
        assert auth_service.decode_access_token(tok) == u.id
    def test_invalid_tokens(self):
        for t in ["garbage", "", "null"]: assert auth_service.decode_access_token(t) is None
    def test_expired(self):
        u = _gh(); orig = auth_service.ACCESS_TOKEN_TTL; auth_service.ACCESS_TOKEN_TTL = -1
        try: tok = auth_service.create_access_token(u.id)
        finally: auth_service.ACCESS_TOKEN_TTL = orig
        assert auth_service.decode_access_token(tok) is None
    def test_wrong_type_rejected(self):
        u = _gh()
        tok = jwt.encode({"sub": u.id, "type": "refresh", "iat": int(time.time()), "exp": int(time.time())+3600}, auth_service.JWT_SECRET, algorithm=auth_service.JWT_ALGORITHM)
        assert auth_service.decode_access_token(tok) is None
    def test_wrong_secret_rejected(self):
        u = _gh()
        tok = jwt.encode({"sub": u.id, "type": "access", "iat": int(time.time()), "exp": int(time.time())+3600}, "wrong", algorithm="HS256")
        assert auth_service.decode_access_token(tok) is None
    def test_token_pair(self):
        u = _gh(); p = auth_service.create_token_pair(u.id)
        assert p.access_token and p.refresh_token and p.token_type == "bearer"
    def test_refresh_exchange(self):
        u = _gh(); p = auth_service.create_token_pair(u.id)
        np = auth_service.refresh_access_token(p.refresh_token)
        assert np and np.refresh_token != p.refresh_token
        assert auth_service.decode_access_token(np.access_token) == u.id
    def test_refresh_single_use(self):
        u = _gh(); p = auth_service.create_token_pair(u.id)
        assert auth_service.refresh_access_token(p.refresh_token) is not None
        assert auth_service.refresh_access_token(p.refresh_token) is None
    def test_refresh_invalid(self):
        assert auth_service.refresh_access_token("invalid") is None
        assert auth_service.refresh_access_token("") is None
    def test_refresh_expired(self):
        u = _gh(); h = hashlib.sha256(b"tok").hexdigest()
        auth_service._refresh_tokens[h] = (u.id, time.time() - 100)
        assert auth_service.refresh_access_token("tok") is None

class TestNonce:
    def test_generate_and_validate(self):
        n = auth_service.generate_nonce(WA)
        assert n.nonce and "SolFoundry" in n.message
        assert auth_service.validate_nonce(n.nonce, WA) is True
    def test_wrong_wallet(self):
        n = auth_service.generate_nonce(WA)
        assert auth_service.validate_nonce(n.nonce, WB) is False
    def test_single_use(self):
        n = auth_service.generate_nonce(WA)
        assert auth_service.validate_nonce(n.nonce, WA) is True
        assert auth_service.validate_nonce(n.nonce, WA) is False
    def test_expired(self):
        n = auth_service.generate_nonce(WA)
        auth_service._nonces[n.nonce] = (WA, time.time() - auth_service.NONCE_TTL - 1)
        assert auth_service.validate_nonce(n.nonce, WA) is False
    def test_unknown(self):
        assert auth_service.validate_nonce("nonexistent", WA) is False

class TestUserStore:
    def test_github_user(self):
        u = _gh(42, "octocat"); assert u.github_id == 42 and u.username == "octocat"
    def test_wallet_user(self):
        u = _wl(WA); assert u.wallet_address == WA
    def test_lookup(self):
        u = _gh(42); assert auth_service.get_user_by_github_id(42).id == u.id
        assert auth_service.get_user_by_github_id(999) is None
    def test_link_wallet(self):
        u = _gh(); r = auth_service.link_wallet_to_user(u.id, WA)
        assert r and r.wallet_address == WA
    def test_link_wallet_claimed(self):
        u1 = _gh(1, "u1"); u2 = _gh(2, "u2")
        auth_service.link_wallet_to_user(u1.id, WA)
        assert auth_service.link_wallet_to_user(u2.id, WA) is None
    def test_link_wallet_replace(self):
        u = _gh(); auth_service.link_wallet_to_user(u.id, WA)
        auth_service.link_wallet_to_user(u.id, WB)
        assert auth_service.get_user_by_wallet(WA) is None
        assert auth_service.get_user_by_wallet(WB).id == u.id
    def test_reset(self):
        _gh(); _wl(); auth_service.generate_nonce(WA); auth_service.reset_stores()
        assert len(auth_service._users) == 0

def _mock_http(token_resp, user_resp=None):
    """Helper to mock httpx.AsyncClient for GitHub OAuth tests."""
    inst = AsyncMock()
    inst.post.return_value = token_resp
    if user_resp: inst.get.return_value = user_resp
    inst.__aenter__ = AsyncMock(return_value=inst)
    inst.__aexit__ = AsyncMock(return_value=False)
    return inst

class TestGitHubExchange:
    @pytest.mark.anyio
    async def test_success(self):
        tr = MagicMock(status_code=200); tr.json.return_value = {"access_token": "gho_abc"}
        ur = MagicMock(status_code=200); ur.json.return_value = {"id": 42, "login": "octocat", "avatar_url": "https://x.png"}
        with patch.object(auth_service, "GITHUB_CLIENT_ID", "cid"), patch.object(auth_service, "GITHUB_CLIENT_SECRET", "csec"), patch("httpx.AsyncClient", return_value=_mock_http(tr, ur)):
            r = await auth_service.exchange_github_code("valid-code", state="abc")
            assert r and r["id"] == 42
    @pytest.mark.anyio
    async def test_invalid_code(self):
        tr = MagicMock(status_code=200); tr.json.return_value = {"error": "bad_verification_code"}
        with patch.object(auth_service, "GITHUB_CLIENT_ID", "cid"), patch.object(auth_service, "GITHUB_CLIENT_SECRET", "csec"), patch("httpx.AsyncClient", return_value=_mock_http(tr)):
            assert await auth_service.exchange_github_code("bad", state="abc") is None
    @pytest.mark.anyio
    async def test_server_error(self):
        tr = MagicMock(status_code=500)
        with patch.object(auth_service, "GITHUB_CLIENT_ID", "cid"), patch.object(auth_service, "GITHUB_CLIENT_SECRET", "csec"), patch("httpx.AsyncClient", return_value=_mock_http(tr)):
            assert await auth_service.exchange_github_code("code", state="abc") is None
    @pytest.mark.anyio
    async def test_timeout(self):
        inst = AsyncMock(); inst.post.side_effect = httpx.TimeoutException("timeout")
        inst.__aenter__ = AsyncMock(return_value=inst); inst.__aexit__ = AsyncMock(return_value=False)
        with patch.object(auth_service, "GITHUB_CLIENT_ID", "cid"), patch.object(auth_service, "GITHUB_CLIENT_SECRET", "csec"), patch("httpx.AsyncClient", return_value=inst):
            assert await auth_service.exchange_github_code("code", state="abc") is None
    @pytest.mark.anyio
    async def test_missing_creds(self):
        with patch.object(auth_service, "GITHUB_CLIENT_ID", ""), patch.object(auth_service, "GITHUB_CLIENT_SECRET", ""):
            assert await auth_service.exchange_github_code("code", state="abc") is None

class TestGitHubAuthEndpoint:
    @patch("app.services.auth_service.exchange_github_code", new_callable=AsyncMock)
    def test_success(self, mock_ex):
        mock_ex.return_value = {"id": 12345, "login": "octocat", "avatar_url": "https://x.png"}
        r = client.post("/api/auth/github", json={"code": "test-code", "state": "csrf-tok"})
        assert r.status_code == 200 and "access_token" in r.json()
    @patch("app.services.auth_service.exchange_github_code", new_callable=AsyncMock)
    def test_invalid_code(self, mock_ex):
        mock_ex.return_value = None
        assert client.post("/api/auth/github", json={"code": "bad", "state": "x"}).status_code == 401
    def test_missing_code(self):
        r = client.post("/api/auth/github", json={})
        assert r.status_code == 422

class TestWalletAuthEndpoint:
    def test_nonce_generation(self):
        r = client.post("/api/auth/wallet/nonce", json={"wallet_address": WA})
        assert r.status_code == 200 and "nonce" in r.json()
    @patch("app.services.auth_service.verify_wallet_signature", return_value=True)
    def test_wallet_verify_success(self, _):
        n = auth_service.generate_nonce(WA)
        r = client.post("/api/auth/wallet/verify", json={"wallet_address": WA, "signature": "sig", "nonce": n.nonce})
        assert r.status_code == 200 and "access_token" in r.json()
    @patch("app.services.auth_service.verify_wallet_signature", return_value=False)
    def test_wallet_verify_bad_sig(self, _):
        n = auth_service.generate_nonce(WA)
        assert client.post("/api/auth/wallet/verify", json={"wallet_address": WA, "signature": "bad", "nonce": n.nonce}).status_code == 401

class TestProtectedRoutes:
    def test_me_success(self):
        u = _gh(); r = client.get("/api/auth/me", headers=_hdr(u.id))
        assert r.status_code == 200 and r.json()["username"] == "testuser"
    def test_me_no_token(self):
        assert client.get("/api/auth/me").status_code == 401
    def test_me_invalid_token(self):
        assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    def test_link_wallet(self):
        u = _gh()
        r = client.post("/api/auth/me/wallet", headers=_hdr(u.id), json={"wallet_address": WA})
        assert r.status_code == 200 and r.json()["wallet_address"] == WA
    def test_refresh(self):
        u = _gh(); p = auth_service.create_token_pair(u.id)
        r = client.post("/api/auth/refresh", json={"refresh_token": p.refresh_token})
        assert r.status_code == 200 and "access_token" in r.json()

class TestOAuthStateCSRF:
    """OAuth state parameter prevents CSRF attacks on the authorization flow."""
    def test_state_param_forwarded(self):
        """State token from frontend is passed through to GitHub OAuth exchange."""
        with patch("app.services.auth_service.exchange_github_code", new_callable=AsyncMock) as m:
            m.return_value = {"id": 1, "login": "u", "avatar_url": ""}
            client.post("/api/auth/github", json={"code": "c", "state": "csrf-token-123"})
            m.assert_called_once_with("c", state="csrf-token-123")
