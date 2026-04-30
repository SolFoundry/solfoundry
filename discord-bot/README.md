# SolFoundry Discord Bot

A Discord bot for SolFoundry that provides bounty notifications, leaderboards, and community engagement features.

## Features

- **Bounty Posting Bot** — Automatically posts new bounties to Discord channels with rich embeds (title, reward, deadline, description, link)
- **Leaderboard Command** (`/leaderboard`) — Shows top contributors by bounty earnings and completions
- **Notification Filters** (`/filters`) — Per-user customizable filters for bounty type, reward level, and categories
- **Interactive Buttons** — Quick action buttons on bounty posts (View Details, Claim, Subscribe)
- **Bounty Status Updates** — Automated notifications when bounty status changes (claimed, in-progress, completed)

## Prerequisites

- Node.js >= 18.0.0
- A Discord Bot Application with the bot invited to your server
- SolFoundry API access (optional, for live data)

## Setup

### 1. Create a Discord Bot Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section and create a bot
4. Copy the **Bot Token** (keep this secret!)
5. Copy the **Application ID** (Client ID)
6. Enable the following **Privileged Gateway Intents**:
   - Message Content Intent
   - Server Members Intent (optional)
7. Invite the bot to your server using this URL (replace `YOUR_CLIENT_ID`):
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147518464&scope=bot%20applications.commands
   ```

### 2. Configure Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required variables:
| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Your Discord bot token |
| `DISCORD_CLIENT_ID` | Your Discord application ID |
| `BOUNTY_CHANNEL_ID` | The Discord channel ID for bounty notifications |

Optional variables:
| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_GUILD_ID` | Guild ID for guild-scoped commands | (global) |
| `ANNOUNCEMENTS_CHANNEL_ID` | Channel for general announcements | - |
| `LEADERBOARD_CHANNEL_ID` | Channel for periodic leaderboard posts | - |
| `SOLFOUNDRY_API_URL` | SolFoundry API base URL | `https://api.solfoundry.io` |
| `SOLFOUNDRY_API_TOKEN` | API authentication token | - |
| `BOUNTY_POLL_INTERVAL` | Bounty polling interval (seconds) | `60` |
| `LOG_LEVEL` | Log level (debug/info/warn/error) | `info` |
| `NODE_ENV` | Environment (development/production) | `development` |

### 3. Install Dependencies

```bash
cd discord-bot
npm install
```

### 4. Build

```bash
npm run build
```

### 5. Run

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

## Commands

### `/leaderboard [limit]`

Shows the top contributors by bounty earnings and completions.

- `limit` (optional): Number of entries to show (1-25, default: 10)

**Example:**
```
/leaderboard
/leaderboard limit: 5
```

### `/filters [tiers] [min_reward] [categories] [reset]`

Configure your bounty notification preferences.

- `tiers` (optional): Comma-separated tier numbers (e.g., `1,2,3`)
- `min_reward` (optional): Minimum reward in $FNDRY
- `categories` (optional): Comma-separated categories (e.g., `frontend,backend`)
- `reset` (optional): Set to `true` to reset all filters

**Examples:**
```
/filters tiers: 1,2 min_reward: 500
/filters categories: frontend,backend
/filters reset: true
```

## Interactive Buttons

Bounty posts include interactive buttons:

- **🔗 View Details** — Opens the bounty page (link button)
- **🎯 Claim** — Starts the bounty claiming process (T2/T3 only)
- **🔔 Subscribe** — Subscribe to status updates for this bounty

## Docker Deployment

Build and run with Docker:

```bash
# Build the image
docker build -f Dockerfile.discord-bot -t solfoundry/discord-bot .

# Run with environment file
docker run --env-file .env solfoundry/discord-bot
```

Or add to your Docker Compose stack:

```yaml
services:
  discord-bot:
    build:
      context: .
      dockerfile: Dockerfile.discord-bot
    restart: unless-stopped
    env_file: .env
```

## Development

### Project Structure

```
discord-bot/
├── src/
│   ├── index.ts          # Entry point
│   ├── config.ts         # Configuration management
│   ├── bot.ts            # Main bot class
│   ├── commands/
│   │   ├── index.ts      # Command routing
│   │   ├── leaderboard.ts # /leaderboard command
│   │   └── filters.ts     # /filters command
│   ├── services/
│   │   ├── api-client.ts     # SolFoundry API client
│   │   ├── bounty-poster.ts  # Bounty posting service
│   │   └── status-updater.ts # Status update service
│   ├── utils/
│   │   ├── embeds.ts   # Discord embed builders
│   │   ├── buttons.ts  # Interactive button builders
│   │   └── logger.ts   # Structured logging
│   └── __tests__/      # Unit tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
└── README.md
```

### Run Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

## Architecture

The bot follows a modular architecture:

1. **Configuration** — Environment-based config with validation
2. **Discord Client** — discord.js v14 client with intents and partials
3. **Command Handlers** — Slash command registration and routing
4. **Services** — Background services for bounty monitoring and status updates
5. **Utilities** — Embed builders, button builders, and logging

## Error Handling

- All API requests have timeout protection
- Failed Discord interactions are caught and reported to users
- Background services log errors without crashing the bot
- Graceful shutdown on SIGTERM/SIGINT

## License

MIT
