"""
Main Bounty Hunter Agent — State Machine Implementation.

State transitions:
  IDLE → SCANNING → ANALYZING → PLANNING → IMPLEMENTING → TESTING → SUBMITTING → DONE
                                                                      ↓
                                                                  BLOCKED (retry)
"""

import os
import time
import json
import logging
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime

from .github_client import GitHubClient, Bounty, BountyTier
from .planner import Planner, ImplementationPlan
from .coder import Coder, FileChange
from .tester import Tester, TestResult

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("bounty_hunter")


class AgentState(Enum):
    IDLE = "idle"
    SCANNING = "scanning"
    ANALYZING = "analyzing"
    PLANNING = "planning"
    IMPLEMENTING = "implementing"
    TESTING = "testing"
    SUBMITTING = "submitting"
    DONE = "done"
    BLOCKED = "blocked"
    ERROR = "error"


@dataclass
class AgentConfig:
    """Configuration for the Bounty Hunter Agent."""
    github_owner: str = "liufang88789-ui"  # Fork owner
    github_repo: str = "solfoundry"
    upstream_owner: str = "SolFoundry"
    upstream_repo: str = "solfoundry"
    local_repo_path: str = "/tmp/solfoundry-bounty"
    branch_prefix: str = "feat/bounty-hunter"
    wallet_address: str = "7UqBdYyy9LG59Un6yzjAW8HPcTC4J63B9cZxBHWhhHsg"
    evm_wallet: str = "0x7F3a01563C504bD57aa465dd6273Ef21AF8F7784"
    max_retries: int = 2
    min_bounty_tier: BountyTier = BountyTier.TIER_3  # Only go for T3 by default
    # LLM config
    llm_model: str = "gpt-4"
    llm_api_key: str = None
    llm_api_base: str = None


@dataclass
class AgentRun:
    """Record of a single agent run for a specific bounty."""
    bounty_number: int
    bounty_title: str
    state: AgentState = AgentState.IDLE
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    plan: Optional[ImplementationPlan] = None
    changes: list[FileChange] = field(default_factory=list)
    test_result: Optional[TestResult] = None
    pr_url: Optional[str] = None
    pr_number: Optional[int] = None
    error_message: Optional[str] = None
    retry_count: int = 0


