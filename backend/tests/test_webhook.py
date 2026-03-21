"""Tests for GitHub webhook endpoint."""

import hashlib
import hmac
import json
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.models.bounty import BountyDB, BountyTier, BountyStatus, SubmissionRecord
@pytest_asyncio.fixture
async def client():
    """Create a test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


def create_signature(payload: bytes, secret: str) -> str:
    """Create HMAC-SHA256 signature for webhook."""
    signature = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return f"sha256={signature}"


class TestGitHubWebhook:
    """Tests for GitHub webhook endpoint."""

    @pytest.mark.asyncio
    async def test_ping_event(self, client):
        """Test ping event returns pong."""
        response = await client.post(
            "/api/webhooks/github",
            headers={
                "X-GitHub-Event": "ping",
                "X-GitHub-Delivery": "test-delivery-1",
            },
            content=json.dumps({"zen": "test"}).encode(),
        )

        assert response.status_code == 200
        assert response.json()["msg"] == "pong"

    @pytest.mark.asyncio
    async def test_signature_verification_success(self, client):
        """Test valid signature passes verification."""
        payload = json.dumps({"action": "opened"}).encode()
        signature = create_signature(payload, WEBHOOK_SECRET)

        # Set secret in environment
        os.environ["GITHUB_WEBHOOK_SECRET"] = WEBHOOK_SECRET

        response = await client.post(
            "/api/webhooks/github",
            headers={
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": signature,
                "X-GitHub-Delivery": "test-delivery-2",
            },
            content=payload,
        )

        assert response.status_code in [200, 202]

        del os.environ["GITHUB_WEBHOOK_SECRET"]

    @pytest.mark.asyncio
    async def test_signature_verification_failure(self, client):
        """Test invalid signature returns 401."""
        os.environ["GITHUB_WEBHOOK_SECRET"] = WEBHOOK_SECRET

        payload = json.dumps({"action": "opened"}).encode()
        wrong_signature = "sha256=wrong_signature"

        response = await client.post(
            "/api/webhooks/github",
            headers={
                "X-GitHub-Event": "pull_request",
                "X-Hub-Signature-256": wrong_signature,
                "X-GitHub-Delivery": "test-delivery-3",
            },
            content=payload,
        )

        assert response.status_code == 401

        del os.environ["GITHUB_WEBHOOK_SECRET"]

    @pytest.mark.asyncio
    async def test_pull_request_opened_updates_bounty(self, client):
        """Test PR opened with 'Closes #N' updates bounty status."""
        # Create a bounty first
        bounty = BountyDB(
            title="Test Bounty",
            description="Test",
            tier=BountyTier.T1,
            status=BountyStatus.OPEN,
            github_issue_url="https://github.com/test/repo/issues/123",
        )
        bounty_service._bounty_store[bounty.id] = bounty

        # Send PR opened event
        payload = {
            "action": "opened",
            "number": 456,
            "pull_request": {
                "number": 456,
                "title": "Fix bug",
                "body": "This PR fixes the issue.\n\nCloses #123",
                "state": "open",
                "user": {"login": "testuser", "id": 1},
            },
            "repository": {
                "id": 1,
                "name": "repo",
                "full_name": "test/repo",
            },
            "sender": {"login": "testuser", "id": 1},
        }

        response = await client.post(
            "/api/webhooks/github",
            headers={
                "X-GitHub-Event": "pull_request",
                "X-GitHub-Delivery": "test-delivery-4",
            },
            content=json.dumps(payload).encode(),
        )

        assert response.status_code == 200
        data = response.json()

        assert "bounty_updated" in data
        assert data["new_status"] == "in_review"

    @pytest.mark.asyncio
    async def test_pull_request_merged_completes_bounty(self, client):
        """Test PR merged updates bounty to completed."""
        # Create a bounty with a submission
        bounty = BountyDB(
            title="Test Bounty",
            description="Test",
            tier=BountyTier.T1,
            status=BountyStatus.UNDER_REVIEW,
            github_issue_url="https://github.com/test/repo/issues/789",
        )
        # Add a mock submission matching the PR
        bounty.submissions.append(SubmissionRecord(
            bounty_id=bounty.id,
            pr_url="https://github.com/test/repo/pull/999",
            submitted_by="user_123",
            contributor_wallet="wallet_123"
        ))
        bounty_service._bounty_store[bounty.id] = bounty

        # Send PR merged event
        payload = {
            "action": "closed",
            "number": 999,
            "pull_request": {
                "number": 999,
                "title": "Feature",
                "body": "Closes #789",
                "state": "closed",
                "merged": True,
                "user": {"login": "testuser", "id": 1},
            },
            "repository": {
                "id": 1,
                "name": "repo",
                "full_name": "test/repo",
            },
            "sender": {"login": "testuser", "id": 1},
        }

        response = await client.post(
            "/api/webhooks/github",
            headers={
                "X-GitHub-Event": "pull_request",
                "X-GitHub-Delivery": "test-delivery-5",
            },
            content=json.dumps(payload).encode(),
        )

        assert response.status_code == 200
        data = response.json()

        assert "bounty_updated" in data
        assert data["new_status"] == "completed"

    @pytest.mark.asyncio
    async def test_issue_labeled_creates_bounty(self, client):
        """Test issue labeled with 'bounty' creates bounty record."""
        payload = {
            "action": "labeled",
            "issue": {
                "number": 100,
                "title": "New Feature",
                "body": "Implement new feature",
                "labels": [
                    {"name": "bounty"},
                    {"name": "tier-1"},
                    {"name": "backend"},
                ],
            },
            "repository": {
                "id": 1,
                "name": "repo",
                "full_name": "test/repo",
            },
            "sender": {"login": "testuser", "id": 1},
        }

        response = await client.post(
            "/api/webhooks/github",
            headers={
                "X-GitHub-Event": "issues",
                "X-GitHub-Delivery": "test-delivery-6",
            },
            content=json.dumps(payload).encode(),
        )

        assert response.status_code == 200
        data = response.json()

        assert "bounty_created" in data

    @pytest.mark.asyncio
    async def test_idempotency(self, client):
        """Test duplicate delivery is skipped."""
        # First request
        payload = {
            "action": "opened",
            "number": 111,
            "pull_request": {
                "number": 111,
                "title": "Test",
                "body": "",
                "state": "open",
                "user": {"login": "testuser", "id": 1},
            },
            "repository": {
                "id": 1,
                "name": "repo",
                "full_name": "test/repo",
            },
            "sender": {"login": "testuser", "id": 1},
        }

        delivery_id = "test-delivery-idempotency"

        response1 = await client.post(
            "/api/webhooks/github",
            headers={
                "X-GitHub-Event": "pull_request",
                "X-GitHub-Delivery": delivery_id,
            },
            content=json.dumps(payload).encode(),
        )

        assert response1.status_code == 200

        # Second request with same delivery_id
        response2 = await client.post(
            "/api/webhooks/github",
            headers={
                "X-GitHub-Event": "pull_request",
                "X-GitHub-Delivery": delivery_id,
            },
            content=json.dumps(payload).encode(),
        )

        assert response2.status_code == 200
        assert response2.json()["status"] == "skipped"
        assert response2.json()["reason"] == "duplicate"

    @pytest.mark.asyncio
    async def test_unhandled_event_type(self, client):
        """Test unhandled event types are accepted but not processed."""
        response = await client.post(
            "/api/webhooks/github",
            headers={
                "X-GitHub-Event": "push",
                "X-GitHub-Delivery": "test-delivery-7",
            },
            content=json.dumps({"ref": "main"}).encode(),
        )

        assert response.status_code == 202
        data = response.json()

        assert data["status"] == "accepted"
        assert not data["handled"]
