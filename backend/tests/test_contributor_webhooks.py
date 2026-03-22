"""Unit tests for contributor webhook notification system.

Coverage:
    - Registration: valid URL, invalid URL, exceeding limit
    - Listing: authenticated user, empty list
    - Deletion: owner, unauthorized, non-existent
    - Dispatcher: successful delivery, retry on failure, final failure
    - Signature: correct HMAC output, header inclusion
    - Secret management: encryption round-trip
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app
from app.models.contributor_webhook import ContributorWebhookDB, WebhookEventType
from app.services.contributor_webhook_service import (
    MAX_WEBHOOKS_PER_USER,
    ContributorWebhookService,
    _encrypt_secret,
    _generate_secret,
    _hash_secret,
    decrypt_secret,
)
from app.services.webhook_dispatcher import (
    _build_payload,
    _deliver_with_retry,
    dispatch_event,
    sign_payload,
)

TEST_USER_ID = str(uuid.uuid4())
TEST_WEBHOOK_URL = "https://example.com/webhook"

_TEST_ENGINE = None
_TEST_SESSION_FACTORY = None


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture(scope="function")
async def db_session():
    """In-memory SQLite session per test."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    """ASGI test client with DB override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def registered_webhook(db_session):
    """Create a single webhook for TEST_USER_ID."""
    svc = ContributorWebhookService(db_session)
    return await svc.create_webhook(TEST_USER_ID, TEST_WEBHOOK_URL)


# ---------------------------------------------------------------------------
# Secret management
# ---------------------------------------------------------------------------


class TestSecretManagement:
    def test_generate_secret_is_64_hex_chars(self):
        s = _generate_secret()
        assert len(s) == 64
        int(s, 16)

    def test_encrypt_decrypt_roundtrip(self):
        raw = _generate_secret()
        encrypted = _encrypt_secret(raw)
        assert encrypted != raw
        assert decrypt_secret(encrypted) == raw

    def test_hash_secret_is_sha256(self):
        raw = "test-secret"
        assert _hash_secret(raw) == hashlib.sha256(raw.encode()).hexdigest()
        assert len(_hash_secret(raw)) == 64

    def test_different_secrets_have_different_hashes(self):
        a, b = _generate_secret(), _generate_secret()
        assert _hash_secret(a) != _hash_secret(b)


# ---------------------------------------------------------------------------
# Signature
# ---------------------------------------------------------------------------


class TestSignature:
    def test_correct_hmac(self):
        secret = "my-secret-key"
        payload = b'{"event":"bounty.claimed"}'
        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        assert sign_payload(secret, payload) == expected

    def test_is_deterministic(self):
        assert sign_payload("k", b"d") == sign_payload("k", b"d")

    def test_differs_with_different_secret(self):
        assert sign_payload("key1", b"d") != sign_payload("key2", b"d")

    def test_build_payload_valid_json(self):
        raw = _build_payload(WebhookEventType.BOUNTY_CLAIMED, "bounty-123", {"k": "v"})
        body = json.loads(raw)
        assert body["event"] == "bounty.claimed"
        assert body["bounty_id"] == "bounty-123"
        assert "timestamp" in body
        assert body["data"] == {"k": "v"}

    def test_build_payload_sorted_keys(self):
        raw = _build_payload(WebhookEventType.REVIEW_PASSED, "b1", {}).decode()
        assert raw.find('"bounty_id"') < raw.find('"data"') < raw.find('"event"')


# ---------------------------------------------------------------------------
# Service: registration
# ---------------------------------------------------------------------------


class TestWebhookRegistration:
    @pytest.mark.asyncio
    async def test_register_valid_url(self, db_session):
        svc = ContributorWebhookService(db_session)
        result = await svc.create_webhook(TEST_USER_ID, TEST_WEBHOOK_URL)
        assert result.url == TEST_WEBHOOK_URL
        assert len(result.secret) == 64
        assert result.is_active is True

    @pytest.mark.asyncio
    async def test_secret_not_in_list_response(self, registered_webhook, db_session):
        svc = ContributorWebhookService(db_session)
        listed = await svc.list_webhooks(TEST_USER_ID)
        assert not hasattr(listed[0], "secret")

    @pytest.mark.asyncio
    async def test_secret_hash_stored_correctly(self, registered_webhook, db_session):
        from sqlalchemy import select

        row = (
            await db_session.execute(
                select(ContributorWebhookDB).where(
                    ContributorWebhookDB.id == registered_webhook.id
                )
            )
        ).scalar_one()
        assert row.secret_hash == _hash_secret(registered_webhook.secret)

    @pytest.mark.asyncio
    async def test_max_limit_enforced(self, db_session):
        svc = ContributorWebhookService(db_session)
        user_id = str(uuid.uuid4())
        for i in range(MAX_WEBHOOKS_PER_USER):
            await svc.create_webhook(user_id, f"https://example.com/hook/{i}")
        with pytest.raises(ValueError, match="Webhook limit reached"):
            await svc.create_webhook(user_id, "https://example.com/overflow")

    @pytest.mark.asyncio
    async def test_register_http_url_accepted(self, db_session):
        svc = ContributorWebhookService(db_session)
        result = await svc.create_webhook(TEST_USER_ID, "http://example.com/hook")
        assert result.url == "http://example.com/hook"


