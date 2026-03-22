"""Status command."""

import typer
from rich.console import Console

from ..api import APIClient, APIError
from ..formatters import format_status_table, format_status_json, print_error

console = Console()

status_app = typer.Typer(help="View user status")


@status_app.command()
def status(
    as_json: bool = typer.Option(
        False,
        "--json", "-j",
        help="Output in JSON format"
    ),
):
    """View your SolFoundry status including earnings and progress."""
    try:
        client = APIClient()
        status_info = client.get_status()
        
        if as_json:
            console.print(format_status_json(status_info))
        else:
            console.print(format_status_table(status_info))
    
    except APIError as e:
        print_error(f"API Error: {e}")
        print_error("Make sure you have configured your API key.")
        print_error("\nConfigure with:")
        console.print("  [dim]sf config set api_key YOUR_API_KEY[/dim]")
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        raise typer.Exit(1)
