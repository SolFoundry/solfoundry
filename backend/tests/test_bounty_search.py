"""Tests for bounty search service — in-memory fallback path.

Tests the BountySearchService and its underlying search/filter/sort/autocomplete
logic using the in-memory store (no PostgreSQL required). This suite covers the
code path that runs in dev/test when no database is connected.

Run with: pytest tests/test_bounty_search.py -v
"""

import pytest
from datetime import datetime, timezone, timedelta

from app.models.bounty import (
    BountyDB,
    BountySearchParams,
    BountyStatus,
    BountyTier,
    VALID_SORT_FIELDS,
    VALID_CATEGORIES,
)
from app.services.bounty_service import _bounty_store
from app.services.bounty_search_service import (
    BountySearchService,
    search_bounties_memory,
    autocomplete_memory,
    get_hot_bounties_memory,
    get_recommended_memory,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

NOW = datetime.now(timezone.utc)


def _make_bounty(**overrides) -> BountyDB:
    """The _make_bounty function."""
    defaults = dict(
        title="Test Bounty",
        description="A test bounty description for searching",
        tier=BountyTier.T1,
        reward_amount=1000,
        status=BountyStatus.OPEN,
        required_skills=["python", "fastapi"],
        github_issue_url="https://github.com/test/repo/issues/1",
        created_by="SolFoundry",
        created_at=NOW - timedelta(hours=1),
        updated_at=NOW - timedelta(hours=1),
        deadline=NOW + timedelta(days=7),
    )
    defaults.update(overrides)
    return BountyDB(**defaults)


@pytest.fixture(autouse=True)
def seed_store():
    """Populate the in-memory store with diverse bounties for each test."""
    _bounty_store.clear()

    bounties = [
        _make_bounty(
            title="Build Smart Search & Discovery",
            description="Full-text search bar with instant results and filtering",
            tier=BountyTier.T1,
            reward_amount=300_000,
            skills=["react", "typescript", "python", "fastapi"],
            required_skills=["react", "typescript", "python", "fastapi"],
            created_at=NOW - timedelta(hours=2),
            updated_at=NOW - timedelta(minutes=30),
        ),
        _make_bounty(
            title="Security Audit — Escrow Token Transfer",
            description="Audit the escrow token transfer logic for edge cases",
            tier=BountyTier.T2,
            reward_amount=5_000,
            status=BountyStatus.OPEN,
            required_skills=["rust", "anchor", "solana"],
            created_at=NOW - timedelta(hours=48),
            updated_at=NOW - timedelta(hours=48),
            deadline=NOW + timedelta(days=14),
        ),
        _make_bounty(
            title="Staking Dashboard UI",
            description="Staking dashboard with total staked, APY, and history",
            tier=BountyTier.T2,
            reward_amount=3_500,
            status=BountyStatus.IN_PROGRESS,
            required_skills=["react", "typescript", "solana"],
            created_at=NOW - timedelta(hours=72),
            updated_at=NOW - timedelta(hours=72),
        ),
        _make_bounty(
            title="API Documentation — OpenAPI Spec",
            description="Generate comprehensive OpenAPI documentation for all endpoints",
            tier=BountyTier.T1,
            reward_amount=200,
            status=BountyStatus.OPEN,
            required_skills=["typescript", "documentation"],
            created_at=NOW - timedelta(hours=120),
            updated_at=NOW - timedelta(hours=120),
            deadline=NOW + timedelta(days=21),
        ),
        _make_bounty(
            title="Lending Protocol v2 Security Audit",
            description="Full security audit of lending protocol v2 smart contracts",
            tier=BountyTier.T3,
            reward_amount=15_000,
            status=BountyStatus.COMPLETED,
            required_skills=["rust", "anchor", "solana", "security"],
            created_at=NOW - timedelta(hours=240),
            updated_at=NOW - timedelta(hours=240),
            deadline=NOW - timedelta(days=1),
        ),
    ]
    for b in bounties:
        _bounty_store[b.id] = b

    yield

    _bounty_store.clear()


# ---------------------------------------------------------------------------
# BountySearchParams validation
# ---------------------------------------------------------------------------


class TestSearchParamsValidation:
    """The TestSearchParamsValidation class."""
    def test_valid_sort_fields(self):
        """The test_valid_sort_fields function."""
        for field in VALID_SORT_FIELDS:
            params = BountySearchParams(sort=field)
            assert params.sort == field

    def test_invalid_sort_raises(self):
        """The test_invalid_sort_raises function."""
        with pytest.raises(ValueError, match="Invalid sort"):
            BountySearchParams(sort="bogus")

    def test_invalid_category_raises(self):
        """The test_invalid_category_raises function."""
        with pytest.raises(ValueError, match="Invalid category"):
            BountySearchParams(category="nonexistent")

    def test_valid_categories(self):
        """The test_valid_categories function."""
        for cat in VALID_CATEGORIES:
            params = BountySearchParams(category=cat)
            assert params.category == cat

    def test_reward_max_less_than_min_raises(self):
        """The test_reward_max_less_than_min_raises function."""
        with pytest.raises(ValueError, match="reward_max must be >= reward_min"):
            BountySearchParams(reward_min=1000, reward_max=500)

    def test_negative_reward_min_raises(self):
        """The test_negative_reward_min_raises function."""
        with pytest.raises(ValueError):
            BountySearchParams(reward_min=-10)

    def test_tier_out_of_range_raises(self):
        """The test_tier_out_of_range_raises function."""
        with pytest.raises(ValueError):
            BountySearchParams(tier=5)

    def test_defaults(self):
        """The test_defaults function."""
        p = BountySearchParams()
        assert p.q == ""
        assert p.page == 1
        assert p.per_page == 20
        assert p.sort == "newest"


# ---------------------------------------------------------------------------
# In-memory search
# ---------------------------------------------------------------------------


class TestSearchMemory:
    """The TestSearchMemory class."""
    def test_returns_all_when_no_filters(self):
        """The test_returns_all_when_no_filters function."""
        result = search_bounties_memory(BountySearchParams())
        assert result.total == 5

    def test_filter_by_status_open(self):
        """The test_filter_by_status_open function."""
        result = search_bounties_memory(BountySearchParams(status=BountyStatus.OPEN))
        assert all(b.status == BountyStatus.OPEN for b in result.items)
        assert result.total == 3

    def test_filter_by_status_completed(self):
        """The test_filter_by_status_completed function."""
        result = search_bounties_memory(
            BountySearchParams(status=BountyStatus.COMPLETED)
        )
        assert result.total == 1
        assert result.items[0].title == "Lending Protocol v2 Security Audit"

    def test_filter_by_tier(self):
        """The test_filter_by_tier function."""
        result = search_bounties_memory(BountySearchParams(tier=2))
        assert all(b.tier == BountyTier.T2 for b in result.items)
        assert result.total == 2

    def test_filter_by_skills(self):
        """The test_filter_by_skills function."""
        result = search_bounties_memory(BountySearchParams(skills=["rust"]))
        assert result.total == 2
        for item in result.items:
            assert "rust" in [s.lower() for s in item.required_skills]

    def test_filter_by_reward_range(self):
        """The test_filter_by_reward_range function."""
        result = search_bounties_memory(
            BountySearchParams(reward_min=1000, reward_max=10000)
        )
        assert all(1000 <= b.reward_amount <= 10000 for b in result.items)

    def test_full_text_search_title(self):
        """The test_full_text_search_title function."""
        result = search_bounties_memory(BountySearchParams(q="security audit"))
        assert result.total >= 1
        titles = [b.title.lower() for b in result.items]
        assert any("security" in t for t in titles)

    def test_full_text_search_description(self):
        """The test_full_text_search_description function."""
        result = search_bounties_memory(BountySearchParams(q="escrow"))
        assert result.total >= 1
        assert any("escrow" in b.description.lower() for b in result.items)

    def test_full_text_no_match(self):
        """The test_full_text_no_match function."""
        result = search_bounties_memory(BountySearchParams(q="zzzznonexistent"))
        assert result.total == 0
        assert result.items == []

    def test_sort_reward_high(self):
        """The test_sort_reward_high function."""
        result = search_bounties_memory(BountySearchParams(sort="reward_high"))
        amounts = [b.reward_amount for b in result.items]
        assert amounts == sorted(amounts, reverse=True)

    def test_sort_reward_low(self):
        """The test_sort_reward_low function."""
        result = search_bounties_memory(BountySearchParams(sort="reward_low"))
        amounts = [b.reward_amount for b in result.items]
        assert amounts == sorted(amounts)

    def test_sort_newest(self):
        """The test_sort_newest function."""
        result = search_bounties_memory(BountySearchParams(sort="newest"))
        dates = [b.created_at for b in result.items]
        assert dates == sorted(dates, reverse=True)

    def test_pagination_page_1(self):
        """The test_pagination_page_1 function."""
        result = search_bounties_memory(BountySearchParams(per_page=2, page=1))
        assert len(result.items) == 2
        assert result.total == 5
        assert result.page == 1

    def test_pagination_page_2(self):
        """The test_pagination_page_2 function."""
        result = search_bounties_memory(BountySearchParams(per_page=2, page=2))
        assert len(result.items) == 2
        assert result.page == 2

    def test_pagination_last_page(self):
        """The test_pagination_last_page function."""
        result = search_bounties_memory(BountySearchParams(per_page=2, page=3))
        assert len(result.items) == 1

    def test_combined_filters(self):
        """The test_combined_filters function."""
        result = search_bounties_memory(
            BountySearchParams(
                status=BountyStatus.OPEN,
                tier=2,
                skills=["rust"],
            )
        )
        assert result.total == 1
        assert result.items[0].title == "Security Audit — Escrow Token Transfer"

    def test_skill_match_count(self):
        """The test_skill_match_count function."""
        result = search_bounties_memory(
            BountySearchParams(skills=["react", "typescript"])
        )
        for item in result.items:
            expected = len(
                {"react", "typescript"} & {s.lower() for s in item.required_skills}
            )
            assert item.skill_match_count == expected

    def test_deadline_filter(self):
        """The test_deadline_filter function."""
        cutoff = NOW + timedelta(days=10)
        result = search_bounties_memory(BountySearchParams(deadline_before=cutoff))
        for item in result.items:
            assert item.deadline is not None
            assert item.deadline <= cutoff


# ---------------------------------------------------------------------------
# Autocomplete
# ---------------------------------------------------------------------------


class TestAutocompleteMemory:
    """The TestAutocompleteMemory class."""
    def test_returns_title_matches(self):
        """The test_returns_title_matches function."""
        result = autocomplete_memory("staking", limit=5)
        assert any(
            s.type == "title" and "staking" in s.text.lower()
            for s in result.suggestions
        )

    def test_returns_skill_matches(self):
        """The test_returns_skill_matches function."""
        result = autocomplete_memory("rust", limit=5)
        assert any(s.type == "skill" for s in result.suggestions)

    def test_short_query_returns_empty(self):
        """The test_short_query_returns_empty function."""
        result = autocomplete_memory("a", limit=5)
        assert result.suggestions == []

    def test_respects_limit(self):
        """The test_respects_limit function."""
        result = autocomplete_memory("s", limit=2)
        assert len(result.suggestions) <= 2

    def test_no_match_returns_empty(self):
        """The test_no_match_returns_empty function."""
        result = autocomplete_memory("zzzznonexistent", limit=5)
        assert result.suggestions == []


# ---------------------------------------------------------------------------
# Hot bounties
# ---------------------------------------------------------------------------


class TestHotBountiesMemory:
    """The TestHotBountiesMemory class."""
    def test_returns_recent_active(self):
        """The test_returns_recent_active function."""
        results = get_hot_bounties_memory(limit=10)
        for b in results:
            assert b.status in (BountyStatus.OPEN, BountyStatus.IN_PROGRESS)

    def test_excludes_completed(self):
        """The test_excludes_completed function."""
        results = get_hot_bounties_memory(limit=10)
        assert all(b.status != BountyStatus.COMPLETED for b in results)

    def test_respects_limit(self):
        """The test_respects_limit function."""
        results = get_hot_bounties_memory(limit=2)
        assert len(results) <= 2


# ---------------------------------------------------------------------------
# Recommended bounties
# ---------------------------------------------------------------------------


class TestRecommendedMemory:
    """The TestRecommendedMemory class."""
    def test_matches_user_skills(self):
        """The test_matches_user_skills function."""
        results = get_recommended_memory(["react", "typescript"], [], limit=5)
        for b in results:
            overlap = {"react", "typescript"} & {s.lower() for s in b.required_skills}
            assert len(overlap) > 0

    def test_excludes_specified_ids(self):
        """The test_excludes_specified_ids function."""
        all_results = get_recommended_memory(["react"], [], limit=10)
        if all_results:
            exclude_id = all_results[0].id
            filtered = get_recommended_memory(["react"], [exclude_id], limit=10)
            assert all(b.id != exclude_id for b in filtered)

    def test_empty_skills_returns_empty(self):
        """The test_empty_skills_returns_empty function."""
        results = get_recommended_memory([], [], limit=5)
        assert results == []

    def test_only_open_bounties(self):
        """The test_only_open_bounties function."""
        results = get_recommended_memory(["rust", "anchor", "solana"], [], limit=10)
        assert all(b.status == BountyStatus.OPEN for b in results)

    def test_skill_match_count_populated(self):
        """The test_skill_match_count_populated function."""
        results = get_recommended_memory(["react", "typescript"], [], limit=5)
        for b in results:
            assert b.skill_match_count >= 1


# ---------------------------------------------------------------------------
# BountySearchService unified interface (memory fallback)
# ---------------------------------------------------------------------------


class TestBountySearchService:
    @pytest.mark.asyncio
    """The TestBountySearchService class."""
    async def test_search_falls_back_to_memory(self):
        """The test_search_falls_back_to_memory function."""
        svc = BountySearchService(session=None)
        result = await svc.search(BountySearchParams())
        assert result.total == 5

    @pytest.mark.asyncio
    async def test_autocomplete_falls_back(self):
        """The test_autocomplete_falls_back function."""
        svc = BountySearchService(session=None)
        result = await svc.autocomplete("staking")
        assert any("staking" in s.text.lower() for s in result.suggestions)

    @pytest.mark.asyncio
    async def test_hot_bounties_falls_back(self):
        """The test_hot_bounties_falls_back function."""
        svc = BountySearchService(session=None)
        results = await svc.hot_bounties(limit=3)
        assert isinstance(results, list)

    @pytest.mark.asyncio
    async def test_recommended_falls_back(self):
        """The test_recommended_falls_back function."""
        svc = BountySearchService(session=None)
        results = await svc.recommended(["react"], [], limit=3)
        assert isinstance(results, list)

    @pytest.mark.asyncio
    async def test_search_with_filters(self):
        """The test_search_with_filters function."""
        svc = BountySearchService(session=None)
        result = await svc.search(
            BountySearchParams(status=BountyStatus.OPEN, sort="reward_high")
        )
        assert all(b.status == BountyStatus.OPEN for b in result.items)
        amounts = [b.reward_amount for b in result.items]
        assert amounts == sorted(amounts, reverse=True)
