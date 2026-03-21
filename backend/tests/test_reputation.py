"""Tests for the contributor reputation system."""

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.contributor import ContributorDB, ContributorResponse, ContributorStats
from app.models.reputation import (
    ANTI_FARMING_THRESHOLD, BADGE_THRESHOLDS,
    ContributorTier, ReputationBadge, ReputationRecordCreate,
)
from app.services import contributor_service, reputation_service

client = TestClient(app)
calc = reputation_service.calculate_earned_reputation


@pytest.fixture(autouse=True)
def clear_stores():
    """Reset stores."""
    contributor_service._store.clear()
    reputation_service._reputation_store.clear()
    yield
    contributor_service._store.clear()
    reputation_service._reputation_store.clear()


def _mc(username="alice"):
    """Create contributor in store."""
    now = datetime.now(timezone.utc)
    cid = str(uuid.uuid4())
    contributor_service._store[cid] = ContributorDB(
        id=uuid.UUID(cid), username=username, display_name=username,
        email=None, avatar_url=None, bio=None, skills=["python"], badges=[],
        social_links={}, total_contributions=0, total_bounties_completed=0,
        total_earnings=0.0, reputation_score=0, created_at=now, updated_at=now)
    return ContributorResponse(
        id=cid, username=username, display_name=username, skills=["python"],
        badges=[], social_links={}, stats=ContributorStats(),
        created_at=now, updated_at=now)


def _rec(cid, bid="b-1", tier=1, score=8.0):
    """Record reputation."""
    return reputation_service.record_reputation(ReputationRecordCreate(
        contributor_id=cid, bounty_id=bid, bounty_title="Fix", bounty_tier=tier, review_score=score,
    ))


# ── Calculation ────────────────────────────────────────────────────────────

def test_above_threshold():
    assert calc(8.0, 1, False) > 0

def test_below_threshold():
    assert calc(5.0, 1, False) == 0

def test_exact_threshold():
    assert calc(6.0, 1, False) == 0

def test_t2_more_than_t1():
    assert calc(9.0, 2, False) > calc(9.0, 1, False)

def test_t3_more_than_t1():
    assert calc(10.0, 3, False) > calc(10.0, 1, False)

# ── Anti-farming ───────────────────────────────────────────────────────────

def test_veteran_reduces():
    assert calc(7.0, 1, True) < calc(7.0, 1, False)

def test_veteran_bumped_zero():
    assert calc(6.5, 1, True) == 0

def test_no_penalty_on_t2():
    c = _mc()
    for i in range(ANTI_FARMING_THRESHOLD):
        _rec(c.id, f"t1-{i}")
    assert _rec(c.id, "t2", tier=2).anti_farming_applied is False

def test_veteran_after_threshold():
    c = _mc()
    for i in range(ANTI_FARMING_THRESHOLD):
        _rec(c.id, f"b-{i}")
    assert reputation_service.is_veteran(reputation_service._reputation_store[c.id])

def test_not_veteran_before():
    c = _mc()
    for i in range(ANTI_FARMING_THRESHOLD - 1):
        _rec(c.id, f"b-{i}")
    assert not reputation_service.is_veteran(reputation_service._reputation_store[c.id])

# ── Badges ─────────────────────────────────────────────────────────────────

def test_no_badge():
    assert reputation_service.determine_badge(5.0) is None

def test_bronze():
    assert reputation_service.determine_badge(BADGE_THRESHOLDS[ReputationBadge.BRONZE]) == ReputationBadge.BRONZE

def test_silver():
    assert reputation_service.determine_badge(BADGE_THRESHOLDS[ReputationBadge.SILVER]) == ReputationBadge.SILVER

def test_gold():
    assert reputation_service.determine_badge(BADGE_THRESHOLDS[ReputationBadge.GOLD]) == ReputationBadge.GOLD

def test_diamond():
    assert reputation_service.determine_badge(BADGE_THRESHOLDS[ReputationBadge.DIAMOND]) == ReputationBadge.DIAMOND

