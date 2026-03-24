"""Tests for the Leaderboard API with PostgreSQL persistence.

Verifies ranked contributor queries, caching, pagination, and filters
against the async leaderboard service backed by the database.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.database import engine
from app.main import app
from app.models.contributor import ContributorTable
from app.models.leaderboard import CategoryFilter, TierFilter, TimePeriod
from app.services import contributor_service
from app.services.leaderboard_service import get_leaderboard, invalidate_cache
from tests.conftest import run_async

client = TestClient(app)


def _seed_contributor(
    username: str,
    display_name: str,
    total_earnings: float = 0.0,
    bounties_completed: int = 0,
    reputation: int = 0,
    skills: list[str] | None = None,
    badges: list[str] | None = None,
) -> ContributorTable:
    """Insert a contributor directly into PostgreSQL and _store cache.

    Args:
        username: GitHub username.
        display_name: Display name for the leaderboard.
        total_earnings: Total $FNDRY earned.
        bounties_completed: Number of bounties completed.
        reputation: Reputation score (0-100).
        skills: List of skill strings.
        badges: List of badge strings.

    Returns:
        The inserted ``ContributorTable`` ORM instance.
    """
    row_data = {
        "id": uuid.uuid4(),
        "username": username,
        "display_name": display_name,
        "avatar_url": f"https://github.com/{username}.png",
        "total_earnings": Decimal(str(total_earnings)),
        "total_bounties_completed": bounties_completed,
        "reputation_score": float(reputation),
        "skills": skills or [],
        "badges": badges or [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    row = run_async(contributor_service.upsert_contributor(row_data))
    contributor_service._store[str(row.id)] = row
    return row


@pytest.fixture(autouse=True)
def _clean():
    """Reset database, store, and cache before every test."""

    async def _clear():
        """Delete all rows from the contributors table."""
        from sqlalchemy import delete

        async with engine.begin() as conn:
            await conn.execute(delete(ContributorTable))

    run_async(_clear())
    contributor_service._store.clear()
    invalidate_cache()
    yield
    run_async(_clear())
    contributor_service._store.clear()
    invalidate_cache()


# -- Basic endpoint tests ---------------------------------------------------


def test_empty_leaderboard():
    """Empty database returns zero entries."""
    result = run_async(get_leaderboard())
    assert result.total == 0
    assert result.entries == []
    assert result.top3 == []


def test_single_contributor():
    """Single contributor appears at rank 1."""
    _seed_contributor(
        "alice", "Alice A", total_earnings=500.0, bounties_completed=3, reputation=80
    )
    result = run_async(get_leaderboard())
    assert result.total == 1
    assert len(result.entries) == 1
    assert result.entries[0].rank == 1
    assert result.entries[0].username == "alice"
    assert result.entries[0].total_earned == 500.0


def test_ranking_order():
    """Contributors are ranked by total_earnings descending."""
    _seed_contributor("low", "Low Earner", total_earnings=100.0)
    _seed_contributor("mid", "Mid Earner", total_earnings=500.0)
    _seed_contributor("top", "Top Earner", total_earnings=1000.0)
    result = run_async(get_leaderboard())
    assert result.total == 3
    usernames = [e.username for e in result.entries]
    assert usernames == ["top", "mid", "low"]
    assert result.entries[0].rank == 1
    assert result.entries[2].rank == 3


def test_top3_medals():
    """Top 3 contributors receive gold, silver, bronze medals."""
    _seed_contributor("gold", "Gold", total_earnings=1000.0)
    _seed_contributor("silver", "Silver", total_earnings=500.0)
    _seed_contributor("bronze", "Bronze", total_earnings=250.0)
    result = run_async(get_leaderboard())
    assert len(result.top3) == 3
    assert result.top3[0].meta.medal == "\U0001f947"
    assert result.top3[1].meta.medal == "\U0001f948"
    assert result.top3[2].meta.medal == "\U0001f949"


def test_top3_with_fewer_than_3():
    """Fewer than 3 contributors still get correct medals."""
    _seed_contributor("solo", "Solo", total_earnings=100.0)
    result = run_async(get_leaderboard())
    assert len(result.top3) == 1
    assert result.top3[0].meta.medal == "\U0001f947"


# -- Filter tests -----------------------------------------------------------


def test_filter_by_category():
    """Category filter returns only contributors with matching skill."""
    _seed_contributor("fe_dev", "FE Dev", total_earnings=300.0, skills=["frontend"])
    _seed_contributor("be_dev", "BE Dev", total_earnings=600.0, skills=["backend"])
    result = run_async(get_leaderboard(category=CategoryFilter.frontend))
    assert result.total == 1
    assert result.entries[0].username == "fe_dev"


def test_filter_by_tier():
    """Tier filter returns only contributors with matching badge."""
    _seed_contributor("t1_dev", "T1 Dev", total_earnings=200.0, badges=["tier-1"])
    _seed_contributor("t2_dev", "T2 Dev", total_earnings=800.0, badges=["tier-2"])
    result = run_async(get_leaderboard(tier=TierFilter.t1))
    assert result.total == 1
    assert result.entries[0].username == "t1_dev"


def test_filter_by_period_all():
    """Period=all returns all contributors regardless of creation date."""
    _seed_contributor("old", "Old Timer", total_earnings=900.0)
    result = run_async(get_leaderboard(period=TimePeriod.all))
    assert result.total == 1
    assert result.period == "all"


# -- Pagination tests -------------------------------------------------------


def test_pagination_limit():
    """Limit parameter restricts the number of returned entries."""
    for i in range(5):
        _seed_contributor(f"user{i}", f"User {i}", total_earnings=float(100 * (5 - i)))
    result = run_async(get_leaderboard(limit=2, offset=0))
    assert result.total == 5
    assert len(result.entries) == 2
    assert result.entries[0].rank == 1


def test_pagination_offset():
    """Offset parameter skips the first N entries."""
    for i in range(5):
        _seed_contributor(f"user{i}", f"User {i}", total_earnings=float(100 * (5 - i)))
    result = run_async(get_leaderboard(limit=2, offset=2))
    assert len(result.entries) == 2
    assert result.entries[0].rank == 3


def test_pagination_beyond_total():
    """Offset beyond total returns empty entries."""
    _seed_contributor("only", "Only One", total_earnings=100.0)
    result = run_async(get_leaderboard(limit=10, offset=5))
    assert result.total == 1
    assert len(result.entries) == 0


# -- Tiebreaker tests -------------------------------------------------------


def test_tiebreaker_reputation_then_username():
    """Equal earnings are broken by reputation desc, then username asc."""
    _seed_contributor("bob", "Bob", total_earnings=500.0, reputation=90)
    _seed_contributor("alice", "Alice", total_earnings=500.0, reputation=100)
    _seed_contributor("charlie", "Charlie", total_earnings=500.0, reputation=90)
    result = run_async(get_leaderboard())
    usernames = [e.username for e in result.entries]
    assert usernames == ["alice", "bob", "charlie"]


# -- Cache tests ------------------------------------------------------------


def test_cache_returns_same_result():
    """Successive calls return identical results from cache."""
    _seed_contributor("cached", "Cached", total_earnings=100.0)
    r1 = run_async(get_leaderboard())
    r2 = run_async(get_leaderboard())
    assert r1.total == r2.total
    assert len(r1.entries) == len(r2.entries)


def test_cache_invalidation():
    """invalidate_cache forces fresh database query."""
    _seed_contributor("first", "First", total_earnings=100.0)
    r1 = run_async(get_leaderboard())
    assert r1.total == 1
    invalidate_cache()
    _seed_contributor("second", "Second", total_earnings=200.0)
    r2 = run_async(get_leaderboard())
    assert r2.total == 2


# -- Database-specific tests (new for PostgreSQL migration) -----------------


def test_leaderboard_queries_database():
    """Leaderboard results come from PostgreSQL, not just in-memory."""
    _seed_contributor("db_test", "DB Test", total_earnings=999.0)
    invalidate_cache()
    result = run_async(get_leaderboard())
    assert result.total >= 1
    assert any(e.username == "db_test" for e in result.entries)


def test_leaderboard_under_100ms_with_cache():
    """Cached leaderboard response returns within 100ms target."""
    for i in range(10):
        _seed_contributor(f"perf{i}", f"Perf {i}", total_earnings=float(100 * i))
    run_async(get_leaderboard())  # warm the cache
    start = time.time()
    run_async(get_leaderboard())
    elapsed_ms = (time.time() - start) * 1000
    assert elapsed_ms < 100, (
        f"Cached leaderboard took {elapsed_ms:.1f}ms (target <100ms)"
    )
