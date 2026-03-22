"""Comprehensive tests for the Sign-In With Solana (SIWS) flow.

Covers:
  - SIWS message format (domain, address, nonce, issued-at, expiration)
  - Nonce generation, persistence, replay-attack prevention
  - Signature verification (valid Ed25519, wrong key, bad length, bad base64)
  - Full siws_login flow (happy path, rate limit, bad sig, expired nonce)
  - Session creation, validation, revocation
  - Token refresh (happy path, revoked token, bad JWT)
  - require_wallet_auth middleware (valid, revoked, missing)
  - Logout endpoint
  - Rate limiting (5 attempts / 60s per wallet)
"""

from __future__ import annotations

import asyncio
import base64
import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-siws-ci")

import pytest
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from fastapi.testclient import TestClient
from solders.keypair import Keypair

from app.api.auth import router as auth_router
from app.database import init_db, get_db_session
from app.models.siws import SiwsNonceTable
from app.models.user import User
from app.services import siws_service
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.services.siws_service import (
    SiwsNonceError,
    SiwsRateLimitError,
    WalletVerificationError,
    build_siws_message,
    verify_siws_signature,
    _reset_rate_limit,
    _parse_siws_nonce,
)

# ---------------------------------------------------------------------------
# Test app
# ---------------------------------------------------------------------------

_app = FastAPI()
_app.include_router(auth_router)
client = TestClient(_app, raise_server_exceptions=False)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module", autouse=True)
def setup_db(event_loop):
    event_loop.run_until_complete(init_db())


@pytest.fixture(autouse=True)
def clean_siws(event_loop):
    """Wipe SIWS tables + users between tests."""

    async def _wipe():
        from sqlalchemy import text

        async with get_db_session() as session:
            await session.execute(text("DELETE FROM wallet_sessions"))
            await session.execute(text("DELETE FROM siws_nonces"))
            await session.execute(
                text("DELETE FROM users WHERE github_id LIKE 'siws_%'")
            )
            await session.commit()

    event_loop.run_until_complete(_wipe())
    yield
    event_loop.run_until_complete(_wipe())


@pytest.fixture()
def keypair() -> Keypair:
    return Keypair()


def _wallet(kp: Keypair) -> str:
    return str(kp.pubkey())


def _sign(kp: Keypair, message: str) -> str:
    """Sign a message with a Solana keypair and return base64 signature."""
    sig = kp.sign_message(message.encode("utf-8"))
    return base64.b64encode(bytes(sig)).decode()


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# Unit: build_siws_message
# ---------------------------------------------------------------------------


class TestBuildSiwsMessage:
    def test_contains_domain(self, keypair):
        msg = build_siws_message(_wallet(keypair), "nonce123", datetime.now(timezone.utc))
        assert "solfoundry.io" in msg

    def test_contains_wallet_address(self, keypair):
        wallet = _wallet(keypair)
        msg = build_siws_message(wallet, "nonce123", datetime.now(timezone.utc))
        assert wallet in msg

    def test_contains_nonce(self, keypair):
        msg = build_siws_message(_wallet(keypair), "mynonce_abc", datetime.now(timezone.utc))
        assert "Nonce: mynonce_abc" in msg

    def test_contains_issued_at(self, keypair):
        now = datetime.now(timezone.utc)
        msg = build_siws_message(_wallet(keypair), "n", now)
        assert "Issued At:" in msg
        assert now.isoformat() in msg

    def test_contains_expiration(self, keypair):
        now = datetime.now(timezone.utc)
        msg = build_siws_message(_wallet(keypair), "n", now)
        assert "Expiration Time:" in msg
        expiry = (now + timedelta(minutes=10)).isoformat()
        assert expiry in msg

    def test_contains_uri_version_chain(self, keypair):
        msg = build_siws_message(_wallet(keypair), "n", datetime.now(timezone.utc))
        assert "URI: https://solfoundry.io" in msg
        assert "Version: 1" in msg
        assert "Chain ID: mainnet" in msg

    def test_parse_nonce_roundtrip(self, keypair):
        msg = build_siws_message(_wallet(keypair), "roundtrip_nonce", datetime.now(timezone.utc))
        assert _parse_siws_nonce(msg) == "roundtrip_nonce"


