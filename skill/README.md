# SolFoundry Claude Code MCP Skill

A [Model Context Protocol](https://modelcontextprotocol.io) server that provides SolFoundry bounty management tools directly in the Claude CLI.

## Installation

### Prerequisites

- Node.js 18+
- A SolFoundry API token (`SOLFOUNDRY_TOKEN`)

### Install from source

```bash
cd skill
npm install
npm run build
```

### Claude Desktop / Claude Code Configuration

Add the skill to your `claude_desktop_config.json` or Claude Code MCP config:

```json
{
  "mcpServers": {
    "solfoundry": {
      "command": "node",
      "args": ["/path/to/solfoundry/skill/dist/index.js"],
      "env": {
        "SOLFOUNDRY_BASE_URL": "https://api.solfoundry.io",
        "SOLFOUNDRY_TOKEN": "your-jwt-token"
      }
    }
  }
}
```

## Tools

### `list_bounties`
List bounties with optional filters.

Parameters:
- `status` (string, optional): Filter by status (`draft`, `open`, `in_progress`, `under_review`, `completed`, `paid`, `cancelled`). Default: `open`.
- `tier` (number, optional): Filter by tier (`1`, `2`, or `3`).
- `limit` (number, optional): Max results (1–100). Default: 20.
- `skip` (number, optional): Pagination offset. Default: 0.

### `get_bounty`
Get full details of a specific bounty.

Parameters:
- `bounty_id` (string, required): UUID of the bounty.

### `create_bounty`
Create a new bounty. Requires authentication.

Parameters:
- `title` (string, required): Bounty title (max 200 chars).
- `description` (string, required): Detailed description (max 5000 chars).
- `reward_amount` (number, required): Reward in $FNDRY tokens.
- `tier` (number, optional): Bounty tier (1, 2, or 3). Default: 1.
- `deadline` (string, optional): ISO 8601 deadline datetime.
- `tags` (string[], optional): Tags (max 10).
- `github_issue_url` (string, optional): Associated GitHub issue URL.

### `update_bounty`
Update an existing bounty. Requires authentication.

Parameters:
- `bounty_id` (string, required): UUID of the bounty.
- Plus any subset of `title`, `description`, `reward_amount`, `status`, `deadline`, `tags`.

### `delete_bounty`
Delete a draft or cancelled bounty. Requires authentication.

Parameters:
- `bounty_id` (string, required): UUID of the bounty.

### `batch_create_bounties`
Create multiple bounties at once from a JSON array. Requires authentication.

Parameters:
- `bounties` (array, required): Array of bounty objects (max 50). Each object has the same shape as `create_bounty`.
- `publish` (boolean, optional): Publish all immediately (default: `false`, creates as drafts).

### `submit_solution`
Submit a solution (PR) to an existing bounty. Requires authentication.

Parameters:
- `bounty_id` (string, required): UUID of the bounty.
- `pr_url` (string, required): GitHub PR URL.
- `contributor_wallet` (string, optional): Solana wallet address for payout.
- `notes` (string, optional): Submission notes (max 1000 chars).

### `get_contributor`
Get a contributor profile and stats.

Parameters:
- `username` (string, required): GitHub username.

### `list_contributors`
List top contributors.

Parameters:
- `limit` (number, optional): Max results (1–100). Default: 20.
- `skip` (number, optional): Pagination offset.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SOLFOUNDRY_BASE_URL` | `https://api.solfoundry.io` | API base URL |
| `SOLFOUNDRY_TOKEN` | — | JWT auth token (required for mutations) |
| `SOLFOUNDRY_BATCH_DIR` | `./batch` | Directory for batch config files |

## Example: Batch Create from JSON

```json
{
  "bounties": [
    {
      "title": "Implement search API",
      "description": "Build a full-text search endpoint for bounties",
      "reward_amount": 500,
      "tier": 2,
      "tags": ["backend", "api"]
    },
    {
      "title": "Add dark mode",
      "description": "Implement dark mode toggle with persistence",
      "reward_amount": 300,
      "tier": 1,
      "tags": ["frontend", "ui"]
    }
  ],
  "publish": true
}
```