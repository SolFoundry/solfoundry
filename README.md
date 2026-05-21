# SolFoundry MCP Server

Claude Code MCP server for the SolFoundry bounty platform — enables bounty CRUD operations directly from Claude CLI.

## Features

- **List bounties** — Filter by status (open, in_progress, completed, etc.) or tier (T1/T2/T3)
- **Get bounty details** — Full bounty info including submissions and payout status
- **Create bounties** — Post new bounties with reward, tier, repository URL, and acceptance criteria
- **Update bounties** — Modify title, description, reward, or status
- **Delete bounties** — Remove draft or open bounties
- **Submit solutions** — Submit a GitHub PR as a solution to any bounty

## Installation

```bash
npm install -g solfoundry-mcp
```

Or build from source:

```bash
git clone https://github.com/phoenix7956/solfoundry-mcp.git
cd solfoundry-mcp
npm install
npm run build
npm link
```

## Configuration

Set your SolFoundry API key as an environment variable:

```bash
export SOLFOUNDRY_API_KEY=your_api_key_here
```

Get your API key from [app.solfoundry.xyz](https://app.solfoundry.xyz).

## Claude Code Usage

After installing and configuring, Claude Code will automatically discover the MCP server tools:

```
list_bounties    — List open bounties
get_bounty       — Get bounty details by ID
create_bounty    — Create a new bounty
update_bounty    — Update an existing bounty
delete_bounty    — Delete a bounty
submit_solution  — Submit a PR as solution
```

## Claude Code Skill Configuration

Add to your `~/.claude/settings.json` or project CLAUDE.md:

```json
{
  "mcpServers": {
    "solfoundry": {
      "command": "solfoundry-mcp",
      "env": {
        "SOLFOUNDRY_API_KEY": "your_key"
      }
    }
  }
}
```

## Tools

### list_bounties
List bounties with optional filtering.

```typescript
list_bounties({ status?: "open", tier?: 2, limit?: 20 })
```

### get_bounty
Get full details for a specific bounty.

```typescript
get_bounty({ bounty_id: "uuid-here" })
```

### create_bounty
Create a new bounty.

```typescript
create_bounty({
  title: "Fix authentication bug",
  description: "...",
  reward_amount: 500,
  tier: 1,
  repository_url: "https://github.com/owner/repo",
  acceptance_criteria: "..."
})
```

### update_bounty
Update an existing bounty.

```typescript
update_bounty({ bounty_id: "uuid", status: "in_progress", reward_amount: 750 })
```

### delete_bounty
Delete a bounty.

```typescript
delete_bounty({ bounty_id: "uuid" })
```

### submit_solution
Submit a GitHub PR as a solution.

```typescript
submit_solution({
  bounty_id: "uuid",
  pr_url: "https://github.com/owner/repo/pull/123",
  contributor_wallet: "SolanaWalletAddress",
  notes: "Fixed the bug as described"
})
```

## Bounty Tiers

| Tier | Description | Typical Reward |
|------|-------------|----------------|
| T1   | Small, focused task | ~$100-500 |
| T2   | Medium complexity | ~$500-2000 |
| T3   | Large, multi-part | ~$2000+ |

## License

MIT
