"""SolFoundry MCP Server — Claude Code Skill for bounty management.

Provides CLI commands for bounty CRUD operations, integration with
SolFoundry API, and support for batch bounty creation from config files.
"""

import asyncio
import json
import logging
import sys
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

API_BASE = "https://solfoundry.xyz/api"


# --- MCP Server Implementation ---

class SolFoundryMCPServer:
    """MCP server for SolFoundry bounty management."""

    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self.http = httpx.AsyncClient(
            base_url=API_BASE,
            headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
            timeout=30.0,
        )

    async def close(self):
        await self.http.aclose()

    # --- Tool Definitions (MCP format) ---

    @staticmethod
    def list_tools() -> list[dict]:
        """Return MCP tool definitions."""
        return [
            {
                "name": "list_bounties",
                "description": "List open SolFoundry bounties with optional filters",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "tier": {"type": "string", "enum": ["T1", "T2", "T3"], "description": "Filter by tier"},
                        "status": {"type": "string", "enum": ["open", "in_progress", "completed"], "default": "open"},
                        "domain": {"type": "string", "description": "Filter by domain (Frontend, Backend, Agent, etc.)"},
                        "limit": {"type": "number", "default": 20, "description": "Max results"},
                    },
                },
            },
            {
                "name": "get_bounty",
                "description": "Get detailed information about a specific bounty",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "bounty_id": {"type": "number", "description": "Bounty issue number"},
                    },
                    "required": ["bounty_id"],
                },
            },
            {
                "name": "create_bounty",
                "description": "Create a new SolFoundry bounty",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Bounty title"},
                        "description": {"type": "string", "description": "Detailed description"},
                        "tier": {"type": "string", "enum": ["T1", "T2", "T3"]},
                        "reward": {"type": "number", "description": "Reward in $FNDRY"},
                        "domain": {"type": "string", "description": "Domain category"},
                        "acceptance_criteria": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of acceptance criteria",
                        },
                        "skills": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Required skills/languages",
                        },
                        "deadline": {"type": "string", "description": "ISO 8601 deadline"},
                    },
                    "required": ["title", "description", "tier", "reward"],
                },
            },
            {
                "name": "update_bounty",
                "description": "Update an existing bounty",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "bounty_id": {"type": "number", "description": "Bounty issue number"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "reward": {"type": "number"},
                        "status": {"type": "string", "enum": ["open", "in_progress", "completed", "cancelled"]},
                        "acceptance_criteria": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["bounty_id"],
                },
            },
            {
                "name": "delete_bounty",
                "description": "Cancel/close a bounty",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "bounty_id": {"type": "number", "description": "Bounty issue number"},
                        "reason": {"type": "string", "description": "Reason for cancellation"},
                    },
                    "required": ["bounty_id"],
                },
            },
            {
                "name": "batch_create_bounties",
                "description": "Create multiple bounties from a config file (JSON)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "config_path": {"type": "string", "description": "Path to JSON config file"},
                        "config_json": {"type": "string", "description": "JSON config string (alternative to file)"},
                    },
                },
            },
            {
                "name": "claim_bounty",
                "description": "Claim a bounty and set up development environment",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "bounty_id": {"type": "number", "description": "Bounty issue number"},
                        "wallet_address": {"type": "string", "description": "Solana wallet for payout"},
                    },
                    "required": ["bounty_id"],
                },
            },
            {
                "name": "check_wallet",
                "description": "Check $FNDRY token balance for a wallet",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "wallet_address": {"type": "string", "description": "Solana wallet address"},
                    },
                    "required": ["wallet_address"],
                },
            },
        ]

    # --- Tool Implementations ---

    async def list_bounties(self, tier: str = "", status: str = "open",
                            domain: str = "", limit: int = 20) -> list[dict]:
        """List bounties with optional filters."""
        params = {"status": status, "limit": limit}
        if tier: params["tier"] = tier
        if domain: params["domain"] = domain

        try:
            resp = await self.http.get("/bounties", params=params)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return [{"error": str(e)}]

    async def get_bounty(self, bounty_id: int) -> dict:
        """Get bounty details."""
        try:
            resp = await self.http.get(f"/bounties/{bounty_id}")
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    async def create_bounty(self, title: str, description: str, tier: str,
                            reward: int, domain: str = "", **kwargs) -> dict:
        """Create a new bounty."""
        payload = {
            "title": title,
            "description": description,
            "tier": tier,
            "reward": reward,
            "domain": domain,
        }
        if "acceptance_criteria" in kwargs:
            payload["acceptance_criteria"] = kwargs["acceptance_criteria"]
        if "skills" in kwargs:
            payload["skills"] = kwargs["skills"]
        if "deadline" in kwargs:
            payload["deadline"] = kwargs["deadline"]

        try:
            resp = await self.http.post("/bounties", json=payload)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    async def update_bounty(self, bounty_id: int, **kwargs) -> dict:
        """Update an existing bounty."""
        payload = {k: v for k, v in kwargs.items() if v is not None}
        try:
            resp = await self.http.patch(f"/bounties/{bounty_id}", json=payload)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    async def delete_bounty(self, bounty_id: int, reason: str = "") -> dict:
        """Cancel/close a bounty."""
        try:
            resp = await self.http.delete(f"/bounties/{bounty_id}", json={"reason": reason})
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    async def batch_create_bounties(self, config_path: str = "",
                                     config_json: str = "") -> list[dict]:
        """Create multiple bounties from a config file or JSON string."""
        # Load config
        if config_path:
            with open(config_path, "r") as f:
                config = json.load(f)
        elif config_json:
            config = json.loads(config_json)
        else:
            return [{"error": "Must provide config_path or config_json"}]

        bounties = config.get("bounties", [])
        if not bounties:
            return [{"error": "No bounties found in config"}]

        results = []
        for bounty_data in bounties:
            result = await self.create_bounty(**bounty_data)
            results.append(result)

        return results

    async def claim_bounty(self, bounty_id: int,
                            wallet_address: str = "") -> dict:
        """Claim a bounty and set up dev environment."""
        try:
            resp = await self.http.post(
                f"/bounties/{bounty_id}/claim",
                json={"wallet_address": wallet_address},
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    async def check_wallet(self, wallet_address: str) -> dict:
        """Check $FNDRY token balance."""
        try:
            resp = await self.http.get(f"/wallet/{wallet_address}/balance")
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            return {"error": str(e)}


# --- CLI Entry Point ---

async def main():
    """Run MCP server via stdio."""
    server = SolFoundryMCPServer(api_key=os.environ.get("SOLFOUNDRY_API_KEY", ""))

    # Read JSON-RPC messages from stdin
    while True:
        line = await asyncio.get_event_loop().run_in_executor(None, sys.stdin.readline)
        if not line:
            break

        try:
            request = json.loads(line.strip())
            method = request.get("method", "")
            params = request.get("params", {})
            req_id = request.get("id")

            # Route to handler
            if method == "tools/list":
                result = server.list_tools()
            elif method == "tools/call":
                tool_name = params.get("name", "")
                tool_args = params.get("arguments", {})
                handler = getattr(server, tool_name, None)
                if handler:
                    result = await handler(**tool_args)
                else:
                    result = {"error": f"Unknown tool: {tool_name}"}
            else:
                result = {"error": f"Unknown method: {method}"}

            # Send response
            response = {"jsonrpc": "2.0", "id": req_id, "result": result}
            print(json.dumps(response), flush=True)

        except Exception as e:
            error_response = {
                "jsonrpc": "2.0",
                "id": request.get("id") if 'request' in dir() else None,
                "error": {"code": -32603, "message": str(e)},
            }
            print(json.dumps(error_response), flush=True)

    await server.close()


if __name__ == "__main__":
    import os
    asyncio.run(main())
