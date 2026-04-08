# SolFoundry Telegram Bot

Telegram bot for SolFoundry bounty notifications. Get notified when new bounties are posted, browse open bounties, and track the leaderboard — all from Telegram.

## Setup

### 1. Configuration

```bash
cp .env.example .env
# Edit .env with your values
```

| Variable | Description | Default |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) | *required* |
| `SOLFOUNDRY_API_URL` | SolFoundry API base URL | `https://solfoundry.io` |
| `POLL_INTERVAL_MINUTES` | Bounty polling interval | `5` |
| `DB_PATH` | SQLite database path | `./data/subscribers.db` |

### 2. Install & Run

```bash
npm install
npm run build
npm start
```

Or with Docker:

```bash
docker build -t solfoundry-telegram .
docker run -d --name solfoundry-bot \
  -e TELEGRAM_BOT_TOKEN=your_token \
  -v $(pwd)/data:/app/data \
  solfoundry-telegram
```

## Commands

| Command | Description |
|---|---|
| `/start` | Welcome message & bot overview |
| `/bounties` | List top 10 open bounties |
| `/bounty <id>` | Get details for a specific bounty |
| `/subscribe` | Subscribe to new bounty notifications |
| `/unsubscribe` | Unsubscribe from notifications |
| `/filter <tier\|token\|skill>` | Set notification filters (e.g., `T1;USDC;rust`) |
| `/leaderboard` | Show top contributors |
| `/stats` | Platform statistics |

## Features

- **Auto-notifications**: Polls for new bounties every 5 minutes and notifies subscribed users
- **Inline keyboards**: Quick "View Details" and "Claim" buttons on bounty messages
- **Per-user filters**: Filter notifications by tier (T0-T3), token, or skill
- **SQLite storage**: Persistent subscriber data, no external DB needed
- **Docker ready**: Single-container deployment with volume mount for data

## Architecture

```
src/
├── index.ts      # Entry point — bot init, signal handling
├── commands.ts   # Telegram command handlers
├── api.ts        # SolFoundry API client
├── notifier.ts   # Cron-based new bounty polling & notification
├── storage.ts    # SQLite subscriber storage
├── messages.ts   # Message formatting helpers
└── types.ts      # TypeScript type definitions
```

## Bounty

Built for SolFoundry Bounty #847 — Telegram Bot for New Bounty Notifications (500K $FNDRY).
