"""Tests for the Leaderboard API."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.contributor import ContributorDB
from app.services.contributor_service import _store
from app.services.leaderboard_service import invalidate_cache

client = TestClient(app)


def _seed_contributor(
    username: str,
    display_name: str,
    total_earnings: float = 0.0,
    bounties_completed: int = 0,
    reputation: int = 0,
    skills: list[str] | None = None,
    badges: list[str] | None = None,
) -> ContributorDB:
    """Insert a contributor directly into the in-memory store."""
    db = ContributorDB(
        id=uuid.uuid4(),
        username=username,
        display_name=display_name,
        total_earnings=total_earnings,
        total_bounties_completed=bounties_completed,
        reputation_score=reputation,
        skills=skills or [],
        badges=badges or [],
        avatar_url=f"https://github.com/{username}.png",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    _store[str(db.id)] = db
    return db


@pytest.fixture(autouse=True)
def _clean():
    """Reset store and cache before every test."""
    _store.clear()
    invalidate_cache()
    yield
    _store.clear()
    invalidate_cache()


# ── Basic endpoint tests ─────────────────────────────────────────────────


def test_empty_leaderboard():
    """The test_empty_leaderboard function."""
    resp = client.get("/api/leaderboard")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["entries"] == []
    assert data["top3"] == []


def test_single_contributor():
    """The test_single_contributor function."""
    _seed_contributor(
        "alice", "Alice A", total_earnings=500.0, bounties_completed=3, reputation=80
    )

    resp = client.get("/api/leaderboard")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["entries"]) == 1
    assert data["entries"][0]["rank"] == 1
    assert data["entries"][0]["username"] == "alice"
    assert data["entries"][0]["total_earned"] == 500.0


def test_ranking_order():
    """The test_ranking_order function."""
    _seed_contributor("low", "Low Earner", total_earnings=100.0)
    _seed_contributor("mid", "Mid Earner", total_earnings=500.0)
    _seed_contributor("top", "Top Earner", total_earnings=1000.0)

    resp = client.get("/api/leaderboard")
    data = resp.json()
    assert data["total"] == 3
    usernames = [e["username"] for e in data["entries"]]
    assert usernames == ["top", "mid", "low"]
    assert data["entries"][0]["rank"] == 1
    assert data["entries"][2]["rank"] == 3


def test_top3_medals():
    """The test_top3_medals function."""
    _seed_contributor("gold", "Gold", total_earnings=1000.0)
    _seed_contributor("silver", "Silver", total_earnings=500.0)
    _seed_contributor("bronze", "Bronze", total_earnings=250.0)

    resp = client.get("/api/leaderboard")
    data = resp.json()
    assert len(data["top3"]) == 3
    assert data["top3"][0]["meta"]["medal"] == "🥇"
    assert data["top3"][1]["meta"]["medal"] == "🥈"
    assert data["top3"][2]["meta"]["medal"] == "🥉"


def test_top3_with_fewer_than_3():
    """The test_top3_with_fewer_than_3 function."""
    _seed_contributor("solo", "Solo", total_earnings=100.0)

    resp = client.get("/api/leaderboard")
    data = resp.json()
    assert len(data["top3"]) == 1
    assert data["top3"][0]["meta"]["medal"] == "🥇"


# ── Filter tests ─────────────────────────────────────────────────────────


def test_filter_by_category():
    """The test_filter_by_category function."""
    _seed_contributor("fe_dev", "FE Dev", total_earnings=300.0, skills=["frontend"])
    _seed_contributor("be_dev", "BE Dev", total_earnings=600.0, skills=["backend"])

    resp = client.get("/api/leaderboard?category=frontend")
    data = resp.json()
    assert data["total"] == 1
    assert data["entries"][0]["username"] == "fe_dev"


def test_filter_by_tier():
    """The test_filter_by_tier function."""
    _seed_contributor("t1_dev", "T1 Dev", total_earnings=200.0, badges=["tier-1"])
    _seed_contributor("t2_dev", "T2 Dev", total_earnings=800.0, badges=["tier-2"])

    resp = client.get("/api/leaderboard?tier=1")
    data = resp.json()
    assert data["total"] == 1
    assert data["entries"][0]["username"] == "t1_dev"


def test_filter_by_period_all():
    """The test_filter_by_period_all function."""
    _seed_contributor("old", "Old Timer", total_earnings=900.0)

    resp = client.get("/api/leaderboard?period=all")
    data = resp.json()
    assert data["total"] == 1
    assert data["period"] == "all"


# ── Pagination tests ─────────────────────────────────────────────────────


def test_pagination_limit():
    """The test_pagination_limit function."""
    for i in range(5):
        _seed_contributor(f"user{i}", f"User {i}", total_earnings=float(100 * (5 - i)))

    resp = client.get("/api/leaderboard?limit=2&offset=0")
    data = resp.json()
    assert data["total"] == 5
    assert len(data["entries"]) == 2
    assert data["entries"][0]["rank"] == 1


def test_pagination_offset():
    """The test_pagination_offset function."""
    for i in range(5):
        _seed_contributor(f"user{i}", f"User {i}", total_earnings=float(100 * (5 - i)))

    resp = client.get("/api/leaderboard?limit=2&offset=2")
    data = resp.json()
    assert len(data["entries"]) == 2
    assert data["entries"][0]["rank"] == 3


def test_pagination_beyond_total():
    """The test_pagination_beyond_total function."""
    _seed_contributor("only", "Only One", total_earnings=100.0)

    resp = client.get("/api/leaderboard?limit=10&offset=5")
    data = resp.json()
    assert data["total"] == 1
    assert len(data["entries"]) == 0


# ── Tiebreaker test ─────────────────────────────────────────────────────


def test_tiebreaker_reputation_then_username():
    """The test_tiebreaker_reputation_then_username function."""
    _seed_contributor("bob", "Bob", total_earnings=500.0, reputation=90)
    _seed_contributor("alice", "Alice", total_earnings=500.0, reputation=100)
    _seed_contributor("charlie", "Charlie", total_earnings=500.0, reputation=90)

    resp = client.get("/api/leaderboard")
    data = resp.json()
    usernames = [e["username"] for e in data["entries"]]
    # alice has higher reputation, then bob < charlie alphabetically
    assert usernames == ["alice", "bob", "charlie"]


# ── Cache test ───────────────────────────────────────────────────────────


def test_cache_returns_same_result():
    """The test_cache_returns_same_result function."""
    _seed_contributor("cached", "Cached", total_earnings=100.0)

    resp1 = client.get("/api/leaderboard")
    resp2 = client.get("/api/leaderboard")
    assert resp1.json() == resp2.json()


def test_cache_invalidation():
    """The test_cache_invalidation function."""
    _seed_contributor("first", "First", total_earnings=100.0)
    resp1 = client.get("/api/leaderboard")
    assert resp1.json()["total"] == 1

    invalidate_cache()
    _seed_contributor("second", "Second", total_earnings=200.0)
    resp2 = client.get("/api/leaderboard")
    assert resp2.json()["total"] == 2
