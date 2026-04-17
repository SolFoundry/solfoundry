# @solfoundry/discord-bot

Discord bot for SolFoundry bounty notifications, leaderboards, and customizable per-user filters.

## Features

- **🏆 Bounty Notifications** — Automatically posts rich embeds to a channel when new bounties appear
- **📊 Leaderboard** — `/leaderboard` slash command showing top contributors by completed bounties
- **🔔 Custom Filters** — Per-user notification filters by category, tier, and reward level with DM alerts
- **⚡ Slash Commands** — `/setfilter`, `/myfilters`, `/clearfilter`, `/filters` for filter management

## Setup

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application → Bot
3. Enable **Message Content Intent** and **Server Members Intent**
4. Copy the bot token

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your tokens and IDs
```

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | ✅ | Application ID for command registration |
| `BOUNTY_CHANNEL_ID` | ✅ | Channel ID for bounty notifications |
| `DISCORD_GUILD_ID` | ❌ | Guild ID for instant dev command registration |
| `SOLFOUNDRY_API_URL` | ❌ | API base URL (default: `https://api.solfoundry.io`) |
| `SOLFOUNDRY_API_TOKEN` | ❌ | Auth token for private API instances |
| `DB_PATH` | ❌ | SQLite DB path (default: `./data/filters.db`) |

### 3. Install & Run

```bash
npm install
npm run dev       # Development (tsx)
npm run build     # Compile TypeScript
npm start         # Production
```

### 4. Invite Bot to Server

Use this URL (replace `CLIENT_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=274877991936&scope=bot%20applications.commands
```

## Commands

| Command | Description |
|---|---|
| `/leaderboard [limit]` | Top contributors by completed bounties |
| `/filters` | Show available filter options |
| `/setfilter [category] [min_tier] [max_tier] [min_reward]` | Set notification filters |
| `/myfilters` | View your current filters |
| `/clearfilter` | Remove all your filters |

## Architecture

```
discord-bot/
├── src/
│   ├── index.ts              # Entry point, bot client setup
│   ├── register-commands.ts  # Slash command registration
│   ├── commands/
│   │   ├── leaderboard.ts    # /leaderboard
│   │   ├── filters.ts        # /filters
│   │   ├── setfilter.ts      # /setfilter
│   │   ├── myfilters.ts      # /myfilters
│   │   └── clearfilter.ts    # /clearfilter
│   ├── events/
│   │   └── bounty-created.ts # Bounty polling + embed posting + DM notifications
│   └── services/
│       ├── api-client.ts     # SolFoundry REST API client
│       └── filter-store.ts   # SQLite per-user filter persistence
├── data/                     # SQLite DB (gitignored)
├── package.json
├── tsconfig.json
└── .env.example
```

## Docker

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/
COPY .env .env
CMD ["node", "dist/index.js"]
```

## License

MIT