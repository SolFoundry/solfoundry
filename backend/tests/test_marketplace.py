"""Bounty Marketplace tests (Issue #188): create, browse, filter, sort, badges."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.auth import get_current_user
from app.api.bounties import router as bounties_router
from app.models.bounty import BountyCreate, BountyTier, CreatorType
from app.models.user import UserResponse
from app.services import bounty_service

U = UserResponse(id="u1", github_id="g1", username="tester", email="t@x.com",
    wallet_address="test-wallet", wallet_verified=True,
    created_at="2026-03-20T00:00:00Z", updated_at="2026-03-20T00:00:00Z")
async def _u(): return U
_a = FastAPI()
_a.include_router(bounties_router, prefix="/api")
_a.dependency_overrides[get_current_user] = _u
c = TestClient(_a)

@pytest.fixture(autouse=True)
def _r():
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()

def _mk(t="Test Bounty", tier=1, rw=500.0, sk=None, dl=None):
    p = {"title": t, "tier": tier, "reward_amount": rw, "required_skills": sk or ["python"]}
    if dl: p["deadline"] = dl
    r = c.post("/api/bounties", json=p)
    assert r.status_code == 201
    return r.json()

def _seed():
    _mk("Alpha", 1, 300, ["python"])
    _mk("Beta", 2, 5000, ["react"])
    _mk("Gamma", 3, 15000, ["rust"], "2026-06-15T00:00:00Z")
    _mk("Delta", 1, 200, ["python", "fastapi"])

def test_create_community_type(): assert _mk()["creator_type"] == "community"
def test_create_wallet(): assert _mk()["created_by"] == "test-wallet"
def test_visible_in_list():
    b = _mk("Listed")
    assert any(i["id"] == b["id"] for i in c.get("/api/bounties").json()["items"])
def test_preview():
    b = _mk("Preview")
    d = c.get(f"/api/bounties/{b['id']}").json()
    assert d["title"] == "Preview" and d["creator_type"] == "community"
def test_list_all():
    _seed(); assert c.get("/api/bounties").json()["total"] == 4
def test_filter_tier():
    _seed(); r = c.get("/api/bounties?tier=1").json()
    assert r["total"] == 2 and all(i["tier"] == 1 for i in r["items"])
def test_filter_skills():
    _seed(); assert c.get("/api/bounties?skills=rust").json()["total"] == 1
def test_filter_creator_type():
    _seed()
    assert c.get("/api/bounties?creator_type=community").json()["total"] == 4
    assert c.get("/api/bounties?creator_type=platform").json()["total"] == 0
def test_sort_reward_high():
    _seed()
    rw = [i["reward_amount"] for i in c.get("/api/bounties?sort=reward_high").json()["items"]]
    assert rw == sorted(rw, reverse=True)
def test_sort_reward_low():
    _seed()
    rw = [i["reward_amount"] for i in c.get("/api/bounties?sort=reward_low").json()["items"]]
    assert rw == sorted(rw)
def test_sort_deadline():
    _seed()
    assert c.get("/api/bounties?sort=deadline").json()["items"][0]["title"] == "Gamma"
def test_pagination():
    _seed()
    r = c.get("/api/bounties?skip=0&limit=2").json()
    assert len(r["items"]) == 2 and r["total"] == 4
def test_card_fields():
    _mk(dl="2026-08-01T00:00:00Z")
    item = c.get("/api/bounties").json()["items"][0]
    for f in ("title","tier","reward_amount","status","required_skills","deadline",
              "submission_count","creator_type","created_at"):
        assert f in item, f"Missing: {f}"
def test_platform_badge():
    bounty_service.create_bounty(BountyCreate(title="Platform Bounty", tier=BountyTier.T1,
        reward_amount=500, required_skills=["python"], created_by="system",
        creator_type=CreatorType.PLATFORM))
    r = c.get("/api/bounties?creator_type=platform").json()
    assert r["total"] == 1 and r["items"][0]["creator_type"] == "platform"
