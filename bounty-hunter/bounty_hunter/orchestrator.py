"""Orchestrator — the main coordinator of the autonomous bounty pipeline."""

import logging
import sys
from typing import Optional

from .config import Config
from .discoverer import BountyDiscoverer, Bounty
from .planner import Planner, SolutionPlan
from .implementer import Implementer
from .tester import Tester
from .submitter import Submitter

log = logging.getLogger(__name__)


class Orchestrator:
    """Orchestrates the full autonomous bounty-hunting pipeline.

    Pipeline:
    1. Discover open bounties
    2. Select best target
    3. Analyze requirements → plan
    4. Implement solution
    5. Run tests
    6. Submit PR
    """

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
        self.discoverer = BountyDiscoverer(
            owner=self.config.env.repo_owner,
            repo=self.config.env.repo_name,
        )
        self.planner = Planner(
            llm_api_key=self.config.env.llm_api_key,
            llm_endpoint=self.config.env.llm_endpoint,
        )
        self.implementer = None  # set per-run
        self.tester = None
        self.submitter = None
        self.repo_path = self._find_repo_path()

    def _find_repo_path(self) -> str:
        """Find the repository root path."""
        import subprocess
        try:
            result = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                capture_output=True, text=True, timeout=5,
                cwd=__file__,
            )
            if result.returncode == 0:
                return result.stdout.strip()
        except Exception:
            pass
        return "."

    def run_full_pipeline(self, target_issue: Optional[int] = None) -> bool:
        """Run the complete autonomous pipeline."""
        log.info("=== Starting autonomous bounty pipeline ===")

        # Step 1: Discover
        if target_issue:
            bounty = self.discoverer.get_bounty(target_issue)
            bounties = [bounty] if bounty else []
        else:
            bounties = self._select_best_bounty()

        if not bounties:
            log.error("No suitable bounties found")
            return False

        bounty = bounties[0]
        log.info(f"Target: #{bounty.number} [{bounty.tier}] {bounty.title} ({bounty.reward})")

        # Step 2: Check claim status
        status = self.discoverer.check_claim_status(bounty.number)
        log.info(f"Claim status: {status}")
        if "claimed" in status:
            log.warning("Bounty already claimed, consider another target")

        # Step 3: Plan
        plan = self.planner.analyze_bounty(bounty.body)
        plan.bounty_number = bounty.number
        plan.bounty_title = bounty.title
        tasks = self.planner.generate_task_list(plan)
        log.info(f"Plan generated: {len(tasks)} tasks")

        # Step 4: Implement
        self.implementer = Implementer(self.repo_path)
        success = self.implementer.implement(plan)
        if not success:
            log.error("Implementation failed")
            return False

        # Step 5: Test
        self.tester = Tester(self.repo_path)
        test_result = self.tester.run_python_tests("bounty-hunter/tests/")
        if not test_result.passed:
            log.warning(f"Tests failed: {test_result.summary}")

        quality = self.tester.validate_code_quality("bounty-hunter/")
        if not quality.passed:
            log.warning(f"Quality issues: {quality.summary}")

        # Step 6: Submit PR
        branch = f"{self.config.env.repo_owner}/{bounty.number}"
        if self.config.pr_branch_prefix:
            branch = f"{self.config.pr_branch_prefix}-{bounty.number}"

        self.submitter = Submitter(self.repo_path, self.config.env.wallet_address)
        self.submitter.create_branch(branch)
        self.submitter.commit_changes(f"feat: implement bounty #{bounty.number} - {bounty.title[:60]}")
        self.submitter.push_branch(branch)

        pr_body = self.submitter.build_pr_body(bounty.number, bounty.title)
        pr_title = f"feat: {bounty.title[:80]} (Closes #{bounty.number})"

        repo_full = f"{self.config.env.repo_owner}/{self.config.env.repo_name}"
        pr_result = self.submitter.submit_pr(branch, pr_title, pr_body, repo_full)

        if pr_result:
            log.info(f"=== Pipeline complete! PR submitted for #{bounty.number} ===")
            return True
        else:
            log.error("PR submission failed")
            return False

    def run_discover_only(self) -> list[Bounty]:
        """Discover and display available bounties without running the full pipeline."""
        bounties = self.discoverer.list_bounties(state="open")
        for b in bounties:
            status = self.discoverer.check_claim_status(b.number)
            log.info(f"#{b.number} [{b.tier}] {b.title} — {b.reward} — {status}")
        return bounties

    def _select_best_bounty(self) -> list[Bounty]:
        """Select the best bounty to work on based on tier and availability."""
        bounties = self.discoverer.list_bounties(state="open")
        if not bounties:
            return []

        # Score: higher tier + not claimed = best
        tier_score = {"T3": 30, "T2": 20, "T1": 10}
        scored = []
        for b in bounties:
            status = self.discoverer.check_claim_status(b.number)
            if "claimed" in status:
                continue
            score = tier_score.get(b.tier, 0)
            scored.append((score, b))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [b for _, b in scored[:3]]  # top 3
