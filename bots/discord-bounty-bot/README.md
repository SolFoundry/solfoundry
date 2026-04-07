# SolFoundry Discord Bounty Bot

🏭 Discord bot for SolFoundry bounty notifications

## Features

- ✅ **New bounty postings** - Automatic notifications with rich embeds
- ✅ **Leaderboard command** - `/leaderboard` shows top contributors
- ✅ **Subscription filters** - `/subscribe` to filter by bounty type and reward level
- ✅ **Unsubscribe command** - `/unsubscribe` to manage preferences
- ✅ **User preferences** - SQLite storage for persistent settings
- ✅ **Configurable notifications** - Filter by type (feature, bugfix, integration, etc.) and level (T1, T2, T3)

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your tokens
```

### 3. Get Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the token to `.env`
5. Enable "Message Content Intent" in Bot settings
6. Invite bot to your server with proper permissions

### 4. Get GitHub Token

1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens)
2. Create a new token with `public_repo` scope
3. Copy the token to `.env`

### 5. Run the Bot

```bash
python bot.py
```

## Commands

| Command | Description |
|---------|-------------|
| `/leaderboard` | Display top bounty contributors |
| `/subscribe [type] [level]` | Subscribe to bounty notifications with filters |
| `/unsubscribe [type] [level] [--all]` | Unsubscribe from notifications |
| `/status` | Show your current subscription status |

## Subscription Filters

### Bounty Types
- `feature` - New features
- `bugfix` - Bug fixes
- `integration` - Integrations
- `documentation` - Documentation
- `testing` - Testing

### Reward Levels
- `T1` - Tier 1 (1M+ $FNDRY)
- `T2` - Tier 2 (500K $FNDRY)
- `T3` - Tier 3 (100K $FNDRY)

## Examples

```bash
# Subscribe to all bounties (no filters)
/subscribe

# Subscribe to only feature bounties
/subscribe bounty_type:feature

# Subscribe to T1 and T2 rewards
/subscribe reward_level:T1 reward_level:T2

# Unsubscribe from everything
/unsubscribe all:true

# Check your subscription
/status
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              SolFoundry Discord Bot                  │
├─────────────────────────────────────────────────────┤
│  GitHub API Polling (every 5 min)                   │
│  ↓                                                   │
│  Fetch issues with "bounty" label                   │
│  ↓                                                   │
│  Parse bounty type & reward level                   │
│  ↓                                                   │
│  Check database for posted bounties                 │
│  ↓                                                   │
│  Filter by user subscriptions                       │
│  ↓                                                   │
│  Post to Discord channels with rich embeds          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              SQLite Database                         │
├─────────────────────────────────────────────────────┤
│  user_subscriptions: User preferences               │
│  posted_bounties: Avoid duplicate posts             │
│  leaderboard_cache: Cached contributor data         │
└─────────────────────────────────────────────────────┘
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Discord bot token | Yes |
| `GITHUB_TOKEN` | GitHub PAT | No (but recommended) |
| `GITHUB_REPO` | Repository to monitor | No (default: SolFoundry/solfoundry) |
| `DATABASE_PATH` | SQLite database path | No (default: bounty_bot.db) |

## Development

### Testing Locally

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run bot
python bot.py
```

### Docker (Optional)

```bash
docker build -t solfoundry-discord-bot .
docker run -e DISCORD_TOKEN=xxx -e GITHUB_TOKEN=xxx solfoundry-discord-bot
```

## License

Same as SolFoundry main repository

## Support

For issues or questions, please open an issue in the main SolFoundry repository.

---

**Fixes #853** - Bounty T2: Discord Bot for Bounty Notifications
