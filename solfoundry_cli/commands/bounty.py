"""Individual bounty commands (claim, submit, get)."""

import typer
from typing import Optional
from rich.console import Console
from rich.panel import Panel

from ..api import APIClient, APIError, Bounty
from ..formatters import print_error, print_success, print_info, print_warning

console = Console()

bounty_app = typer.Typer(help="Manage individual bounties")


@bounty_app.command("get")
def get_bounty(
    bounty_id: int = typer.Argument(..., help="Bounty ID"),
    as_json: bool = typer.Option(
        False,
        "--json", "-j",
        help="Output in JSON format"
    ),
):
    """Get details of a specific bounty."""
    try:
        client = APIClient()
        bounty = client.get_bounty(bounty_id)
        
        if as_json:
            import json
            console.print(json.dumps(bounty.model_dump(mode="json"), indent=2))
        else:
            # Format as a nice panel
            content = f"""[bold white]{bounty.title}[/bold white]

[bold]ID:[/bold] {bounty.id}
[bold]Status:[/bold] [{get_status_color(bounty.status)}]{bounty.status}[/{get_status_color(bounty.status)}]
[bold]Tier:[/bold] {bounty.tier.upper()}
[bold]Category:[/bold] {bounty.category}
[bold]Reward:[/bold] [green]{bounty.reward:,} {bounty.reward_token}[/green]
[bold]Repository:[/bold] {bounty.repository}
[bold]Issue URL:[/bold] [blue underline]{bounty.issue_url}[/blue underline]

[bold]Description:[/bold]
{bounty.description}
"""
            
            if bounty.claimer:
                content += f"\n[bold]Claimed by:[/bold] {bounty.claimer}"
            
            if bounty.deadline:
                content += f"\n[bold]Deadline:[/bold] {bounty.deadline.strftime('%Y-%m-%d %H:%M')}"
            
            console.print(Panel(content, title=f"Bounty #{bounty_id}", border_style="blue"))
    
    except APIError as e:
        print_error(f"API Error: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        raise typer.Exit(1)


@bounty_app.command("claim")
def claim_bounty(
    bounty_id: int = typer.Argument(..., help="Bounty ID"),
    yes: bool = typer.Option(
        False,
        "--yes", "-y",
        help="Skip confirmation prompt"
    ),
):
    """Claim a bounty."""
    try:
        client = APIClient()
        
        # First get bounty details
        bounty = client.get_bounty(bounty_id)
        
        if bounty.status != "open":
            print_error(f"Bounty #{bounty_id} is not available (status: {bounty.status})")
            raise typer.Exit(1)
        
        # Show details and confirm
        if not yes:
            console.print(Panel(
                f"""[bold]{bounty.title}[/bold]
Reward: [green]{bounty.reward:,} {bounty.reward_token}[/green]
Tier: {bounty.tier.upper()}""",
                title="About to claim",
                border_style="yellow"
            ))
            
            confirm = typer.confirm("Do you want to claim this bounty?")
            if not confirm:
                console.print("[yellow]Claim cancelled[/yellow]")
                raise typer.Exit(0)
        
        # Claim the bounty
        result = client.claim_bounty(bounty_id)
        
        print_success(f"Successfully claimed Bounty #{bounty_id}!")
        print_info(f"Transaction hash: {result.get('transaction_hash', 'N/A')}")
        print_warning("Remember to submit your work before the deadline!")
    
    except APIError as e:
        print_error(f"API Error: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        raise typer.Exit(1)


@bounty_app.command("submit")
def submit_bounty(
    bounty_id: int = typer.Argument(..., help="Bounty ID"),
    pr_url: str = typer.Option(
        ...,
        "--pr", "-p",
        help="Pull request URL"
    ),
    yes: bool = typer.Option(
        False,
        "--yes", "-y",
        help="Skip confirmation prompt"
    ),
):
    """Submit work for a bounty."""
    try:
        client = APIClient()
        
        # Validate PR URL
        if not pr_url.startswith("https://github.com/"):
            print_error("PR URL must be a valid GitHub pull request URL")
            raise typer.Exit(1)
        
        # Get bounty details
        bounty = client.get_bounty(bounty_id)
        
        if not yes:
            console.print(Panel(
                f"""[bold]{bounty.title}[/bold]
PR URL: [blue]{pr_url}[/blue]""",
                title="About to submit",
                border_style="yellow"
            ))
            
            confirm = typer.confirm("Do you want to submit this PR?")
            if not confirm:
                console.print("[yellow]Submission cancelled[/yellow]")
                raise typer.Exit(0)
        
        # Submit
        result = client.submit_bounty(bounty_id, pr_url)
        
        print_success(f"Successfully submitted work for Bounty #{bounty_id}!")
        print_info(f"Submission ID: {result.get('submission_id', 'N/A')}")
        print_info("Your submission will be reviewed by the maintainers.")
    
    except APIError as e:
        print_error(f"API Error: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        raise typer.Exit(1)


def get_status_color(status: str) -> str:
    """Get rich color code for status."""
    colors = {
        "open": "green",
        "claimed": "yellow",
        "completed": "blue",
        "cancelled": "red"
    }
    return colors.get(status, "white")
