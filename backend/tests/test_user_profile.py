"""Tests for user profile endpoints (Task 5).

Covers: GET /users/me/profile, PATCH /users/me/profile, PATCH /users/me/settings.
Uses an isolated FastAPI test app with a mock auth dependency.
"""
import asyncio
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.users import router as users_router
from app.api.auth import get_current_user_id
from app.database import init_db

# ── Test app ──────────────────────────────────────────────────────────────────

TEST_USER_UUID = uuid.uuid4()
TEST_USER_ID = str(TEST_USER_UUID)


async def override_auth():
    return TEST_USER_ID


_app = FastAPI()
_app.include_router(users_router)
_app.dependency_overrides[get_current_user_id] = override_auth

client = TestClient(_app)


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module", autouse=True)
def setup_db(event_loop):
    event_loop.run_until_complete(init_db())


@pytest.fixture(autouse=True)
def seed_user(event_loop):
    """Insert a minimal User row so the endpoints can find the current user."""
    from app.database import get_db_session
    from app.models.user import User

    async def _seed():
        from sqlalchemy import text
        async with get_db_session() as session:
            # Remove any leftover rows from previous runs
            await session.execute(
                text("DELETE FROM contributors WHERE username = 'profiletest'")
            )
            await session.execute(
                text(f"DELETE FROM users WHERE id = '{TEST_USER_UUID}'")
            )
            user = User(
                id=TEST_USER_UUID,
                github_id="profiletest_gh",
                username="profiletest",
                email="profile@test.com",
                avatar_url="https://example.com/avatar.png",
            )
            session.add(user)
            await session.commit()

    event_loop.run_until_complete(_seed())
    yield
    # Cleanup
    async def _cleanup():
        from sqlalchemy import text
        async with get_db_session() as session:
            await session.execute(
                text("DELETE FROM contributors WHERE username = 'profiletest'")
            )
            await session.execute(
                text(f"DELETE FROM users WHERE id = '{TEST_USER_UUID}'")
            )
            await session.commit()
    event_loop.run_until_complete(_cleanup())


# ── Tests: GET /me/profile ────────────────────────────────────────────────────


def test_get_profile_returns_200():
    """Profile endpoint returns 200 for authenticated user."""
    resp = client.get("/users/me/profile")
    assert resp.status_code == 200


def test_get_profile_creates_contributor_on_first_access():
    """First GET creates a contributor profile linked to the user's username."""
    resp = client.get("/users/me/profile")
    data = resp.json()
    assert data["username"] == "profiletest"
    assert data["user_id"] == TEST_USER_ID
    assert data["wallet_address"] is None
    assert isinstance(data["skills"], list)


def test_get_profile_returns_identity_fields():
    """Profile response includes email, avatar, and wallet status."""
    data = client.get("/users/me/profile").json()
    assert data["email"] == "profile@test.com"
    assert data["wallet_verified"] is False
    assert "reputation_score" in data
    assert "total_bounties_completed" in data
    assert "total_earnings" in data


# ── Tests: PATCH /me/profile ──────────────────────────────────────────────────


def test_update_display_name():
    """PATCH /me/profile updates the display name."""
    resp = client.patch("/users/me/profile", json={"display_name": "Profile Tester"})
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Profile Tester"


def test_update_bio():
    """PATCH /me/profile updates the bio field."""
    resp = client.patch("/users/me/profile", json={"bio": "I build Solana dApps"})
    assert resp.status_code == 200
    assert resp.json()["bio"] == "I build Solana dApps"


def test_update_skills():
    """PATCH /me/profile replaces the skills list."""
    resp = client.patch("/users/me/profile", json={"skills": ["rust", "solidity", "typescript"]})
    assert resp.status_code == 200
    assert set(resp.json()["skills"]) == {"rust", "solidity", "typescript"}


def test_update_social_links():
    """PATCH /me/profile updates social links."""
    links = {"github": "github.com/tester", "twitter": "twitter.com/tester"}
    resp = client.patch("/users/me/profile", json={"social_links": links})
    assert resp.status_code == 200
    assert resp.json()["social_links"]["github"] == "github.com/tester"


def test_update_profile_is_persistent():
    """Profile changes are persisted and visible on subsequent GET."""
    client.patch("/users/me/profile", json={"display_name": "Persistent Name"})
    data = client.get("/users/me/profile").json()
    assert data["display_name"] == "Persistent Name"


def test_update_profile_partial_patch():
    """PATCH /me/profile with a single field does not wipe other fields."""
    client.patch("/users/me/profile", json={"bio": "First bio"})
    client.patch("/users/me/profile", json={"display_name": "New Name"})
    data = client.get("/users/me/profile").json()
    assert data["bio"] == "First bio"
    assert data["display_name"] == "New Name"


def test_update_display_name_too_long_rejected():
    """Display name over 100 chars is rejected with 422."""
    resp = client.patch("/users/me/profile", json={"display_name": "x" * 101})
    assert resp.status_code == 422


# ── Tests: PATCH /me/settings ─────────────────────────────────────────────────


def test_disable_email_notifications():
    """PATCH /me/settings can disable email notifications."""
    resp = client.patch("/users/me/settings", json={"email_notifications_enabled": False})
    assert resp.status_code == 200
    assert resp.json()["email_notifications_enabled"] is False


def test_update_notification_preferences():
    """PATCH /me/settings updates individual notification toggles."""
    prefs = {"payout_sent": False, "review_complete": True}
    resp = client.patch("/users/me/settings", json={"notification_preferences": prefs})
    assert resp.status_code == 200
    saved = resp.json()["notification_preferences"]
    assert saved["payout_sent"] is False
    assert saved["review_complete"] is True


def test_notification_preferences_are_merged():
    """Partial notification_preferences update merges with existing prefs."""
    client.patch("/users/me/settings", json={
        "notification_preferences": {"bounty_claimed": True, "pr_submitted": True}
    })
    client.patch("/users/me/settings", json={
        "notification_preferences": {"pr_submitted": False}
    })
    prefs = client.get("/users/me/profile").json()["notification_preferences"]
    assert prefs["bounty_claimed"] is True
    assert prefs["pr_submitted"] is False


def test_settings_preserved_across_profile_updates():
    """Updating profile fields does not reset notification settings."""
    client.patch("/users/me/settings", json={"email_notifications_enabled": False})
    client.patch("/users/me/profile", json={"bio": "Updated bio"})
    data = client.get("/users/me/profile").json()
    assert data["email_notifications_enabled"] is False
