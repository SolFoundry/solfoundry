"""Tests for Bounty Marketplace features (Issue #188).

Covers: creator_wallet, creator_type, enhanced list filters and sort.
"""

import os; os.environ.setdefault("AUTH_ENABLED", "false")  # noqa: E702
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.bounties import router as bounties_router
from app.models.bounty import CreatorType
from app.services import bounty_service

_test_app = FastAPI()
_test_app.include_router(bounties_router)
client = TestClient(_test_app)

VALID_BOUNTY = {
    "title": "Build marketplace UI component",
    "description": "Create the bounty marketplace browse page.",
    "tier": 2,
    "reward_amount": 500.0,
    "required_skills": ["react", "typescript"],
}


@pytest.fixture(autouse=True)
def clear_store():
    """Ensure each test starts and ends with an empty bounty store."""
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()


def _create(**kw) -> dict:
    """Create a bounty via API."""
    resp = client.post("/api/bounties", json={**VALID_BOUNTY, **kw})
    assert resp.status_code == 201
    return resp.json()


class TestCreatorFields:
    """Tests for creator_wallet and creator_type."""

    def test_create_with_wallet(self):
        b = _create(creator_wallet="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF")
        assert b["creator_wallet"] == "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF"

    def test_default_wallet_is_none(self):
        assert _create()["creator_wallet"] is None

    def test_platform_type(self):
        assert _create(creator_type="platform")["creator_type"] == "platform"

    def test_community_type_default(self):
        assert _create()["creator_type"] == "community"

    def test_invalid_wallet_rejected(self):
        r = client.post("/api/bounties", json={**VALID_BOUNTY, "creator_wallet": "bad"})
        assert r.status_code == 422

    def test_wallet_in_get(self):
        b = _create(creator_wallet="97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF")
        r = client.get(f"/api/bounties/{b['id']}")
        assert r.json()["creator_wallet"] == "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF"

    def test_type_in_list(self):
        _create(creator_type="platform")
        assert client.get("/api/bounties").json()["items"][0]["creator_type"] == "platform"

    def test_list_item_has_fields(self):
        _create()
        item = client.get("/api/bounties").json()["items"][0]
        assert "creator_wallet" in item and "creator_type" in item


class TestListFilters:
    """Tests for sort, creator_type, reward range filters."""

    def test_filter_creator_platform(self):
        _create(title="Alpha platform", creator_type="platform")
        _create(title="Beta community", creator_type="community")
        assert client.get("/api/bounties?creator_type=platform").json()["total"] == 1

    def test_filter_creator_community(self):
        _create(title="Alpha platform", creator_type="platform")
        _create(title="Beta community", creator_type="community")
        assert client.get("/api/bounties?creator_type=community").json()["total"] == 1

    def test_filter_reward_min(self):
        _create(title="Low", reward_amount=100.0)
        _create(title="High", reward_amount=1000.0)
        assert client.get("/api/bounties?reward_min=500").json()["total"] == 1

    def test_filter_reward_max(self):
        _create(title="Low", reward_amount=100.0)
        _create(title="High", reward_amount=1000.0)
        assert client.get("/api/bounties?reward_max=500").json()["total"] == 1

    def test_sort_reward_high(self):
        _create(title="Cheap", reward_amount=10.0)
        _create(title="Expensive", reward_amount=9999.0)
        items = client.get("/api/bounties?sort=reward_high").json()["items"]
        assert items[0]["title"] == "Expensive"

    def test_sort_reward_low(self):
        _create(title="Cheap", reward_amount=10.0)
        _create(title="Expensive", reward_amount=9999.0)
        items = client.get("/api/bounties?sort=reward_low").json()["items"]
        assert items[0]["title"] == "Cheap"

    def test_sort_submissions(self):
        a = _create(title="Popular")
        _create(title="Quiet")
        client.post(f"/api/bounties/{a['id']}/submit",
                    json={"pr_url": "https://github.com/o/r/pull/1", "submitted_by": "a"})
        items = client.get("/api/bounties?sort=submissions").json()["items"]
        assert items[0]["title"] == "Quiet"

    def test_combined(self):
        _create(title="Match", tier=1, reward_amount=500.0, creator_type="platform")
        _create(title="WrongTier", tier=2, reward_amount=300.0, creator_type="platform")
        _create(title="WrongType", tier=1, reward_amount=400.0, creator_type="community")
        body = client.get("/api/bounties?tier=1&creator_type=platform&sort=reward_high").json()
        assert body["total"] == 1
        assert body["items"][0]["title"] == "Match"
