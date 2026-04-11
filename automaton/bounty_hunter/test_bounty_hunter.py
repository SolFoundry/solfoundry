from automaton.bounty_hunter.github_client import Bounty, BountyTier
from automaton.bounty_hunter.planner import Planner
from automaton.bounty_hunter.tester import Tester


def test_bounty_from_issue_parses_tier_and_reward():
    issue = {
        "number": 861,
        "title": "🏭 Bounty T3: Full Autonomous Bounty-Hunting Agent",
        "body": "**Reward:** 1M $FNDRY | **Tier:** T3 | **Domain:** Agent",
        "labels": [
            {"name": "bounty"},
            {"name": "tier-3"},
            {"name": "agent"},
        ],
        "state": "open",
        "assignee": None,
    }

    bounty = Bounty.from_issue(issue)

    assert bounty.number == 861
    assert bounty.tier == BountyTier.TIER_3
    assert bounty.domain == "agent"
    assert bounty.state == "open"
    assert bounty.assignee is None
    assert bounty.reward is not None


def test_planner_fallback_returns_valid_plan():
    planner = Planner(api_key="")

    plan = planner.create_plan(
        bounty_body="Build a bot that scans bounties and opens PRs.",
        bounty_title="Autonomous bounty hunter",
        bounty_number=861,
        codebase_structure="automaton/\n  README.md",
    )

    assert plan.bounty_number == 861
    assert plan.title == "Autonomous bounty hunter"
    assert plan.summary
    assert len(plan.steps) >= 1
    assert plan.estimated_complexity in {"low", "medium", "high"}


def test_tester_detects_pytest_for_repo():
    tester = Tester(".")
    framework = tester.detect_test_framework()
    assert framework == "pytest"