# ── Tiers ──────────────────────────────────────────────────────────────────

def test_starts_t1():
    assert reputation_service.determine_current_tier({1: 0, 2: 0, 3: 0}) == ContributorTier.T1

def test_t2_after_4():
    assert reputation_service.determine_current_tier({1: 4, 2: 0, 3: 0}) == ContributorTier.T2

def test_t3_after_3t2():
    assert reputation_service.determine_current_tier({1: 4, 2: 3, 3: 0}) == ContributorTier.T3

def test_3t1_still_t1():
    assert reputation_service.determine_current_tier({1: 3, 2: 0, 3: 0}) == ContributorTier.T1

def test_progression_remaining():
    p = reputation_service.build_tier_progression({1: 2, 2: 0, 3: 0}, ContributorTier.T1)
    assert p.bounties_until_next_tier == 2 and p.next_tier == ContributorTier.T2

def test_t3_no_next():
    p = reputation_service.build_tier_progression({1: 10, 2: 5, 3: 2}, ContributorTier.T3)
    assert p.next_tier is None and p.bounties_until_next_tier == 0

# ── Service ────────────────────────────────────────────────────────────────

def test_record_retrieve():
    c = _mc()
    _rec(c.id)
    s = reputation_service.get_reputation(c.id)
    assert s and s.reputation_score > 0 and len(s.history) == 1

def test_missing_returns_none():
    assert reputation_service.get_reputation("x") is None

def test_missing_record_raises():
    with pytest.raises(ValueError):
        _rec("x")

def test_cumulative():
    c = _mc()
    _rec(c.id, "b-1", 1, 8.0)
    _rec(c.id, "b-2", 1, 9.0)
    assert len(reputation_service.get_reputation(c.id).history) == 2

def test_avg_score():
    c = _mc()
    _rec(c.id, "b-1", score=8.0)
    _rec(c.id, "b-2", score=10.0)
    assert reputation_service.get_reputation(c.id).average_review_score == 9.0

def test_history_order():
    c = _mc()
    _rec(c.id, "b-1")
    _rec(c.id, "b-2")
    h = reputation_service.get_history(c.id)
    assert h[0].created_at >= h[1].created_at

def test_empty_history():
    assert reputation_service.get_history(_mc().id) == []

def test_leaderboard_sorted():
    a, b = _mc("alice"), _mc("bob")
    _rec(a.id, "b-1", score=7.0)
    # Bob needs 4 T1 completions to unlock T2
    for i in range(4):
        _rec(b.id, f"t1-{i}", tier=1, score=8.0)
    _rec(b.id, "b-2", tier=2, score=10.0)
    lb = reputation_service.get_reputation_leaderboard()
    assert lb[0].reputation_score >= lb[1].reputation_score

def test_leaderboard_pagination():
    for i in range(5):
        c = _mc(f"user{i}")
        _rec(c.id, f"b-{i}", score=7.0 + i * 0.5)
    assert len(reputation_service.get_reputation_leaderboard(limit=2)) == 2

# ── API ────────────────────────────────────────────────────────────────────

def test_api_get_rep():
    c = _mc()
    r = client.get(f"/api/contributors/{c.id}/reputation")
    assert r.status_code == 200 and r.json()["tier_progression"]["current_tier"] == "T1"

def test_api_get_rep_404():
    assert client.get("/api/contributors/x/reputation").status_code == 404

def test_api_history():
    c = _mc()
    _rec(c.id)
    assert client.get(f"/api/contributors/{c.id}/reputation/history").status_code == 200

def test_api_history_404():
    assert client.get("/api/contributors/x/reputation/history").status_code == 404

def test_api_record():
    c = _mc()
    r = client.post(f"/api/contributors/{c.id}/reputation", json={
        "contributor_id": c.id, "bounty_id": "b-1",
        "bounty_title": "Fix", "bounty_tier": 1, "review_score": 8.5,
    })
    assert r.status_code == 201 and r.json()["earned_reputation"] > 0

