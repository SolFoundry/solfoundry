"""Bounties list command."""

import typer
from typing import Optional
from rich.console import Console

from ..api import APIClient, APIError
from ..formatters import format_bounty_table, format_bounty_json, print_error

console = Console()

bounties_app = typer.Typer(help="List and manage bounties")


@bounties_app.command("list")
def list_bounties(
    tier: Optional[str] = typer.Option(
        None,
        "--tier", "-t",
        help="Filter by tier (t1, t2, t3)"
    ),
    status: Optional[str] = typer.Option(
        None,
        "--status", "-s",
        help="Filter by status (open, claimed, completed)"
    ),
    category: Optional[str] = typer.Option(
        None,
        "--category", "-c",
        help="Filter by category (frontend, backend, smart-contract, etc.)"
    ),
    limit: int = typer.Option(
        50,
        "--limit", "-l",
        help="Maximum number of bounties to return"
    ),
    as_json: bool = typer.Option(
        False,
        "--json", "-j",
        help="Output in JSON format"
    ),
):
    """List available bounties with optional filters."""
    try:
        client = APIClient()
        bounties = client.list_bounties(
            tier=tier,
            status=status,
            category=category,
            limit=limit
        )
        
        if not bounties:
            console.print("[yellow]No bounties found matching your criteria.[/yellow]")
            raise typer.Exit(0)
        
        if as_json:
            console.print(format_bounty_json(bounties))
        else:
            console.print(format_bounty_table(bounties))
            console.print(f"\n[dim]Showing {len(bounties)} bounty(ies)[/dim]")
    
    except APIError as e:
        print_error(f"API Error: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        raise typer.Exit(1)


@bounties_app.command("search")
def search_bounties(
    query: str = typer.Argument(..., help="Search query"),
    as_json: bool = typer.Option(
        False,
        "--json", "-j",
        help="Output in JSON format"
    ),
):
    """Search bounties by keyword."""
    try:
        client = APIClient()
        # Note: This would need a search endpoint in the API
        # For now, we'll just list all and filter client-side
        bounties = client.list_bounties(limit=200)
        
        # Client-side search
        filtered = [
            b for b in bounties
            if query.lower() in b.title.lower() or query.lower() in b.description.lower()
        ]
        
        if not filtered:
            console.print(f"[yellow]No bounties found matching '{query}'[/yellow]")
            raise typer.Exit(0)
        
        if as_json:
            console.print(format_bounty_json(filtered))
        else:
            console.print(format_bounty_table(filtered))
            console.print(f"\n[dim]Found {len(filtered)} matching bounty(ies)[/dim]")
    
    except APIError as e:
        print_error(f"API Error: {e}")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        raise typer.Exit(1)
