"""Core orchestration engine — coordinates all agents in the bounty pipeline."""
import asyncio
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from app.agents.discovery import DiscoveryAgent, Bounty
from app.agents.planner import PlannerAgent, Plan
from app.agents.implementer import ImplementerAgent
from app.agents.reviewer import ReviewerAgent, ReviewResult
from app.config import config


class BountyOrchestrator:
    """Main orchestrator that coordinates Discovery → Planning → Implementation → Review → PR."""

    def __init__(self):
        self.discovery = DiscoveryAgent()
        self.planner = PlannerAgent()
        self.implementer = ImplementerAgent()
        self.reviewer = ReviewerAgent()
        self.log: list[dict] = []

    def _log(self, event: str, data: dict | None = None):
        """Log an event."""
        entry = {"timestamp": datetime.now(timezone.utc).isoformat(), "event": event, **(data or {})}
        self.log.append(entry)
        print(f"[{entry['timestamp'][:19]}] {event}: {json.dumps(data or {}, default=str)[:200]}")

    async def run_once(self, bounty_number: int | None = None) -> list[dict]:
        """Run one complete cycle: discover → plan → implement → review → submit."""
        results = []

        # Step 1: Discover bounties
        self._log("discovery_start", {"target_repos": config.TARGET_REPOS})
        if bounty_number:
            # Fetch specific bounty
            bounties = []
            for repo in config.TARGET_REPOS:
                try:
                    all_b = await self.discovery.scan_repo(repo)
                    bounties.extend(b for b in all_b if b.number == bounty_number)
                except Exception as e:
                    self._log("discovery_error", {"repo": repo, "error": str(e)})
        else:
            bounties = await self.discovery.scan_all()

        # Filter claimable bounties
        claimable = [b for b in bounties if b.is_claimable][: config.MAX_BOUNTIES]
        self._log("discovery_complete", {"found": len(bounties), "claimable": len(claimable)})

        # Step 2-5: Process each bounty
        for bounty in claimable:
            result = await self._process_bounty(bounty)
            results.append(result)

        return results

    async def _process_bounty(self, bounty: Bounty) -> dict:
        """Process a single bounty through the full pipeline."""
        self._log("processing_bounty", {"number": bounty.number, "title": bounty.title})
        result = {"bounty": bounty.number, "title": bounty.title, "repo": bounty.repo}

        # Clone/setup repo
        repo_path = await self._setup_repo(bounty)
        if not repo_path:
            result["status"] = "failed"
            result["error"] = "Could not setup repo"
            return result

        # Step 2: Plan
        self._log("planning_start", {"bounty": bounty.number})
        try:
            plan = await self.planner.plan(bounty, repo_context=str(repo_path))
        except Exception as e:
            self._log("planning_error", {"bounty": bounty.number, "error": str(e)})
            result["status"] = "planning_failed"
            result["error"] = str(e)
            return result

        self._log("planning_complete", {"bounty": bounty.number, "steps": len(plan.steps)})

        # Step 3: Implement
        self._log("implementation_start", {"bounty": bounty.number})
        try:
            impl_results = await self.implementer.implement(plan, repo_path=repo_path)
        except Exception as e:
            self._log("implementation_error", {"bounty": bounty.number, "error": str(e)})
            result["status"] = "implementation_failed"
            result["error"] = str(e)
            return result

        # Git add & commit
        self._git_commit(repo_path, bounty)
        result["implementation"] = impl_results
        self._log("implementation_complete", {"bounty": bounty.number, "files": len(impl_results)})

        # Step 4: Review
        self._log("review_start", {"bounty": bounty.number})
        diff = self.reviewer.get_git_diff(str(repo_path))
        test_results = self.implementer.run_tests(repo_path)

        try:
            review = await self.reviewer.review(bounty, plan, diff, test_results)
        except Exception as e:
            self._log("review_error", {"bounty": bounty.number, "error": str(e)})
            review = ReviewResult(passed=False, issues=[f"Review error: {e}"], suggestions=[])

        result["review"] = {"passed": review.passed, "issues": review.issues}
        self._log("review_complete", {"bounty": bounty.number, "passed": review.passed})

        # Step 5: Submit PR
        if review.passed or config.DRY_RUN:
            self._log("pr_submission_start", {"bounty": bounty.number})
            pr_body = self.reviewer.format_pr_body(bounty, plan, review, test_results)
            branch = bounty.branch_name

            # Push branch
            self._git_push(repo_path, branch)

            try:
                pr_result = await self.reviewer.submit_pr(bounty, branch, bounty.repo, pr_body=pr_body)
                result["pr"] = pr_result
                result["status"] = "submitted" if pr_result.get("status") != "dry_run" else "dry_run"
                self._log("pr_submitted", {"bounty": bounty.number, "url": pr_result.get("pr_url", "")})
            except Exception as e:
                result["status"] = "pr_failed"
                result["error"] = str(e)
                self._log("pr_submission_error", {"bounty": bounty.number, "error": str(e)})
        else:
            result["status"] = "review_failed"
            self._log("review_failed", {"bounty": bounty.number, "issues": review.issues})

        return result

    async def _setup_repo(self, bounty: Bounty) -> Path | None:
        """Clone or update the target repository."""
        repo_dir = config.WORKSPACE_ROOT / bounty.repo.replace("/", "-")
        repo_dir.mkdir(parents=True, exist_ok=True)

        if (repo_dir / ".git").exists():
            # Pull latest
            subprocess.run(["git", "pull"], cwd=str(repo_dir), capture_output=True, timeout=30)
        else:
            # Clone
            fork_url = f"https://{config.GITHUB_TOKEN}@github.com/ahmadfardan464-cmyk/{bounty.repo.split('/')[-1]}.git"
            result = subprocess.run(
                ["git", "clone", fork_url, str(repo_dir)],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode != 0:
                # Try upstream if fork doesn't exist
                upstream_url = f"https://{config.GITHUB_TOKEN}@github.com/{bounty.repo}.git"
                result = subprocess.run(
                    ["git", "clone", upstream_url, str(repo_dir)],
                    capture_output=True,
                    text=True,
                    timeout=60,
                )
                if result.returncode != 0:
                    self._log("clone_error", {"repo": bounty.repo, "error": result.stderr[:500]})
                    return None

        # Create feature branch
        branch = bounty.branch_name
        subprocess.run(["git", "checkout", "main"], cwd=str(repo_dir), capture_output=True)
        subprocess.run(["git", "pull"], cwd=str(repo_dir), capture_output=True)
        subprocess.run(["git", "checkout", "-b", branch], cwd=str(repo_dir), capture_output=True)
        return repo_dir

    def _git_commit(self, repo_path: Path, bounty: Bounty):
        """Stage and commit all changes."""
        subprocess.run(["git", "add", "."], cwd=str(repo_path), capture_output=True)
        subprocess.run(
            ["git", "commit", "-m", f"feat: implement bounty #{bounty.number} - {bounty.title}\n\nCloses #{bounty.number}"],
            cwd=str(repo_path),
            capture_output=True,
        )

    def _git_push(self, repo_path: Path, branch: str):
        """Push the feature branch to remote."""
        subprocess.run(
            ["git", "push", "-u", "origin", branch],
            cwd=str(repo_path),
            capture_output=True,
            timeout=60,
        )

    async def run_daemon(self, interval: int = 300):
        """Run continuously, scanning for bounties at regular intervals."""
        self._log("daemon_start", {"interval": interval, "repos": config.TARGET_REPOS})
        while True:
            try:
                results = await self.run_once()
                self._log("cycle_complete", {"results": len(results)})
            except Exception as e:
                self._log("cycle_error", {"error": str(e)})
            await asyncio.sleep(interval)