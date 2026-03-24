"""Single-bounty commands: claim, submit, show.

Provides ``sf bounty claim <id>``, ``sf bounty submit <id> --pr <url>``,
and ``sf bounty show <id>`` for operating on individual bounties.
All mutation commands require authentication (API key).
"""

import sys
from typing import Optional

import click

from app.cli.api_client import (
    ApiClientError,
    AuthenticationError,
    NotFoundError,
    SolFoundryApiClient,
    ValidationError,
)
from app.cli.formatting import (
    render_bounty_detail,
    render_json,
    render_submission_detail,
    GREEN,
    BOLD,
    RESET,
)


@click.group("bounty")
def bounty_group() -> None:
    """Operate on a single bounty (claim, submit, show)."""
    pass


@bounty_group.command("show")
@click.argument("bounty_id")
@click.option(
    "--json",
    "output_json",
    is_flag=True,
    default=False,
    help="Output raw JSON.",
)
def show_bounty(bounty_id: str, output_json: bool) -> None:
    """Show detailed information for a bounty.

    Examples:

        sf bounty show abc12345-1234-1234-1234-123456789abc
    """
    client = SolFoundryApiClient()
    try:
        bounty = client.get_bounty(bounty_id)
        if output_json:
            click.echo(render_json(bounty))
        else:
            click.echo(render_bounty_detail(bounty))
    except NotFoundError:
        click.echo(f"Bounty '{bounty_id}' not found.", err=True)
        sys.exit(1)
    except ApiClientError as exc:
        click.echo(f"Error: {exc.detail}", err=True)
        sys.exit(1)
    finally:
        client.close()


@bounty_group.command("claim")
@click.argument("bounty_id")
@click.option(
    "--json",
    "output_json",
    is_flag=True,
    default=False,
    help="Output raw JSON.",
)
def claim_bounty(bounty_id: str, output_json: bool) -> None:
    """Claim a bounty (sets status to in_progress).

    Requires authentication. Set your API key via ``sf configure``
    or the ``SOLFOUNDRY_API_KEY`` environment variable.

    Examples:

        sf bounty claim abc12345-1234-1234-1234-123456789abc
    """
    client = SolFoundryApiClient()
    try:
        result = client.claim_bounty(bounty_id)
        if output_json:
            click.echo(render_json(result))
        else:
            click.echo(
                f"{GREEN}{BOLD}Bounty claimed successfully!{RESET}\n"
            )
            click.echo(render_bounty_detail(result))
    except AuthenticationError as exc:
        click.echo(
            f"Authentication failed: {exc.detail}\n"
            "Run 'sf configure' to set your API key.",
            err=True,
        )
        sys.exit(1)
    except NotFoundError:
        click.echo(f"Bounty '{bounty_id}' not found.", err=True)
        sys.exit(1)
    except ApiClientError as exc:
        click.echo(f"Error: {exc.detail}", err=True)
        sys.exit(1)
    finally:
        client.close()


@bounty_group.command("submit")
@click.argument("bounty_id")
@click.option(
    "--pr",
    required=True,
    type=str,
    help="GitHub pull request URL.",
)
@click.option(
    "--notes",
    type=str,
    default=None,
    help="Optional notes about the submission.",
)
@click.option(
    "--json",
    "output_json",
    is_flag=True,
    default=False,
    help="Output raw JSON.",
)
def submit_solution(
    bounty_id: str,
    pr: str,
    notes: Optional[str],
    output_json: bool,
) -> None:
    """Submit a PR solution for a bounty.

    Requires authentication. The PR URL must be a valid GitHub pull
    request URL.

    Examples:

        sf bounty submit abc123 --pr https://github.com/org/repo/pull/42

        sf bounty submit abc123 --pr https://github.com/org/repo/pull/42 --notes "Fixed edge case"
    """
    # Validate PR URL format before sending to API
    if not pr.startswith(("https://github.com/", "http://github.com/")):
        click.echo(
            "Invalid PR URL. Must start with https://github.com/",
            err=True,
        )
        sys.exit(1)

    client = SolFoundryApiClient()
    try:
        result = client.submit_solution(
            bounty_id=bounty_id,
            pr_url=pr,
            notes=notes,
        )
        if output_json:
            click.echo(render_json(result))
        else:
            click.echo(render_submission_detail(result))
    except AuthenticationError as exc:
        click.echo(
            f"Authentication failed: {exc.detail}\n"
            "Run 'sf configure' to set your API key.",
            err=True,
        )
        sys.exit(1)
    except NotFoundError:
        click.echo(f"Bounty '{bounty_id}' not found.", err=True)
        sys.exit(1)
    except ValidationError as exc:
        click.echo(f"Validation error: {exc.detail}", err=True)
        sys.exit(1)
    except ApiClientError as exc:
        click.echo(f"Error: {exc.detail}", err=True)
        sys.exit(1)
    finally:
        client.close()
