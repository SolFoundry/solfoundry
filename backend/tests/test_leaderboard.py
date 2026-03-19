"""Unit tests for leaderboard API and service logic."""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.models.leaderboard import (
    Contribution,
    Contributor,
    ContributorBrief,
    ContributorDetail,
    LeaderboardResponse,
    SortField,
    TimeFilter,
)
from app.services.leaderboard_service import _time_cutoff, get_leaderboard, get_contributor_detail


# ---------------------------------------------------------------------------
# Model validation tests
# ---------------------------------------------------------------------------

class TestPydanticModels:
    def test_contributor_brief(self):
        c = ContributorBrief(
            id=1,
            wallet_address="0xabc",
            display_name="Alice",
            total_contributions=10,
            total_earnings=150.0,
            rank=3,
        )
        assert c.display_name == "Alice"
        assert c.total_earnings == 150.0

    def test_leaderboard_response(self):
        resp = LeaderboardResponse(
            items=[],
            total=0,
            page=1,
            limit=20,
            pages=0,
        )
        assert resp.pages == 0

    def test_contributor_detail_defaults(self):
        d = ContributorDetail(
            id=1,
            wallet_address="0xabc",
            display_name="Alice",
            total_contributions=5,
            total_earnings=100.0,
            rank=1,
        )
        assert d.contributions == []


# ---------------------------------------------------------------------------
# Service logic tests
# ---------------------------------------------------------------------------

class TestTimeCutoff:
    def test_weekly_returns_datetime(self):
        cutoff = _time_cutoff(TimeFilter.weekly)
        assert cutoff is not None
        assert isinstance(cutoff, datetime)

    def test_monthly_returns_datetime(self):
        cutoff = _time_cutoff(TimeFilter.monthly)
        assert cutoff is not None

    def test_all_time_returns_none(self):
        assert _time_cutoff(TimeFilter.all_time) is None


class TestGetLeaderboard:
    def test_empty_database(self):
        db = MagicMock()
        db.scalar.return_value = 0
        db.execute.return_value.all.return_value = []

        result = get_leaderboard(
            db, page=1, limit=10, sort=SortField.rank, time_filter=TimeFilter.all_time
        )
        assert isinstance(result, LeaderboardResponse)
        assert result.items == []
        assert result.total == 0
        assert result.page == 1

    def test_pagination_params(self):
        db = MagicMock()
        db.scalar.return_value = 0
        db.execute.return_value.all.return_value = []

        result = get_leaderboard(db, page=2, limit=5)
        assert result.page == 2
        assert result.limit == 5
        assert result.pages == 0

    def test_sort_field_earnings(self):
        db = MagicMock()
        db.scalar.return_value = 0
        db.execute.return_value.all.return_value = []

        result = get_leaderboard(db, sort=SortField.earnings)
        assert result is not None


class TestGetContributorDetail:
    def test_not_found(self):
        db = MagicMock()
        db.scalar.return_value = None

        result = get_contributor_detail(db, 999)
        assert result is None
