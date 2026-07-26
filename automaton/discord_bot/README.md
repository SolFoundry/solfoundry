# Discord Bot for Bounty Notifications
# ``automaton/discord_bot/``

A lightweight Python daemon that polls the SolFoundry GitHub issues for
``bounty``-labeled issues, detects newly created or updated bounties, and posts
rich embed messages to a Discord channel via a webhook (no full bot token or
OAuth needed).

This module is part of the ``automaton/`` directory — higher-level deployment
automation and notification services.

## Features

- Polls the GitHub Issues search API for `repo:SolFoundry/solfoundry label:bounty`.
- Tracks what it has already notified via a local JSON file
  (``LAST_SEEN_FILE``), so a restart never reposts the same bounty.
- Sends rich Discord embeds containing the bounty title, reward, tier label,
  domain, assignees, and a link to the issue.
- Distinguishes *new* bounties from *updated* bounties (state changes, label
  changes, etc.) and colours the embed accordingly.

## Quick start

### 1. Install dependencies

```bash
cd automaton/discord_bot
pip install -r requirements.txt
```

``requests`` and ``python-dotenv`` are the only runtime dependencies.

### 2. Configure

Copy the example environment file and set the required webhook URL:

```bash
cd /Users/water/dev/solfoundry          # repo root
cp .env.example .env
```

Edit ``.env`` and set ``DISCORD_WEBHOOK_URL`` (required).  The other values
are optional and default sensibly:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| ``DISCORD_WEBHOOK_URL`` | Yes | _(none)_ | Discord incoming-webhook URL |
| ``GITHUB_TOKEN`` | No | _(none)_ | Personal access token (raises rate-limit ceiling) |
| ``SOLFOWNDRY_REPO`` | No | ``SolFoundry/solfoundry`` | GitHub ``owner/repo`` to watch |
| ``POLL_INTERVAL`` | No | ``300`` | Seconds between polls |
| ``LAST_SEEN_FILE`` | No | ``.last_seen_bounties.json`` | Where to store last-seen state |

### 3. Run

```bash
cd /Users/water/dev/solfoundry
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR/WEBHOOK"
python -m automaton.discord_bot      # daemon loop
# or
python -m automaton.discord_bot --poll-once   # poll once and exit
# or via the Makefile
make poll
make poll-once
```

With ``--poll-once`` the poller is suitable for cron.

## Tests

```bash
python -m pytest tests/test_discord_bot.py -v
# or
make discord-bot-test
```

Tests are pure-unit: they exercise parsing, embed-building, persistence, and
poller orchestration with no real GitHub / Discord calls.

## How it works

1. **``config.py``** — reads the env vars / ``.env`` file.
2. **``github_client.py``** — fetches all open bounty issues (paginated).
3. **``embeds.py``** — parses a GitHub issue into structured metadata and
   builds a Discord embed.
4. **``persistence.py``** — the ``SeenState`` JSON file that makes polling
   idempotent.
5. **``webhook.py``** — POSTs the embed to the Discord webhook.
6. **``poller.py``** — orchestrates the loop (or single poll).
7. **``__main__.py``** — the ``python -m automaton.discord_bot`` entry point.

Run ``--verbose`` / ``-v`` for DEBUG logging.

## Notes for maintainers

- Use ``--poll-once`` inside a systemd timer or cron rather than leaving a
  daemon running if the host is ephemeral.
- The ``.last_seen_bounties.json`` file is safe to delete; the next poll
  will simply re-notify everything.
- Webhook URLs are credentials — never commit ``.env`` or the ``.last_seen_*.json``.
  Both are already listed in ``.gitignore``.