# ---------------------------------------------------------------------------
# Unit: verify_siws_signature
# ---------------------------------------------------------------------------


class TestVerifySiwsSignature:
    def test_valid_signature_passes(self, keypair):
        wallet = _wallet(keypair)
        msg = build_siws_message(wallet, "n", datetime.now(timezone.utc))
        sig = _sign(keypair, msg)
        verify_siws_signature(wallet, msg, sig)  # should not raise

    def test_wrong_key_raises(self, keypair):
        wallet = _wallet(keypair)
        other = Keypair()
        msg = build_siws_message(wallet, "n", datetime.now(timezone.utc))
        sig = _sign(other, msg)  # signed with wrong key
        with pytest.raises(WalletVerificationError, match="[Vv]erif"):
            verify_siws_signature(wallet, msg, sig)

    def test_tampered_message_raises(self, keypair):
        wallet = _wallet(keypair)
        msg = build_siws_message(wallet, "n", datetime.now(timezone.utc))
        sig = _sign(keypair, msg)
        tampered = msg + " tampered"
        with pytest.raises(WalletVerificationError):
            verify_siws_signature(wallet, tampered, sig)

    def test_invalid_base64_raises(self, keypair):
        with pytest.raises(WalletVerificationError, match="base64"):
            verify_siws_signature(_wallet(keypair), "msg", "!!!not-base64!!!")

    def test_wrong_sig_length_raises(self, keypair):
        short_sig = base64.b64encode(b"tooshort").decode()
        with pytest.raises(WalletVerificationError, match="64 bytes"):
            verify_siws_signature(_wallet(keypair), "msg", short_sig)

    def test_invalid_wallet_raises(self):
        with pytest.raises(WalletVerificationError, match="[Ii]nvalid wallet"):
            verify_siws_signature("not_a_valid_wallet", "msg", base64.b64encode(b"x" * 64).decode())


# ---------------------------------------------------------------------------
# Unit: nonce lifecycle
# ---------------------------------------------------------------------------


class TestNonceLifecycle:
    def test_create_nonce_persists_to_db(self, keypair, event_loop):
        wallet = _wallet(keypair)
        nonce, issued_at = run(siws_service.create_nonce(wallet))
        assert len(nonce) > 16

        async def _check():
            async with get_db_session() as session:
                row = await session.get(SiwsNonceTable, nonce)
                assert row is not None
                assert row.wallet_address == wallet.lower()
                assert row.used is False

        run(_check())

    def test_consume_nonce_marks_used(self, keypair):
        wallet = _wallet(keypair)
        nonce, _ = run(siws_service.create_nonce(wallet))
        run(siws_service.consume_nonce(nonce, wallet))

        async def _check():
            async with get_db_session() as session:
                row = await session.get(SiwsNonceTable, nonce)
                assert row.used is True

        run(_check())

    def test_replay_raises(self, keypair):
        wallet = _wallet(keypair)
        nonce, _ = run(siws_service.create_nonce(wallet))
        run(siws_service.consume_nonce(nonce, wallet))
        with pytest.raises(SiwsNonceError, match="already used"):
            run(siws_service.consume_nonce(nonce, wallet))

    def test_unknown_nonce_raises(self, keypair):
        with pytest.raises(SiwsNonceError, match="[Ii]nvalid"):
            run(siws_service.consume_nonce("nonexistent_nonce", _wallet(keypair)))

    def test_expired_nonce_raises(self, keypair):
        wallet = _wallet(keypair)
        nonce, _ = run(siws_service.create_nonce(wallet))

        # Manually expire it
        async def _expire():
            from sqlalchemy import update as _up

            async with get_db_session() as session:
                await session.execute(
                    _up(SiwsNonceTable)
                    .where(SiwsNonceTable.nonce == nonce)
                    .values(expires_at=datetime.now(timezone.utc) - timedelta(seconds=1))
                )
                await session.commit()

        run(_expire())
        with pytest.raises(SiwsNonceError, match="expired"):
            run(siws_service.consume_nonce(nonce, wallet))

    def test_wallet_mismatch_raises(self, keypair):
        wallet = _wallet(keypair)
        other_wallet = _wallet(Keypair())
        nonce, _ = run(siws_service.create_nonce(wallet))
        with pytest.raises(SiwsNonceError, match="[Mm]ismatch"):
            run(siws_service.consume_nonce(nonce, other_wallet))


