# SolFoundry Discord Bot

A Discord bot that posts new bounties to a channel, displays live leaderboard rankings, and allows users to filter notifications by bounty type and reward level.

## Features

- **Rich embeds** — New bounty postings with colorful Discord embeds
- **Interactive buttons** — View bounty, get details, subscribe directly from the message
- **Leaderboard command** — `/leaderboard` displays top contributors
- **User filters** — `/filters` to set notification preferences (min/max reward, tiers, tags)
- **Slash commands** — Full set of Discord slash commands
- **Background polling** — Automatically checks for new bounties at configurable intervals

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/poll` | Manually trigger a poll |
| POST | `/api/v1/start` | Start the Discord bot |
| POST | `/api/v1/stop` | Stop the Discord bot |
| GET | `/api/v1/stats` | Bot statistics |

## Configuration

Environment variables (prefix: `DISCORD_BOT_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_BOT_DISCORD_TOKEN` | `""` | Discord Bot token |
| `DISCORD_BOT_DISCORD_GUILD_ID` | `""` | Guild ID to register slash commands |
| `DISCORD_BOT_DISCORD_CHANNEL_ID` | `""` | Default channel to post bounties to |
| `DISCORD_BOT_SOLFOUNDRY_API_URL` | `http://localhost:8000` | SolFoundry API base URL |
| `DISCORD_BOT_SOLFOUNDRY_API_TOKEN` | `""` | SolFoundry API auth token |
| `DISCORD_BOT_POLL_INTERVAL_SECONDS` | `60` | Polling interval |
| `DISCORD_BOT_DEBUG` | `false` | Enable debug logging |

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run with environment variables
DISCORD_BOT_DISCORD_TOKEN=MTE4... \
DISCORD_BOT_SOLFOUNDRY_API_URL=https://api.solfoundry.io \
DISCORD_BOT_DISCORD_CHANNEL_ID=123456789 \
python -m app.main

# Docker
docker build -t solfoundry-discord-bot .
docker run -e DISCORD_BOT_DISCORD_TOKEN=xxx -p 8030:8030 solfoundry-discord-bot
```

## Discord Commands

| Command | Description |
|---------|-------------|
| `/subscribe` | Subscribe to bounty notifications |
| `/unsubscribe` | Stop receiving notifications |
| `/filters` | Set filters: `/filters min_reward:100 tiers:1,2 tags:backend` |
| `/leaderboard` | View top contributors leaderboard |
| `/stats` | Show bot statistics |
| `/help` | Show available commands |