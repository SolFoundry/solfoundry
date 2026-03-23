"""Infer a coarse wallet funding fingerprint from recent on-chain history.

Uses Solana JSON-RPC only (same endpoint as ``solana_client``). The fingerprint
is the first plausible counterparty that funded native SOL to the wallet; it is
a heuristic, not proof of identity.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.services.solana_client import SolanaRPCError, _rpc_call

logger = logging.getLogger(__name__)


def _account_keys(message: dict[str, Any]) -> list[str]:
    keys: list[str] = []
    for k in message.get("accountKeys", []) or []:
        if isinstance(k, str):
            keys.append(k)
        elif isinstance(k, dict):
            keys.append(k.get("pubkey") or "")
    return keys


def _pick_funder_for_sol_increase(wallet: str, tx: dict[str, Any]) -> Optional[str]:
    """Return a pubkey that plausibly sent SOL to ``wallet`` in this transaction."""
    message = (tx.get("transaction") or {}).get("message") or {}
    keys = _account_keys(message)
    try:
        w_idx = keys.index(wallet)
    except ValueError:
        return None
    meta = tx.get("meta") or {}
    pre = meta.get("preBalances") or []
    post = meta.get("postBalances") or []
    if w_idx >= len(pre) or w_idx >= len(post):
        return None
    delta = int(post[w_idx]) - int(pre[w_idx])
    if delta <= 0:
        return None
    for i, (pb, ab) in enumerate(zip(pre, post)):
        if i == w_idx or i >= len(keys):
            continue
        drop = int(pb) - int(ab)
        if drop > 0 and drop >= int(delta * 0.95):
            return keys[i] or None
    return None


async def infer_wallet_funding_cluster_key(
    wallet: str, *, max_signatures: int = 25
) -> Optional[str]:
    """Return a cluster key (funder address) or ``None`` if unknown."""
    try:
        sig_data = await _rpc_call(
            "getSignaturesForAddress",
            [wallet, {"limit": max(1, max_signatures)}],
        )
    except SolanaRPCError as exc:
        logger.debug("funder_probe signatures failed: %s", exc)
        return None
    sigs = sig_data.get("result") or []
    if not sigs:
        return None
    for entry in reversed(sigs):
        sig = entry.get("signature")
        if not sig:
            continue
        try:
            tx_data = await _rpc_call(
                "getTransaction",
                [
                    sig,
                    {
                        "encoding": "jsonParsed",
                        "maxSupportedTransactionVersion": 0,
                    },
                ],
            )
        except SolanaRPCError:
            continue
        tx = tx_data.get("result")
        if not tx or tx.get("meta", {}).get("err"):
            continue
        funder = _pick_funder_for_sol_increase(wallet, tx)
        if funder and funder != wallet:
            return funder
    return None
