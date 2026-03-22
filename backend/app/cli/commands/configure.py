"""Interactive configuration command.

Provides ``sf configure`` to set API URL, API key, default output
format, and wallet address. Values are persisted to
``~/.solfoundry/config.yaml``.
"""

import click

from app.cli.config import load_config, save_config, CONFIG_FILE
from app.cli.formatting import BOLD, GREEN, RESET, DIM


@click.command("configure")
def configure_command() -> None:
    """Configure the SolFoundry CLI (API URL, API key, preferences).

    Prompts for each setting interactively. Press Enter to keep the
    current value. Configuration is saved to ~/.solfoundry/config.yaml.

    Examples:

        sf configure
    """
    config = load_config()

    click.echo(f"{BOLD}SolFoundry CLI Configuration{RESET}")
    click.echo(f"{DIM}Press Enter to keep current value.{RESET}\n")

    # API URL
    current_url = config.get("api_url", "")
    new_url = click.prompt(
        f"  API URL [{current_url}]",
        default=current_url,
        show_default=False,
    )
    config["api_url"] = new_url.rstrip("/")

    # API Key
    current_key = config.get("api_key", "")
    masked_key = f"{current_key[:8]}...{current_key[-4:]}" if len(current_key) > 12 else current_key
    new_key = click.prompt(
        f"  API Key [{masked_key or 'not set'}]",
        default=current_key,
        show_default=False,
        hide_input=True,
    )
    config["api_key"] = new_key

    # Default format
    current_format = config.get("default_format", "table")
    new_format = click.prompt(
        f"  Default output format [{current_format}]",
        default=current_format,
        show_default=False,
        type=click.Choice(["table", "json"], case_sensitive=False),
    )
    config["default_format"] = new_format

    # Wallet address
    current_wallet = config.get("wallet_address", "")
    new_wallet = click.prompt(
        f"  Wallet address [{current_wallet or 'not set'}]",
        default=current_wallet,
        show_default=False,
    )
    config["wallet_address"] = new_wallet

    save_config(config)
    click.echo(f"\n{GREEN}{BOLD}Configuration saved to {CONFIG_FILE}{RESET}")
