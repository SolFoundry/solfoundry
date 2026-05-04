from typing import Optional
"""Tests for the TierClassifier."""

from github_scraper.models.issue import BountyTier, ScrapedIssue
from github_scraper.utils.tier_classifier import TierClassifier
from datetime import datetime, timezone


def make_issue(title: str, labels: Optional[list[str]] = None, body: str = "") -> ScrapedIssue:
    return ScrapedIssue(
        source_repo="test/repo",
        issue_number=1,
        title=title,
        body=body,
        state="open",
        labels=labels or [],
    )


class TestTierClassifier:
    def setup_method(self):
        self.classifier = TierClassifier()

    def test_explicit_t0_label(self):
        issue = make_issue("Fix bug", labels=["T0"])
        assert self.classifier.classify(issue) == BountyTier.T0_CRITICAL

    def test_explicit_t1_label(self):
        issue = make_issue("Add feature", labels=["T1"])
        assert self.classifier.classify(issue) == BountyTier.T1_MAJOR

    def test_security_label(self):
        issue = make_issue("Fix issue", labels=["security"])
        assert self.classifier.classify(issue) == BountyTier.T0_CRITICAL

    def test_bug_label(self):
        issue = make_issue("Fix crash", labels=["bug"])
        assert self.classifier.classify(issue) == BountyTier.T2_STANDARD

    def test_good_first_issue(self):
        issue = make_issue("Update README", labels=["good first issue"])
        assert self.classifier.classify(issue) == BountyTier.T4_MICRO

    def test_critical_keyword_in_title(self):
        issue = make_issue("CRITICAL: Security vulnerability in auth")
        assert self.classifier.classify(issue) == BountyTier.T0_CRITICAL

    def test_major_keyword_in_body(self):
        issue = make_issue("Refactor needed", body="This requires a complete rewrite of the module")
        assert self.classifier.classify(issue) == BountyTier.T1_MAJOR

    def test_standard_keyword(self):
        issue = make_issue("Implement new feature for dashboard")
        assert self.classifier.classify(issue) == BountyTier.T2_STANDARD

    def test_default_tier(self):
        issue = make_issue("Random issue with no keywords")
        assert self.classifier.classify(issue) == BountyTier.T3_MINOR

    def test_get_reward(self):
        assert "1M" in self.classifier.get_reward(BountyTier.T0_CRITICAL)
        assert "500K" in self.classifier.get_reward(BountyTier.T1_MAJOR)
        assert "100K" in self.classifier.get_reward(BountyTier.T2_STANDARD)

    def test_priority_label_over_keyword(self):
        """Explicit labels take priority over keywords."""
        issue = make_issue("Fix typo", labels=["T0"])
        # Label T0 should win, even though title has no critical keywords
        assert self.classifier.classify(issue) == BountyTier.T0_CRITICAL
