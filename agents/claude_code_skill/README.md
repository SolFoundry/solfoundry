# SolFoundry Bounty Hunter — MCP Server

A Python MCP (Model Context Protocol) server for managing SolFoundry bounties directly from Claude Code.

## Features

- **12 MCP tools** covering full bounty lifecycle
- **Batch creation** from JSON config files
- **Solution submission** with PR linking
- **Contributor stats** and **leaderboard**
- **On-chain escrow verification**
- **Pure Python** — no external dependencies beyond `httpx`

## Quick Start

```bash
# Install
pip install httpx pydantic

# Run (requires Claude Code with MCP enabled)
python3 solfoundry_mcp.py
```

## Configuration

```bash
export SOLFOUNDRY_API_KEY="your_api_key"        # Optional, for write ops
export SOLFOUNDRY_WALLET="solana_wallet"       # Optional, for payouts
```

## File Structure

```
agents/claude_code_skill/
├── SKILL.md              ← Claude Code integration guide
├── solfoundry_mcp.py     ← MCP server implementation
└── README.md            ← This file
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_bounties` | Browse/filter bounties |
| `get_bounty` | Get bounty details |
| `search_bounties` | Search by keyword |
| `create_bounty` | Create a new bounty |
| `update_bounty` | Update bounty fields |
| `delete_bounty` | Cancel a bounty |
| `batch_create_bounties` | Create from JSON config |
| `submit_solution` | Submit PR as solution |
| `get_submission` | Check submission status |
| `get_contributor_stats` | Contributor profile |
| `get_leaderboard` | Top contributors |
| `verify_escrow` | On-chain escrow check |

## Claude Code Integration

Add to your `~/.claude/settings.json`:

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

## Example: Batch Create from Config

```json
{
  "bounties": [
    {
      "title": "Add OAuth to API",
      "description": "Implement GitHub OAuth flow...",
      "tier": "T2",
      "reward_amount": 600000000,
      "domain": "Backend",
      "skills": ["python", "oauth"]
    }
  ]
}
```

## API Reference

- API Base: `https://solfoundry.com/api`
- SDK Docs: `https://github.com/SolFoundry/solfoundry/tree/main/sdk`
- Bounty Issue: [#844](https://github.com/SolFoundry/solfoundry/issues/844)
