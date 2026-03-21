"""Async Solana RPC client (read-only, httpx-based, no solana-py)."""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)

SOLANA_RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
TREASURY_WALLET: str = os.getenv(
    "TREASURY_WALLET", "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp"
)
FNDRY_TOKEN_CA = "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS"
TOKEN_PROGRAM_ID: str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

RPC_TIMEOUT: float = float(os.getenv("SOLANA_RPC_TIMEOUT", "10"))


class SolanaRPCError(Exception):
    """Raised when the Solana JSON-RPC returns an error payload."""

    def __init__(self, message: str, code: int | None = None) -> None:
        """Initialize the instance."""
        super().__init__(message)
        self.code = code


async def _rpc_call(method: str, params: list[Any] | None = None) -> dict[str, Any]:
    """Send a JSON-RPC 2.0 request; raises ``SolanaRPCError`` on error."""
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params or []}
    async with httpx.AsyncClient(timeout=RPC_TIMEOUT) as client:
        resp = await client.post(SOLANA_RPC_URL, json=payload)
        resp.raise_for_status()
    data: dict[str, Any] = resp.json()
    if "error" in data:
        err = data["error"]
        logger.error("Solana RPC error: %s", err)
        raise SolanaRPCError(
            f"RPC error: {err.get('message', str(err))}",
            code=err.get("code"),
        )
    return data


async def get_sol_balance(wallet: str = TREASURY_WALLET) -> float:
    """Return the native SOL balance of *wallet* in SOL (not lamports)."""
    data = await _rpc_call("getBalance", [wallet])
    lamports = data.get("result", {}).get("value", 0)
    return lamports / 1e9


async def get_token_balance(
    wallet: str = TREASURY_WALLET,
    mint: str = FNDRY_TOKEN_CA,
) -> float:
    """Return the SPL-token balance for *mint* held by *wallet*."""
    data = await _rpc_call(
        "getTokenAccountsByOwner",
        [wallet, {"mint": mint}, {"encoding": "jsonParsed"}],
    )
    accounts = data.get("result", {}).get("value", [])
    if not accounts:
        return 0.0
    total = 0.0
    for account in accounts:
        parsed = (
            account.get("account", {})
            .get("data", {})
            .get("parsed", {})
            .get("info", {})
            .get("tokenAmount", {})
        )
        total += float(parsed.get("uiAmount", 0) or 0)
    return total


async def get_treasury_balances(
    wallet: str = TREASURY_WALLET,
) -> tuple[float, float]:
    """Return ``(sol_balance, fndry_balance)`` for the treasury wallet."""
    sol = await get_sol_balance(wallet)
    fndry = await get_token_balance(wallet)
    return sol, fndry
