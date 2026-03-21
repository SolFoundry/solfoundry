"""Tests for the contributor reputation system."""

import time
import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient

from app.constants import INTERNAL_SYSTEM_USER_ID
from app.exceptions import ContributorNotFoundError, TierNotUnlockedError
from app.main import app
from app.models.contributor import ContributorDB, ContributorResponse, ContributorStats
from app.models.reputation import (
    ANTI_FARMING_THRESHOLD, BADGE_THRESHOLDS,
    ContributorTier, ReputationBadge, ReputationRecordCreate,
)
from app.services import contributor_service, reputation_service

client = TestClient(app)
calc = reputation_service.calculate_earned_reputation

# Auth header for the internal system user (automated pipelines)
SYSTEM_AUTH = {"X-User-ID": INTERNAL_SYSTEM_USER_ID}


@pytest.fixture(autouse=True)
def clear_stores():
    """Reset in-memory stores before and after each test."""
    contributor_service._store.clear()
    reputation_service._reputation_store.clear()
    yield
    contributor_service._store.clear()
    reputation_service._reputation_store.clear()


def _mc(username="alice"):
    """Create a contributor directly in the store and return its response."""
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
    """Record reputation via the service layer."""
    return reputation_service.record_reputation(ReputationRecordCreate(
        contributor_id=cid, bounty_id=bid, bounty_title="Fix", bounty_tier=tier, review_score=score,
    ))


def _auth_for(contributor_id: str) -> dict[str, str]:
    """Return auth headers that identify as the given contributor."""
    return {"X-User-ID": contributor_id}


# -- Calculation ---------------------------------------------------------------

def test_above_threshold():
    """Score above T1 threshold earns positive reputation."""
    assert calc(8.0, 1, False) > 0

def test_below_threshold():
    """Score below T1 threshold earns zero reputation."""
    assert calc(5.0, 1, False) == 0

def test_exact_threshold():
    """Score exactly at T1 threshold earns zero (must exceed)."""
    assert calc(6.0, 1, False) == 0

def test_t2_more_than_t1():
    """T2 bounty earns more reputation than T1 at same score."""
    assert calc(9.0, 2, False) > calc(9.0, 1, False)

def test_t3_more_than_t1():
    """T3 bounty earns more reputation than T1 at same score."""
    assert calc(10.0, 3, False) > calc(10.0, 1, False)

# -- Anti-farming --------------------------------------------------------------

def test_veteran_reduces():
    """Veteran penalty reduces T1 earnings."""
    assert calc(7.0, 1, True) < calc(7.0, 1, False)

def test_veteran_bumped_zero():
    """Veteran with score near threshold earns zero on T1."""
    assert calc(6.5, 1, True) == 0

def test_no_penalty_on_t2():
    """Anti-farming only applies to T1 bounties."""
    c = _mc()
    for i in range(ANTI_FARMING_THRESHOLD):
        _rec(c.id, f"t1-{i}")
    assert _rec(c.id, "t2", tier=2).anti_farming_applied is False

def test_veteran_after_threshold():
    """Contributor becomes veteran after ANTI_FARMING_THRESHOLD T1 bounties."""
    c = _mc()
    for i in range(ANTI_FARMING_THRESHOLD):
        _rec(c.id, f"b-{i}")
    assert reputation_service.is_veteran(reputation_service._reputation_store[c.id])

def test_not_veteran_before():
    """Contributor is not veteran before reaching the threshold."""
    c = _mc()
    for i in range(ANTI_FARMING_THRESHOLD - 1):
        _rec(c.id, f"b-{i}")
    assert not reputation_service.is_veteran(reputation_service._reputation_store[c.id])

# -- Badges --------------------------------------------------------------------

def test_no_badge():
    """Score below bronze threshold returns no badge."""
    assert reputation_service.determine_badge(5.0) is None

def test_bronze():
    """Score at bronze threshold returns bronze."""
    assert reputation_service.determine_badge(BADGE_THRESHOLDS[ReputationBadge.BRONZE]) == ReputationBadge.BRONZE

def test_silver():
    """Score at silver threshold returns silver."""
    assert reputation_service.determine_badge(BADGE_THRESHOLDS[ReputationBadge.SILVER]) == ReputationBadge.SILVER

def test_gold():
    """Score at gold threshold returns gold."""
    assert reputation_service.determine_badge(BADGE_THRESHOLDS[ReputationBadge.GOLD]) == ReputationBadge.GOLD

def test_diamond():
    """Score at diamond threshold returns diamond."""
    assert reputation_service.determine_badge(BADGE_THRESHOLDS[ReputationBadge.DIAMOND]) == ReputationBadge.DIAMOND

# -- Tiers ---------------------------------------------------------------------

def test_starts_t1():
    """New contributor starts at T1."""
    assert reputation_service.determine_current_tier({1: 0, 2: 0, 3: 0}) == ContributorTier.T1