# ---------------------------------------------------------------------------
# Unit: session management
# ---------------------------------------------------------------------------


class TestSessionManagement:
    def test_create_and_validate_session(self, keypair):
        wallet = _wallet(keypair)
        # Need a user first
        user_id = run(_create_test_user(wallet))
        access = create_access_token(user_id)
        refresh = create_refresh_token(user_id)

        run(siws_service.create_session(wallet, user_id, access, refresh))

        assert run(siws_service.is_session_valid(access)) is True
        assert run(siws_service.is_session_valid(refresh)) is True

    def test_revoke_session(self, keypair):
        wallet = _wallet(keypair)
        user_id = run(_create_test_user(wallet))
        access = create_access_token(user_id)
        refresh = create_refresh_token(user_id)

        run(siws_service.create_session(wallet, user_id, access, refresh))
        run(siws_service.revoke_session(access))

        assert run(siws_service.is_session_valid(access)) is False
        assert run(siws_service.is_session_valid(refresh)) is True  # unaffected

    def test_revoke_all_sessions(self, keypair):
        wallet = _wallet(keypair)
        user_id = run(_create_test_user(wallet))
        t1 = create_access_token(user_id)
        t2 = create_access_token(user_id)
        r1 = create_refresh_token(user_id)

        run(siws_service.create_session(wallet, user_id, t1, r1))
        run(siws_service.create_session(wallet, user_id, t2, r1 + "x"))  # different refresh

        run(siws_service.revoke_all_sessions(wallet))

        assert run(siws_service.is_session_valid(t1)) is False
        assert run(siws_service.is_session_valid(t2)) is False

    def test_unknown_token_is_invalid(self):
        fake_token = create_access_token("00000000-0000-0000-0000-000000000000")
        assert run(siws_service.is_session_valid(fake_token)) is False


# ---------------------------------------------------------------------------
# Integration: GET /auth/siws/message
# ---------------------------------------------------------------------------


class TestGetSiwsMessage:
    def test_returns_message_nonce_timestamps(self, keypair):
        wallet = _wallet(keypair)
        r = client.get(f"/auth/siws/message?wallet_address={wallet}")
        assert r.status_code == 200
        data = r.json()
        assert "message" in data
        assert "nonce" in data
        assert "issued_at" in data
        assert "expires_at" in data

    def test_message_contains_wallet(self, keypair):
        wallet = _wallet(keypair)
        r = client.get(f"/auth/siws/message?wallet_address={wallet}")
        assert wallet in r.json()["message"]

    def test_message_contains_domain(self, keypair):
        wallet = _wallet(keypair)
        r = client.get(f"/auth/siws/message?wallet_address={wallet}")
        assert "solfoundry.io" in r.json()["message"]

    def test_each_call_returns_unique_nonce(self, keypair):
        wallet = _wallet(keypair)
        n1 = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["nonce"]
        n2 = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["nonce"]
        assert n1 != n2


# ---------------------------------------------------------------------------
# Integration: POST /auth/siws (login)
# ---------------------------------------------------------------------------


