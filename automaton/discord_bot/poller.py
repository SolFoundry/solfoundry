"""Poller that drives the Discord notification loop.

On each tick it fetches all open bounty issues from GitHub, compares them
against the persisted ``seen`` state, and posts an embed for anything that is
new or changed.  The poller loops forever by default (with SIGINT /
SIGTERM handling) so it can run as a daemon.
"""

from __future__ import annotations

import logging
import signal
import time
from typing import Any, Callable

from automaton.discord_bot import config, embeds, github_client, persistence, webhook

log = logging.getLogger(__name__)


class Poller:
    """Thin wrapper to make the core loop testable without real network / IO."""

    def __init__(
        self,
        config_holder: config.Config,
        seen: persistence.SeenState,
        *,
        fetch_issues: Callable[..., list[dict[str, Any]]] = github_client.fetch_bounty_issues,
        send_embed: Callable[..., dict[str, Any]] = webhook.send_to_webhook,
    ) -> None:
        self.config = config_holder
        self.seen = seen
        self._fetch_issues = fetch_issues
        self._send_embed = send_embed
        self._running = True

    # ------------------------------------------------------------------
    # Core logic
    # ------------------------------------------------------------------
    def tick(self) -> tuple[int, int]:
        """Run a single poll cycle.

        Returns:
            A ``(created, updated)`` count of issues notified this tick.
        """
        issues = self._fetch_issues(
            repo=self.config.solfoundry_repo,
            token=self.config.github_token,
            state="open",
        )
        created = 0
        updated = 0
        for raw_issue in issues:
            number = int(raw_issue["number"])
            updated_at = raw_issue.get("updated_at")

            if self.seen.has_seen(number, updated_at):
                continue

            # Decide whether this is the first time we've seen the issue at
            # all (``new``) or a follow-up state change (``updated``).
            if self.seen.has_seen(number, None):
                action = "updated"
            else:
                action = "new"

            bounty = embeds.parse_bounty(raw_issue)
            embed_payload = embeds.build_embed(bounty, action=action)
            try:
                self._send_embed(
                    webhook_url=self.config.discord_webhook_url,
                    embed=embed_payload,
                    content=f"Issue #{number} ({bounty['title']})",
                )
            except Exception:
                log.exception("Failed to post Discord embed for issue #%d", number)
            self.seen.mark_seen(number, updated_at)

            if action == "new":
                created += 1
            else:
                updated += 1

        log.info("Tick complete — %d new, %d updated", created, updated)
        return created, updated

    def run(self) -> None:
        """Start the polling loop and block until interrupted."""
        log.info(
            "Starting Discord bounty poller (interval=%ds, repo=%s)",
            self.config.poll_interval,
            self.config.solfoundry_repo,
        )
        log.info("Seen file: %s", self.seen.path)

        handler = lambda *_: setattr(self, "_running", False)
        signal.signal(signal.SIGINT, handler)
        signal.signal(signal.SIGTERM, handler)

        while self._running:
            try:
                self.tick()
            except Exception:
                log.exception("Error during poll tick")

            if self._running:
                time.sleep(self.config.poll_interval)

        log.info("Poller stopped")

    def poll_once(self) -> tuple[int, int]:
        """Convenience for one-off / ``--poll-once`` runs."""
        return self.tick()


def main() -> None:
    """CLI entry point.

    Reads config from env / ``.env``, builds the poller, and either runs the
    daemon loop or performs a single poll and exits.
    """
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Discord bounty notification poller")
    parser.add_argument(
        "--poll-once",
        action="store_true",
        help="Poll once and exit instead of running a daemon loop",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable DEBUG logging",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    cfg = config.get_config()
    seen = persistence.SeenState(cfg.last_seen_file)
    poller = Poller(cfg, seen)

    if args.poll_once:
        created, updated = poller.poll_once()
        print(f"Poll once: {created} new, {updated} updated")
        return

    poller.run()
