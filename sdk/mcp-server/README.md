# @solfoundry/mcp-server

MCP (Model Context Protocol) server for [SolFoundry](https://solfoundry.io) bounty management. Create, update, list, and manage bounties directly from Claude Code.

## Features

- 🔍 **Browse Bounties** — Filter by status, tier, reward token, or skill
- ➕ **Create Bounties** — Single or batch creation from JSON config
- ✏️ **Update Bounties** — Modify title, description, reward, deadline
- ❌ **Cancel Bounties** — Remove bounties from the marketplace
- 📬 **Submissions** — View and submit PRs for bounties
- 🏆 **Leaderboard** — View top contributors
- 📊 **Stats** — Platform statistics at a glance
- 📦 **Batch Create** — Create multiple bounties from a config file

## Quick Start

### 1. Install

```bash
npm install
npm run build
```

### 2. Configure

Set environment variables:

```bash
export SOLFOUNDRY_BASE_URL="https://api.solfoundry.io"
export SOLFOUNDRY_TOKEN="your_jwt_token_here"  # Required for write operations
```

### 3. Add to Claude Code

Add the MCP server to your Claude Code configuration (`~/.claude.json` or project `.claude.json`):

```json
{
  "mcpServers": {
    "solfoundry": {
      "command": "node",
      "args": ["/path/to/solfoundry-mcp/dist/server.js"],
      "env": {
        "SOLFOUNDRY_BASE_URL": "https://api.solfoundry.io",
        "SOLFOUNDRY_TOKEN": "your_jwt_token_here"
      }
    }
  }
}
```

### 4. Use in Claude Code

Once configured, you can use these tools in Claude Code:

```
"List all open T2 bounties"
"Create a bounty for building a Python SDK"
"Show me the leaderboard"
"Create bounties from this config file" (with batch-config.json)
```

## Available Tools

| Tool | Description | Auth Required |
|------|-------------|:-------------:|
| `solfoundry_list_bounties` | Browse/filter bounties | No |
| `solfoundry_get_bounty` | Get single bounty details | No |
| `solfoundry_create_bounty` | Create a new bounty | Yes |
| `solfoundry_update_bounty` | Update existing bounty | Yes |
| `solfoundry_delete_bounty` | Cancel a bounty | Yes |
| `solfoundry_batch_create` | Create multiple bounties from JSON | Yes |
| `solfoundry_list_submissions` | View submissions for a bounty | No |
| `solfoundry_submit` | Submit a PR for a bounty | Yes |
| `solfoundry_leaderboard` | View contributor leaderboard | No |
| `solfoundry_stats` | Platform statistics | No |

## Batch Create

Create multiple bounties at once from a JSON config file:

```json
{
  "bounties": [
    {
      "title": "Add Python SDK Examples",
      "description": "Create Python SDK with examples...",
      "reward_amount": 500000,
      "reward_token": "FNDRY",
      "tier": "T2",
      "skills": ["python", "api", "sdk"]
    },
    {
      "title": "Build Analytics Dashboard",
      "description": "Web dashboard for bounty analytics...",
      "reward_amount": 800000,
      "reward_token": "FNDRY",
      "tier": "T2",
      "skills": ["react", "typescript"]
    }
  ]
}
```

In Claude Code, provide the JSON content and ask:
> "Create these bounties on SolFoundry"

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLFOUNDRY_BASE_URL` | `https://api.solfoundry.io` | API base URL |
| `SOLFOUNDRY_TOKEN` | — | JWT auth token (required for write ops) |

## Development

```bash
# Install dependencies
npm install

# Run in dev mode (auto-reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT
