"""Tests for ``automaton.discord_bot``.

These are pure-unit tests — they exercise the parsing / embed-building /
persistence / poller-orchestration logic without any real GitHub or Discord
network calls.  Use ``pytest tests/ -q`` to run them.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from automaton.discord_bot.embeds import build_embed, parse_bounty
from automaton.discord_bot.persistence import SeenState
from automaton.discord_bot.poller import Poller


# ------------------------------------------------------------------ fixtures
# ------------------------------------------------------------------
@pytest.fixture
def sample_issue() -> dict[str, Any]:
    return {
        "number": 853,
        "title": "Bounty T2: Discord Bot for Bounty Notifications",
        "html_url": "https://github.com/SolFoundry/solfoundry/issues/853",
        "state": "open",
        "body": (
            "## Bounty: Discord Bot for Bounty Notifications\n"
            "**Reward:** 500K $FNDRY | **Tier:** T2 | **Domain:** Integration\n"
            "Some description text.\n"
        ),
        "labels": [
            {"name": "bounty"},
            {"name": "tier-2"},
            {"name": "integration"},
        ],
        "assignees": [{"login": "dev-alice"}, {"login": "dev-bob"}],
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-02T12:00:00Z",
    }


@pytest.fixture
def missing_reward_issue() -> dict[str, Any]:
    return {
        "number": 123,
        "title": "Mystery bounty",
        "html_url": "https://github.com/SolFoundry/solfoundry/issues/123",
        "state": "open",
        "body": "Just a title, no reward line.",
        "labels": [{"name": "bounty"}],  # no tier / domain label
        "assignees": [],
        "created_at": "2026-03-01T00:00:00Z",
        "updated_at": "2026-03-01T00:00:00Z",
    }



# ------------------------------------------------------------------ parse_bounty
# ------------------------------------------------------------------
class TestParseBounty:
    def test_parses_standard_fields(self, sample_issue):
        result = parse_bounty(sample_issue)

        assert result["number"] == 853
        assert "Discord Bot" in result["title"]
        assert result["html_url"] == sample_issue["html_url"]
        assert result["state"] == "open"
        assert result["tier"] == "tier-2"
        assert result["domain"] == "Integration"
        assert result["assignees"] == ["dev-alice", "dev-bob"]

    def test_parses_reward_from_body(self, sample_issue):
        result = parse_bounty(sample_issue)
        assert result["reward"] == "500K $FNDRY"

    def test_returns_none_reward_when_missing(self, missing_reward_issue):
        result = parse_bounty(missing_reward_issue)
        assert result["reward"] is None

    def test_unknown_tier_returns_none(self):
        issue = {
            "number": 999,
            "title": "Plain issue",
            "html_url": "https://github.com/SolFoundry/solfoundry/issues/999",
            "state": "open",
            "body": "",
            "labels": [{"name": "bounty"}],
            "assignees": [],
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        result = parse_bounty(issue)
        assert result["tier"] is None
        assert result["domain"] is None


# ------------------------------------------------------------------ build_embed
# ------------------------------------------------------------------
class TestBuildEmbed:
    def _bounty(self, sample_issue) -> dict[str, Any]:
        return parse_bounty(sample_issue)

    def test_embed_has_title_and_url(self, sample_issue):
        embed = build_embed(self._bounty(sample_issue), action="new")

        assert embed["title"] == sample_issue["title"]
        assert embed["url"] == sample_issue["html_url"]
        assert "embed" not in embed["title"]

    def test_tier_2_uses_amber_colour(self, sample_issue):
        embed = build_embed(self._bounty(sample_issue), action="updated")

        assert embed["color"] == 0xFAA61A
        assert any(f["name"] == "Tier" and f["value"] == "T2 — Gated" for f in embed["fields"])

    def test_new_action_phrase(self, sample_issue):
        embed = build_embed(self._bounty(sample_issue), action="new")
        assert "New bounty posted" in embed["description"]

    def test_unknown_tier_defaults_to_grey(self, missing_reward_issue):
        embed = build_embed(self._bounty(missing_reward_issue), action="closed")
        assert embed["color"] == 0x808080

    def test_no_assignees_shows_open_for_grabs(self, missing_reward_issue):
        embed = build_embed(self._bounty(missing_reward_issue), action="new")
        assert any(
            f["name"] == "Assignees" and "open for grabs" in f["value"]
            for f in embed["fields"]
        )

    def test_embed_is_json_serialisable(self, sample_issue):
        embed = build_embed(self._bounty(sample_issue), action="new")
        # Must not raise — caller json.dumps()s the payload.
        json.dumps(embed)


# ------------------------------------------------------------------ SeenState
# ------------------------------------------------------------------
class TestSeenState:
    def test_empty_on_missing_file(self, tmp_path: Path):
        seen = SeenState(tmp_path / "nope.json")
        assert seen.size() == 0
        assert not seen.has_seen(1, "2026-01-01T00:00:00Z")

    def test_mark_and_check(self, tmp_path: Path):
        file = tmp_path / "seen.json"
        seen = SeenState(file)
        ts = "2026-06-01T00:00:00Z"

        seen.mark_seen(42, ts)
        assert seen.size() == 1
        assert seen.has_seen(42, ts)
        assert not seen.has_seen(42, "different-timestamp")
        # None means "ever recorded at all".
        assert seen.has_seen(42, None)
        assert not seen.has_seen(999, None)

    def test_clear_removes_file(self, tmp_path: Path):
        file = tmp_path / "seen.json"
        seen = SeenState(file)
        seen.mark_seen(1, "t")
        seen.clear()
        assert not file.exists()


# ------------------------------------------------------------------ Poller orchestration
# ------------------------------------------------------------------
class TestPollerOrchestration:
    @staticmethod
    def _fake_cfg() -> Any:
        cfg = type("Cfg", (), {})()
        cfg.discord_webhook_url = "https://discord.com/api/webhooks/FAKE"
        cfg.github_token = None
        cfg.solfoundry_repo = "SolFoundry/solfoundry"
        cfg.poll_interval = 300
        return cfg

    def test_tick_posts_for_new_issue(self, tmp_path: Path, sample_issue):
        sent: list[dict] = []

        def capture(**kw):
            sent.append(kw["embed"])

        issues_returned = [sample_issue]

        def fake_fetch(**kw):
            return issues_returned

        seen = SeenState(tmp_path / "seen.json")
        poller = Poller(self._fake_cfg(), seen, fetch_issues=fake_fetch, send_embed=capture)

        created, updated = poller.tick()
        assert created == 1
        assert updated == 0
        assert len(sent) == 1
        assert "New bounty posted" in sent[0]["description"]

        # Idempotent: tick again with same updated_at -> no notify.
        created, updated = poller.tick()
        assert created == 0
        assert updated == 0
        assert len(sent) == 1

    def test_tick_distinguishes_update_from_new(self, tmp_path: Path, sample_issue):
        sent: list[dict] = []

        def capture(**kw):
            sent.append(kw["embed"])

        seen = SeenState(tmp_path / "seen.json")
        seen.mark_seen(853, sample_issue["created_at"])  # seen before, at old time

        def fake_fetch(**kw):
            return [sample_issue]

        poller = Poller(self._fake_cfg(), seen, fetch_issues=fake_fetch, send_embed=capture)

        created, updated = poller.tick()
        assert created == 0
        assert updated == 1
        assert len(sent) == 1
        assert "Bounty updated" in sent[0]["description"]
