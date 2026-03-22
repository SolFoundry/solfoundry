"""SolFoundry CLI entry point.

Defines the top-level ``sf`` Click group and registers all subcommands.
This module is the console_scripts entry point configured in setup.py:

    sf = app.cli.main:cli

Shell completion is provided via Click's built-in completion support.
To enable completions, add one of the following to your shell profile:

    Bash:  eval "$(_SF_COMPLETE=bash_source sf)"
    Zsh:   eval "$(_SF_COMPLETE=zsh_source sf)"
    Fish:  eval "$(_SF_COMPLETE=fish_source sf)"
"""

import click

from app.cli import __version__
from app.cli.commands.bounties import bounties_group
from app.cli.commands.bounty import bounty_group
from app.cli.commands.status import status_command
from app.cli.commands.configure import configure_command


@click.group()
@click.version_option(version=__version__, prog_name="solfoundry-cli")
def cli() -> None:
    """SolFoundry CLI — interact with bounties from the terminal.

    A command-line interface for power users and AI agents to list, claim,
    submit, and check the status of SolFoundry bounties.

    Authentication:
        Run ``sf configure`` to set your API key, or export the
        ``SOLFOUNDRY_API_KEY`` environment variable.

    Shell completions:
        Bash:  eval "$(_SF_COMPLETE=bash_source sf)"
        Zsh:   eval "$(_SF_COMPLETE=zsh_source sf)"
        Fish:  eval "$(_SF_COMPLETE=fish_source sf)"

    Examples:
        sf bounties list --tier t2 --status open
        sf bounty claim <bounty-id>
        sf bounty submit <bounty-id> --pr https://github.com/org/repo/pull/42
        sf status
        sf configure
    """
    pass


# Register command groups and standalone commands
cli.add_command(bounties_group)
cli.add_command(bounty_group)
cli.add_command(status_command)
cli.add_command(configure_command)


def main() -> None:
    """Invoke the CLI (used as the console_scripts entry point)."""
    cli()


if __name__ == "__main__":
    main()
