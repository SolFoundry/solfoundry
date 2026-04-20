---
name: solfoundry-bounties
description: Manage SolFoundry bounties from Claude Code — list, create, update, submit, and batch-create bounties via MCP tools
---

# SolFoundry Bounties Skill

Use the SolFoundry MCP server to manage bounties on the [SolFoundry](https://solfoundry.io) platform directly from Claude Code.

## Setup

1. Build the MCP server:
   ```bash
   cd /path/to/solfoundry-mcp
   npm install && npm run build
   ```

2. Set environment variables:
   ```bash
   export SOLFOUNDRY_BASE_URL="https://api.solfoundry.io"
   export SOLFOUNDRY_TOKEN="<your_jwt_token>"  # Required for write operations
   ```

3. Register in Claude Code config (`~/.claude.json`):
   ```json
   {
     "mcpServers": {
       "solfoundry": {
         "command": "node",
         "args": ["/path/to/solfoundry-mcp/dist/server.js"],
         "env": {
           "SOLFOUNDRY_BASE_URL": "https://api.solfoundry.io",
           "SOLFOUNDRY_TOKEN": "${SOLFOUNDRY_TOKEN}"
         }
       }
     }
   }
   ```

## Usage Examples

### Browse Bounties
```
"Show me all open T2 bounties"
"List bounties with Python skills"
"Find FNDRY bounties under 500K reward"
```

### Create a Bounty
```
"Create a T1 bounty: 'Add unit tests for API client', 300K FNDRY,
description: 'Add comprehensive unit tests for the frontend API
client covering all endpoints and error cases'"
```

### Batch Create from Config
Provide a JSON config with `examples/batch-config.json` format:
```
"Create these bounties from the config file: { ... JSON ... }"
```

### View Submissions
```
"Show submissions for bounty abc123"
```

### Submit a PR
```
"Submit PR https://github.com/SolFoundry/solfoundry/pull/999
for bounty abc123"
```

### Check Stats & Leaderboard
```
"Show me SolFoundry platform stats"
"Who's on the leaderboard this month?"
```

## Available Tools

| Tool | Description |
|------|-------------|
| `solfoundry_list_bounties` | Browse/filter bounties by status, tier, token, skill |
| `solfoundry_get_bounty` | Get full details of a single bounty |
| `solfoundry_create_bounty` | Create a new bounty (auth required) |
| `solfoundry_update_bounty` | Update bounty fields (auth required) |
| `solfoundry_delete_bounty` | Cancel a bounty (auth required) |
| `solfoundry_batch_create` | Create multiple bounties from JSON (auth required) |
| `solfoundry_list_submissions` | View submissions for a bounty |
| `solfoundry_submit` | Submit a PR for a bounty (auth required) |
| `solfoundry_leaderboard` | View contributor leaderboard |
| `solfoundry_stats` | View platform statistics |

## Batch Config Format

```json
{
  "bounties": [
    {
      "title": "Bounty Title",
      "description": "Detailed description with acceptance criteria",
      "reward_amount": 500000,
      "reward_token": "FNDRY",
      "tier": "T2",
      "skills": ["python", "api"],
      "github_repo_url": "https://github.com/org/repo",
      "github_issue_url": "https://github.com/org/repo/issues/123",
      "deadline": "2026-05-01T00:00:00Z"
    }
  ]
}
```

## Troubleshooting

- **"SOLFOUNDRY_TOKEN required"** — Set the env var before starting Claude Code
- **"API 401"** — Token expired, refresh via SolFoundry web UI
- **"API 404"** — Bounty ID not found, check with `solfoundry_list_bounties`
