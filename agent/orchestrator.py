"""
Orchestrator Agent — Coordinates the full bounty-hunting pipeline.

Responsibilities:
- Initialize all sub-agents
- Run the pipeline: Scout -> Analyst -> Coder -> Submitter
- Handle errors and retries
- Track progress across multiple bounties
- Report results
"""

import json
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.table import Table

from agent.config import load_config
from agent.scout import ScoutAgent, BountyOpportunity
from agent.analyst import AnalystAgent, ImplementationPlan
from agent.coder import CoderAgent
from agent.submitter import SubmitterAgent, PRResult


console = Console()


@dataclass
class PipelineRun:
    """Tracks a single bounty pipeline run."""
    bounty: BountyOpportunity
    plan: Optional[ImplementationPlan] = None
    implemented: bool = False
    pr_result: Optional[PRResult] = None
    error: Optional[str] = None
    started_at: str = field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None


class OrchestratorAgent:
    """Coordinates the full autonomous bounty-hunting pipeline."""

    def __init__(self, config_path: str = "config.yaml"):
        self.config = load_config(config_path)
        self.scout = ScoutAgent(self.config)
        self.analyst = AnalystAgent(self.config)
        self.coder = CoderAgent(self.config)
        self.submitter = SubmitterAgent(self.config)
        self.runs: list[PipelineRun] = []
        self.max_concurrent = self.config.get("rate_limits", {}).get("max_concurrent_bounties", 3)

    def run_scout_phase(self) -> list[BountyOpportunity]:
        """Phase 1: Discover and filter bounties."""
        console.print("\n[bold cyan]🔍 Phase 1: Scouting for bounties...[/]")
        bounties = self.scout.scan_all()
        console.print(f"  Found [green]{len(bounties)}[/] viable bounties")
        return bounties

    def run_analyze_phase(self, bounty: BountyOpportunity) -> Optional[ImplementationPlan]:
        """Phase 2: Analyze a bounty and generate implementation plan."""
        console.print(f"\n[bold cyan]📋 Phase 2: Analyzing bounty #{bounty.issue_number}...[/]")
        try:
            plan = self.analyst.analyze(bounty)
            console.print(f"  Plan: [green]{plan.summary}[/]")
            console.print(f"  Files to modify: {len(plan.files_to_modify)}")
            console.print(f"  Files to create: {len(plan.files_to_create)}")
            console.print(f"  Steps: {len(plan.steps)}")
            console.print(f"  Effort: {plan.estimated_effort}")
            return plan
        except Exception as e:
            console.print(f"  [red]Analysis failed: {e}[/]")
            return None

    def run_implement_phase(self, bounty: BountyOpportunity, plan: ImplementationPlan) -> bool:
        """Phase 3: Implement the solution."""
        console.print(f"\n[bold cyan]⚡ Phase 3: Implementing bounty #{bounty.issue_number}...[/]")
        try:
            repo_path = self.analyst.clone_repo(bounty.repo)
            success = self.coder.implement(repo_path, plan)
            if success:
                console.print(f"  [green]Implementation complete[/]")
            else:
                console.print(f"  [red]Implementation failed[/]")
            return success
        except Exception as e:
            console.print(f"  [red]Implementation error: {e}[/]")
            return False

    def run_submit_phase(self, bounty: BountyOpportunity, plan: ImplementationPlan) -> Optional[PRResult]:
        """Phase 4: Submit the PR."""
        console.print(f"\n[bold cyan]🚀 Phase 4: Submitting PR for #{bounty.issue_number}...[/]")
        try:
            repo_path = self.analyst.clone_repo(bounty.repo)
            result = self.submitter.submit(str(repo_path), plan)
            if result.status == "created":
                console.print(f"  [green]PR #{result.pr_number}: {result.pr_url}[/]")
            else:
                console.print(f"  [red]PR creation failed[/]")
            return result
        except Exception as e:
            console.print(f"  [red]Submission error: {e}[/]")
            return None

    def run_single(self, bounty: BountyOpportunity) -> PipelineRun:
        """Run the full pipeline for a single bounty."""
        run = PipelineRun(bounty=bounty)

        # Phase 2: Analyze
        run.plan = self.run_analyze_phase(bounty)
        if run.plan is None:
            run.error = "Analysis failed"
            run.completed_at = datetime.now().isoformat()
            return run

        # Phase 3: Implement
        run.implemented = self.run_implement_phase(bounty, run.plan)
        if not run.implemented:
            run.error = "Implementation failed"
            run.completed_at = datetime.now().isoformat()
            return run

        # Phase 4: Submit
        run.pr_result = self.run_submit_phase(bounty, run.plan)
        if run.pr_result is None or run.pr_result.status != "created":
            run.error = "PR submission failed"

        run.completed_at = datetime.now().isoformat()
        return run

    def run_all(self, phase: Optional[str] = None, bounty_id: Optional[int] = None):
        """Run the full autonomous pipeline."""
        console.print("[bold]🤖 SolFoundry Autonomous Bounty-Hunting Agent[/]")
        console.print(f"[dim]Version 0.1.0 | {datetime.now().strftime('%Y-%m-%d %H:%M')}[/]")

        # Phase 1: Scout
        if phase in (None, "scout"):
            bounties = self.run_scout_phase()
        else:
            bounties = self.scout.scan_all()

        # Filter to specific bounty if requested
        if bounty_id:
            bounties = [b for b in bounties if b.issue_number == bounty_id]
            if not bounties:
                console.print(f"[red]Bounty #{bounty_id} not found[/]")
                return

        # Limit to max concurrent
        bounties = bounties[:self.max_concurrent]

        # Skip to specific phase if requested
        if phase == "scout":
            self._print_bounty_table(bounties)
            return

        # Phase 2-4: For each bounty
        for bounty in bounties:
            console.print(f"\n[bold]{'='*60}[/]")
            console.print(f"[bold yellow]🎯 Target: #{bounty.issue_number} — {bounty.title}[/]")
            console.print(f"  Score: {bounty.score:.1f} | Competition: {bounty.competition_level}")
            console.print(f"[bold]{'='*60}[/]")

            run = self.run_single(bounty)
            self.runs.append(run)

        # Summary
        self._print_summary()

    def _print_bounty_table(self, bounties: list[BountyOpportunity]):
        """Display bounties in a rich table."""
        table = Table(title="Bounty Opportunities")
        table.add_column("#", style="cyan")
        table.add_column("Title", style="white")
        table.add_column("Tier", style="yellow")
        table.add_column("Reward", style="green")
        table.add_column("Comments", style="dim")
        table.add_column("Score", style="bold")

        for b in bounties:
            table.add_row(
                str(b.issue_number),
                b.title[:50],
                b.tier,
                f"{b.reward_amount:,} {b.reward_token}",
                str(b.comment_count),
                f"{b.score:.1f}",
            )

        console.print(table)

    def _print_summary(self):
        """Print pipeline run summary."""
        console.print(f"\n[bold]{'='*60}[/]")
        console.print("[bold]Pipeline Summary[/]")
        console.print(f"[bold]{'='*60}[/]")

        success = sum(1 for r in self.runs if r.pr_result and r.pr_result.status == "created")
        failed = len(self.runs) - success

        console.print(f"  Total: {len(self.runs)} | [green]Succeeded: {success}[/] | [red]Failed: {failed}[/]")

        for run in self.runs:
            status = "✅" if run.pr_result and run.pr_result.status == "created" else "❌"
            pr_info = f"PR #{run.pr_result.pr_number}" if run.pr_result else run.error or "N/A"
            console.print(f"  {status} #{run.bounty.issue_number}: {pr_info}")
