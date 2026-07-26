"""Send messages to Discord via a webhook.

Discord webhooks are simpler than full bot tokens — no OAuth, no install.
We just POST JSON to a webhook URL and Discord posts it.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import requests

log = logging.getLogger(__name__)


def send_to_webhook(
    webhook_url: str,
    embed: dict[str, Any],
    content: Optional[str] = None,
    username: str = "SolFoundry Bounty Bot",
) -> dict[str, Any]:
    """Post a single embed to a Discord webhook.

    Args:
        webhook_url: The Discord webhook URL.
        embed: A single Discord embed dict (not the top-level ``embeds``
            list — this function wraps it).
        content: Optional plain-text message body to include alongside the
            embed.
        username: The bot name shown on the webhook post.

    Returns:
        The JSON response body from Discord (empty on success).

    Raises:
        requests.RequestException: On network / HTTP errors.
        RuntimeError: If Discord returns a non-2xx status.
    """
    payload: dict[str, Any] = {
        "username": username,
        "embeds": [embed],
    }
    if content:
        payload["content"] = content

    log.info("Sending embed to Discord webhook %s", webhook_url[:40] + "...")
    resp = requests.post(webhook_url, json=payload, timeout=30)
    resp.raise_for_status()
    # Discord returns 204 No Content on success; body is empty.
    if resp.status_code not in (200, 204):
        raise RuntimeError(
            f"Discord webhook rejected the message (HTTP {resp.status_code}): "
            f"{resp.text}"
        )
    return resp.json() if resp.text else {}
