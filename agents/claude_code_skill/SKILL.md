# SolFoundry Bounty Hunter — Claude Code Skill

Manage SolFoundry bounties directly from Claude Code via this Python MCP server.

## What It Does

- **Browse** open bounties, filter by tier/domain/status
- **Search** for bounties matching your skills
- **Create** new bounties with full metadata
- **Update** bounty details (title, description, reward, status)
- **Delete** (cancel) bounties you own
- **Batch create** from JSON config files
- **Submit** solutions (PR URL) to bounties
- **Check** your contributor stats and leaderboard
- **Verify** on-chain escrow status

## Requirements

- Python 3.10+
- `pip install httpx pydantic`
- (Optional) Solana wallet for payouts

## Setup

### 1. Install Dependencies

```bash
pip install httpx pydantic
```

### 2. Set Environment

```bash
# Optional: API key for write operations
export SOLFOUNDRY_API_KEY="your_key_here"

# Optional: Default wallet for payouts
export SOLFOUNDRY_WALLET="your_solana_wallet_address"
```

### 3. Configure Claude Code

In your `~/.claude/skills/` directory, create a skill entry:

```json
{
  "name": "solfoundry",
  "description": "Manage SolFoundry bounties",
  "command": "python3 /path/to/solfoundry_mcp.py"
}
```

Or use the MCP server URL directly in Claude Code's `settings.json`:

```json
{
  "mcpServers": {
    "solfoundry": {
      "command": "python3",
      "args": ["/path/to/solfoundry_mcp.py"]
    }
  }
}
```

## Tools

### `list_bounties`
List open bounties with optional filters.

```json
{
  "tier": "T1|T2|T3",
  "domain": "Frontend|Backend|Agent|Integration|...",
  "status": "open|draft|in_progress|under_review|completed",
  "limit": 20
}
```

### `get_bounty`
Get detailed info for a specific bounty.

```json
{ "bounty_id": "uuid-or-issue-number" }
```

### `search_bounties`
Search bounties by keyword.

```json
{ "query": "typescript", "limit": 10 }
```

### `create_bounty`
Create a new bounty.

```json
{
  "title": "Add Rate Limiting to API",
  "description": "Implement rate limiting using Redis...",
  "tier": "T2",
  "reward_amount": 600000,
  "domain": "Backend",
  "skills": ["typescript", "redis"],
  "acceptance_criteria": ["Limits per IP", "Configurable thresholds"],
  "deadline": "2025-06-01T00:00:00Z"
}
```

> Note: `reward_amount` is in $FNDRY micro-units (1 FNDRY = 1,000,000 units). 600K FNDRY = 600000000.

### `update_bounty`
Update an existing bounty.

```json
{
  "bounty_id": "uuid",
  "title": "New Title",
  "reward_amount": 800000,
  "status": "in_progress"
}
```

### `delete_bounty`
Cancel a bounty.

```json
{ "bounty_id": "uuid", "reason": "Budget constraints" }
```

### `batch_create_bounties`
Create multiple bounties from a JSON config file.

```json
{
  "config_path": "./bounties-config.json"
}
```

Config file format:
```json
{
  "bounties": [
    {
      "title": "Bounty 1",
      "description": "...",
      "tier": "T2",
      "reward_amount": 500000
    }
  ]
}
```

### `submit_solution`
Submit a PR as a solution to a bounty.

```json
{
  "bounty_id": "uuid",
  "pr_url": "https://github.com/user/repo/pull/123",
  "notes": "Implements all acceptance criteria"
}
```

### `check_submission`
Check your submission status.

```json
{ "submission_id": "uuid" }
```

### `get_contributor_stats`
Get your contributor profile stats.

```json
{
  "github_username": "your_username"
}
```

### `get_leaderboard`
Get top contributors.

```json
{ "limit": 10 }
```

### `verify_escrow`
Verify on-chain escrow status for a bounty.

```json
{ "bounty_id": "uuid" }
```

## Usage Examples

### Find all T2 Agent bounties

```
list_bounties(tier="T2", domain="Agent", limit=20)
```

### Create a bounty from config

```
batch_create_bounties(config_path="./q2-bounties.json")
```

### Submit a solution

```
submit_solution(
  bounty_id="abc123-uuid",
  pr_url="https://github.com/myrepo/pull/42",
  notes="Fixed all acceptance criteria"
)
```

### Check your earnings

```
get_contributor_stats(github_username="mygithub")
```

## File Structure

```
agents/claude_code_skill/
├── SKILL.md           ← This file
├── solfoundry_mcp.py  ← MCP server implementation
└── README.md          ← Setup guide
```

## API Base

- **Production**: `https://solfoundry.com/api`
- SDK Reference: `https://github.com/SolFoundry/solfoundry/tree/main/sdk`
