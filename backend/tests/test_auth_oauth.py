"""GitHub OAuth authorize URL + token exchange (GitHub API mocked)."""

from __future__ import annotations

from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from itsdangerous import URLSafeTimedSerializer

from app.config import get_settings


class _FakeAsyncClient:
    """Minimal async HTTP client for github_oauth module tests."""

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def post(self, url: str, **kwargs):
        if "login/oauth/access_token" in url:
            return httpx.Response(200, json={"access_token": "gho_test_token", "token_type": "bearer"})
        return httpx.Response(404, json={})

    async def get(self, url: str, **kwargs):
        if url.rstrip("/").endswith("/user") and "emails" not in url:
            return httpx.Response(
                200,
                json={
                    "id": 424242,
                    "login": "octocat",
                    "avatar_url": "https://avatars.githubusercontent.com/u/424242",
                    "email": "octocat@example.com",
                },
            )
        if "user/emails" in url:
            return httpx.Response(200, json=[])
        return httpx.Response(404, json={})


def test_authorize_redirect_without_format_json(client: TestClient) -> None:
    r = client.get("/api/auth/github/authorize", follow_redirects=False)
    assert r.status_code == 302
    loc = r.headers["location"]
    assert loc.startswith("https://github.com/login/oauth/authorize")
    assert "client_id=test_github_client_id" in loc
    assert "state=" in loc


def test_authorize_json_format(client: TestClient) -> None:
    r = client.get("/api/auth/github/authorize?format=json")
    assert r.status_code == 200
    data = r.json()
    assert "authorize_url" in data
    assert data["authorize_url"].startswith("https://github.com/login/oauth/authorize")


def test_github_exchange_happy_path(client: TestClient) -> None:
    settings = get_settings()
    signer = URLSafeTimedSerializer(settings.secret_key, salt="sf-github-oauth-state")
    state = signer.dumps({"v": 1})

    with patch("app.services.github_oauth.httpx.AsyncClient", _FakeAsyncClient):
        r = client.post(
            "/api/auth/github",
            json={"code": "test-code-abc", "state": state},
        )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["username"] == "octocat"
    assert body["user"]["github_id"] == "424242"
    assert "avatars.githubusercontent.com" in (body["user"]["avatar_url"] or "")


def test_github_exchange_invalid_state(client: TestClient) -> None:
    with patch("app.services.github_oauth.httpx.AsyncClient", _FakeAsyncClient):
        r = client.post(
            "/api/auth/github",
            json={"code": "test-code", "state": "not-a-valid-state"},
        )
    assert r.status_code == 400


def test_github_exchange_bad_signature_state(client: TestClient) -> None:
    bad_signer = URLSafeTimedSerializer("wrong-secret", salt="sf-github-oauth-state")
    bad_state = bad_signer.dumps({"v": 1})
    r = client.post(
        "/api/auth/github",
        json={"code": "x", "state": bad_state},
    )
    assert r.status_code == 400


def test_refresh_token_round_trip(client: TestClient) -> None:
    settings = get_settings()
    signer = URLSafeTimedSerializer(settings.secret_key, salt="sf-github-oauth-state")
    state = signer.dumps({"v": 1})

    with patch("app.services.github_oauth.httpx.AsyncClient", _FakeAsyncClient):
        r = client.post(
            "/api/auth/github",
            json={"code": "code", "state": state},
        )
    refresh = r.json()["refresh_token"]

    r2 = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert r2.status_code == 200
    assert r2.json()["access_token"]


def test_me_with_access_token(client: TestClient) -> None:
    settings = get_settings()
    signer = URLSafeTimedSerializer(settings.secret_key, salt="sf-github-oauth-state")
    state = signer.dumps({"v": 1})

    with patch("app.services.github_oauth.httpx.AsyncClient", _FakeAsyncClient):
        r = client.post(
            "/api/auth/github",
            json={"code": "code", "state": state},
        )
    access = r.json()["access_token"]

    r2 = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r2.status_code == 200
    assert r2.json()["username"] == "octocat"
