"""Thin wrapper around the GitHub Issues REST API.

Fetches issues for a repository that carry the ``bounty`` label.  Supports
optional bearer-token authentication so we stay within the unauthenticated
rate limit when a token is provided.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import requests

log = logging.getLogger(__name__)


def fetch_bounty_issues(
    repo: str,
    token: Optional[str] = None,
    state: str = "open",
    per_page: int = 100,
) -> list[dict[str, Any]]:
    """Fetch all issues in *repo* that have the ``bounty`` label.

    The GitHub search API is used because the list endpoint cannot filter by
    multiple labels reliably and search returns paginated results easily.

    Args:
        repo: ``owner/repo`` string, e.g. ``SolFoundry/solfoundry``.
        token: Optional bearer token (raises ``RuntimeError`` on missing token
            only if you intend to authenticate).
        state: ``open`` or ``closed``.
        per_page: Items per page (max 100).

    Returns:
        A flat list of issue dicts, newest first.
    """
    url = "https://api.github.com/search/issues"
    headers: dict[str, str] = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "solfoundry-discord-bot/0.1",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    params: dict[str, str] = {
        "q": f"repo:{repo} label:bounty is:issue state:{state}",
        "sort": "created",
        "order": "desc",
        "per_page": str(per_page),
    }

    issues: list[dict[str, Any]] = []
    page = 1
    while url:
        log.debug("Fetching issues page %d", page)
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        data = resp.json()

        # The search API returns results under ``items``.
        page_items = data.get("items", [])
        issues.extend(page_items)
        total_count = data.get("total_count", 0)
        log.info(
            "GitHub returned %d item(s) (of %d total) on page %d",
            len(page_items),
            total_count,
            page,
        )

        # Move to next page via the Link header.
        link = resp.headers.get("Link", "")
        url = _next_page_url(link)
        page += 1
        if not page_items or len(issues) >= total_count:
            break

    return issues


def _next_page_url(link_header: str) -> Optional[str]:
    """Return the next page URL from a GitHub ``Link`` header, or ``None``."""
    if not link_header:
        return None
    for part in link_header.split(","):
        part = part.strip()
        if 'rel="next"' in part:
            start = part.index("<") + 1
            end = part.index(">")
            return part[start:end]
    return None
