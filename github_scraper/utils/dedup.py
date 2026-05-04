"""Issue deduplication using similarity matching."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field

from github_scraper.models.issue import ScrapedIssue


@dataclass
class IssueDeduplicator:
    """Deduplicate scraped issues to avoid posting duplicates.

    Uses exact hash matching and optional title similarity.
    """
    seen_keys: set[str] = field(default_factory=set)
    seen_title_hashes: set[str] = field(default_factory=set)

    def _normalize_title(self, title: str) -> str:
        """Normalize a title for comparison."""
        title = title.lower().strip()
        title = re.sub(r"[^a-z0-9\s]", "", title)
        title = re.sub(r"\s+", " ", title)
        return title

    def _title_hash(self, title: str) -> str:
        """Hash a normalized title."""
        return hashlib.sha256(self._normalize_title(title).encode()).hexdigest()[:16]

    def is_duplicate(self, issue: ScrapedIssue) -> bool:
        """Check if an issue has already been seen."""
        # Exact key check (repo#number)
        if issue.unique_key in self.seen_keys:
            return True
        # Title hash check (same title, different repo)
        thash = self._title_hash(issue.title)
        if thash in self.seen_title_hashes:
            return True
        return False

    def mark_seen(self, issue: ScrapedIssue) -> None:
        """Mark an issue as seen."""
        self.seen_keys.add(issue.unique_key)
        self.seen_title_hashes.add(self._title_hash(issue.title))

    def reset(self) -> None:
        """Reset all seen markers."""
        self.seen_keys.clear()
        self.seen_title_hashes.clear()