# ---------------------------------------------------------------------------
# API: registration endpoint
# ---------------------------------------------------------------------------


class TestRegistrationAPI:
    @pytest.mark.asyncio
    async def test_returns_201_with_secret(self, client):
        resp = await client.post(
            "/api/webhooks/register",
            json={"url": TEST_WEBHOOK_URL},
            headers={"X-User-ID": TEST_USER_ID},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert "secret" in body
        assert body["url"] == TEST_WEBHOOK_URL
        assert "id" in body

    @pytest.mark.asyncio
    async def test_invalid_url_rejected(self, client):
        resp = await client.post(
            "/api/webhooks/register",
            json={"url": "not-a-url"},
            headers={"X-User-ID": TEST_USER_ID},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_missing_url_rejected(self, client):
        resp = await client.post(
            "/api/webhooks/register",
            json={},
            headers={"X-User-ID": TEST_USER_ID},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_limit_returns_422(self, client):
        user_id = str(uuid.uuid4())
        for i in range(MAX_WEBHOOKS_PER_USER):
            r = await client.post(
                "/api/webhooks/register",
                json={"url": f"https://example.com/hook/{i}"},
                headers={"X-User-ID": user_id},
            )
            assert r.status_code == 201
        r = await client.post(
            "/api/webhooks/register",
            json={"url": "https://example.com/overflow"},
            headers={"X-User-ID": user_id},
        )
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# API: listing
# ---------------------------------------------------------------------------


class TestListAPI:
    @pytest.mark.asyncio
    async def test_empty_list(self, client):
        resp = await client.get(
            "/api/webhooks", headers={"X-User-ID": str(uuid.uuid4())}
        )
        assert resp.status_code == 200
        assert resp.json() == {"items": [], "total": 0}

    @pytest.mark.asyncio
    async def test_returns_registered_webhooks(self, client):
        user_id = str(uuid.uuid4())
        await client.post(
            "/api/webhooks/register",
            json={"url": TEST_WEBHOOK_URL},
            headers={"X-User-ID": user_id},
        )
        resp = await client.get("/api/webhooks", headers={"X-User-ID": user_id})
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["url"] == TEST_WEBHOOK_URL
        assert "secret" not in body["items"][0]

    @pytest.mark.asyncio
    async def test_isolated_per_user(self, client):
        user_a, user_b = str(uuid.uuid4()), str(uuid.uuid4())
        await client.post(
            "/api/webhooks/register",
            json={"url": TEST_WEBHOOK_URL},
            headers={"X-User-ID": user_a},
        )
        resp = await client.get("/api/webhooks", headers={"X-User-ID": user_b})
        assert resp.json()["total"] == 0


# ---------------------------------------------------------------------------
# API: deletion
# ---------------------------------------------------------------------------


class TestDeleteAPI:
    @pytest.mark.asyncio
    async def test_owner_can_delete(self, client):
        user_id = str(uuid.uuid4())
        reg = await client.post(
            "/api/webhooks/register",
            json={"url": TEST_WEBHOOK_URL},
            headers={"X-User-ID": user_id},
        )
        webhook_id = reg.json()["id"]
        resp = await client.delete(
            f"/api/webhooks/{webhook_id}", headers={"X-User-ID": user_id}
        )
        assert resp.status_code == 204
        listed = await client.get("/api/webhooks", headers={"X-User-ID": user_id})
        assert listed.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_non_owner_gets_403(self, client):
        owner, other = str(uuid.uuid4()), str(uuid.uuid4())
        reg = await client.post(
            "/api/webhooks/register",
            json={"url": TEST_WEBHOOK_URL},
            headers={"X-User-ID": owner},
        )
        webhook_id = reg.json()["id"]
        resp = await client.delete(
            f"/api/webhooks/{webhook_id}", headers={"X-User-ID": other}
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_nonexistent_returns_404(self, client):
        resp = await client.delete(
            f"/api/webhooks/{uuid.uuid4()}", headers={"X-User-ID": TEST_USER_ID}
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_double_delete_returns_404(self, client):
        user_id = str(uuid.uuid4())
        reg = await client.post(
            "/api/webhooks/register",
            json={"url": TEST_WEBHOOK_URL},
            headers={"X-User-ID": user_id},
        )
        webhook_id = reg.json()["id"]
        await client.delete(
            f"/api/webhooks/{webhook_id}", headers={"X-User-ID": user_id}
        )
        resp = await client.delete(
            f"/api/webhooks/{webhook_id}", headers={"X-User-ID": user_id}
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Dispatcher: delivery logic
# ---------------------------------------------------------------------------


def _make_webhook_spec(raw_secret: str | None = None) -> tuple[str, str, str]:
    """Return (webhook_id, url, secret_encrypted) for testing _deliver_with_retry."""
    raw = raw_secret or _generate_secret()
    return str(uuid.uuid4()), TEST_WEBHOOK_URL, _encrypt_secret(raw)


class TestWebhookDispatcher:
    @pytest.mark.asyncio
    async def test_successful_delivery(self):
        wh_id, url, secret_enc = _make_webhook_spec()
        mock_resp = MagicMock(status_code=200)
        payload = _build_payload(WebhookEventType.BOUNTY_CLAIMED, "b1", {})

        with patch("app.services.webhook_dispatcher.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            await _deliver_with_retry(wh_id, url, secret_enc, payload)
            mock_client.post.assert_called_once()
            call_headers = mock_client.post.call_args[1]["headers"]
            assert "X-Webhook-Signature" in call_headers
            assert len(call_headers["X-Webhook-Signature"]) == 64

    @pytest.mark.asyncio
    async def test_retries_on_network_failure(self):
        wh_id, url, secret_enc = _make_webhook_spec()
        call_count = 0

        async def flaky(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise httpx.TransportError("refused")
            return MagicMock(status_code=200)

        with patch("app.services.webhook_dispatcher.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=flaky)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            with patch(
                "app.services.webhook_dispatcher.asyncio.sleep", new_callable=AsyncMock
            ):
                payload = _build_payload(WebhookEventType.REVIEW_STARTED, "b1", {})
                await _deliver_with_retry(wh_id, url, secret_enc, payload)

        assert call_count == 3

    @pytest.mark.asyncio
    async def test_max_3_attempts_on_permanent_failure(self):
        wh_id, url, secret_enc = _make_webhook_spec()
        call_count = 0

        async def always_fail(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            raise httpx.TransportError("refused")

        with patch("app.services.webhook_dispatcher.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=always_fail)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            with patch(
                "app.services.webhook_dispatcher.asyncio.sleep", new_callable=AsyncMock
            ):
                payload = _build_payload(WebhookEventType.REVIEW_FAILED, "b1", {})
                await _deliver_with_retry(wh_id, url, secret_enc, payload)

        assert call_count == 3

    @pytest.mark.asyncio
    async def test_retries_on_non_2xx(self):
        wh_id, url, secret_enc = _make_webhook_spec()
        call_count = 0

        async def server_error(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return MagicMock(status_code=500)

        with patch("app.services.webhook_dispatcher.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=server_error)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            with patch(
                "app.services.webhook_dispatcher.asyncio.sleep", new_callable=AsyncMock
            ):
                payload = _build_payload(WebhookEventType.BOUNTY_PAID, "b1", {})
                await _deliver_with_retry(wh_id, url, secret_enc, payload)

        assert call_count == 3

    @pytest.mark.asyncio
    async def test_dispatch_event_no_webhooks_is_noop(self, db_session):
        """dispatch_event with no registered webhooks makes no HTTP calls."""
        user_id = str(uuid.uuid4())

        with patch("app.services.webhook_dispatcher.httpx.AsyncClient") as mock_cls:
            with patch("app.services.webhook_dispatcher.get_db_session") as mock_db_ctx:
                mock_db_ctx.return_value.__aenter__ = AsyncMock(return_value=db_session)
                mock_db_ctx.return_value.__aexit__ = AsyncMock(return_value=False)

                await dispatch_event(
                    event=WebhookEventType.BOUNTY_CLAIMED,
                    bounty_id="b1",
                    user_id=user_id,
                    data={},
                )
            mock_cls.assert_not_called()

    @pytest.mark.asyncio
    async def test_signature_is_verifiable_by_receiver(self):
        """The X-Webhook-Signature header passes receiver-side HMAC check."""
        raw_secret = _generate_secret()
        wh_id, url, secret_enc = _make_webhook_spec(raw_secret)

        received_headers: dict = {}
        received_body: bytes = b""

        async def capture(*args, **kwargs):
            nonlocal received_headers, received_body
            received_headers = kwargs.get("headers", {})
            received_body = kwargs.get("content", b"")
            return MagicMock(status_code=200)

        with patch("app.services.webhook_dispatcher.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=capture)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            payload = _build_payload(
                WebhookEventType.REVIEW_PASSED, "b1", {"score": 9.5}
            )
            await _deliver_with_retry(wh_id, url, secret_enc, payload)

        sig = received_headers["X-Webhook-Signature"]
        expected = hmac.new(
            raw_secret.encode(), received_body, hashlib.sha256
        ).hexdigest()
        assert hmac.compare_digest(sig, expected)
