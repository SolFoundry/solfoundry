"""Bounty comments API, spam filter, and rate limit."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from app.config import get_settings
from app.main import app
from app.routers import comments as comments_router
from app.services.comment_spam import RateLimiter, assess_spam
from app.services.comment_store import get_comment_store
from app.services.tokens import create_access_token


@pytest.fixture
def api_client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_rate_limiter_singleton():
    comments_router._rl_singleton = None
    yield
    comments_router._rl_singleton = None


@pytest.fixture(autouse=True)
def clear_comments():
    store = get_comment_store()
    store.clear_all()
    yield
    store.clear_all()


def _access_token() -> str:
    settings = get_settings()
    return create_access_token(
        settings,
        {
            "sub": "user-test-1",
            "username": "tester",
            "github_id": "1",
            "avatar_url": None,
            "email": None,
            "created_at": "2026-01-01T00:00:00+00:00",
        },
    )


def test_list_comments_empty(api_client: TestClient) -> None:
    r = api_client.get("/api/bounties/b1/comments")
    assert r.status_code == 200
    assert r.json() == {"items": []}


def test_create_and_list_comment(api_client: TestClient) -> None:
    token = _access_token()
    r = api_client.post(
        "/api/bounties/b1/comments",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "Does this include tests?"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["body"] == "Does this include tests?"
    assert data["author_username"] == "tester"

    r2 = api_client.get("/api/bounties/b1/comments")
    assert len(r2.json()["items"]) == 1


def test_nested_reply(api_client: TestClient) -> None:
    token = _access_token()
    parent = api_client.post(
        "/api/bounties/b1/comments",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "Parent"},
    ).json()
    child = api_client.post(
        "/api/bounties/b1/comments",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "Reply", "parent_id": parent["id"]},
    )
    assert child.status_code == 200
    assert child.json()["parent_id"] == parent["id"]


def test_spam_rejected(api_client: TestClient) -> None:
    token = _access_token()
    r = api_client.post(
        "/api/bounties/b1/comments",
        headers={"Authorization": f"Bearer {token}"},
        json={"body": "click here now for free money"},
    )
    assert r.status_code == 400


def test_rate_limit(api_client: TestClient) -> None:
    settings = get_settings()
    token = create_access_token(
        settings,
        {
            "sub": "user-rate-limit-only",
            "username": "rater",
            "github_id": "99",
            "avatar_url": None,
            "email": None,
            "created_at": "2026-01-01T00:00:00+00:00",
        },
    )
    for i in range(15):
        r = api_client.post(
            "/api/bounties/b1/comments",
            headers={"Authorization": f"Bearer {token}"},
            json={"body": f"msg {i}"},
        )
        if r.status_code == 429:
            assert i >= 10
            return
    pytest.fail("expected 429 rate limit")


def test_assess_spam_helpers() -> None:
    assert assess_spam("hello world")[0] is False
    assert assess_spam("Discussion about the API design.")[0] is False
    assert assess_spam("click here now for prize")[0] is True
    assert assess_spam("x" * 60)[0] is True


def test_rate_limiter_unit() -> None:
    rl = RateLimiter(2, 10.0)
    assert rl.check("u")[0] is True
    assert rl.check("u")[0] is True
    assert rl.check("u")[0] is False


def test_websocket_connect_message(api_client: TestClient) -> None:
    """Smoke: WS accepts and receives broadcast after REST create."""
    with api_client.websocket_connect("/ws/bounties/ws-bounty/comments") as ws:
        token = _access_token()
        api_client.post(
            "/api/bounties/ws-bounty/comments",
            headers={"Authorization": f"Bearer {token}"},
            json={"body": "live"},
        )
        raw = ws.receive_text()
        msg = json.loads(raw)
        assert msg["type"] == "comment_created"
        assert msg["comment"]["body"] == "live"
