"""Persistent record of the last-seen state for each bounty issue.

Stores a simple JSON file mapping ``issue_number`` -> last ``updated_at``
ISO timestamp.  This is what makes the poller idempotent: on restart it
re-reads the file and skips anything it has already notified on.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

log = logging.getLogger(__name__)


class SeenState:
    """Thread-unsafe (sufficient for a single-threaded poller) seen-file cache."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def has_seen(self, issue_number: int, updated_at: Optional[str]) -> bool:
        """Return ``True`` if *issue_number* was last seen at *updated_at*.

        When *updated_at* is ``None``, this checks whether the issue has ever
        been recorded at all (i.e. is the key present in the file).
        """
        last = self._load()
        if updated_at is None:
            return issue_number in last
        return last.get(issue_number) == updated_at

    def mark_seen(self, issue_number: int, updated_at: Optional[str]) -> None:
        """Record that *issue_number* was seen at *updated_at*."""
        last = self._load()
        last[issue_number] = updated_at
        self._save(last)

    def clear(self) -> None:
        """Remove the seen-file entirely."""
        if self.path.exists():
            self.path.unlink()
            log.info("Cleared seen file %s", self.path)

    def size(self) -> int:
        """Return the number of seen issues."""
        return len(self._load())

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _load(self) -> dict[int, Any]:
        if not self.path.exists():
            return {}
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                raw = json.load(fh)
            return {int(k): v for k, v in raw.items()}
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("Failed to load seen file %s (%s); starting fresh", self.path, exc)
            return {}

    def _save(self, data: dict[int, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, sort_keys=True)
        log.debug("Saved seen file %s (%d entries)", self.path, len(data))
