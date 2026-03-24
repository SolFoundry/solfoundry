"""Bounty listing and search commands.

Provides ``sf bounties list`` with filtering by tier, status, category,
and skills. Supports both table and JSON output formats.
"""

import sys
from typing import Optional

import click

from app.cli.api_client import (
    ApiClientError,
    AuthenticationError,
    SolFoundryApiClient,
    ValidationError,
)
from app.cli.formatting import render_bounty_table, render_json


@click.group("bounties")
def bounties_group() -> None:
    """List and search bounties."""
    pass


@bounties_group.command("list")
@click.option(
    "--tier",
    type=click.Choice(["t1", "t2", "t3"], case_sensitive=False),
    default=None,
    help="Filter by bounty tier (t1, t2, t3).",
)
@click.option(
    "--status",
    type=click.Choice(
        ["open", "in_progress", "completed", "paid"], case_sensitive=False
    ),
    default=None,
    help="Filter by bounty status.",
)
@click.option(
    "--category",
    type=click.Choice(
        [
            "smart-contract",
            "frontend",
            "backend",
            "design",
            "content",
            "security",
            "devops",
            "documentation",
        ],
        case_sensitive=False,
    ),
    default=None,
    help="Filter by bounty category.",
)
@click.option(
    "--skills",
    type=str,
    default=None,
    help="Comma-separated skill filter (e.g. 'rust,python').",
)
@click.option(
    "--limit",
    type=click.IntRange(1, 100),
    default=20,
    help="Number of results per page (1-100).",
)
@click.option(
    "--skip",
    type=click.IntRange(0),
    default=0,
    help="Number of results to skip (pagination offset).",
)
@click.option(
    "--json",
    "output_json",
    is_flag=True,
    default=False,
    help="Output raw JSON instead of a formatted table.",
)
@click.pass_context
def list_bounties(
    ctx: click.Context,
    tier: Optional[str],
    status: Optional[str],
    category: Optional[str],
    skills: Optional[str],
    limit: int,
    skip: int,
    output_json: bool,
) -> None:
    """List bounties with optional filters.

    Examples:

        sf bounties list

        sf bounties list --tier t2 --status open

        sf bounties list --skills rust,python --limit 10

        sf bounties list --category backend --json
    """
    client = SolFoundryApiClient()
    try:
        result = client.list_bounties(
            status=status,
            tier=tier,
            skills=skills,
            category=category,
            skip=skip,
            limit=limit,
        )

        if output_json:
            click.echo(render_json(result))
        else:
            items = result.get("items", [])
            total = result.get("total", 0)
            click.echo(render_bounty_table(items))
            click.echo(
                f"\nShowing {len(items)} of {total} bounties "
                f"(skip={skip}, limit={limit})"
            )
    except ValidationError as exc:
        click.echo(f"Validation error: {exc.detail}", err=True)
        sys.exit(1)
    except ApiClientError as exc:
        click.echo(f"Error: {exc.detail}", err=True)
        sys.exit(1)
    finally:
        client.close()


@bounties_group.command("search")
@click.argument("query", default="")
@click.option(
    "--tier",
    type=click.IntRange(1, 3),
    default=None,
    help="Filter by tier number (1, 2, or 3).",
)
@click.option(
    "--status",
    type=click.Choice(
        ["open", "in_progress", "completed", "paid"], case_sensitive=False
    ),
    default=None,
    help="Filter by bounty status.",
)
@click.option(
    "--category",
    type=str,
    default=None,
    help="Filter by category.",
)
@click.option(
    "--skills",
    type=str,
    default=None,
    help="Comma-separated skill filter.",
)
@click.option(
    "--sort",
    type=click.Choice(
        ["newest", "reward_high", "reward_low", "deadline", "submissions", "best_match"],
        case_sensitive=False,
    ),
    default="newest",
    help="Sort order.",
)
@click.option(
    "--json",
    "output_json",
    is_flag=True,
    default=False,
    help="Output raw JSON.",
)
@click.pass_context
def search_bounties(
    ctx: click.Context,
    query: str,
    tier: Optional[int],
    status: Optional[str],
    category: Optional[str],
    skills: Optional[str],
    sort: str,
    output_json: bool,
) -> None:
    """Full-text search for bounties.

    Examples:

        sf bounties search "smart contract"

        sf bounties search --tier 2 --sort reward_high
    """
    client = SolFoundryApiClient()
    try:
        result = client.search_bounties(
            query=query,
            status=status,
            tier=tier,
            skills=skills,
            category=category,
            sort=sort,
        )

        if output_json:
            click.echo(render_json(result))
        else:
            items = result.get("items", [])
            total = result.get("total", 0)
            click.echo(render_bounty_table(items))
            click.echo(f"\n{total} results for '{query}'")
    except ApiClientError as exc:
        click.echo(f"Error: {exc.detail}", err=True)
        sys.exit(1)
    finally:
        client.close()
