"""SolFoundry CLI - Main entry point."""

import typer
from rich.console import Console
from typing import Optional

from . import __version__
from .commands.bounties import bounties_app
from .commands.bounty import bounty_app
from .commands.status import status_app
from .commands.submissions import submissions_app
from .commands.config import config_app

console = Console()

app = typer.Typer(
    name="sf",
    help="🏭 SolFoundry CLI - Interact with SolFoundry bounties from the terminal",
    add_completion=True,
)

# Register subcommands
app.add_typer(bounties_app, name="bounties", help="List and search bounties")
app.add_typer(bounty_app, name="bounty", help="Manage individual bounties")
app.add_typer(status_app, name="status", help="View user status")
app.add_typer(submissions_app, name="submissions", help="Manage submissions")
app.add_typer(config_app, name="config", help="Manage configuration")


def version_callback(value: bool):
    """Show version and exit."""
    if value:
        console.print(f"[bold blue]SolFoundry CLI[/bold blue] version [green]{__version__}[/green]")
        raise typer.Exit()


@app.callback()
def main(
    version: Optional[bool] = typer.Option(
        None,
        "--version", "-v",
        callback=version_callback,
        is_eager=True,
        help="Show version and exit"
    ),
):
    """🏭 SolFoundry CLI - Bounty management for power users and agents."""
    pass


@app.command()
def quickstart():
    """Show quick start guide."""
    guide = """
[bold blue]🏭 SolFoundry CLI Quick Start Guide[/bold blue]

[bold]1. Initialize Configuration[/bold]
   sf config init
   # Or set environment variables:
   export SOLFOUNDRY_API_KEY=your_api_key

[bold]2. Browse Bounties[/bold]
   sf bounties list                    # List all bounties
   sf bounties list --tier t2          # Filter by tier
   sf bounties list --status open      # Filter by status
   sf bounties search "frontend"       # Search bounties

[bold]3. Claim a Bounty[/bold]
   sf bounty get 511                   # View bounty details
   sf bounty claim 511                 # Claim bounty #511

[bold]4. Submit Work[/bold]
   sf bounty submit 511 --pr https://github.com/.../pull/123

[bold]5. Check Status[/bold]
   sf status                           # View your earnings and progress

[bold]6. Manage Submissions[/bold]
   sf submissions list --bounty 511    # List submissions for bounty
   sf submissions review 123 --score 8.5 --comment "Great work!"
   sf submissions vote 123 --upvote
   sf submissions distribute 123       # Distribute reward

[bold]Output Formats[/bold]
   All list commands support --json flag for JSON output:
   sf bounties list --json

[bold]Need Help?[/bold]
   sf --help                           # Main help
   sf bounties --help                  # Bounties help
   sf bounty --help                    # Bounty help

[dim]Documentation: https://github.com/solfoundry/solfoundry[/dim]
"""
    console.print(guide)


@app.command()
def completion(shell: str = typer.Argument(..., help="Shell type (bash, zsh, fish)")):
    """Generate shell completion script."""
    if shell not in ["bash", "zsh", "fish"]:
        console.print("[red]Error:[/red] Shell must be bash, zsh, or fish")
        raise typer.Exit(1)
    
    # Get completion script
    if shell == "bash":
        console.print("[dim]# Add to ~/.bashrc:[/dim]")
        console.print("[dim]eval \"$(sf completion bash)\"[/dim]")
    elif shell == "zsh":
        console.print("[dim]# Add to ~/.zshrc:[/dim]")
        console.print("[dim]eval \"$(sf completion zsh)\"[/dim]")
    elif shell == "fish":
        console.print("[dim]# Run this command:[/dim]")
        console.print("[dim]sf completion fish > ~/.config/fish/completions/sf.fish[/dim]")
    
    # In production, this would output the actual completion script
    console.print(f"\n[green]✓[/green] {shell} completion instructions shown")


if __name__ == "__main__":
    app()
