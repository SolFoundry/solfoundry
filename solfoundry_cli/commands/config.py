"""Configuration management commands."""

import typer
from typing import Optional
from rich.console import Console
from rich.table import Table

from ..config import config_manager, Config
from ..formatters import print_success, print_info, print_error

console = Console()

config_app = typer.Typer(help="Manage CLI configuration")


@config_app.command("show")
def config_show():
    """Show current configuration."""
    try:
        config = config_manager.load()
        
        table = Table(title="SolFoundry CLI Configuration", border_style="blue")
        table.add_column("Setting", style="cyan", width=20)
        table.add_column("Value", style="white")
        
        table.add_row("API URL", config.api_url)
        table.add_row("API Key", "***" + config.api_key[-4:] if config.api_key else "[yellow]Not set[/yellow]")
        table.add_row("Wallet Path", config.wallet_path or "[dim]Not set[/dim]")
        table.add_row("Output Format", config.default_output_format)
        table.add_row("Default Tier", config.default_tier or "[dim]None[/dim]")
        
        console.print(table)
        console.print(f"\n[dim]Config file: {config_manager.config_file}[/dim]")
    
    except Exception as e:
        print_error(f"Error loading config: {e}")
        raise typer.Exit(1)


@config_app.command("set")
def config_set(
    key: str = typer.Argument(..., help="Configuration key"),
    value: str = typer.Argument(..., help="Configuration value"),
):
    """Set a configuration value."""
    try:
        config = config_manager.load()
        
        if key == "api_url":
            config.api_url = value
        elif key == "api_key":
            config.api_key = value
        elif key == "wallet_path":
            config.wallet_path = value
        elif key == "output_format":
            if value not in ["table", "json"]:
                print_error("Output format must be 'table' or 'json'")
                raise typer.Exit(1)
            config.default_output_format = value
        elif key == "default_tier":
            if value not in ["t1", "t2", "t3", None]:
                print_error("Tier must be 't1', 't2', or 't3'")
                raise typer.Exit(1)
            config.default_tier = value
        else:
            print_error(f"Unknown configuration key: {key}")
            print_info("Available keys: api_url, api_key, wallet_path, output_format, default_tier")
            raise typer.Exit(1)
        
        config_manager.save(config)
        print_success(f"Configuration '{key}' updated successfully!")
    
    except Exception as e:
        print_error(f"Error saving config: {e}")
        raise typer.Exit(1)


@config_app.command("init")
def config_init(
    api_key: Optional[str] = typer.Option(
        None,
        "--api-key", "-k",
        help="API key for SolFoundry"
    ),
    api_url: str = typer.Option(
        "https://api.solfoundry.io",
        "--api-url", "-u",
        help="SolFoundry API URL"
    ),
):
    """Initialize configuration interactively."""
    try:
        console.print("[bold]🏭 SolFoundry CLI Setup[/bold]\n")
        
        config = Config()
        
        # API URL
        config.api_url = typer.prompt("API URL", default=api_url)
        
        # API Key
        if not api_key:
            api_key = typer.prompt("API Key (or press Enter to skip)", default="", hide_input=True)
            if api_key:
                config.api_key = api_key
        
        # Save
        config_manager.save(config)
        
        print_success("Configuration saved successfully!")
        console.print(f"\n[dim]Config file: {config_manager.config_file}[/dim]")
        console.print("\n[dim]You can also set environment variables:[/dim]")
        console.print("  [dim]export SOLFOUNDRY_API_KEY=your_key[/dim]")
        console.print("  [dim]export SOLFOUNDRY_API_URL=https://api.solfoundry.io[/dim]")
    
    except Exception as e:
        print_error(f"Error initializing config: {e}")
        raise typer.Exit(1)