def test_t2_after_4():
    """Contributor unlocks T2 after 4 T1 completions."""
    assert reputation_service.determine_current_tier({1: 4, 2: 0, 3: 0}) == ContributorTier.T2

def test_t3_after_3t2():
    """Contributor unlocks T3 after 3 T2 completions."""
    assert reputation_service.determine_current_tier({1: 4, 2: 3, 3: 0}) == ContributorTier.T3

def test_3t1_still_t1():
    """Three T1 completions is not enough for T2."""
    assert reputation_service.determine_current_tier({1: 3, 2: 0, 3: 0}) == ContributorTier.T1

def test_progression_remaining():
    """Progression shows correct bounties remaining until next tier."""
    p = reputation_service.build_tier_progression({1: 2, 2: 0, 3: 0}, ContributorTier.T1)
    assert p.bounties_until_next_tier == 2 and p.next_tier == ContributorTier.T2

def test_t3_no_next():
    """T3 contributors have no next tier."""
    p = reputation_service.build_tier_progression({1: 10, 2: 5, 3: 2}, ContributorTier.T3)
    assert p.next_tier is None and p.bounties_until_next_tier == 0

# -- Service -------------------------------------------------------------------

def test_record_retrieve():
    """Record and retrieve a reputation entry."""
    c = _mc()
    _rec(c.id)
    s = reputation_service.get_reputation(c.id)
    assert s and s.reputation_score > 0 and len(s.history) == 1

def test_missing_returns_none():
    """get_reputation returns None for unknown contributor."""
    assert reputation_service.get_reputation("x") is None

def test_missing_record_raises():
    """record_reputation raises ContributorNotFoundError for unknown contributor."""
    with pytest.raises(ContributorNotFoundError):
        _rec("x")

def test_cumulative():
    """Multiple bounties accumulate in history."""
    c = _mc()
    _rec(c.id, "b-1", 1, 8.0)
    _rec(c.id, "b-2", 1, 9.0)
    assert len(reputation_service.get_reputation(c.id).history) == 2

def test_avg_score():
    """Average review score is calculated correctly."""
    c = _mc()
    _rec(c.id, "b-1", score=8.0)
    _rec(c.id, "b-2", score=10.0)
    assert reputation_service.get_reputation(c.id).average_review_score == 9.0

def test_history_order():
    """History entries are returned newest-first."""
    c = _mc()
    _rec(c.id, "b-1")
    time.sleep(0.001)
    _rec(c.id, "b-2")
    h = reputation_service.get_history(c.id)
    assert h[0].created_at >= h[1].created_at

def test_empty_history():
    """New contributor has empty history."""
    assert reputation_service.get_history(_mc().id) == []

def test_leaderboard_sorted():
    """Leaderboard returns contributors sorted by reputation descending."""
    a, b = _mc("alice"), _mc("bob")
    _rec(a.id, "b-1", score=7.0)
    # Bob needs 4 T1 completions to unlock T2
    for i in range(4):
        _rec(b.id, f"t1-{i}", tier=1, score=8.0)
    _rec(b.id, "b-2", tier=2, score=10.0)
    lb = reputation_service.get_reputation_leaderboard()
    assert lb[0].reputation_score >= lb[1].reputation_score

def test_leaderboard_pagination():
    """Leaderboard respects limit parameter."""
    for i in range(5):
        c = _mc(f"user{i}")
        _rec(c.id, f"b-{i}", score=7.0 + i * 0.5)
    assert len(reputation_service.get_reputation_leaderboard(limit=2)) == 2

# -- API -----------------------------------------------------------------------

def test_api_get_rep():
    """GET reputation returns 200 with tier info."""
    c = _mc()
    r = client.get(f"/api/contributors/{c.id}/reputation")
    assert r.status_code == 200 and r.json()["tier_progression"]["current_tier"] == "T1"

def test_api_get_rep_404():
    """GET reputation for unknown contributor returns 404."""
    assert client.get("/api/contributors/x/reputation").status_code == 404

def test_api_history():
    """GET history returns 200 with entries."""
    c = _mc()
    _rec(c.id)
    assert client.get(f"/api/contributors/{c.id}/reputation/history").status_code == 200

def test_api_history_404():
    """GET history for unknown contributor returns 404."""
    assert client.get("/api/contributors/x/reputation/history").status_code == 404

def test_api_record():
    """POST reputation with valid auth creates entry."""
    c = _mc()
    r = client.post(
        f"/api/contributors/{c.id}/reputation",
        json={
            "contributor_id": c.id, "bounty_id": "b-1",
            "bounty_title": "Fix", "bounty_tier": 1, "review_score": 8.5,
        },
        headers=_auth_for(c.id),
    )
    assert r.status_code == 201 and r.json()["earned_reputation"] > 0

def test_api_mismatch():
    """POST reputation with mismatched path/body contributor returns 400."""
    c = _mc()
    r = client.post(
        f"/api/contributors/{c.id}/reputation",
        json={
            "contributor_id": "wrong", "bounty_id": "b",
            "bounty_title": "F", "bounty_tier": 1, "review_score": 8.0,
        },
        headers=_auth_for(c.id),
    )
    assert r.status_code == 400

