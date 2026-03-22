"""CLI commands for SolFoundry."""

from .bounties import bounties_app
from .bounty import bounty_app
from .status import status_app
from .submissions import submissions_app

__all__ = ["bounties_app", "bounty_app", "status_app", "submissions_app"]
