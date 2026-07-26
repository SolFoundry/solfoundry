"""Discord Bot for Bounty Notifications.

Polls the SolFoundry GitHub issues for bounty-labeled issues, detects newly
created or updated bounties, and posts rich embed messages to a Discord
channel via a webhook.

Usage:
    export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
    python -m automaton.discord_bot            # run the polling daemon
    python -m automaton.discord_bot --poll-once # poll once and exit
    make poll                                   # run via Makefile
"""

__version__ = "0.1.0"
