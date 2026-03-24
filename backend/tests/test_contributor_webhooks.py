"""Unit tests for outbound contributor webhook endpoints and service (Issue #475).

Covers:
- Webhook registration (happy path, limit enforcement, HTTPS validation)
- Webhook unregistration (happy path, not-found)
- Listing webhooks
- Payload signing (HMAC-SHA256)
- Dispatch with retry logic (success, non-2xx, network error, exhausted retries)
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.contributor_webhooks import router as webhook_router
from app.models.contributor_webhook import (
    ContributorWebhookDB,
    WebhookRegisterRequest,
)
from app.services.contributor_webhook_service import (
    ContributorWebhookService,
    WebhookLimitExceededError,
    WebhookNotFoundError,
    _sign_payload,
    _build_payload,
    MAX_WEBHOOKS_PER_USER,
)

# ── test app ───────────────────────────────────────────────────────────────────

TEST_USER_ID = str(uuid.uuid4())

app = FastAPI()
app.include_router(webhook_router)

# Override auth to always return TEST_USER_ID
app.dependency_overrides = {}


async def _fake_user_id() -> str:
    return TEST_USER_ID


async def _fake_db():
    """Yield a mock DB session."""
    yield MagicMock()


# ── fixtures ───────────────────────────────────────────────────────────────────


def _make_db_record(
    user_id: str = TEST_USER_ID,
    url: str = "https://example.com/hook",
    secret: str = "supersecret1234567890",
    active: bool = True,
    failure_count: int = 0,
) -> ContributorWebhookDB:
    """Build a synthetic DB record for testing."""
    record = ContributorWebhookDB()
    record.id = uuid.uuid4()
    record.user_id = uuid.UUID(user_id)
    record.url = url
    record.secret = secret
    record.active = active
    record.failure_count = failure_count
    record.created_at = datetime.now(timezone.utc)
    record.updated_at = datetime.now(timezone.utc)
    record.last_delivery_at = None
    record.last_delivery_status = None
    return record


# ── signing tests ──────────────────────────────────────────────────────────────


def test_sign_payload_produces_sha256_prefix():
    """Signature must start with 'sha256='."""
    sig = _sign_payload(b"hello", "mysecret")
    assert sig.startswith("sha256=")


def test_sign_payload_hmac_correct():
    """Signature must match an independently computed HMAC-SHA256."""
    payload = b'{"event":"bounty.claimed"}'
    secret = "test-secret-abc"
    expected = (
        "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    )
    assert _sign_payload(payload, secret) == expected


def test_sign_payload_different_secrets_differ():
    payload = b"data"
    assert _sign_payload(payload, "secret-a") != _sign_payload(payload, "secret-b")


def test_build_payload_structure():
    """build_payload must produce valid JSON with required fields."""
    raw = _build_payload("bounty.claimed", "bounty-123", {"foo": "bar"})
    data = json.loads(raw)
    assert data["event"] == "bounty.claimed"
    assert data["bounty_id"] == "bounty-123"
    assert "timestamp" in data
    assert data["data"] == {"foo": "bar"}


# ── service unit tests ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_creates_record():
    """register() should add a record and return a WebhookResponse."""
    record = _make_db_record()

    # Build a mock result chain: execute -> scalar_one (sync, not coro)
    count_result = MagicMock()
    count_result.scalar_one = MagicMock(return_value=0)

    db = AsyncMock()
    db.execute = AsyncMock(return_value=count_result)

    # Simulate refresh populating the record
    async def fake_refresh(r):
        r.id = record.id
        r.created_at = record.created_at
        r.updated_at = record.updated_at
        r.last_delivery_at = None
        r.last_delivery_status = None
        r.failure_count = 0
        r.active = True

    db.refresh = fake_refresh

    service = ContributorWebhookService(db)
    req = WebhookRegisterRequest(
        url="https://example.com/hook",
        secret="supersecret1234567890",
    )
    result = await service.register(TEST_USER_ID, req)
    assert result.url == "https://example.com/hook"
    assert result.active is True
    db.add.assert_called_once()
    db.commit.assert_called()


@pytest.mark.asyncio
async def test_register_enforces_limit():
    """register() must raise WebhookLimitExceededError when at limit."""
    count_result = MagicMock()
    count_result.scalar_one = MagicMock(return_value=MAX_WEBHOOKS_PER_USER)

    db = AsyncMock()
    db.execute = AsyncMock(return_value=count_result)

    service = ContributorWebhookService(db)
    req = WebhookRegisterRequest(
        url="https://example.com/hook",
        secret="supersecret1234567890",
    )
    with pytest.raises(WebhookLimitExceededError):
        await service.register(TEST_USER_ID, req)


@pytest.mark.asyncio
async def test_unregister_sets_inactive():
    """unregister() should set active=False."""
    record = _make_db_record()

    select_result = MagicMock()
    select_result.scalar_one_or_none = MagicMock(return_value=record)

    db = AsyncMock()
    db.execute = AsyncMock(return_value=select_result)

    service = ContributorWebhookService(db)
    await service.unregister(TEST_USER_ID, str(record.id))

    assert record.active is False
    db.commit.assert_called()


@pytest.mark.asyncio
async def test_unregister_raises_not_found():
    """unregister() must raise WebhookNotFoundError if record missing."""
    select_result = MagicMock()
    select_result.scalar_one_or_none = MagicMock(return_value=None)

    db = AsyncMock()
    db.execute = AsyncMock(return_value=select_result)

    service = ContributorWebhookService(db)
    with pytest.raises(WebhookNotFoundError):
        await service.unregister(TEST_USER_ID, str(uuid.uuid4()))


@pytest.mark.asyncio
async def test_list_for_user_returns_active_webhooks():
    """list_for_user() should return all active records."""
    records = [_make_db_record(), _make_db_record(url="https://other.example/hook")]

    scalars_result = MagicMock()
    scalars_result.all = MagicMock(return_value=records)

    list_result = MagicMock()
    list_result.scalars = MagicMock(return_value=scalars_result)

    db = AsyncMock()
    db.execute = AsyncMock(return_value=list_result)

    service = ContributorWebhookService(db)
    result = await service.list_for_user(TEST_USER_ID)
    assert len(result) == 2
    assert result[0].url == "https://example.com/hook"


# ── dispatch / retry tests ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_deliver_success_on_first_attempt():
    """Successful 2xx delivery should record success and not retry."""
    record = _make_db_record()
    db = AsyncMock()

    service = ContributorWebhookService(db)

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_cm.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.post.return_value = mock_cm
    mock_session_cm = MagicMock()
    mock_session_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session_cm.__aexit__ = AsyncMock(return_value=False)

    with patch(
        "app.services.contributor_webhook_service.aiohttp.ClientSession",
        return_value=mock_session_cm,
    ):
        payload_bytes = _build_payload("bounty.claimed", "b-1", {})
        await service._deliver_with_retry(record, "bounty.claimed", payload_bytes)

    db.commit.assert_called()


@pytest.mark.asyncio
async def test_deliver_retries_on_non_2xx():
    """Non-2xx responses should trigger retries up to MAX_ATTEMPTS."""
    record = _make_db_record()
    db = AsyncMock()
    service = ContributorWebhookService(db)

    mock_resp = MagicMock()
    mock_resp.status = 503

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_cm.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.post.return_value = mock_cm
    mock_session_cm = MagicMock()
    mock_session_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session_cm.__aexit__ = AsyncMock(return_value=False)

    with (
        patch(
            "app.services.contributor_webhook_service.aiohttp.ClientSession",
            return_value=mock_session_cm,
        ),
        patch(
            "app.services.contributor_webhook_service.asyncio.sleep",
            new_callable=AsyncMock,
        ),
    ):
        payload_bytes = _build_payload("review.failed", "b-2", {})
        await service._deliver_with_retry(record, "review.failed", payload_bytes)

    from app.services.contributor_webhook_service import MAX_ATTEMPTS

    assert mock_session.post.call_count == MAX_ATTEMPTS


@pytest.mark.asyncio
async def test_deliver_retries_on_network_error():
    """Network exceptions should trigger retries."""
    record = _make_db_record()
    db = AsyncMock()
    service = ContributorWebhookService(db)

    mock_session = MagicMock()
    mock_session.post.side_effect = ConnectionError("refused")
    mock_session_cm = MagicMock()
    mock_session_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session_cm.__aexit__ = AsyncMock(return_value=False)

    with (
        patch(
            "app.services.contributor_webhook_service.aiohttp.ClientSession",
            return_value=mock_session_cm,
        ),
        patch(
            "app.services.contributor_webhook_service.asyncio.sleep",
            new_callable=AsyncMock,
        ),
    ):
        payload_bytes = _build_payload("bounty.paid", "b-3", {})
        await service._deliver_with_retry(record, "bounty.paid", payload_bytes)

    from app.services.contributor_webhook_service import MAX_ATTEMPTS

    assert mock_session.post.call_count == MAX_ATTEMPTS


@pytest.mark.asyncio
async def test_deliver_succeeds_on_second_attempt():
    """Delivery that fails once then succeeds should not exhaust retries."""
    record = _make_db_record()
    db = AsyncMock()
    service = ContributorWebhookService(db)

    call_count = 0

    def make_resp_cm(status_code: int):
        resp = MagicMock()
        resp.status = status_code
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(return_value=resp)
        cm.__aexit__ = AsyncMock(return_value=False)
        return cm

    def fake_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        return make_resp_cm(503 if call_count == 1 else 200)

    mock_session = MagicMock()
    mock_session.post.side_effect = fake_post
    mock_session_cm = MagicMock()
    mock_session_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session_cm.__aexit__ = AsyncMock(return_value=False)

    with (
        patch(
            "app.services.contributor_webhook_service.aiohttp.ClientSession",
            return_value=mock_session_cm,
        ),
        patch(
            "app.services.contributor_webhook_service.asyncio.sleep",
            new_callable=AsyncMock,
        ),
    ):
        payload_bytes = _build_payload("review.passed", "b-4", {})
        await service._deliver_with_retry(record, "review.passed", payload_bytes)

    assert call_count == 2  # failed once, succeeded on second try


# ── API endpoint tests ─────────────────────────────────────────────────────────


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.asyncio
async def test_register_endpoint_returns_201():
    """POST /webhooks/register must return 201 with webhook data."""
    from app.auth import get_current_user_id
    from app.database import get_db

    created = _make_db_record()

    mock_service = AsyncMock()
    from app.models.contributor_webhook import WebhookResponse

    mock_service.register.return_value = WebhookResponse(
        id=str(created.id),
        url="https://example.com/hook",
        active=True,
        created_at=created.created_at,
        failure_count=0,
    )

    with patch(
        "app.api.contributor_webhooks.ContributorWebhookService",
        return_value=mock_service,
    ):
        test_app = FastAPI()
        test_app.include_router(webhook_router)
        test_app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
        test_app.dependency_overrides[get_db] = _fake_db

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/webhooks/register",
                json={
                    "url": "https://example.com/hook",
                    "secret": "supersecret1234567890",
                },
            )
    assert response.status_code == 201
    body = response.json()
    assert body["url"] == "https://example.com/hook"
    assert body["active"] is True


@pytest.mark.asyncio
async def test_register_endpoint_rejects_http_url():
    """POST /webhooks/register must reject non-HTTPS URLs."""
    from app.auth import get_current_user_id
    from app.database import get_db

    test_app = FastAPI()
    test_app.include_router(webhook_router)
    test_app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    test_app.dependency_overrides[get_db] = _fake_db

    async with AsyncClient(
        transport=ASGITransport(app=test_app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/webhooks/register",
            json={"url": "http://example.com/hook", "secret": "supersecret1234567890"},
        )
    assert response.status_code == 422  # validation error


@pytest.mark.asyncio
async def test_register_endpoint_returns_400_on_limit():
    """POST /webhooks/register returns 400 when limit exceeded."""
    from app.auth import get_current_user_id
    from app.database import get_db

    mock_service = AsyncMock()
    mock_service.register.side_effect = WebhookLimitExceededError("limit")

    with patch(
        "app.api.contributor_webhooks.ContributorWebhookService",
        return_value=mock_service,
    ):
        test_app = FastAPI()
        test_app.include_router(webhook_router)
        test_app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
        test_app.dependency_overrides[get_db] = _fake_db

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/webhooks/register",
                json={
                    "url": "https://example.com/hook",
                    "secret": "supersecret1234567890",
                },
            )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_unregister_endpoint_returns_204():
    """DELETE /webhooks/{id} returns 204 on success."""
    from app.auth import get_current_user_id
    from app.database import get_db

    wh_id = str(uuid.uuid4())
    mock_service = AsyncMock()
    mock_service.unregister.return_value = None

    with patch(
        "app.api.contributor_webhooks.ContributorWebhookService",
        return_value=mock_service,
    ):
        test_app = FastAPI()
        test_app.include_router(webhook_router)
        test_app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
        test_app.dependency_overrides[get_db] = _fake_db

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            response = await client.delete(f"/webhooks/{wh_id}")
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_unregister_endpoint_returns_404():
    """DELETE /webhooks/{id} returns 404 when webhook not found."""
    from app.auth import get_current_user_id
    from app.database import get_db

    mock_service = AsyncMock()
    mock_service.unregister.side_effect = WebhookNotFoundError("not found")

    with patch(
        "app.api.contributor_webhooks.ContributorWebhookService",
        return_value=mock_service,
    ):
        test_app = FastAPI()
        test_app.include_router(webhook_router)
        test_app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
        test_app.dependency_overrides[get_db] = _fake_db

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            response = await client.delete(f"/webhooks/{uuid.uuid4()}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_endpoint_returns_webhooks():
    """GET /webhooks returns list of active webhooks."""
    from app.auth import get_current_user_id
    from app.database import get_db
    from app.models.contributor_webhook import WebhookResponse

    now = datetime.now(timezone.utc)
    mock_service = AsyncMock()
    mock_service.list_for_user.return_value = [
        WebhookResponse(
            id=str(uuid.uuid4()),
            url="https://example.com/hook",
            active=True,
            created_at=now,
            failure_count=0,
        )
    ]

    with patch(
        "app.api.contributor_webhooks.ContributorWebhookService",
        return_value=mock_service,
    ):
        test_app = FastAPI()
        test_app.include_router(webhook_router)
        test_app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
        test_app.dependency_overrides[get_db] = _fake_db

        async with AsyncClient(
            transport=ASGITransport(app=test_app), base_url="http://test"
        ) as client:
            response = await client.get("/webhooks")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["url"] == "https://example.com/hook"
