"""Output formatters for SolFoundry CLI."""

import json
from typing import List, Any, Optional
from rich.table import Table
from rich.console import Console
from rich.json import JSON
from rich import box

from .api import Bounty, Submission, StatusInfo


console = Console()


def format_bounty_table(bounties: List[Bounty]) -> Table:
    """Format bounties as a rich table."""
    table = Table(
        title="🏭 SolFoundry Bounties",
        box=box.ROUNDED,
        header_style="bold magenta",
        border_style="blue"
    )
    
    table.add_column("ID", style="cyan", justify="right", width=6)
    table.add_column("Title", style="white", width=50)
    table.add_column("Reward", style="green", justify="right")
    table.add_column("Tier", style="yellow", width=6)
    table.add_column("Status", style="blue", width=10)
    table.add_column("Category", style="magenta", width=12)
    
    for bounty in bounties:
        reward_str = f"{bounty.reward:,} {bounty.reward_token}"
        status_style = "green" if bounty.status == "open" else "yellow"
        
        table.add_row(
            str(bounty.id),
            bounty.title[:48] + "..." if len(bounty.title) > 50 else bounty.title,
            reward_str,
            bounty.tier.upper(),
            f"[{status_style}]{bounty.status}[/{status_style}]",
            bounty.category
        )
    
    return table


def format_bounty_json(bounties: List[Bounty]) -> JSON:
    """Format bounties as JSON."""
    data = [bounty.model_dump(mode="json") for bounty in bounties]
    return JSON(json.dumps(data, indent=2))


def format_submission_table(submissions: List[Submission]) -> Table:
    """Format submissions as a rich table."""
    table = Table(
        title="📝 Submissions",
        box=box.ROUNDED,
        header_style="bold magenta",
        border_style="blue"
    )
    
    table.add_column("ID", style="cyan", justify="right", width=6)
    table.add_column("Bounty ID", style="yellow", justify="right", width=10)
    table.add_column("Submitter", style="white", width=20)
    table.add_column("PR URL", style="blue", width=50)
    table.add_column("Status", style="green", width=12)
    table.add_column("Score", style="magenta", justify="right", width=6)
    
    for submission in submissions:
        pr_display = submission.pr_url[:48] + "..." if len(submission.pr_url) > 50 else submission.pr_url
        score_str = f"{submission.review_score:.1f}" if submission.review_score else "N/A"
        
        table.add_row(
            str(submission.id),
            str(submission.bounty_id),
            submission.submitter,
            pr_display,
            submission.status,
            score_str
        )
    
    return table


def format_submission_json(submissions: List[Submission]) -> JSON:
    """Format submissions as JSON."""
    data = [submission.model_dump(mode="json") for submission in submissions]
    return JSON(json.dumps(data, indent=2))


def format_status_table(status: StatusInfo) -> Table:
    """Format user status as a rich table."""
    table = Table(
        title="👤 User Status",
        box=box.ROUNDED,
        header_style="bold magenta",
        border_style="blue"
    )
    
    table.add_column("Metric", style="cyan", width=20)
    table.add_column("Value", style="white", width=30)
    
    table.add_row("Wallet Address", status.wallet_address[:20] + "..." + status.wallet_address[-6:])
    table.add_row("Total Earned", f"{status.total_earned:,} $FNDRY")
    table.add_row("Active Bounties", str(status.active_bounties))
    table.add_row("Completed Bounties", str(status.completed_bounties))
    
    # Tier progress
    for tier, count in status.tier_progress.items():
        table.add_row(f"Tier {tier.upper()} Progress", str(count))
    
    return table


def format_status_json(status: StatusInfo) -> JSON:
    """Format user status as JSON."""
    return JSON(json.dumps(status.model_dump(mode="json"), indent=2))


def print_success(message: str) -> None:
    """Print success message."""
    console.print(f"[green]✓[/green] {message}")


def print_error(message: str) -> None:
    """Print error message."""
    console.print(f"[red]✗[/red] {message}")


def print_warning(message: str) -> None:
    """Print warning message."""
    console.print(f"[yellow]⚠[/yellow] {message}")


def print_info(message: str) -> None:
    """Print info message."""
    console.print(f"[blue]ℹ[/blue] {message}")
