#!/usr/bin/env python3
"""
SolFoundry MCP Server — Claude Code Skill for bounty management.

Provides MCP (Model Context Protocol) tools for full SolFoundry bounty lifecycle:
browse, search, create, update, delete, batch-create, submit solutions, and stats.

Usage:
    python3 solfoundry_mcp.py

The server speaks JSON-RPC 2.0 over stdio, compatible with Claude Code MCP integration.
"""

import json
import logging
import os
import sys
import uuid
from typing import Any, Optional

import httpx

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_BASE = os.environ.get("SOLFOUNDRY_API_BASE", "https://solfoundry.com/api")
API_KEY = os.environ.get("SOLFOUNDRY_API_KEY", "")
DEFAULT_WALLET = os.environ.get("SOLFOUNDRY_WALLET", "")
TIMEOUT = 30.0

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# HTTP Client
# ---------------------------------------------------------------------------


class SolFoundryClient:
    """Async HTTP client for SolFoundry API."""

    def __init__(self, base_url: str = API_BASE, api_key: str = API_KEY):
        self.base_url = base_url.rstrip("/")
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        self.http = httpx.AsyncClient(
            base_url=self.base_url,
            headers=headers,
            timeout=TIMEOUT,
        )

    async def close(self):
        """Close the HTTP client."""
        await self.http.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
    ) -> dict[str, Any]:
        """Make an HTTP request and return parsed JSON."""
        url = f"{self.base_url}{path}"
        try:
            resp = await self.http.request(method, url, params=params, json=json_data)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP {e.response.status_code} for {method} {url}: {e.response.text[:200]}")
            return {"error": f"HTTP {e.response.status_code}", "detail": e.response.text[:200]}
        except Exception as e:
            logger.error(f"{method} {url} failed: {e}")
            return {"error": str(e)}

    # --- Bounties ---

    async def list_bounties(
        self,
        tier: Optional[str] = None,
        domain: Optional[str] = None,
        status: str = "open",
        skip: int = 0,
        limit: int = 20,
    ) -> dict[str, Any]:
        """List bounties with optional filters."""
        params: dict[str, Any] = {"status": status, "skip": skip, "limit": min(limit, 100)}
        if tier:
            params["tier"] = tier.upper()
        if domain:
            params["domain"] = domain
        return await self._request("GET", "/bounties", params=params)

    async def get_bounty(self, bounty_id: str) -> dict[str, Any]:
        """Get a single bounty by ID."""
        return await self._request("GET", f"/bounties/{bounty_id}")

    async def search_bounties(self, query: str, limit: int = 10) -> dict[str, Any]:
        """Search bounties by keyword."""
        params = {"q": query, "limit": min(limit, 50)}
        return await self._request("GET", "/bounties/search", params=params)

    async def create_bounty(
        self,
        title: str,
        description: str,
        tier: str,
        reward_amount: int,
        domain: str = "",
        skills: Optional[list[str]] = None,
        acceptance_criteria: Optional[list[str]] = None,
        deadline: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create a new bounty."""
        payload: dict[str, Any] = {
            "title": title,
            "description": description,
            "tier": tier.upper(),
            "reward_amount": reward_amount,
        }
        if domain:
            payload["domain"] = domain
        if skills:
            payload["skills"] = skills
        if acceptance_criteria:
            payload["acceptance_criteria"] = acceptance_criteria
        if deadline:
            payload["deadline"] = deadline
        return await self._request("POST", "/bounties", json_data=payload)

    async def update_bounty(
        self,
        bounty_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        reward_amount: Optional[int] = None,
        status: Optional[str] = None,
        acceptance_criteria: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """Update an existing bounty."""
        payload: dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if description is not None:
            payload["description"] = description
        if reward_amount is not None:
            payload["reward_amount"] = reward_amount
        if status is not None:
            payload["status"] = status
        if acceptance_criteria is not None:
            payload["acceptance_criteria"] = acceptance_criteria
        if not payload:
            return {"error": "No update fields provided"}
        return await self._request("PATCH", f"/bounties/{bounty_id}", json_data=payload)

    async def delete_bounty(self, bounty_id: str, reason: str = "") -> dict[str, Any]:
        """Cancel/delete a bounty."""
        payload = {"reason": reason} if reason else {}
        return await self._request("DELETE", f"/bounties/{bounty_id}", json_data=payload if payload else None)

    async def batch_create_bounties(
        self,
        config_path: str = "",
        config_json: str = "",
    ) -> list[dict[str, Any]]:
        """Create multiple bounties from a JSON config file or string."""
        if config_path:
            try:
                with open(config_path, "r") as f:
                    config = json.load(f)
            except FileNotFoundError:
                return [{"error": f"Config file not found: {config_path}"}]
            except json.JSONDecodeError as e:
                return [{"error": f"Invalid JSON in config file: {e}"}]
        elif config_json:
            try:
                config = json.loads(config_json)
            except json.JSONDecodeError as e:
                return [{"error": f"Invalid JSON: {e}"}]
        else:
            return [{"error": "Must provide config_path or config_json"}]

        bounties = config.get("bounties", [])
        if not bounties:
            return [{"error": "No 'bounties' key found in config"}]

        results = []
        for bounty_data in bounties:
            try:
                result = await self.create_bounty(**bounty_data)
                results.append(result)
            except Exception as e:
                results.append({"error": str(e), "bounty_data": bounty_data})
        return results

    # --- Submissions ---

    async def submit_solution(
        self,
        bounty_id: str,
        pr_url: str,
        notes: str = "",
        contributor_wallet: str = "",
    ) -> dict[str, Any]:
        """Submit a PR as a solution to a bounty."""
        wallet = contributor_wallet or DEFAULT_WALLET
        payload: dict[str, Any] = {"pr_url": pr_url}
        if wallet:
            payload["contributor_wallet"] = wallet
        if notes:
            payload["notes"] = notes
        return await self._request("POST", f"/bounties/{bounty_id}/submissions", json_data=payload)

    async def get_submission(self, submission_id: str) -> dict[str, Any]:
        """Get submission status by ID."""
        return await self._request("GET", f"/submissions/{submission_id}")

    async def list_submissions(
        self,
        bounty_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        """List submissions, optionally filtered by bounty."""
        params: dict[str, Any] = {"limit": min(limit, 100)}
        if bounty_id:
            params["bounty_id"] = bounty_id
        if status:
            params["status"] = status
        return await self._request("GET", "/submissions", params=params)

    # --- Contributors ---

    async def get_contributor_stats(self, github_username: str = "") -> dict[str, Any]:
        """Get contributor profile stats."""
        if not github_username:
            return {"error": "github_username is required"}
        return await self._request("GET", f"/contributors/{github_username}")

    async def get_leaderboard(self, limit: int = 10) -> dict[str, Any]:
        """Get top contributors leaderboard."""
        return await self._request("GET", "/leaderboard", params={"limit": min(limit, 50)})

    # --- Escrow ---

    async def verify_escrow(self, bounty_id: str) -> dict[str, Any]:
        """Verify on-chain escrow status for a bounty."""
        return await self._request("GET", f"/bounties/{bounty_id}/escrow")

    # --- Wallet ---

    async def check_balance(self, wallet_address: str) -> dict[str, Any]:
        """Check FNDRY token balance for a wallet."""
        return await self._request("GET", f"/wallet/{wallet_address}/balance")


# ---------------------------------------------------------------------------
# MCP Tool Definitions
# ---------------------------------------------------------------------------


TOOLS = [
    {
        "name": "list_bounties",
        "description": "List open SolFoundry bounties with optional filters (tier, domain, status, pagination).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "tier": {"type": "string", "enum": ["T1", "T2", "T3"], "description": "Filter by bounty tier"},
                "domain": {"type": "string", "description": "Filter by domain (e.g. Frontend, Backend, Agent)"},
                "status": {"type": "string", "enum": ["open", "draft", "in_progress", "under_review", "completed"], "default": "open"},
                "skip": {"type": "integer", "default": 0, "description": "Pagination offset"},
                "limit": {"type": "integer", "default": 20, "description": "Max results (max 100)"},
            },
        },
    },
    {
        "name": "get_bounty",
        "description": "Get detailed information about a specific bounty by ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "bounty_id": {"type": "string", "description": "Bounty UUID or issue number"},
            },
            "required": ["bounty_id"],
        },
    },
    {
        "name": "search_bounties",
        "description": "Search bounties by keyword.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword"},
                "limit": {"type": "integer", "default": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "create_bounty",
        "description": "Create a new SolFoundry bounty.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Bounty title"},
                "description": {"type": "string", "description": "Detailed description"},
                "tier": {"type": "string", "enum": ["T1", "T2", "T3"], "description": "Reward tier"},
                "reward_amount": {"type": "integer", "description": "Reward in FNDRY micro-units (1 FNDRY = 1,000,000 units)"},
                "domain": {"type": "string", "description": "Domain category"},
                "skills": {"type": "array", "items": {"type": "string"}, "description": "Required skills"},
                "acceptance_criteria": {"type": "array", "items": {"type": "string"}, "description": "List of acceptance criteria"},
                "deadline": {"type": "string", "description": "ISO 8601 deadline"},
            },
            "required": ["title", "description", "tier", "reward_amount"],
        },
    },
    {
        "name": "update_bounty",
        "description": "Update an existing bounty's fields.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "bounty_id": {"type": "string", "description": "Bounty UUID"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "reward_amount": {"type": "integer"},
                "status": {"type": "string", "enum": ["open", "in_progress", "under_review", "completed", "cancelled"]},
                "acceptance_criteria": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["bounty_id"],
        },
    },
    {
        "name": "delete_bounty",
        "description": "Cancel/delete a bounty.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "bounty_id": {"type": "string", "description": "Bounty UUID"},
                "reason": {"type": "string", "description": "Reason for cancellation"},
            },
            "required": ["bounty_id"],
        },
    },
    {
        "name": "batch_create_bounties",
        "description": "Create multiple bounties from a JSON config file.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "config_path": {"type": "string", "description": "Path to JSON config file"},
                "config_json": {"type": "string", "description": "JSON config string (alternative to file)"},
            },
        },
    },
    {
        "name": "submit_solution",
        "description": "Submit a PR as a solution to a bounty.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "bounty_id": {"type": "string", "description": "Bounty UUID"},
                "pr_url": {"type": "string", "description": "GitHub PR URL"},
                "notes": {"type": "string", "description": "Optional notes about the solution"},
                "contributor_wallet": {"type": "string", "description": "Solana wallet for payout (or set SOLFOUNDRY_WALLET env var)"},
            },
            "required": ["bounty_id", "pr_url"],
        },
    },
    {
        "name": "get_submission",
        "description": "Get submission status by submission ID.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "submission_id": {"type": "string", "description": "Submission UUID"},
            },
            "required": ["submission_id"],
        },
    },
    {
        "name": "get_contributor_stats",
        "description": "Get contributor profile stats by GitHub username.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "github_username": {"type": "string", "description": "GitHub username"},
            },
            "required": ["github_username"],
        },
    },
    {
        "name": "get_leaderboard",
        "description": "Get top contributors leaderboard.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "default": 10},
            },
        },
    },
    {
        "name": "verify_escrow",
        "description": "Verify on-chain escrow status for a bounty.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "bounty_id": {"type": "string", "description": "Bounty UUID"},
            },
            "required": ["bounty_id"],
        },
    },
]


# ---------------------------------------------------------------------------
# MCP Server (stdio JSON-RPC)
# ---------------------------------------------------------------------------


class MCPServer:
    """MCP server implementing JSON-RPC 2.0 over stdio."""

    def __init__(self):
        self.client = SolFoundryClient()

    async def handle_request(self, request: dict[str, Any]) -> dict[str, Any]:
        """Handle a JSON-RPC request."""
        method = request.get("method", "")
        req_id = request.get("id")
        params = request.get("params", {})

        try:
            if method == "initialize":
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "solfoundry", "version": "1.0.0"},
                    },
                }

            elif method == "tools/list":
                return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}

            elif method == "tools/call":
                tool_name = params.get("name", "")
                tool_args = params.get("arguments", {})

                handler_map = {
                    "list_bounties": self.client.list_bounties,
                    "get_bounty": self.client.get_bounty,
                    "search_bounties": self.client.search_bounties,
                    "create_bounty": self.client.create_bounty,
                    "update_bounty": self.client.update_bounty,
                    "delete_bounty": self.client.delete_bounty,
                    "batch_create_bounties": self.client.batch_create_bounties,
                    "submit_solution": self.client.submit_solution,
                    "get_submission": self.client.get_submission,
                    "get_contributor_stats": self.client.get_contributor_stats,
                    "get_leaderboard": self.client.get_leaderboard,
                    "verify_escrow": self.client.verify_escrow,
                }

                handler = handler_map.get(tool_name)
                if not handler:
                    raise ValueError(f"Unknown tool: {tool_name}")

                result = await handler(**tool_args)
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(result, indent=2, ensure_ascii=False),
                            }
                        ]
                    },
                }

            else:
                raise ValueError(f"Unknown method: {method}")

        except Exception as e:
            logger.exception("Request failed")
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32603, "message": str(e)},
            }

    async def run(self):
        """Run the stdio MCP server loop."""
        logger.info("SolFoundry MCP Server started")
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                line = line.strip()
                if not line:
                    continue

                request = json.loads(line)
                response = await self.handle_request(request)
                print(json.dumps(response), flush=True)

            except json.JSONDecodeError as e:
                error_resp = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32700, "message": f"Parse error: {e}"},
                }
                print(json.dumps(error_resp), flush=True)
            except Exception:
                logger.exception("Server error")
                error_resp = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32603, "message": "Internal server error"},
                }
                print(json.dumps(error_resp), flush=True)

        await self.client.close()


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio

    server = MCPServer()
    asyncio.run(server.run())