def test_api_mismatch():
    c = _mc()
    r = client.post(f"/api/contributors/{c.id}/reputation", json={
        "contributor_id": "wrong", "bounty_id": "b", "bounty_title": "F", "bounty_tier": 1, "review_score": 8.0,
    })
    assert r.status_code == 400

def test_api_record_404():
    r = client.post("/api/contributors/x/reputation", json={
        "contributor_id": "x", "bounty_id": "b", "bounty_title": "F", "bounty_tier": 1, "review_score": 8.0,
    })
    assert r.status_code == 404

def test_api_bad_score():
    c = _mc()
    r = client.post(f"/api/contributors/{c.id}/reputation", json={
        "contributor_id": c.id, "bounty_id": "b", "bounty_title": "F", "bounty_tier": 1, "review_score": 11.0,
    })
    assert r.status_code == 422

def test_api_bad_tier():
    c = _mc()
    r = client.post(f"/api/contributors/{c.id}/reputation", json={
        "contributor_id": c.id, "bounty_id": "b", "bounty_title": "F", "bounty_tier": 5, "review_score": 8.0,
    })
    assert r.status_code == 422

def test_api_leaderboard():
    _rec(_mc().id, score=9.0)
    assert client.get("/api/contributors/leaderboard/reputation").status_code == 200

def test_api_get_still_works():
    assert client.get(f"/api/contributors/{_mc().id}").status_code == 200

def test_api_list_still_works():
    _mc()
    assert client.get("/api/contributors").json()["total"] >= 1

# ── Fix validations ───────────────────────────────────────────────────────

def test_idempotent_duplicate_bounty():
    """Fix 4: duplicate bounty_id for same contributor returns existing entry."""
    c = _mc()
    first = _rec(c.id, "dup-1", 1, 8.0)
    second = _rec(c.id, "dup-1", 1, 9.0)
    assert first.entry_id == second.entry_id
    assert len(reputation_service._reputation_store[c.id]) == 1

def test_tier_enforcement_blocks_t2():
    """Fix 5: T2 bounty rejected when contributor only has T1 access."""
    c = _mc()
    with pytest.raises(ValueError, match="not unlocked tier T2"):
        _rec(c.id, "bad-t2", tier=2, score=9.0)

def test_tier_enforcement_allows_after_progression():
    """Fix 5: T2 bounty accepted after 4 T1 completions."""
    c = _mc()
    for i in range(4):
        _rec(c.id, f"t1-{i}", tier=1, score=8.0)
    entry = _rec(c.id, "t2-ok", tier=2, score=9.0)
    assert entry.bounty_tier == 2

def test_score_precision_consistent():
    """Fix 6: reputation_score uses float precision, not int rounding."""
    c = _mc()
    _rec(c.id, "b-prec", 1, 8.5)
    contrib = contributor_service._store[c.id]
    summary = reputation_service.get_reputation(c.id)
    assert contrib.reputation_score == summary.reputation_score

def test_negative_earned_reputation_rejected():
    """Fix 2: earned_reputation field rejects negative values."""
    from app.models.reputation import ReputationHistoryEntry
    with pytest.raises(Exception):
        ReputationHistoryEntry(
            entry_id="x", contributor_id="x", bounty_id="x",
            bounty_title="x", bounty_tier=1, review_score=5.0,
            earned_reputation=-1.0,
        )

def test_api_record_requires_auth():
    """Fix 1: POST reputation returns 403 when caller is not authorized."""
    c = _mc()
    # With X-User-ID set to a non-matching, non-system user
    r = client.post(
        f"/api/contributors/{c.id}/reputation",
        json={
            "contributor_id": c.id, "bounty_id": "auth-test",
            "bounty_title": "Fix", "bounty_tier": 1, "review_score": 8.5,
        },
        headers={"X-User-ID": "11111111-1111-1111-1111-111111111111"},
    )
    assert r.status_code == 403
