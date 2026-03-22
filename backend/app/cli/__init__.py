"""SolFoundry CLI — terminal interface for bounty operations.

This package provides a Click-based CLI tool that communicates with
the SolFoundry backend API. Power users and AI agents can list, claim,
submit, and check bounty status from the command line.

Modules:
    main: Entry point and top-level Click group.
    config: Configuration file management (~/.solfoundry/config.yaml).
    api_client: HTTP client that wraps the SolFoundry REST API.
    formatting: Terminal output formatting (tables, colors, JSON).
    commands: Subpackage containing individual command groups.
"""

__version__ = "0.1.0"
