#!/usr/bin/env python3
"""Tests for SolFoundry Post Bounty action (post-bounty.py)."""
import os
import runpy
import json
import pytest

ACTION = os.path.join(os.path.dirname(__file__), "post-bounty.py")

BASE = {
    "SOLFOUNDRY_DRY_RUN": "true",
    "SOLFOUNDRY_GH_TOKEN": "",
    "SOLFOUNDRY_AUTO_SYNC_LABEL": "false",
    "SOLFOUNDRY_TOKEN": "",
    "SOLFOUNDRY_API_URL": "https://solfoundry.dev",
    "SOLFOUNDRY_BOUNTY_LABELS": "bounty,tier-1,tier-2,tier-3",
    "SOLFOUNDRY_DEFAULT_REWARD_AMOUNT": "1000",
    "SOLFOUNDRY_DEFAULT_REWARD_TOKEN": "FNDRY",
    "SOLFOUNDRY_DEFAULT_TIER": "T1",
    "SOLFOUNDRY_REQUIRE_TIER_LABEL": "false",
    "SOLFOUNDRY_LABEL_SKIP": "solfoundry-synced",
    "SOLFOUNDRY_ISSUE_NUMBER": "1",
    "SOLFOUNDRY_REPO": "owner/repo",
    "SOLFOUNDRY_ISSUE_URL": "https://github.com/owner/repo/issues/1",
}


def _env(overrides):
    os.environ.clear()
    os.environ.update(BASE)
    os.environ.update(overrides)


def _run(overrides):
    _env(overrides)
    runpy.run_path(ACTION, run_name="__main__")


def _capture(overrides):
    import io, sys
    _env(overrides)
    out = io.StringIO()
    orig = sys.stdout
    sys.stdout = out
    try:
        runpy.run_path(ACTION, run_name="__main__")
    finally:
        sys.stdout = orig
    return out.getvalue()


class TestSkips:
    def test_no_bounty_label(self, capsys):
        _run({"SOLFOUNDRY_ISSUE_LABELS": "help-wanted,tier-1",
              "SOLFOUNDRY_ISSUE_TITLE": "X", "SOLFOUNDRY_ISSUE_BODY": "hi"})
        assert "no 'bounty' label" in capsys.readouterr().out

    def test_synced_label(self, capsys):
        _run({"SOLFOUNDRY_ISSUE_LABELS": "bounty,tier-2,solfoundry-synced",
              "SOLFOUNDRY_ISSUE_TITLE": "X", "SOLFOUNDRY_ISSUE_BODY": "hi"})
        assert "solfoundry-synced label" in capsys.readouterr().out

    def test_require_tier_missing(self, capsys):
        _run({"SOLFOUNDRY_REQUIRE_TIER_LABEL": "true",
              "SOLFOUNDRY_ISSUE_LABELS": "bounty",
              "SOLFOUNDRY_ISSUE_TITLE": "X", "SOLFOUNDRY_ISSUE_BODY": "hi"})
        assert "no tier-* label" in capsys.readouterr().out


class TestParse:
    def test_500k_fndry(self, capsys):
        _run({"SOLFOUNDRY_ISSUE_LABELS": "bounty,tier-2",
              "SOLFOUNDRY_ISSUE_TITLE": "X",
              "SOLFOUNDRY_ISSUE_BODY": "**Reward:** 500K $FNDRY"})
        out = capsys.readouterr().out
        assert "reward=500000" in out

    def test_usd_token(self, capsys):
        _run({"SOLFOUNDRY_ISSUE_LABELS": "bounty,tier-1",
              "SOLFOUNDRY_ISSUE_TITLE": "X",
              "SOLFOUNDRY_ISSUE_BODY": "**Reward:** 2000 USDC"})
        out = capsys.readouterr().out
        assert "reward=2000" in out and "USDC" in out

    def test_default_reward(self, capsys):
        _run({"SOLFOUNDRY_ISSUE_LABELS": "bounty",
              "SOLFOUNDRY_ISSUE_TITLE": "X",
              "SOLFOUNDRY_ISSUE_BODY": "just text"})
        out = capsys.readouterr().out
        assert "reward=1000" in out

    def test_tier_mapping(self, capsys):
        _run({"SOLFOUNDRY_ISSUE_LABELS": "bounty,tier-3",
              "SOLFOUNDRY_ISSUE_TITLE": "X", "SOLFOUNDRY_ISSUE_BODY": "hi"})
        out = capsys.readouterr().out
        assert "tier=T3" in out


class TestPayload:
    def test_payload_shape(self):
        text = _capture({"SOLFOUNDRY_ISSUE_LABELS": "bounty,tier-2",
                         "SOLFOUNDRY_ISSUE_TITLE": "My Feature",
                         "SOLFOUNDRY_ISSUE_BODY": "build it"})
        payload_block = text.split("::group::Payload to SolFoundry")[-1].split("::endgroup::")[0]
        p = json.loads("".join(l for l in payload_block.splitlines() if l.strip()))
        assert p["title"] == "My Feature"
        assert p["tier"] == "T2"
        assert "github_repo_url" in p
        assert "github_issue_url" in p