def test_api_record_404():
    """POST reputation for unknown contributor returns 404."""
    fake_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    r = client.post(
        f"/api/contributors/{fake_id}/reputation",
        json={
            "contributor_id": fake_id, "bounty_id": "b",
            "bounty_title": "F", "bounty_tier": 1, "review_score": 8.0,
        },
        headers=_auth_for(fake_id),
    )
    assert r.status_code == 404

def test_api_bad_score():
    """POST reputation with score > 10 returns 422."""
    c = _mc()
    r = client.post(
        f"/api/contributors/{c.id}/reputation",
        json={
            "contributor_id": c.id, "bounty_id": "b",
            "bounty_title": "F", "bounty_tier": 1, "review_score": 11.0,
        },
        headers=_auth_for(c.id),
    )
    assert r.status_code == 422

def test_api_bad_tier():
    """POST reputation with tier > 3 returns 422."""
    c = _mc()
    r = client.post(
        f"/api/contributors/{c.id}/reputation",
        json={
            "contributor_id": c.id, "bounty_id": "b",
            "bounty_title": "F", "bounty_tier": 5, "review_score": 8.0,
        },
        headers=_auth_for(c.id),
    )
    assert r.status_code == 422

def test_api_leaderboard():
    """GET leaderboard returns 200."""
    _rec(_mc().id, score=9.0)
    assert client.get("/api/contributors/leaderboard/reputation").status_code == 200

def test_api_get_still_works():
    """GET contributor by ID still works after reputation changes."""
    assert client.get(f"/api/contributors/{_mc().id}").status_code == 200

def test_api_list_still_works():
    """GET contributors list still works."""
    _mc()
    assert client.get("/api/contributors").json()["total"] >= 1

# -- Fix validations -----------------------------------------------------------

def test_idempotent_duplicate_bounty():
    """Duplicate bounty_id for same contributor returns existing entry."""
    c = _mc()
    first = _rec(c.id, "dup-1", 1, 8.0)
    second = _rec(c.id, "dup-1", 1, 9.0)
    assert first.entry_id == second.entry_id
    assert len(reputation_service._reputation_store[c.id]) == 1

def test_tier_enforcement_blocks_t2():
    """T2 bounty rejected when contributor only has T1 access."""
    c = _mc()
    with pytest.raises(TierNotUnlockedError, match="not unlocked tier T2"):
        _rec(c.id, "bad-t2", tier=2, score=9.0)

def test_tier_enforcement_allows_after_progression():
    """T2 bounty accepted after 4 T1 completions."""
    c = _mc()
    for i in range(4):
        _rec(c.id, f"t1-{i}", tier=1, score=8.0)
    entry = _rec(c.id, "t2-ok", tier=2, score=9.0)
    assert entry.bounty_tier == 2

def test_score_precision_consistent():
    """reputation_score uses float precision, not int rounding."""
    c = _mc()
    _rec(c.id, "b-prec", 1, 8.5)
    contrib = contributor_service._store[c.id]
    summary = reputation_service.get_reputation(c.id)
    assert contrib.reputation_score == summary.reputation_score

def test_negative_earned_reputation_rejected():
    """earned_reputation field rejects negative values via Pydantic."""
    from app.models.reputation import ReputationHistoryEntry
    with pytest.raises(ValidationError):
        ReputationHistoryEntry(
            entry_id="x", contributor_id="x", bounty_id="x",
            bounty_title="x", bounty_tier=1, review_score=5.0,
            earned_reputation=-1.0,
        )

def test_api_record_requires_auth():
    """POST reputation returns 403 when caller is not authorized."""
    c = _mc()
    r = client.post(
        f"/api/contributors/{c.id}/reputation",
        json={
            "contributor_id": c.id, "bounty_id": "auth-test",
            "bounty_title": "Fix", "bounty_tier": 1, "review_score": 8.5,
        },
        headers={"X-User-ID": "11111111-1111-1111-1111-111111111111"},
    )
    assert r.status_code == 403

def test_api_record_no_auth_returns_401():
    """POST reputation without any auth headers returns 401."""
    c = _mc()
    r = client.post(
        f"/api/contributors/{c.id}/reputation",
        json={
            "contributor_id": c.id, "bounty_id": "no-auth",
            "bounty_title": "Fix", "bounty_tier": 1, "review_score": 8.5,
        },
    )
    assert r.status_code == 401

def test_api_record_system_user_allowed():
    """POST reputation with system user auth succeeds."""
    c = _mc()
    r = client.post(
        f"/api/contributors/{c.id}/reputation",
        json={
            "contributor_id": c.id, "bounty_id": "sys-auth",
            "bounty_title": "Fix", "bounty_tier": 1, "review_score": 8.5,
        },
        headers=SYSTEM_AUTH,
    )
    assert r.status_code == 201
