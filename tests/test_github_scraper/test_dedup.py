"""Tests for the IssueDeduplicator."""

from github_scraper.models.issue import ScrapedIssue
from github_scraper.utils.dedup import IssueDeduplicator


def make_issue(repo: str, number: int, title: str) -> ScrapedIssue:
    return ScrapedIssue(
        source_repo=repo,
        issue_number=number,
        title=title,
        body="test body",
        state="open",
    )


class TestIssueDeduplicator:
    def setup_method(self):
        self.dedup = IssueDeduplicator()

    def test_no_duplicates(self):
        issue1 = make_issue("owner/repo1", 1, "Fix bug A")
        issue2 = make_issue("owner/repo2", 2, "Fix bug B")
        assert not self.dedup.is_duplicate(issue1)
        assert not self.dedup.is_duplicate(issue2)

    def test_exact_key_duplicate(self):
        issue = make_issue("owner/repo", 42, "Fix bug")
        assert not self.dedup.is_duplicate(issue)
        self.dedup.mark_seen(issue)
        assert self.dedup.is_duplicate(issue)

    def test_same_title_different_repo(self):
        issue1 = make_issue("owner/repo1", 1, "Fix the critical security vulnerability")
        issue2 = make_issue("owner/repo2", 2, "Fix the critical security vulnerability")
        self.dedup.mark_seen(issue1)
        assert self.dedup.is_duplicate(issue2)

    def test_different_title_different_repo(self):
        issue1 = make_issue("owner/repo1", 1, "Fix login bug")
        issue2 = make_issue("owner/repo2", 2, "Add dark mode feature")
        self.dedup.mark_seen(issue1)
        assert not self.dedup.is_duplicate(issue2)

    def test_reset(self):
        issue = make_issue("owner/repo", 1, "Test issue")
        self.dedup.mark_seen(issue)
        assert self.dedup.is_duplicate(issue)
        self.dedup.reset()
        assert not self.dedup.is_duplicate(issue)
