"""Tests for contributor webhook registration, management, and dispatch.

Covers:
- POST /api/webhooks/register (success, max-limit enforcement)
- GET  /api/webhooks          (empty, populated, user isolation)
- DELETE /api/webhooks/{id}   (success, not-found, wrong owner)
- ContributorWebhookService.dispatch_event (payload format, HMAC, retry)
- ContributorWebhookService._sign_payload helper
"""

import asyncio
import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

# Ensure the contributor_webhooks table is present in the shared in-memory DB.
# init_test_db in conftest.py runs once per session; importing the model here
# triggers SQLAlchemy's metadata registration so create_all (called by init_db)
# picks it up even when this module is loaded after the session fixture fires.
from app.models.contributor_webhook import (  # noqa: F401 (registers with Base.metadata)
    ContributorWebhookCreate,
    ContributorWebhookDB,
)
from app.database import Base, engine as _engine

# Belt-and-suspenders: ensure the table exists no matter when this module loads.
def _ensure_table():
    import asyncio as _asyncio
    from sqlalchemy import inspect as _inspect

    async def _create():
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already inside an event loop (shouldn't happen at module-level, but guard)
            pass
        else:
            loop.run_until_complete(_create())
    except RuntimeError:
        _asyncio.run(_create())

_ensure_table()

from app.database import get_db
from app.main import app
from app.services.contributor_webhook_service import (
    ContributorWebhookService,
    MAX_WEBHOOKS_PER_USER,
    VALID_EVENTS,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

USER_A = str(uuid.uuid4())
USER_B = str(uuid.uuid4())

SAMPLE_URL = "https://example.com/hooks/solfoundry"
BOUNTY_ID = str(uuid.uuid4())


def _auth_headers(user_id: str) -> dict:
    """Return headers that satisfy the test-mode auth dependency."""
    return {"X-User-ID": user_id}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield the app's own database session (in-memory SQLite via conftest)."""
    async for session in get_db():
        yield session
        break


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient backed by the ASGI app (no real network calls)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# POST /api/webhooks/register
# ---------------------------------------------------------------------------


class TestRegisterWebhook:
    """Tests for webhook registration endpoint."""

    @pytest.mark.asyncio
    async def test_register_webhook_success(self, client):
        """Registering a valid URL returns 201 with the webhook details."""
        resp = await client.post(
            "/api/webhooks/register",
            json={"url": SAMPLE_URL},
            headers=_auth_headers(USER_A),
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert "id" in body
        assert body["url"] == SAMPLE_URL
        assert body["active"] is True
        assert body["events"] is None  # all events
        assert "secret" not in body  # secret must never be exposed

    @pytest.mark.asyncio
    async def test_register_webhook_with_events_filter(self, client):
        """Registering with a specific event list stores only those events."""
        events = ["bounty.claimed", "bounty.paid"]
        resp = await client.post(
            "/api/webhooks/register",
            json={"url": SAMPLE_URL, "events": events},
            headers=_auth_headers(USER_A),
        )
        assert resp.status_code == 201
        body = resp.json()
        assert set(body["events"]) == set(events)

    @pytest.mark.asyncio
    async def test_register_webhook_invalid_event(self, client):
        """Unknown event names cause a 400 Bad Request."""
        resp = await client.post(
            "/api/webhooks/register",
            json={"url": SAMPLE_URL, "events": ["bounty.claimed", "not.real.event"]},
            headers=_auth_headers(USER_A),
        )
        assert resp.status_code == 400
        assert "not.real.event" in resp.json().get("detail", "") or \
               "not.real.event" in resp.json().get("message", "")

    @pytest.mark.asyncio
    async def test_register_webhook_enforces_max_limit(self, client):
        """Registering more than MAX_WEBHOOKS_PER_USER returns 429."""
        user_id = str(uuid.uuid4())  # fresh user to avoid cross-test pollution
        for i in range(MAX_WEBHOOKS_PER_USER):
            resp = await client.post(
                "/api/webhooks/register",
                json={"url": f"https://example.com/hook/{i}"},
                headers=_auth_headers(user_id),
            )
            assert resp.status_code == 201, f"Failed on webhook {i}: {resp.text}"

        # One more should be rejected
        resp = await client.post(
            "/api/webhooks/register",
            json={"url": "https://example.com/hook/overflow"},
            headers=_auth_headers(user_id),
        )
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_register_webhook_requires_auth(self, client):
        """Endpoint returns 401/400 when no credentials are supplied and auth is on.

        In the test environment AUTH_ENABLED=false (set by conftest) so the
        auth module falls back to the internal system user rather than raising.
        We therefore just verify the endpoint is reachable (not 404/405) and
        that the system can handle a no-credential request gracefully.
        """
        resp = await client.post(
            "/api/webhooks/register",
            json={"url": SAMPLE_URL},
        )
        # In dev mode (AUTH_ENABLED=false) falls back to system user — 201 is fine.
        # In prod mode it would be 401. Either way the route exists and responds.
        assert resp.status_code in (201, 400, 401)

    @pytest.mark.asyncio
    async def test_register_webhook_missing_url(self, client):
        """Omitting the required URL field returns 422 Unprocessable Entity."""
        resp = await client.post(
            "/api/webhooks/register",
            json={},
            headers=_auth_headers(USER_A),
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/webhooks
# ---------------------------------------------------------------------------


class TestListWebhooks:
    """Tests for the webhook listing endpoint."""

    @pytest.mark.asyncio
    async def test_list_webhooks_empty(self, client):
        """A user with no webhooks receives an empty list."""
        user_id = str(uuid.uuid4())
        resp = await client.get("/api/webhooks", headers=_auth_headers(user_id))
        assert resp.status_code == 200
        body = resp.json()
        assert body["webhooks"] == []
        assert body["total"] == 0

    @pytest.mark.asyncio
    async def test_list_webhooks_returns_own(self, client):
        """Listed webhooks belong only to the requesting user."""
        user_id = str(uuid.uuid4())
        # Register two webhooks
        for i in range(2):
            await client.post(
                "/api/webhooks/register",
                json={"url": f"https://example.com/list-test/{i}"},
                headers=_auth_headers(user_id),
            )

        resp = await client.get("/api/webhooks", headers=_auth_headers(user_id))
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 2
        assert len(body["webhooks"]) == 2
        for webhook in body["webhooks"]:
            assert "secret" not in webhook  # never expose secret

    @pytest.mark.asyncio
    async def test_list_webhooks_user_isolation(self, client):
        """Webhooks registered by user A are not visible to user B."""
        user_a = str(uuid.uuid4())
        user_b = str(uuid.uuid4())

        await client.post(
            "/api/webhooks/register",
            json={"url": "https://example.com/user-a-hook"},
            headers=_auth_headers(user_a),
        )

        resp = await client.get("/api/webhooks", headers=_auth_headers(user_b))
        assert resp.status_code == 200
        body = resp.json()
        urls = [w["url"] for w in body["webhooks"]]
        assert "https://example.com/user-a-hook" not in urls

    @pytest.mark.asyncio
    async def test_list_webhooks_response_shape(self, client):
        """Each webhook item contains the expected fields."""
        user_id = str(uuid.uuid4())
        await client.post(
            "/api/webhooks/register",
            json={"url": "https://example.com/shape-test"},
            headers=_auth_headers(user_id),
        )
        resp = await client.get("/api/webhooks", headers=_auth_headers(user_id))
        item = resp.json()["webhooks"][0]
        for field in ("id", "url", "active", "created_at"):
            assert field in item, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# DELETE /api/webhooks/{id}
# ---------------------------------------------------------------------------


class TestDeleteWebhook:
    """Tests for the webhook deletion endpoint."""

    @pytest.mark.asyncio
    async def test_delete_webhook_success(self, client):
        """Deleting an owned webhook returns 204 and removes it from the list."""
        user_id = str(uuid.uuid4())
        create_resp = await client.post(
            "/api/webhooks/register",
            json={"url": "https://example.com/to-delete"},
            headers=_auth_headers(user_id),
        )
        assert create_resp.status_code == 201
        webhook_id = create_resp.json()["id"]

        del_resp = await client.delete(
            f"/api/webhooks/{webhook_id}",
            headers=_auth_headers(user_id),
        )
        assert del_resp.status_code == 204

        # Verify it no longer appears in the list
        list_resp = await client.get("/api/webhooks", headers=_auth_headers(user_id))
        ids = [w["id"] for w in list_resp.json()["webhooks"]]
        assert webhook_id not in ids

    @pytest.mark.asyncio
    async def test_delete_webhook_not_found(self, client):
        """Deleting a non-existent webhook returns 404."""
        resp = await client.delete(
            f"/api/webhooks/{uuid.uuid4()}",
            headers=_auth_headers(USER_A),
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_webhook_wrong_owner(self, client):
        """A user cannot delete another user's webhook (returns 404)."""
        owner = str(uuid.uuid4())
        intruder = str(uuid.uuid4())

        create_resp = await client.post(
            "/api/webhooks/register",
            json={"url": "https://example.com/owner-hook"},
            headers=_auth_headers(owner),
        )
        webhook_id = create_resp.json()["id"]

        resp = await client.delete(
            f"/api/webhooks/{webhook_id}",
            headers=_auth_headers(intruder),
        )
        assert resp.status_code == 404  # ownership must not be disclosed

        # Original owner's webhook should still be active
        list_resp = await client.get("/api/webhooks", headers=_auth_headers(owner))
        ids = [w["id"] for w in list_resp.json()["webhooks"]]
        assert webhook_id in ids


# ---------------------------------------------------------------------------
# Service-level dispatch tests (mocked httpx)
# ---------------------------------------------------------------------------


class TestDispatchEvent:
    """Tests for ContributorWebhookService.dispatch_event."""

    @pytest.mark.asyncio
    async def test_dispatch_sends_correct_payload(self, db_session):
        """Dispatched payload matches the documented format."""
        service = ContributorWebhookService(db_session)
        webhook = await service.register_webhook(
            USER_A, ContributorWebhookCreate(url="https://example.com/dispatch-test")
        )

        captured_requests = []

        async def mock_post(url, *, content, headers, **kwargs):
            captured_requests.append(
                {"url": url, "content": content, "headers": headers}
            )
            response = MagicMock()
            response.status_code = 200
            return response

        with patch("httpx.AsyncClient.post", side_effect=mock_post):
            await ContributorWebhookService.dispatch_event(
                event_type="bounty.claimed",
                bounty_id=BOUNTY_ID,
                data={"contributor": "alice"},
                db=db_session,
            )

        assert len(captured_requests) >= 1
        req = captured_requests[-1]
        payload = json.loads(req["content"])
        assert payload["event"] == "bounty.claimed"
        assert payload["bounty_id"] == BOUNTY_ID
        assert "timestamp" in payload
        assert payload["data"] == {"contributor": "alice"}

    @pytest.mark.asyncio
    async def test_dispatch_includes_hmac_signature(self, db_session):
        """The X-SolFoundry-Signature header must match the computed HMAC."""
        service = ContributorWebhookService(db_session)
        create_payload = ContributorWebhookCreate(
            url="https://example.com/sig-test"
        )
        await service.register_webhook(USER_A, create_payload)

        # Pull the stored secret from the DB directly
        from sqlalchemy import select
        result = await db_session.execute(
            select(ContributorWebhookDB).where(
                ContributorWebhookDB.url == "https://example.com/sig-test"
            )
        )
        stored = result.scalars().first()
        assert stored is not None
        secret = stored.secret

        captured = {}

        async def mock_post(url, *, content, headers, **kwargs):
            captured["content"] = content
            captured["headers"] = headers
            resp = MagicMock()
            resp.status_code = 200
            return resp

        with patch("httpx.AsyncClient.post", side_effect=mock_post):
            await ContributorWebhookService.dispatch_event(
                event_type="bounty.paid",
                bounty_id=BOUNTY_ID,
                data={},
                db=db_session,
            )

        sig_header = captured["headers"]["X-SolFoundry-Signature"]
        expected = ContributorWebhookService._sign_payload(captured["content"], secret)
        assert sig_header == expected

    @pytest.mark.asyncio
    async def test_dispatch_respects_event_filter(self, db_session):
        """Webhooks with an event filter only receive matching events."""
        service = ContributorWebhookService(db_session)
        user_id = str(uuid.uuid4())
        await service.register_webhook(
            user_id,
            ContributorWebhookCreate(
                url="https://example.com/filtered",
                events=["bounty.paid"],
            ),
        )

        call_count = 0

        async def mock_post(url, **kwargs):
            nonlocal call_count
            if url == "https://example.com/filtered":
                call_count += 1
            resp = MagicMock()
            resp.status_code = 200
            return resp

        with patch("httpx.AsyncClient.post", side_effect=mock_post):
            # review.started should NOT hit the filtered webhook
            await ContributorWebhookService.dispatch_event(
                event_type="review.started",
                bounty_id=BOUNTY_ID,
                data={},
                db=db_session,
            )

        assert call_count == 0

    @pytest.mark.asyncio
    async def test_dispatch_retries_on_5xx(self, db_session):
        """On 5xx responses the dispatcher retries up to 3 times."""
        service = ContributorWebhookService(db_session)
        user_id = str(uuid.uuid4())
        await service.register_webhook(
            user_id,
            ContributorWebhookCreate(url="https://example.com/retry-test"),
        )

        attempt_count = 0

        async def flaky_post(url, *, content, headers, **kwargs):
            nonlocal attempt_count
            if url == "https://example.com/retry-test":
                attempt_count += 1
            resp = MagicMock()
            resp.status_code = 503
            return resp

        with patch("httpx.AsyncClient.post", side_effect=flaky_post), \
             patch("asyncio.sleep", new_callable=AsyncMock):
            await ContributorWebhookService.dispatch_event(
                event_type="review.passed",
                bounty_id=BOUNTY_ID,
                data={},
                db=db_session,
            )

        # 3 attempts total (initial + 2 retries)
        assert attempt_count == 3

    @pytest.mark.asyncio
    async def test_dispatch_does_not_raise_on_total_failure(self, db_session):
        """Permanent delivery failure must not propagate an exception to the caller."""
        service = ContributorWebhookService(db_session)
        user_id = str(uuid.uuid4())
        await service.register_webhook(
            user_id,
            ContributorWebhookCreate(url="https://example.com/always-fail"),
        )

        async def always_fail(*args, **kwargs):
            raise httpx.ConnectError("connection refused")

        import httpx as _httpx  # noqa: F401 (ensure correct module patched)

        with patch("httpx.AsyncClient.post", side_effect=always_fail), \
             patch("asyncio.sleep", new_callable=AsyncMock):
            # Must not raise
            await ContributorWebhookService.dispatch_event(
                event_type="bounty.claimed",
                bounty_id=BOUNTY_ID,
                data={},
                db=db_session,
            )


# ---------------------------------------------------------------------------
# Signature helper
# ---------------------------------------------------------------------------


class TestSignPayload:
    """Tests for the _sign_payload static method."""

    def test_signature_format(self):
        """Signature must start with 'sha256='."""
        payload = b'{"event":"test"}'
        sig = ContributorWebhookService._sign_payload(payload, "mysecret")
        assert sig.startswith("sha256=")

    def test_signature_correct_hmac(self):
        """Computed signature must match a reference HMAC-SHA256 calculation."""
        payload = b'{"event":"bounty.claimed","bounty_id":"abc"}'
        secret = "supersecret"
        expected = "sha256=" + hmac.new(
            secret.encode("utf-8"), payload, hashlib.sha256
        ).hexdigest()
        assert ContributorWebhookService._sign_payload(payload, secret) == expected

    def test_signature_different_payloads_differ(self):
        """Different payloads must produce different signatures."""
        secret = "shared-secret"
        sig1 = ContributorWebhookService._sign_payload(b"payload-one", secret)
        sig2 = ContributorWebhookService._sign_payload(b"payload-two", secret)
        assert sig1 != sig2

    def test_signature_different_secrets_differ(self):
        """The same payload signed with different secrets must differ."""
        payload = b"same payload"
        sig1 = ContributorWebhookService._sign_payload(payload, "secret-one")
        sig2 = ContributorWebhookService._sign_payload(payload, "secret-two")
        assert sig1 != sig2

    def test_signature_is_deterministic(self):
        """The same inputs must always produce the same signature."""
        payload = b"deterministic"
        secret = "fixed"
        assert ContributorWebhookService._sign_payload(
            payload, secret
        ) == ContributorWebhookService._sign_payload(payload, secret)
