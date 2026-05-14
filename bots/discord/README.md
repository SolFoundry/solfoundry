# SolFoundry Discord Bot

Posts new bounties to a Discord channel, displays live leaderboard rankings, and allows users to filter notifications by bounty type and reward level.

## Commands

| Command | Description |
|---------|-------------|
| `/bounties [limit]` | List current open bounties (rich embeds) |
| `/leaderboard` | Show top SolFoundry contributors |
| `/bounty <id>` | View a specific bounty |
| `/notify` | Configure personal notification preferences |

## Setup

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application → Bot
3. Enable **Message Content Intent** and **Server Members Intent**
4. Copy the bot token

### 2. Invite to Server

Use this URL (replace `CLIENT_ID`):
```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=2147483648
```

### 3. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `BOUNTY_CHANNEL_ID` | Yes | Channel ID for bounty notifications |
| `GUILD_ID` | No | Server ID for faster command registration |
| `SOLFOUNDRY_API_URL` | No | SolFoundry API URL (default: `https://solfoundry.xyz`) |
| `POLL_INTERVAL_SEC` | No | Polling interval in seconds (default: 60) |
| `LEADERBOARD_LIMIT` | No | Max leaderboard entries (default: 10) |

### 4. Run

```bash
npm install
npm run build
npm start
```

Or with Docker:
```bash
docker build -t solfoundry-discord-bot .
docker run -d --env-file .env solfoundry-discord-bot
```

## Notification Filters

Users can configure personal filters with `/notify`:

- `enabled` — Toggle notifications on/off
- `min-reward` — Minimum reward in $FNDRY
- `tiers` — Comma-separated tiers (e.g., `t1,t2`)
- `skills` — Comma-separated skill tags (e.g., `frontend,rust`)

Matching bounties are sent via DM (if the user has DMs enabled).

## License

MIT
