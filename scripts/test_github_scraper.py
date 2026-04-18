#!/usr/bin/env python3
"""Tests for GitHub Issue Scraper."""

import json
import sys
from pathlib import Path
import importlib.util

SCRIPT_DIR = Path(__file__).resolve().parent

# Import from hyphenated filename
spec = importlib.util.spec_from_file_location("github_scraper", SCRIPT_DIR / "github-scraper.py")
scraper_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scraper_mod)

ScraperConfig = scraper_mod.ScraperConfig
GitHubIssue = scraper_mod.GitHubIssue
BountySpec = scraper_mod.BountySpec
IssueToBountyConverter = scraper_mod.IssueToBountyConverter
verify_webhook_signature = scraper_mod.verify_webhook_signature


def test_github_issue_id():
    """Test GitHubIssue.id property."""
    issue = GitHubIssue(
        number=123,
        title="Test issue",
        body="Description",
        repo="owner/repo",
        url="https://github.com/owner/repo/issues/123",
    )
    assert issue.id == "owner/repo#123"
    print("  [PASS] test_github_issue_id")


def test_converter_tier_estimation():
    """Test tier estimation logic."""
    converter = IssueToBountyConverter()

    # Simple bug → T1
    issue1 = GitHubIssue(
        number=1, title="Fix typo", body="Short", repo="r", url="u",
        labels=["bug"], comments=0,
    )
    assert converter.estimate_tier(issue1) == 1

    # Complex AI feature → T3
    issue2 = GitHubIssue(
        number=2, title="Build AI agent", body="A" * 1500, repo="r", url="u",
        labels=["agent", "ai", "feature"], comments=15,
    )
    assert converter.estimate_tier(issue2) == 3

    # Medium enhancement → T2
    issue3 = GitHubIssue(
        number=3, title="Add dashboard", body="B" * 600, repo="r", url="u",
        labels=["enhancement"], comments=5,
    )
    assert converter.estimate_tier(issue3) == 2

    print("  [PASS] test_converter_tier_estimation")


def test_converter_category_detection():
    """Test category detection."""
    converter = IssueToBountyConverter()

    tests = [
        (GitHubIssue(1, "Fix UI", "", "r", "u", ["ui"]), "frontend"),
        (GitHubIssue(2, "API endpoint", "", "r", "u", ["backend"]), "backend"),
        (GitHubIssue(3, "ML model", "", "r", "u", ["ai"]), "ai"),
        (GitHubIssue(4, "Docs update", "", "r", "u", ["documentation"]), "docs"),
        (GitHubIssue(5, "Random task", "", "r", "u", []), "general"),
    ]

    for issue, expected in tests:
        result = converter.detect_category(issue)
        assert result == expected, f"Expected {expected}, got {result}"

    print("  [PASS] test_converter_category_detection")


def test_converter_skill_detection():
    """Test skill detection."""
    converter = IssueToBountyConverter()

    issue = GitHubIssue(
        number=1,
        title="Build Python FastAPI backend with PostgreSQL",
        body="Need to implement REST API using Python and FastAPI with a PostgreSQL database",
        repo="r", url="u",
    )
    skills = converter.detect_skills(issue)
    assert "python" in skills
    assert "database" in skills

    print("  [PASS] test_converter_skill_detection")


def test_converter_full_conversion():
    """Test full issue to bounty conversion."""
    converter = IssueToBountyConverter()

    issue = GitHubIssue(
        number=42,
        title="Add user authentication",
        body="We need OAuth2 support for GitHub login",
        repo="org/repo",
        url="https://github.com/org/repo/issues/42",
        labels=["feature", "backend"],
        author="dev1",
        created_at="2024-01-01T00:00:00Z",
        comments=3,
    )

    bounty = converter.convert(issue)
    assert bounty.title == "[GitHub] Add user authentication"
    assert bounty.tier >= 1
    assert bounty.reward > 0
    assert bounty.github_issue_url == issue.url
    assert "github-scraper" in bounty.created_by
    assert "## Original Issue" in bounty.description

    print("  [PASS] test_converter_full_conversion")


def test_bounty_spec_yaml():
    """Test YAML generation."""
    bounty = BountySpec(
        title="Test bounty",
        description="Description",
        tier=1,
        reward=100000,
        category="feature",
        skills=["python"],
        github_issue_url="https://example.com",
    )
    yaml_str = bounty.to_yaml()
    assert "Test bounty" in yaml_str
    assert "100000" in yaml_str
    assert "python" in yaml_str

    print("  [PASS] test_bounty_spec_yaml")


def test_scraper_config():
    """Test config serialization."""
    config = ScraperConfig(
        repos=["owner/repo1", "owner/repo2"],
        labels_filter=["bug", "feature"],
        min_reward_tier=2,
    )

    # Save and load
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
        config.to_yaml(f.name)
        loaded = ScraperConfig.from_yaml(f.name)

    assert loaded.repos == config.repos
    assert loaded.labels_filter == config.labels_filter
    assert loaded.min_reward_tier == config.min_reward_tier

    print("  [PASS] test_scraper_config")


def test_webhook_signature_verification():
    """Test webhook signature verification."""
    import hmac
    import hashlib

    secret = "test-secret"
    payload = b'{"action": "opened"}'

    # Valid signature
    valid_sig = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    assert verify_webhook_signature(payload, valid_sig, secret) == True

    # Invalid signature
    assert verify_webhook_signature(payload, "sha256=invalid", secret) == False

    # No secret → skip verification
    assert verify_webhook_signature(payload, "", "") == True

    print("  [PASS] test_webhook_signature_verification")


def test_reward_estimation():
    """Test reward estimation."""
    converter = IssueToBountyConverter()

    assert converter.estimate_reward(1) == 100000
    assert converter.estimate_reward(2) == 450000
    assert converter.estimate_reward(3) == 800000
    assert converter.estimate_reward(99) == 100000  # default

    print("  [PASS] test_reward_estimation")


def run_all_tests():
    """Run all tests."""
    print("Running GitHub Issue Scraper tests...\n")

    tests = [
        test_github_issue_id,
        test_converter_tier_estimation,
        test_converter_category_detection,
        test_converter_skill_detection,
        test_converter_full_conversion,
        test_bounty_spec_yaml,
        test_scraper_config,
        test_webhook_signature_verification,
        test_reward_estimation,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {test.__name__}: {e}")
            failed += 1

    print(f"\nResults: {passed} passed, {failed} failed, {passed + failed} total")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
