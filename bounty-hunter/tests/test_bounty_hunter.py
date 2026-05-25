"""Tests for bounty hunter components."""

import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from bounty_hunter.config import Config, EnvConfig
from bounty_hunter.discoverer import BountyDiscoverer, Bounty
from bounty_hunter.planner import Planner, SolutionPlan
from bounty_hunter.tester import Tester, TestResult
from bounty_hunter.submitter import Submitter


# ═══════════════════════════════════════════
# Config Tests
# ═══════════════════════════════════════════

class TestConfig:
    def test_env_config_defaults(self):
        config = EnvConfig()
        assert config.repo_owner == "SolFoundry"
        assert config.repo_name == "solfoundry"
        assert config.log_level == "INFO"

    def test_env_config_from_env(self):
        os.environ["REPO_OWNER"] = "TestOwner"
        config = EnvConfig.from_env()
        assert config.repo_owner == "TestOwner"
        assert "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" in config.wallet_address
        del os.environ["REPO_OWNER"]

    def test_config_defaults(self):
        config = Config()
        assert config.max_retries == 3
        assert config.pr_branch_prefix == "feat/bounty"


# ═══════════════════════════════════════════
# Discoverer Tests
# ═══════════════════════════════════════════

class TestBountyDiscoverer:
    def setup_method(self):
        self.discoverer = BountyDiscoverer("TestOwner", "TestRepo")

    def test_detect_tier(self):
        assert self.discoverer._detect_tier(["bounty", "tier-3"]) == "T3"
        assert self.discoverer._detect_tier(["bounty", "t3"]) == "T3"
        assert self.discoverer._detect_tier(["bounty", "tier-2"]) == "T2"
        assert self.discoverer._detect_tier(["bounty", "tier-1"]) == "T1"
        assert self.discoverer._detect_tier(["bug"]) == ""

    def test_extract_reward_with_pattern(self):
        body = "## Reward: 1M $FNDRY\nBuild an autonomous agent"
        assert "1M" in self.discoverer._extract_reward(body, "T3")

    def test_extract_reward_fallback(self):
        assert self.discoverer._extract_reward("", "T3") == "1M $FNDRY"
        assert self.discoverer._extract_reward("", "T2") == "700K $FNDRY"

    def test_bounty_dataclass(self):
        b = Bounty(number=861, title="Bounty Hunter", body="body", tier="T3", reward="1M $FNDRY", state="open")
        assert b.number == 861
        assert b.tier == "T3"

    @patch("subprocess.run")
    def test_get_bounty_api_success(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps({
                "number": 861,
                "title": "Full Autonomous Bounty-Hunting Agent",
                "state": "open",
                "labels": [{"name": "bounty"}, {"name": "tier-3"}],
                "body": "## Reward: 1M $FNDRY\nBuild an autonomous agent",
                "url": "https://github.com/SolFoundry/solfoundry/issues/861",
                "createdAt": "2026-05-01T00:00:00Z",
            }),
            stderr="",
        )
        bounty = self.discoverer.get_bounty(861)
        assert bounty is not None
        assert bounty.number == 861
        assert bounty.tier == "T3"

    @patch("subprocess.run")
    def test_get_bounty_api_failure(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="error")
        bounty = self.discoverer.get_bounty(861)
        assert bounty is None


# ═══════════════════════════════════════════
# Planner Tests
# ═══════════════════════════════════════════

class TestPlanner:
    def setup_method(self):
        self.planner = Planner()

    def test_analyze_bounty_returns_plan(self):
        body = """
## Description
Build a fully autonomous multi-agent system.

## Acceptance Criteria
- Multi-LLM agent orchestration with planning
- Automated solution implementation and testing
- Autonomous PR submission with proper formatting

## Reward: 1M $FNDRY
        """
        plan = self.planner.analyze_bounty(body)
        assert isinstance(plan, SolutionPlan)
        assert "Multi-LLM" in plan.description

    def test_analyze_bounty_empty_body(self):
        plan = self.planner.analyze_bounty("")
        assert isinstance(plan, SolutionPlan)

    def test_generate_task_list(self):
        plan = SolutionPlan(bounty_number=861, bounty_title="Test", description="AC here")
        tasks = self.planner.generate_task_list(plan)
        assert len(tasks) >= 5
        assert any("Closes" in t for t in tasks)