class TestSiwsLogin:
    def test_valid_login_returns_tokens_and_user(self, keypair):
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)

        msg_data = client.get(f"/auth/siws/message?wallet_address={wallet}").json()
        message = msg_data["message"]
        sig = _sign(keypair, message)

        r = client.post("/auth/siws", json={
            "wallet_address": wallet,
            "signature": sig,
            "message": message,
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["wallet_address"] == wallet.lower()
        assert data["user"]["wallet_verified"] is True

    def test_access_token_expires_in_24h(self, keypair):
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        msg = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["message"]
        data = client.post("/auth/siws", json={
            "wallet_address": wallet, "signature": _sign(keypair, msg), "message": msg,
        }).json()
        # expires_in should be 24h in seconds
        assert data["expires_in"] == ACCESS_TOKEN_EXPIRE_MINUTES * 60

    def test_session_written_to_db(self, keypair):
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        msg = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["message"]
        data = client.post("/auth/siws", json={
            "wallet_address": wallet, "signature": _sign(keypair, msg), "message": msg,
        }).json()
        assert run(siws_service.is_session_valid(data["access_token"])) is True

    def test_invalid_signature_returns_400(self, keypair):
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        msg = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["message"]
        bad_sig = base64.b64encode(b"\x00" * 64).decode()
        r = client.post("/auth/siws", json={
            "wallet_address": wallet, "signature": bad_sig, "message": msg,
        })
        assert r.status_code == 400

    def test_wrong_wallet_signature_returns_400(self, keypair):
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        other_kp = Keypair()
        msg = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["message"]
        sig = _sign(other_kp, msg)
        r = client.post("/auth/siws", json={
            "wallet_address": wallet, "signature": sig, "message": msg,
        })
        assert r.status_code == 400

    def test_replayed_nonce_returns_400(self, keypair):
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        msg = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["message"]
        sig = _sign(keypair, msg)
        payload = {"wallet_address": wallet, "signature": sig, "message": msg}
        # First login succeeds
        _reset_rate_limit(wallet)
        r1 = client.post("/auth/siws", json=payload)
        assert r1.status_code == 200
        # Replay: same nonce, same message, same sig
        _reset_rate_limit(wallet)
        r2 = client.post("/auth/siws", json=payload)
        assert r2.status_code == 400

    def test_fabricated_message_no_nonce_in_db_returns_400(self, keypair):
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        now = datetime.now(timezone.utc)
        fake_msg = build_siws_message(wallet, "fake_nonce_not_in_db", now)
        sig = _sign(keypair, fake_msg)
        r = client.post("/auth/siws", json={
            "wallet_address": wallet, "signature": sig, "message": fake_msg,
        })
        assert r.status_code == 400

    def test_second_login_upserts_user(self, keypair):
        wallet = _wallet(keypair)
        for _ in range(2):
            _reset_rate_limit(wallet)
            msg = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["message"]
            client.post("/auth/siws", json={
                "wallet_address": wallet,
                "signature": _sign(keypair, msg),
                "message": msg,
            })

        # Only one user row for this wallet
        async def _count():
            async with get_db_session() as session:
                from sqlalchemy import select, func
                result = await session.execute(
                    select(func.count()).select_from(User).where(
                        User.wallet_address == wallet.lower()
                    )
                )
                return result.scalar_one()

        assert run(_count()) == 1


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------


class TestRateLimit:
    def test_5th_attempt_succeeds(self, keypair):
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        for _ in range(4):
            siws_service._check_rate_limit(wallet)  # 4 quick calls
        # 5th should still succeed
        siws_service._check_rate_limit(wallet)

    def test_6th_attempt_raises(self, keypair):
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        for _ in range(5):
            siws_service._check_rate_limit(wallet)
        with pytest.raises(SiwsRateLimitError):
            siws_service._check_rate_limit(wallet)

    def test_rate_limit_returns_429_via_api(self, keypair):
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)

        # Exhaust limit with 5 bad-sig calls
        bad_sig = base64.b64encode(b"\x00" * 64).decode()
        for _ in range(5):
            msg_data = client.get(f"/auth/siws/message?wallet_address={wallet}").json()
            client.post("/auth/siws", json={
                "wallet_address": wallet,
                "signature": bad_sig,
                "message": msg_data["message"],
            })

        # 6th attempt hits rate limit before signature verification
        msg_data = client.get(f"/auth/siws/message?wallet_address={wallet}").json()
        r = client.post("/auth/siws", json={
            "wallet_address": wallet,
            "signature": bad_sig,
            "message": msg_data["message"],
        })
        assert r.status_code == 429

    def test_different_wallets_have_independent_limits(self):
        kp1, kp2 = Keypair(), Keypair()
        w1, w2 = _wallet(kp1), _wallet(kp2)
        _reset_rate_limit(w1)
        _reset_rate_limit(w2)

        for _ in range(5):
            siws_service._check_rate_limit(w1)

        # w1 is exhausted but w2 is fresh
        with pytest.raises(SiwsRateLimitError):
            siws_service._check_rate_limit(w1)
        siws_service._check_rate_limit(w2)  # should not raise


# ---------------------------------------------------------------------------
# Token refresh
# ---------------------------------------------------------------------------


class TestSiwsRefresh:
    def _login(self, keypair) -> dict:
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        msg = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["message"]
        return client.post("/auth/siws", json={
            "wallet_address": wallet,
            "signature": _sign(keypair, msg),
            "message": msg,
        }).json()

    def test_valid_refresh_returns_new_tokens(self, keypair):
        tokens = self._login(keypair)
        r = client.post("/auth/siws/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["access_token"] != tokens["access_token"]

    def test_old_refresh_token_revoked_after_use(self, keypair):
        tokens = self._login(keypair)
        old_refresh = tokens["refresh_token"]
        client.post("/auth/siws/refresh", json={"refresh_token": old_refresh})
        # Old refresh token should now be invalid
        assert run(siws_service.is_session_valid(old_refresh)) is False

    def test_new_session_written_to_db(self, keypair):
        tokens = self._login(keypair)
        new_tokens = client.post(
            "/auth/siws/refresh", json={"refresh_token": tokens["refresh_token"]}
        ).json()
        assert run(siws_service.is_session_valid(new_tokens["access_token"])) is True

    def test_revoked_refresh_returns_401(self, keypair):
        tokens = self._login(keypair)
        run(siws_service.revoke_session(tokens["refresh_token"]))
        r = client.post("/auth/siws/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert r.status_code == 401

    def test_garbage_refresh_token_returns_401(self):
        r = client.post("/auth/siws/refresh", json={"refresh_token": "not.a.jwt"})
        assert r.status_code == 401

    def test_access_token_used_as_refresh_returns_401(self, keypair):
        tokens = self._login(keypair)
        r = client.post("/auth/siws/refresh", json={"refresh_token": tokens["access_token"]})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# require_wallet_auth middleware
# ---------------------------------------------------------------------------


class TestRequireWalletAuth:
    """Mount a tiny protected endpoint and verify the middleware behaviour."""

    @pytest.fixture(autouse=True)
    def setup_protected_route(self):
        from fastapi import Depends
        from app.api.auth import require_wallet_auth

        @_app.get("/test-protected")
        async def _protected(user_id: str = Depends(require_wallet_auth)):
            return {"user_id": user_id}

    def _login(self, keypair) -> dict:
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        msg = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["message"]
        return client.post("/auth/siws", json={
            "wallet_address": wallet,
            "signature": _sign(keypair, msg),
            "message": msg,
        }).json()

    def test_valid_session_passes(self, keypair):
        tokens = self._login(keypair)
        r = client.get(
            "/test-protected",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert r.status_code == 200

    def test_missing_token_returns_401(self):
        r = client.get("/test-protected")
        assert r.status_code == 401

    def test_revoked_token_returns_401(self, keypair):
        tokens = self._login(keypair)
        run(siws_service.revoke_session(tokens["access_token"]))
        r = client.get(
            "/test-protected",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert r.status_code == 401

    def test_garbage_token_returns_401(self):
        r = client.get(
            "/test-protected", headers={"Authorization": "Bearer garbage.jwt.token"}
        )
        assert r.status_code == 401

    def test_refresh_token_rejected_on_protected_route(self, keypair):
        """Refresh tokens must not be accepted as access tokens."""
        tokens = self._login(keypair)
        r = client.get(
            "/test-protected",
            headers={"Authorization": f"Bearer {tokens['refresh_token']}"},
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


class TestSiwsLogout:
    def _login(self, keypair) -> dict:
        wallet = _wallet(keypair)
        _reset_rate_limit(wallet)
        msg = client.get(f"/auth/siws/message?wallet_address={wallet}").json()["message"]
        return client.post("/auth/siws", json={
            "wallet_address": wallet,
            "signature": _sign(keypair, msg),
            "message": msg,
        }).json()

    def test_logout_revokes_access_token(self, keypair):
        tokens = self._login(keypair)
        r = client.post(
            "/auth/siws/logout",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert r.status_code == 200
        assert run(siws_service.is_session_valid(tokens["access_token"])) is False

    def test_logout_without_token_returns_200(self):
        r = client.post("/auth/siws/logout")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_test_user(wallet: str) -> str:
    """Insert a minimal User row and return its ID string."""
    from datetime import datetime, timezone

    async with get_db_session() as session:
        user = User(
            github_id=f"siws_{wallet.lower()}",
            username=f"test_{wallet[:8].lower()}",
            wallet_address=wallet.lower(),
            wallet_verified=True,
            last_login_at=datetime.now(timezone.utc),
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return str(user.id)
