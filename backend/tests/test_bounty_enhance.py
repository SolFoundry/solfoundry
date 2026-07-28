"""Tests for the AI Bounty Description Enhancer API (Issue #848).

Covers:
- POST /api/bounties/{bounty_id}/enhance — Trigger enhancement
- GET /api/bounties/{bounty_id}/enhancements — List enhancements
- GET /api/bounties/{bounty_id}/enhancements/{id} — Get specific enhancement
- POST /api/bounties/{bounty_id}/enhancements/{id}/approve — Approve enhancement
- POST /api/bounties/{bounty_id}/enhancements/{id}/reject — Reject enhancement
- Edge cases: missing API keys, empty description, non-existent bounty
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")
os.environ.setdefault("AUTH_ENABLED", "false")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.bounty_enhance import router as bounty_enhance_router
from app.models.bounty_enhance import LLMProvider, EnhancementStatus


# ---------------------------------------------------------------------------
# Test app & client
# ---------------------------------------------------------------------------

_test_app = FastAPI()
_test_app.include_router(bounty_enhance_router, prefix="/api")

# Include the bounties router for creating test bounties
from app.api.bounties import router as bounties_router
from app.api.auth import get_current_user
from app.models.user import UserResponse

MOCK_USER = UserResponse(
    id="test-user-id",
    github_id="test-github-id",
    username="testuser",
    email="test@example.com",
    avatar_url="http://example.com/avatar.png",
    wallet_address="test-wallet-address",
    wallet_verified=True,
    created_at="2026-03-20T22:00:00Z",
    updated_at="2026-03-20T22:00:00Z",
)


async def override_get_current_user():
    return MOCK_USER


_test_app.include_router(bounties_router, prefix="/api")
_test_app.dependency_overrides[get_current_user] = override_get_current_user


@pytest.fixture
def client():
    """Create a test client with a fresh app."""
    return TestClient(_test_app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VALID_BOUNTY = {
    "title": "Fix Login Page",
    "description": "The login page has a bug where users cannot log in with their Google account. "
                   "It shows a 500 error when clicking the Google OAuth button.",
    "tier": 1,
    "reward_amount": 100.0,
    "category": "backend",
    "required_skills": ["python", "fastapi", "oauth"],
    "created_by": "test-user",
}


def _create_mock_bounty(client, **overrides) -> dict:
    """Seed a mock bounty via the HTTP API for testing."""
    payload = {**VALID_BOUNTY, **overrides}
    resp = client.post("/api/bounties", json=payload)
    assert resp.status_code == 201, f"Create failed: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# Tests - POST /api/bounties/{bounty_id}/enhance
# ---------------------------------------------------------------------------


class TestEnhanceBounty:
    """Tests for triggering AI description enhancement."""

    def test_enhance_bounty_not_found(self, client):
        """Should return 404 when the bounty does not exist."""
        resp = client.post(
            "/api/bounties/non-existent-id/enhance",
            json={"providers": ["claude"]},
        )
        assert resp.status_code == 404
        data = resp.json()
        assert "not found" in data.get("detail", "").lower()

    def test_enhance_bounty_no_api_keys(self, client):
        """Should return results with error for providers without API keys."""
        for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]:
            os.environ.pop(key, None)

        bounty = _create_mock_bounty(client)

        resp = client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={"providers": ["claude"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["bounty_id"] == bounty["id"]
        assert len(data["results"]) == 1
        assert data["results"][0]["error"] is not None
        assert "API key not configured" in data["results"][0]["error"]
        assert data["status"] == "pending"

    def test_enhance_bounty_multiple_providers_no_keys(self, client):
        """Should handle multiple providers when none have API keys."""
        for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]:
            os.environ.pop(key, None)

        bounty = _create_mock_bounty(client)

        resp = client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={"providers": ["claude", "codex", "gemini"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 3
        for result in data["results"]:
            assert result["error"] is not None
            assert "API key not configured" in result["error"]

    def test_enhance_bounty_empty_description(self, client):
        """Should return 400 when the bounty has no description."""
        bounty = _create_mock_bounty(client, description="")

        resp = client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={"providers": ["claude"]},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "no description" in data.get("detail", "").lower()

    def test_enhance_bounty_with_custom_prompt(self, client):
        """Should accept custom prompt in the request."""
        for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]:
            os.environ.pop(key, None)

        bounty = _create_mock_bounty(client)

        resp = client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={
                "providers": ["claude"],
                "custom_prompt": "Focus on adding security considerations",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["bounty_id"] == bounty["id"]

    def test_enhance_bounty_invalid_provider(self, client):
        """Should return 422 for invalid provider names."""
        bounty = _create_mock_bounty(client)

        resp = client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={"providers": ["invalid_provider"]},
        )
        assert resp.status_code == 422

    def test_enhance_bounty_default_providers(self, client):
        """Should use all three providers when none specified."""
        for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]:
            os.environ.pop(key, None)

        bounty = _create_mock_bounty(client)

        resp = client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 3


# ---------------------------------------------------------------------------
# Tests - GET /api/bounties/{bounty_id}/enhancements
# ---------------------------------------------------------------------------


class TestListEnhancements:
    """Tests for listing enhancement records."""

    def test_list_enhancements_empty(self, client):
        """Should return empty list for a bounty with no enhancements."""
        bounty = _create_mock_bounty(client)

        resp = client.get(f"/api/bounties/{bounty['id']}/enhancements")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["bounty_id"] == bounty["id"]

    def test_list_enhancements_not_found(self, client):
        """Should return 404 for non-existent bounty."""
        resp = client.get("/api/bounties/non-existent-id/enhancements")
        assert resp.status_code == 404

    def test_list_enhancements_after_enhance(self, client):
        """Should list enhancement records after triggering one."""
        for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]:
            os.environ.pop(key, None)

        bounty = _create_mock_bounty(client)

        # Trigger an enhancement
        client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={"providers": ["claude"]},
        )

        # List enhancements
        resp = client.get(f"/api/bounties/{bounty['id']}/enhancements")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["bounty_id"] == bounty["id"]


# ---------------------------------------------------------------------------
# Tests - GET /api/bounties/{bounty_id}/enhancements/{id}
# ---------------------------------------------------------------------------


class TestGetEnhancement:
    """Tests for getting a specific enhancement record."""

    def test_get_enhancement_not_found(self, client):
        """Should return 404 for non-existent enhancement."""
        resp = client.get(
            "/api/bounties/non-existent-bounty/enhancements/non-existent-id"
        )
        assert resp.status_code == 404

    def test_get_enhancement_success(self, client):
        """Should return the enhancement record."""
        for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]:
            os.environ.pop(key, None)

        bounty = _create_mock_bounty(client)

        # Trigger an enhancement
        enhance_resp = client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={"providers": ["claude"]},
        )
        enhance_data = enhance_resp.json()
        enhancement_id = enhance_data["enhancement_id"]

        # Get the specific enhancement
        resp = client.get(
            f"/api/bounties/{bounty['id']}/enhancements/{enhancement_id}"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == enhancement_id
        assert data["bounty_id"] == bounty["id"]
        assert data["original_title"] == "Fix Login Page"
        assert "The login page has a bug" in data["original_description"]


# ---------------------------------------------------------------------------
# Tests - POST /api/bounties/{bounty_id}/enhancements/{id}/approve
# ---------------------------------------------------------------------------


class TestApproveEnhancement:
    """Tests for approving an enhancement result."""

    def test_approve_enhancement_not_found(self, client):
        """Should return 404 for non-existent enhancement."""
        resp = client.post(
            "/api/bounties/non-existent-bounty/enhancements/non-existent/approve",
            json={"action": "approve"},
        )
        assert resp.status_code == 404

    def test_approve_enhancement_with_no_successful_results(self, client):
        """Should return 400 when all providers failed."""
        for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]:
            os.environ.pop(key, None)

        bounty = _create_mock_bounty(client)

        # Trigger enhancement (all providers will fail)
        enhance_resp = client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={"providers": ["claude"]},
        )
        enhance_data = enhance_resp.json()

        # Try to approve
        resp = client.post(
            f"/api/bounties/{bounty['id']}/enhancements/{enhance_data['enhancement_id']}/approve",
            json={"action": "approve"},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "No successful enhancement" in data.get("detail", "")

    def test_approve_enhancement_wrong_action(self, client):
        """Should validate the action field."""
        for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]:
            os.environ.pop(key, None)

        bounty = _create_mock_bounty(client)

        # Trigger enhancement
        enhance_resp = client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={"providers": ["claude"]},
        )
        enhance_data = enhance_resp.json()

        # Try to approve with wrong action
        resp = client.post(
            f"/api/bounties/{bounty['id']}/enhancements/{enhance_data['enhancement_id']}/approve",
            json={"action": "reject"},
        )
        assert resp.status_code == 400
        data = resp.json()
        assert "reject" in data.get("detail", "").lower()


# ---------------------------------------------------------------------------
# Tests - POST /api/bounties/{bounty_id}/enhancements/{id}/reject
# ---------------------------------------------------------------------------


class TestRejectEnhancement:
    """Tests for rejecting an enhancement."""

    def test_reject_enhancement_not_found(self, client):
        """Should return 404 for non-existent enhancement."""
        resp = client.post(
            "/api/bounties/non-existent-bounty/enhancements/non-existent/reject",
        )
        assert resp.status_code == 404

    def test_reject_enhancement_success(self, client):
        """Should mark enhancement as rejected."""
        for key in ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]:
            os.environ.pop(key, None)

        bounty = _create_mock_bounty(client)

        # Trigger enhancement
        enhance_resp = client.post(
            f"/api/bounties/{bounty['id']}/enhance",
            json={"providers": ["claude"]},
        )
        enhance_data = enhance_resp.json()
        enhancement_id = enhance_data["enhancement_id"]

        # Reject the enhancement
        resp = client.post(
            f"/api/bounties/{bounty['id']}/enhancements/{enhancement_id}/reject",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "rejected"
        assert data["id"] == enhancement_id

        # Verify it's still in the list
        list_resp = client.get(f"/api/bounties/{bounty['id']}/enhancements")
        list_data = list_resp.json()
        assert list_data["total"] == 1

        # Verify the record shows as rejected
        get_resp = client.get(
            f"/api/bounties/{bounty['id']}/enhancements/{enhancement_id}"
        )
        assert get_resp.json()["status"] == "rejected"


# ---------------------------------------------------------------------------
# Tests - Service layer edge cases
# ---------------------------------------------------------------------------


class TestServiceEdgeCases:
    """Tests for the service layer directly."""

    def test_llm_provider_enum_values(self):
        """Should have correct provider enum values."""
        assert LLMProvider.CLAUDE.value == "claude"
        assert LLMProvider.CODEX.value == "codex"
        assert LLMProvider.GEMINI.value == "gemini"

    def test_enhancement_status_enum_values(self):
        """Should have correct status enum values."""
        assert EnhancementStatus.PENDING.value == "pending"
        assert EnhancementStatus.APPROVED.value == "approved"
        assert EnhancementStatus.REJECTED.value == "rejected"

    def test_call_llm_provider_no_api_key(self):
        """Should return error result without calling API."""
        from app.services.bounty_enhancer_service import _call_llm_provider

        # Ensure no API key
        os.environ.pop("ANTHROPIC_API_KEY", None)

        result = _call_llm_provider(
            provider=LLMProvider.CLAUDE,
            title="Test Title",
            description="Test description",
        )
        assert result.error is not None
        assert "API key not configured" in result.error
        assert result.provider == LLMProvider.CLAUDE
        assert result.confidence_score == 0.0