# Automaton

This directory is reserved for higher-level deployment automation (CI glue, release orchestration).

Concrete assets for the Phase 3 bounty live alongside it:

- `infra/terraform` — DigitalOcean VPC, DOKS cluster, optional managed Postgres
- `infra/k8s` — Kubernetes manifests (for example HPA)
- `monitoring/` — Docker Compose stack (Prometheus, Grafana, Loki, Alertmanager, Blackbox)
- `scripts/` — Rollback, backup, and Anchor verification helpers
- ``docs/deployment-and-monitoring.md`` — Architecture, procedures, and monitoring guide
- ``docs/runbooks/incident-response.md`` — Incident response
- ``discord_bot/`` — Discord webhook bot for bounty notifications

## Discord Bot for Bounty Notifications

The ``automaton/discord_bot/`` module posts new/updated bounties to a Discord
channel via an incoming webhook (no OAuth bot token needed).

```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR/WEBHOOK"
python -m automaton.discord_bot            # daemon loop
python -m automaton.discord_bot --poll-once # single poll (for cron)
make poll                                   # via Makefile
```

Configuration lives in ``.env`` (``DISCORD_WEBHOOK_URL`` required;
``GITHUB_TOKEN``, ``SOLFOWNDRY_REPO``, ``POLL_INTERVAL``, ``LAST_SEEN_FILE``
optional).  See ``automaton/discord_bot/README.md`` for details.
