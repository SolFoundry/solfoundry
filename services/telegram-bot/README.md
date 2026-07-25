# SolFoundry Telegram Bot

A Telegram bot that posts new bounties to a dedicated channel with filtering options. Includes inline keyboard buttons for quick bounty details.

## Features

- **Real-time bounty posting** — New bounties are automatically posted to Telegram
- **Inline keyboard buttons** — Quick action buttons for bounty details and subscription
- **User subscription management** — Users can subscribe/unsubscribe and set filters
- **Filter by reward** — Set minimum/maximum reward amounts
- **Filter by tier** — Choose which bounty tiers to receive
- **Filter by tags** — Subscribe to specific bounty types (backend, frontend, etc.)
- **Background polling** — Automatically checks for new bounties at configurable intervals
- **REST API** — Full API for manual triggering, stats, and subscription management

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/poll` | Manually trigger a poll for new bounties |
| POST | `/api/v1/send` | Send a custom message to a Telegram chat |
| POST | `/api/v1/webhook` | Telegram webhook endpoint |
| GET | `/api/v1/stats` | Bot statistics |
| POST | `/api/v1/subscribe` | Subscribe a user to bounty notifications |
| POST | `/api/v1/unsubscribe` | Unsubscribe a user from bounty notifications |

## Configuration

Environment variables (prefix: `TELEGRAM_BOT_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TELEGRAM_TOKEN` | `""` | Telegram Bot API token |
| `TELEGRAM_BOT_TELEGRAM_CHAT_ID` | `""` | Default channel/group to post bounties to |
| `TELEGRAM_BOT_TELEGRAM_WEBHOOK_URL` | `""` | Optional webhook URL for Telegram |
| `TELEGRAM_BOT_SOLFOUNDRY_API_URL` | `http://localhost:8000` | SolFoundry API base URL |
| `TELEGRAM_BOT_SOLFOUNDRY_API_TOKEN` | `""` | SolFoundry API auth token |
| `TELEGRAM_BOT_POLL_INTERVAL_SECONDS` | `60` | Polling interval |
| `TELEGRAM_BOT_TELEGRAM_PROXY_URL` | `""` | Proxy URL for restricted Telegram access |
| `TELEGRAM_BOT_DEBUG` | `false` | Enable debug logging |

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run with environment variables
TELEGRAM_BOT_TELEGRAM_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11 \
TELEGRAM_BOT_SOLFOUNDRY_API_URL=https://api.solfoundry.io \
TELEGRAM_BOT_TELEGRAM_CHAT_ID=-1001234567890 \
python -m app.main

# Docker
docker build -t solfoundry-telegram-bot .
docker run -e TELEGRAM_BOT_TELEGRAM_TOKEN=xxx -p 8020:8020 solfoundry-telegram-bot
```

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message with subscription button |
| `/subscribe` | Subscribe to all bounty notifications |
| `/unsubscribe` | Stop receiving bounty notifications |
| `/filters` | Set custom filters |
| `/stats` | Bot statistics |
| `/help` | Show help message |

### Filter Format

```
/filters min_reward=100 max_reward=1000 tiers=1,2 tags=bounty,backend
```

## Example

```bash
# Trigger a poll
curl -X POST http://localhost:8020/api/v1/poll

# Check health
curl http://localhost:8020/api/v1/health

# Subscribe a user
curl -X POST http://localhost:8020/api/v1/subscribe \
  -H "Content-Type: application/json" \
  -d '{"chat_id": 123456789, "username": "testuser"}'
```