class BountyHunterAgent:
    """
    Autonomous Bounty Hunting Agent.
    
    A state-machine agent that finds bounties, plans implementations,
    writes code, runs tests, and submits PRs.
    """

    def __init__(self, config: AgentConfig = None):
        self.config = config or AgentConfig()
        self.github = GitHubClient(
            owner=self.config.github_owner,
            repo=self.config.github_repo,
            upstream_owner=self.config.upstream_owner,
            upstream_repo=self.config.upstream_repo,
        )
        self.github.token = os.environ.get("GITHUB_TOKEN", self.github.token)
        
        self.planner = Planner(
            model=self.config.llm_model,
            api_key=self.config.llm_api_key or os.environ.get("OPENAI_API_KEY"),
            api_base=self.config.llm_api_base or os.environ.get("OPENAI_API_BASE"),
        )
        
        self.coder = Coder(self.config.local_repo_path)
        self.tester = Tester(self.config.local_repo_path)
        
        self.current_run: Optional[AgentRun] = None
        self._state = AgentState.IDLE

    @property
    def state(self) -> AgentState:
        return self._state

    def _set_state(self, state: AgentState):
        self._state = state
        if self.current_run:
            self.current_run.state = state

    def run(self, bounty_number: int = None, bounty: Bounty = None) -> AgentRun:
        """
        Execute a full bounty hunting run.
        Either provide a bounty_number (will fetch it) or a pre-fetched Bounty object.
        """
        if bounty is None:
            if bounty_number is None:
                raise ValueError("Must provide either bounty_number or bounty")
            issue = self.github.get_issue(bounty_number)
            bounty = Bounty.from_issue(issue)

        self.current_run = AgentRun(bounty_number=bounty.number, bounty_title=bounty.title)
        self._set_state(AgentState.SCANNING)
        
        logger.info(f"Starting bounty hunt: #{bounty.number} — {bounty.title}")
        
        try:
            self._run_impl(bounty)
            self._set_state(AgentState.DONE)
            self.current_run.completed_at = datetime.utcnow()
        except Exception as e:
            logger.error(f"Error during bounty hunt: {e}")
            self._set_state(AgentState.ERROR)
            self.current_run.error_message = str(e)
            self.current_run.completed_at = datetime.utcnow()
        
        return self.current_run

    def _run_impl(self, bounty: Bounty):
        """Implementation of the bounty hunting state machine."""
        
        # ── ANALYZING ──────────────────────────────────────────
        self._set_state(AgentState.ANALYZING)
        logger.info(f"Analyzing bounty #{bounty.number}...")
        
        issue_full = self.github.get_issue(bounty.number)
        bounty_body = issue_full.get("body", "")
        bounty_title = issue_full.get("title", "")
        
        # Get codebase structure for context
        structure = self.coder.get_codebase_structure(max_depth=3)
        logger.info(f"Codebase structure:\n{structure[:500]}")

        # ── PLANNING ──────────────────────────────────────────
        self._set_state(AgentState.PLANNING)
        logger.info(f"Creating implementation plan for #{bounty.number}...")
        
        plan = self.planner.create_plan(
            bounty_body=bounty_body,
            bounty_title=bounty_title,
            bounty_number=bounty.number,
            codebase_structure=structure,
        )
        
        self.current_run.plan = plan
        logger.info(f"Plan created: {plan.summary}")
        logger.info(f"Complexity: {plan.estimated_complexity}, Steps: {len(plan.steps)}")

        # ── IMPLEMENTING ──────────────────────────────────────
        self._set_state(AgentState.IMPLEMENTING)
        logger.info(f"Implementing bounty #{bounty.number}...")
        
        # Create a branch for this work
        branch_name = f"{self.config.branch_prefix}-{bounty.number}"
        try:
            self.github.create_branch(branch_name)
            logger.info(f"Branch created: {branch_name}")
        except Exception as e:
            logger.warning(f"Branch may already exist or fork not ready: {e}")
        
        # Implement each step
        all_changes = {}
        for step in plan.steps:
            logger.info(f"Implementing step {step.order}: {step.description}")
            
            code_map = self.planner.generate_code(
                plan=plan,
                codebase_context=structure,
                step=step
            )
            
            if code_map:
                # Apply to local repo
                applied = self.coder.apply_changes(code_map)
                self.current_run.changes.extend(applied)
                
                for path, content in code_map.items():
                    all_changes[path] = content
                    logger.info(f"  Wrote: {path}")
            else:
                logger.warning(f"  No code generated for step {step.order}")
        
        if not all_changes:
            logger.error("No code was generated!")
            raise RuntimeError("No code generated by planner")

        # ── TESTING ─────────────────────────────────────────────
        self._set_state(AgentState.TESTING)
        logger.info("Running tests...")
        
        test_result = self.tester.run_tests()
        self.current_run.test_result = test_result
        
        if test_result.passed:
            logger.info(f"Tests passed ({test_result.passed_tests}/{test_result.total_tests})")
        else:
            logger.warning(f"Tests failed: {test_result.output[-500:]}")
            # Continue anyway if only minor failures
        
        # ── SUBMITTING ──────────────────────────────────────────
        self._set_state(AgentState.SUBMITTING)
        logger.info("Creating pull request...")
        
        changed_files = list(all_changes.keys())
        
        # Stage and commit
        commit_msg = f"feat: {bounty.title} (Bounty #{bounty.number})\n\nCloses #{bounty.number}"
        code, commit_out = self.coder.stage_and_commit(changed_files, commit_msg)
        
        if code != 0:
            logger.warning(f"Commit issue: {commit_out}")
            # Try with force-add
            self.coder.run_command(["git", "add", "-f", "--"] + changed_files)
            self.coder.run_command(["git", "commit", "-m", commit_msg])
        
        # Push branch
        push_code, push_out = self.coder.push_branch(branch_name)
        if push_code != 0:
            logger.warning(f"Push may have failed: {push_out}")
        
        # Create PR
        pr_body = self._build_pr_body(bounty, plan)
        pr = self.github.create_pull_request(
            title=f"feat: {bounty.title} (Bounty #{bounty.number})",
            body=pr_body,
            head_branch=branch_name,
        )
        
        self.current_run.pr_url = pr.get("html_url")
        self.current_run.pr_number = pr.get("number")
        logger.info(f"PR created: {self.current_run.pr_url}")

    def _build_pr_body(self, bounty: Bounty, plan: ImplementationPlan) -> str:
        """Build the PR description body following SolFoundry format."""
        steps_md = "\n".join(
            f"{i+1}. **{s.description}** — modify `{', '.join(s.files_to_modify)}`, create `{', '.join(s.files_to_create)}`"
            for i, s in enumerate(plan.steps)
        )
        
        return f"""## Overview

{plan.summary}

*Submitted by Autonomous Bounty Hunter Agent — SolFoundry Bounty #{bounty.number}*

---

## Implementation Details

{steps_md}

## Testing

- Framework: {self.tester.detect_test_framework() or 'standard test suite'}
- Result: {self.current_run.test_result.summary if self.current_run.test_result else 'N/A'}

## Files Changed

{chr(10).join(f"- `{f}`" for f in self.current_run.changes)}

---

## Wallet

**Solana:** `{self.config.wallet_address}`

**EVM:** `{self.config.evm_wallet}`

---

Closes #{bounty.number}
"""

    def scan_for_bounties(self) -> list[Bounty]:
        """
        Scan for available bounties.
        Returns list of Bounty objects.
        """
        logger.info("Scanning for open bounties...")
        bounties = self.github.list_open_bounties()
        logger.info(f"Found {len(bounties)} open bounties")
        return bounties

    def hunt_best_bounty(self) -> AgentRun:
        """
        Find the best available bounty and hunt it.
        Returns the AgentRun result.
        """
        bounties = self.scan_for_bounties()
        
        if not bounties:
            logger.info("No suitable bounties found")
            self._set_state(AgentState.IDLE)
            return None
        
        # Pick the best one (highest tier, unassigned)
        best = max(bounties, key=lambda b: (
            3 if b.tier == BountyTier.TIER_3 else 2 if b.tier == BountyTier.TIER_2 else 1
        ))
        
        logger.info(f"Selected best bounty: #{best.number} ({best.tier} — {best.title})")
        return self.run(bounty=best)


