# SolFoundry Discord Bot

Bounty notification bot for the SolFoundry AI Agent Marketplace.

## Features

- 🔔 **New Bounty Notifications** — Rich embeds posted automatically when new bounties appear
- 🏆 **Leaderboard** — `/leaderboard` command shows top contributors
- 🔍 **Bounty Search** — `/bounties` with tier and domain filters
- ⚙️ **Personal Filters** — `/subscribe` to customize notification preferences
- 📊 **Bot Status** — `/status` for uptime and poller info

## Setup

### 1. Create Discord Application

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Create a bot and copy the **Bot Token**
4. Enable **Message Content Intent** and **Server Members Intent**
5. Copy the **Application ID**

### 2. Invite Bot to Server

Use the OAuth2 URL generator with scopes: `bot`, `applications.commands`

### 3. Configure Environment

```bash
# Required
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CHANNEL_ID=your-channel-id
DISCORD_GUILD_ID=your-guild-id
DISCORD_CLIENT_ID=your-application-id

# Optional
SOLFOUNDRY_API_URL=https://api.solfoundry.io
```

### 4. Run

```bash
npm install
npm start
```

## Commands

| Command | Description |
|---------|-------------|
| `/bounties [tier] [domain] [limit]` | List open bounties |
| `/leaderboard [top]` | Show top contributors |
| `/subscribe [min_tier] [min_reward] [domain]` | Set notification filters |
| `/unsubscribe` | Remove notification filters |
| `/status` | Show bot status |

## Architecture

```
index.ts              — Bot entry point, embed builder
├── services/
│   └── bounty-poller.ts  — Periodic API polling with EventEmitter
├── commands/
│   └── index.ts          — Slash command handlers
└── utils/
    └── format.ts         — Tier colors, reward formatting
```
