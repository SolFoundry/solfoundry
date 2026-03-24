"""Platform status command.

Provides ``sf status`` to check the SolFoundry platform health,
including bounty counts, contributor counts, and last sync time.
"""

import sys

import click

from app.cli.api_client import ApiClientError, SolFoundryApiClient
from app.cli.formatting import render_json, render_status_summary


@click.command("status")
@click.option(
    "--json",
    "output_json",
    is_flag=True,
    default=False,
    help="Output raw JSON.",
)
def status_command(output_json: bool) -> None:
    """Check SolFoundry platform status.

    Displays server health, bounty count, contributor count,
    and last data synchronisation time.

    Examples:

        sf status

        sf status --json
    """
    client = SolFoundryApiClient()
    try:
        health = client.health()
        if output_json:
            click.echo(render_json(health))
        else:
            click.echo(render_status_summary(health))
    except ApiClientError as exc:
        click.echo(f"Error connecting to server: {exc.detail}", err=True)
        sys.exit(1)
    finally:
        client.close()
