"""
SolFoundry MCP Server for Claude Code

Model Context Protocol (MCP) server that wraps the SolFoundry API,
allowing Claude Code to create, list, update, and manage bounties
directly from the CLI.

Usage with Claude Code:
    Add to ~/.claude/mcp_servers/solfoundry.json:
    {
      "mcpServers": {
        "solfoundry": {
          "command": "python3",
          "args": ["/path/to/sol_foundry_mcp_server.py"],
          "env": {
            "SOLFOUNDRY_API_KEY": "your-key-here"
          }
        }
      }
    }
"""

import json
import os
import sys
from typing import Any

try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
except ImportError:
    print("Error: mcp package not installed. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)

import requests

# ----- Configuration -----

SOLFOUNDRY_API_URL = os.environ.get("SOLFOUNDRY_API_URL", "https://solfoundry.io/api")
SOLFOUNDRY_API_KEY = os.environ.get("SOLFOUNDRY_API_KEY", "")

# ----- API Client -----

def api_request(method: str, path: str, **kwargs) -> dict:
    """Make authenticated request to SolFoundry API."""
    url = f"{SOLFOUNDRY_API_URL}{path}"
    headers = {
        "Authorization": f"Bearer {SOLFOUNDRY_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)
    resp.raise_for_status()
    return resp.json() if resp.content else {}


# ----- MCP Server -----

app = Server("solfoundry")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available SolFoundry tools."""
    return [
        Tool(
            name="list_bounties",
            description="List open SolFoundry bounties. Filter by tier, domain, or reward range.",
            inputSchema={
                "type": "object",
                "properties": {
                    "tier": {"type": "string", "enum": ["T1", "T2", "T3"], "description": "Filter by tier"},
                    "domain": {"type": "string", "description": "Filter by domain (backend, frontend, docs, etc.)"},
                    "min_reward": {"type": "integer", "description": "Minimum reward in $FNDRY"},
                    "max_reward": {"type": "integer", "description": "Maximum reward in $FNDRY"},
                    "limit": {"type": "integer", "default": 20, "description": "Max results"},
                },
            },
        ),
        Tool(
            name="get_bounty",
            description="Get details of a specific bounty by ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "bounty_id": {"type": "string", "description": "Bounty ID or number"},
                },
                "required": ["bounty_id"],
            },
        ),
        Tool(
            name="create_bounty",
            description="Create a new SolFoundry bounty.",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Bounty title"},
                    "description": {"type": "string", "description": "Full description with requirements"},
                    "reward": {"type": "integer", "description": "Reward in $FNDRY"},
                    "tier": {"type": "string", "enum": ["T1", "T2", "T3"], "description": "Bounty tier"},
                    "domain": {"type": "string", "description": "Domain (backend, frontend, docs, creative, agent)"},
                    "acceptance_criteria": {"type": "array", "items": {"type": "string"}, "description": "List of acceptance criteria"},
                    "deadline_days": {"type": "integer", "description": "Days until deadline"},
                },
                "required": ["title", "description", "reward", "tier", "domain"],
            },
        ),
        Tool(
            name="update_bounty",
            description="Update an existing bounty (title, description, status).",
            inputSchema={
                "type": "object",
                "properties": {
                    "bounty_id": {"type": "string", "description": "Bounty ID"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "status": {"type": "string", "enum": ["draft", "open", "in_progress", "review", "completed", "cancelled"]},
                },
                "required": ["bounty_id"],
            },
        ),
        Tool(
            name="delete_bounty",
            description="Delete a draft bounty (cannot delete open bounties).",
            inputSchema={
                "type": "object",
                "properties": {
                    "bounty_id": {"type": "string", "description": "Bounty ID"},
                },
                "required": ["bounty_id"],
            },
        ),
        Tool(
            name="claim_bounty",
            description="Claim a bounty to work on it. Locks the bounty to your account.",
            inputSchema={
                "type": "object",
                "properties": {
                    "bounty_id": {"type": "string", "description": "Bounty ID"},
                },
                "required": ["bounty_id"],
            },
        ),
        Tool(
            name="submit_solution",
            description="Submit a solution (PR URL) for a claimed bounty.",
            inputSchema={
                "type": "object",
                "properties": {
                    "bounty_id": {"type": "string", "description": "Bounty ID"},
                    "pr_url": {"type": "string", "description": "GitHub PR URL"},
                    "description": {"type": "string", "description": "Solution description"},
                },
                "required": ["bounty_id", "pr_url"],
            },
        ),
        Tool(
            name="batch_create_bounties",
            description="Create multiple bounties from a YAML or JSON config file.",
            inputSchema={
                "type": "object",
                "properties": {
                    "config_path": {"type": "string", "description": "Path to YAML or JSON config file"},
                    "dry_run": {"type": "boolean", "default": False, "description": "Validate without creating"},
                },
                "required": ["config_path"],
            },
        ),
        Tool(
            name="get_leaderboard",
            description="Get the SolFoundry leaderboard (top earners by $FNDRY).",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "default": 20, "description": "Top N entries"},
                    "period": {"type": "string", "enum": ["all_time", "monthly", "weekly"], "default": "all_time"},
                },
            },
        ),
        Tool(
            name="get_my_bounties",
            description="Get your claimed/active bounties.",
            inputSchema={
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["claimed", "in_progress", "review", "completed"]},
                },
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls."""
    try:
        if name == "list_bounties":
            params = {k: v for k, v in arguments.items() if v is not None}
            result = api_request("GET", "/bounties", params=params)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "get_bounty":
            result = api_request("GET", f"/bounties/{arguments['bounty_id']}")
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "create_bounty":
            payload = {
                "title": arguments["title"],
                "description": arguments["description"],
                "reward": arguments["reward"],
                "tier": arguments["tier"],
                "domain": arguments["domain"],
                "acceptance_criteria": arguments.get("acceptance_criteria", []),
                "deadline_days": arguments.get("deadline_days", 14),
            }
            result = api_request("POST", "/bounties", json=payload)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "update_bounty":
            bounty_id = arguments["bounty_id"]
            payload = {k: v for k, v in arguments.items() if k != "bounty_id" and v is not None}
            result = api_request("PATCH", f"/bounties/{bounty_id}", json=payload)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "delete_bounty":
            bounty_id = arguments["bounty_id"]
            result = api_request("DELETE", f"/bounties/{bounty_id}")
            return [TextContent(type="text", text=json.dumps({"deleted": True, "id": bounty_id}))]

        elif name == "claim_bounty":
            bounty_id = arguments["bounty_id"]
            result = api_request("POST", f"/bounties/{bounty_id}/claim")
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "submit_solution":
            payload = {
                "pr_url": arguments["pr_url"],
                "description": arguments.get("description", ""),
            }
            result = api_request("POST", f"/bounties/{arguments['bounty_id']}/submit", json=payload)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "batch_create_bounties":
            config_path = arguments["config_path"]
            dry_run = arguments.get("dry_run", False)

            with open(config_path) as f:
                if config_path.endswith((".yaml", ".yml")):
                    try:
                        import yaml
                        config = yaml.safe_load(f)
                    except ImportError:
                        return [TextContent(type="text", text="Error: PyYAML not installed. Use JSON.")]
                else:
                    config = json.load(f)

            bounties = config.get("bounties", [])
            results = []
            for bounty in bounties:
                if dry_run:
                    results.append({"validated": True, "bounty": bounty})
                else:
                    try:
                        result = api_request("POST", "/bounties", json=bounty)
                        results.append({"created": True, "id": result.get("id"), "title": bounty["title"]})
                    except Exception as e:
                        results.append({"created": False, "error": str(e), "title": bounty.get("title", "?")})

            return [TextContent(type="text", text=json.dumps(results, indent=2))]

        elif name == "get_leaderboard":
            params = {"limit": arguments.get("limit", 20), "period": arguments.get("period", "all_time")}
            result = api_request("GET", "/leaderboard", params=params)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "get_my_bounties":
            params = {}
            if "status" in arguments:
                params["status"] = arguments["status"]
            result = api_request("GET", "/me/bounties", params=params)
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]


# ----- Main -----

async def main():
    """Run the MCP server on stdio."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options(),
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