# ═══════════════════════════════════════════
# Tester Tests
# ═══════════════════════════════════════════

class TestTester:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.tester = Tester(self.tmpdir)

    def test_validate_pr_content_valid(self):
        body = """
Implements the bounty.
Closes #861
**Wallet:** 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
        """
        result = self.tester.validate_pr_content(body)
        assert result.passed

    def test_validate_pr_content_missing_closes(self):
        body = "Some description\n**Wallet:** abc123"
        result = self.tester.validate_pr_content(body)
        assert not result.passed
        assert any("Closes" in f for f in result.failures)

    def test_validate_pr_content_missing_wallet(self):
        body = "Some description\nCloses #861"
        result = self.tester.validate_pr_content(body)
        # Our validation checks for "**Wallet:**" or "Wallet:"
        assert not result.passed
        assert any("wallet" in f.lower() for f in result.failures)

    def test_test_result_dataclass(self):
        r = TestResult(passed=True, summary="All passed")
        assert r.passed
        assert r.summary == "All passed"

    def test_quality_check_no_issues(self):
        # Create a clean file
        clean_file = os.path.join(self.tmpdir, "clean.py")
        with open(clean_file, "w") as f:
            f.write("def hello():\n    return 'world'\n")
        result = self.tester.validate_code_quality(self.tmpdir)
        assert result.passed


# ═══════════════════════════════════════════
# Submitter Tests
# ═══════════════════════════════════════════

class TestSubmitter:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.submitter = Submitter(self.tmpdir, "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")

    def test_build_pr_body(self):
        body = self.submitter.build_pr_body(861, "Full Autonomous Bounty-Hunting Agent")
        assert "Closes #861" in body
        assert "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" in body
        assert "**Wallet:**" in body

    def test_build_pr_body_includes_key_sections(self):
        body = self.submitter.build_pr_body(861, "Bounty Hunter")
        assert "## Description" in body
        assert "## Type of Change" in body
        assert "## Checklist" in body
        assert "## Testing" in body


# ═══════════════════════════════════════════
# Integration — Full Pipeline Validation
# ═══════════════════════════════════════════

class TestIntegration:
    """Validate that the full pipeline modules connect correctly."""

    def test_modules_importable(self):
        from bounty_hunter import (
            Config, BountyDiscoverer, Planner,
            Implementer, Tester, Submitter, Orchestrator,
        )
        assert Config is not None
        assert Orchestrator is not None
        assert BountyDiscoverer is not None
        assert Tester is not None
        assert Submitter is not None

    def test_bounty_to_pr_flow_integration(self):
        """Mock the full flow: discover → plan → test → pr body."""
        from bounty_hunter import (
            BountyDiscoverer, Planner, Submitter, Tester,
        )
        discoverer = BountyDiscoverer()
        planner = Planner()
        submitter = Submitter("/tmp")
        tester = Tester("/tmp")

        # Simulate a discovered bounty
        bounty = Bounty(
            number=861,
            title="Full Autonomous Bounty-Hunting Agent",
            body="## Acceptance Criteria\nMulti-LLM orchestration, automated testing, PR submission\n## Reward: 1M $FNDRY",
            tier="T3",
            reward="1M $FNDRY",
            state="open",
        )

        # Plan
        plan = planner.analyze_bounty(bounty.body)
        assert plan is not None

        # Build PR
        pr_body = submitter.build_pr_body(bounty.number, bounty.title)
        assert "Closes #861" in pr_body
        assert "**Wallet:**" in pr_body

        # Validate PR
        result = tester.validate_pr_content(pr_body)
        assert result.passed, f"PR validation failed: {result.failures}"
