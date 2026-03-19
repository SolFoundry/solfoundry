"""Tests for GitHub webhook receiver."""

import hashlib
import hmac
import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

SECRET = "test-webhook-secret"


def _make_signed_body(payload: dict, secret: str = SECRET) -> tuple[bytes, str]:
    body = json.dumps(payload).encode()
    sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return body, sig


def _signed_post(event_type: str, payload: dict, secret: str = SECRET):
    body, sig = _make_signed_body(payload, secret)
    return client.post(
        "/api/webhooks/github",
        content=body,
        headers={
            "X-GitHub-Event": event_type,
            "X-Hub-Signature-256": sig,
            "X-GitHub-Delivery": "test-delivery-123",
            "Content-Type": "application/json",
        },
    )


# ── Fixtures ───────────────────────────────────────────────────────────

PING_PAYLOAD = {
    "zen": "Design for failure.",
    "hook_id": 42,
    "hook": {"type": "Repository", "id": 42, "name": "web"},
    "repository": {
        "id": 1, "name": "solfoundry", "full_name": "SolFoundry/solfoundry",
        "owner": {"login": "SolFoundry", "id": 1},
    },
    "sender": {"login": "bot", "id": 99},
}

PUSH_PAYLOAD = {
    "ref": "refs/heads/main",
    "before": "a" * 40,
    "after": "b" * 40,
    "repository": {
        "id": 1, "name": "solfoundry", "full_name": "SolFoundry/solfoundry",
        "owner": {"login": "SolFoundry", "id": 1},
    },
    "sender": {"login": "dev", "id": 2},
    "head_commit": {"message": "init"},
    "commits": [],
}

PR_PAYLOAD = {
    "action": "opened",
    "number": 12,
    "pull_request": {
        "number": 12, "title": "feat: webhook receiver",
        "state": "open", "user": {"login": "dev", "id": 2},
        "body": "Implements #12", "html_url": "https://github.com/test/pr/12",
    },
    "repository": {
        "id": 1, "name": "solfoundry", "full_name": "SolFoundry/solfoundry",
        "owner": {"login": "SolFoundry", "id": 1},
    },
    "sender": {"login": "dev", "id": 2},
}

ISSUE_PAYLOAD = {
    "action": "opened",
    "issue": {"number": 12, "title": "Webhook receiver", "state": "open",
              "user": {"login": "dev", "id": 2}},
    "repository": {
        "id": 1, "name": "solfoundry", "full_name": "SolFoundry/solfoundry",
        "owner": {"login": "SolFoundry", "id": 1},
    },
    "sender": {"login": "dev", "id": 2},
}


# ── Tests: with secret configured ─────────────────────────────────────

@patch.dict("app.api.webhooks.github.os.environ", {"GITHUB_WEBHOOK_SECRET": SECRET})
class TestWithSecret:
    def test_ping(self):
        r = _signed_post("ping", PING_PAYLOAD)
        assert r.status_code == 200
        assert r.json()["msg"] == "pong"

    def test_push_event(self):
        r = _signed_post("push", PUSH_PAYLOAD)
        assert r.status_code == 202
        assert r.json()["event"] == "push"

    def test_pull_request_event(self):
        r = _signed_post("pull_request", PR_PAYLOAD)
        assert r.status_code == 202
        assert r.json()["event"] == "pull_request"

    def test_issues_event(self):
        r = _signed_post("issues", ISSUE_PAYLOAD)
        assert r.status_code == 202
        assert r.json()["event"] == "issues"

    def test_invalid_signature(self):
        body = json.dumps(PING_PAYLOAD).encode()
        r = client.post("/api/webhooks/github", content=body, headers={
            "X-GitHub-Event": "ping",
            "X-Hub-Signature-256": "sha256=bad_signature_value",
            "X-GitHub-Delivery": "d",
        })
        assert r.status_code == 401

    def test_missing_signature(self):
        body = json.dumps(PING_PAYLOAD).encode()
        r = client.post("/api/webhooks/github", content=body, headers={
            "X-GitHub-Event": "ping",
            "X-GitHub-Delivery": "d",
        })
        assert r.status_code == 401

    def test_wrong_secret(self):
        body = json.dumps(PING_PAYLOAD).encode()
        sig = "sha256=" + hmac.new(b"wrong-secret", body, hashlib.sha256).hexdigest()
        r = client.post("/api/webhooks/github", content=body, headers={
            "X-GitHub-Event": "ping",
            "X-Hub-Signature-256": sig,
            "X-GitHub-Delivery": "d",
        })
        assert r.status_code == 401


# ── Tests: no secret configured ───────────────────────────────────────

@patch.dict("app.api.webhooks.github.os.environ", {"GITHUB_WEBHOOK_SECRET": ""})
class TestWithoutSecret:
    def test_ping_no_secret(self):
        body = json.dumps(PING_PAYLOAD).encode()
        r = client.post("/api/webhooks/github", content=body, headers={
            "X-GitHub-Event": "ping",
            "X-GitHub-Delivery": "d",
        })
        assert r.status_code == 200

    def test_unhandled_event_passes_through(self):
        body = json.dumps({"foo": "bar"}).encode()
        r = client.post("/api/webhooks/github", content=body, headers={
            "X-GitHub-Event": "deployment",
            "X-GitHub-Delivery": "d",
        })
        assert r.status_code == 202
        assert r.json()["event"] == "deployment"

    def test_invalid_json_returns_422(self):
        r = client.post("/api/webhooks/github", content=b"not json", headers={
            "X-GitHub-Event": "push",
            "X-GitHub-Delivery": "d",
        })
        assert r.status_code == 422