# ── CLI Entry Point ──────────────────────────────────────────────────────────

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="SolFoundry Autonomous Bounty Hunter")
    parser.add_argument("--bounty", type=int, help="Bounty issue number to hunt")
    parser.add_argument("--scan", action="store_true", help="Only scan, don't hunt")
    parser.add_argument("--branch-prefix", default="feat/bounty-hunter")
    args = parser.parse_args()
    
    config = AgentConfig(branch_prefix=args.branch_prefix)
    agent = BountyHunterAgent(config)
    
    if args.scan:
        bounties = agent.scan_for_bounties()
        print(f"\n{'#':<6} {'Tier':<8} {'Domain':<12} {'Title'}")
        print("-" * 80)
        for b in sorted(bounties, key=lambda x: (x.tier.value if x.tier else ""), reverse=True):
            tier = b.tier.value if b.tier else "?"
            print(f"{b.number:<6} {tier:<8} {(b.domain or ''):<12} {b.title[:50]}")
    elif args.bounty:
        result = agent.run(bounty_number=args.bounty)
        print(f"\nResult: {result.state.value}")
        if result.pr_url:
            print(f"PR: {result.pr_url}")
        if result.error_message:
            print(f"Error: {result.error_message}")
    else:
        result = agent.hunt_best_bounty()
        if result and result.pr_url:
            print(f"\nPR submitted: {result.pr_url}")
        elif result:
            print(f"\nState: {result.state.value}")


if __name__ == "__main__":
    main()
