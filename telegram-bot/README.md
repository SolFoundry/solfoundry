# SolFoundry Telegram Bot

Real-time bounty notification bot for [SolFoundry](https://solfoundry.org).

## What It Does

- 🔍 Polls the SolFoundry API for new open bounties
- 📢 Posts bounty notifications to a Telegram channel with inline buttons
- ⚙️ User subscription management: filter by tier, category, reward amount
- 💰 Inline buttons for quick bounty details and claiming on GitHub

## Setup

### 1. Create a Telegram Bot

1. Open Telegram → search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow prompts → copy the bot token

### 2. Create a Notification Channel

1. Create a new Telegram channel
2. Add your bot as an **admin** (required to post messages)
3. Note the channel ID:
   - For private channels: forward a message from the channel to [@userinfobot](https://t.me/userinfobot)
   - Format: `-1001234567890`

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values:
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=-1001234567890
SOLFOUNDRY_API_URL=https://solfoundry.org/api
POLL_INTERVAL_SECS=60
```

### 4. Run

```bash
# Direct
pip install -r requirements.txt
python bot.py

# Docker
docker build -t solfoundry-telegram-bot .
docker run -d --env-file .env solfoundry-telegram-bot
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Show welcome message |
| `/subscribe` | Set bounty filter preferences |
| `/unsubscribe` | Stop notifications |
| `/list` | List latest open bounties |
| `/status` | Show bot and subscription status |
| `/help` | Show help |

## Inline Buttons

Each bounty notification includes:
- 📋 **Issue Details** → opens the bounty issue on GitHub
- 🚨 **Claim on GitHub** → opens the bounty issue for claiming
- 📊 **View All Bounties** → links to the bounties page

## Architecture

```
SolFoundry API (polling)
         │
         ▼
    SolFoundryBot.poll_bounties()
         │
         ├──► SubscriptionStore.matches() — filter by user prefs
         │
         └──► Telegram Bot.notify_channel()
                      │
                      ▼
               Telegram Channel
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | BotFather bot token |
| `TELEGRAM_CHAT_ID` | ✅ | — | Channel ID (e.g. `-1001234567890`) |
| `SOLFOUNDRY_API_URL` | ❌ | `https://solfoundry.org/api` | SolFoundry API base URL |
| `POLL_INTERVAL_SECS` | ❌ | `60` | Seconds between bounty polls |
| `LOG_LEVEL` | ❌ | `INFO` | Logging level |

## Deployment

The bot is stateless and runs as a single Python process. Recommended deployment:

- **Railway** / **Render** — set env vars and deploy
- **Docker** — use the included Dockerfile
- **Systemd** — create a service unit for production

## License

MIT
