"""Tests for Bounty Agent."""
import pytest
from app.agents.discovery import Bounty, DiscoveryAgent
from app.agents.planner import PlannerAgent, Plan, TaskStep
from app.agents.reviewer import ReviewerAgent, ReviewResult


class TestBounty:
    """Tests for Bounty dataclass."""

    def test_bounty_creation(self):
        b = Bounty(number=861, title="Test Bounty", body="Body", repo="org/repo", labels=["bounty"])
        assert b.number == 861
        assert b.repo == "org/repo"

    def test_is_claimable(self):
        b1 = Bounty(number=1, title="", body="", repo="", labels=["bounty", "tier-3"])
        assert b1.is_claimable is True

        b2 = Bounty(number=2, title="", body="", repo="", labels=["bounty", "claimed"])
        assert b2.is_claimable is False

        b3 = Bounty(number=3, title="", body="", repo="", labels=["bounty", "in-progress"])
        assert b3.is_claimable is False

    def test_branch_name(self):
        b = Bounty(number=861, title="Full Autonomous Bounty-Hunting Agent", body="", repo="", labels=[])
        assert "861" in b.branch_name
        assert "bounty" in b.branch_name


class TestDiscoveryAgent:
    """Tests for DiscoveryAgent."""

    def test_is_bounty_label(self):
        agent = DiscoveryAgent(token="fake")
        assert agent._is_bounty(["bounty"])
        assert agent._is_bounty(["tier-3"])
        assert agent._is_bounty(["Bounty", "tier-1"])
        assert not agent._is_bounty(["bug"])
        assert not agent._is_bounty(["enhancement"])

    def test_extract_metadata(self):
        agent = DiscoveryAgent(token="fake")
        body = "**Reward:** 1M $FNDRY | **Tier:** T3 | **Domain:** Agent"
        tier, domain, reward = agent._extract_metadata(body, ["bounty", "tier-3"])
        assert "T3" in tier or "tier-3" in tier
        assert "Agent" in domain
        assert "1M" in reward or "$FNDRY" in reward


class TestPlan:
    """Tests for Plan dataclass."""

    def test_plan_creation(self):
        b = Bounty(number=1, title="Test", body="", repo="", labels=[])
        p = Plan(bounty=b, summary="Test plan", approach="TDD", steps=[])
        assert p.summary == "Test plan"
        assert len(p.steps) == 0


class TestReviewerAgent:
    """Tests for ReviewerAgent."""

    def test_format_pr_body(self):
        b = Bounty(number=861, title="Test Bounty", body="Desc", repo="org/repo", labels=["bounty"], tier="T3", reward="1M $FNDRY")
        p = Plan(bounty=b, summary="Summary", approach="Approach", steps=[
            TaskStep(step=1, action="create", target="file.py", description="Create file"),
        ])
        r = ReviewResult(passed=True, issues=[], suggestions=[])
        agent = ReviewerAgent(token="fake")
        body = agent.format_pr_body(b, p, r, {"passed": True})
        assert "#861" in body
        assert "Test Bounty" in body
        assert "T3" in body