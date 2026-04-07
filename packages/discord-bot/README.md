# SolFoundry Discord Bot

Discord bot for SolFoundry bounty notifications and management.

## Features

- **Bounty Listings**: View all active bounties with `/bounties`
- **Search**: Find specific bounties with `/search <query>`
- **Notifications**: Get alerted when new bounties are posted with `/notify`
- **Rich Embeds**: Beautiful formatted bounty information
- **Tier Organization**: Bounties organized by reward level

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file:
   ```
   DISCORD_TOKEN=your_bot_token_here
   ```
4. Start the bot:
   ```bash
   npm start
   ```

## Commands

| Command | Description |
|---------|-------------|
| `/bounties` | List all active SolFoundry bounties |
| `/search <query>` | Search for bounties by keyword |
| `/notify <true/false>` | Enable/disable bounty notifications |

## Setup

1. Create a Discord application at https://discord.com/developers
2. Create a bot and copy the token
3. Invite bot to your server with slash command permissions
4. Configure the `.env` file

## Development

```bash
npm run dev  # Run with nodemon for auto-restart
```

## Requirements

- Node.js 16.9.0 or higher
- Discord.js v14

## License

MIT