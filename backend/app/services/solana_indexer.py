"""Solana on-chain event ingestion service.

Monitors the SolFoundry program for on-chain events by polling the Solana
RPC endpoint for recent transactions involving the treasury wallet and
$FNDRY token.  Detected events are normalized and fed into the event
indexer for persistence and distribution.

Architecture:
    Solana RPC (poll) -> parse transactions -> classify events -> ingest

The service runs as an async background task, polling every 30 seconds
for new transactions.  Each transaction is classified into an event
category (escrow funded, payout confirmed, etc.) and ingested via the
event indexer service.

References:
    - Solana JSON-RPC: https://solana.com/docs/rpc
    - SolFoundry treasury: 57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp
"""

import asyncio
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import httpx

from app.models.indexer_event import (
    EventSource,
    IndexedEventCategory,
    IndexedEventCreate,
)

logger = logging.getLogger(__name__)

# Configuration from environment
SOLANA_RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
TREASURY_WALLET = os.getenv(
    "TREASURY_WALLET", "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp"
)
FNDRY_TOKEN_MINT = "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS"
POLL_INTERVAL_SECONDS = int(os.getenv("SOLANA_POLL_INTERVAL", "30"))
RPC_TIMEOUT = float(os.getenv("SOLANA_RPC_TIMEOUT", "15"))

# Track the last processed signature to avoid re-processing
_last_processed_signature: Optional[str] = None


async def _rpc_call(method: str, params: Optional[list] = None) -> Dict[str, Any]:
    """Execute a JSON-RPC 2.0 call to the Solana cluster.

    Args:
        method: The RPC method name (e.g., 'getSignaturesForAddress').
        params: Optional list of RPC parameters.

    Returns:
        The full JSON-RPC response dictionary.

    Raises:
        httpx.HTTPStatusError: If the HTTP response indicates an error.
        ValueError: If the RPC response contains an error payload.
    """
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params or [],
    }
    async with httpx.AsyncClient(timeout=RPC_TIMEOUT) as client:
        response = await client.post(SOLANA_RPC_URL, json=payload)
        response.raise_for_status()

    data = response.json()
    if "error" in data:
        error_info = data["error"]
        raise ValueError(
            f"Solana RPC error: {error_info.get('message', str(error_info))}"
        )
    return data


async def fetch_recent_signatures(
    wallet: str = TREASURY_WALLET,
    limit: int = 20,
    before: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch recent transaction signatures for the treasury wallet.

    Uses the ``getSignaturesForAddress`` RPC method to retrieve the
    most recent confirmed transactions.

    Args:
        wallet: Solana wallet address to query.
        limit: Maximum number of signatures to return (max 1000).
        before: Optional signature to start before (for pagination).

    Returns:
        List of signature info dictionaries with fields:
        - signature: Transaction signature string.
        - slot: Slot number.
        - blockTime: Unix timestamp.
        - err: Error info if transaction failed, else None.
        - memo: Optional memo string.
    """
    params: list = [
        wallet,
        {"limit": limit, "commitment": "confirmed"},
    ]
    if before:
        params[1]["before"] = before

    data = await _rpc_call("getSignaturesForAddress", params)
    return data.get("result", [])


async def fetch_transaction_details(
    signature: str,
) -> Optional[Dict[str, Any]]:
    """Fetch full transaction details for a given signature.

    Args:
        signature: The base58-encoded transaction signature.

    Returns:
        Transaction detail dictionary, or None if not found.
    """
    params = [
        signature,
        {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0},
    ]
    try:
        data = await _rpc_call("getTransaction", params)
        return data.get("result")
    except Exception as error:
        logger.warning(
            "Failed to fetch transaction %s: %s", signature[:16], error
        )
        return None


def classify_transaction(
    transaction_details: Dict[str, Any],
) -> Optional[IndexedEventCreate]:
    """Classify a Solana transaction into an indexed event.

    Examines the transaction instructions and token transfers to
    determine the event category.  Supports detection of:
    - Escrow funding (transfers TO treasury)
    - Payout confirmations (transfers FROM treasury)
    - Escrow releases and refunds

    Args:
        transaction_details: Parsed transaction details from RPC.

    Returns:
        An IndexedEventCreate if the transaction is relevant, else None.
    """
    if not transaction_details:
        return None

    meta = transaction_details.get("meta")
    if not meta or meta.get("err") is not None:
        return None  # Skip failed transactions

    transaction = transaction_details.get("transaction", {})
    message = transaction.get("message", {})
    instructions = message.get("instructions", [])

    signature = transaction.get("signatures", ["unknown"])[0]
    block_time = transaction_details.get("blockTime")
    timestamp = (
        datetime.fromtimestamp(block_time, tz=timezone.utc)
        if block_time
        else datetime.now(timezone.utc)
    )

    # Analyze token balance changes
    pre_token_balances = meta.get("preTokenBalances", [])
    post_token_balances = meta.get("postTokenBalances", [])

    # Detect $FNDRY token transfers
    fndry_transfers = _detect_token_transfers(
        pre_token_balances, post_token_balances, FNDRY_TOKEN_MINT
    )

    if not fndry_transfers:
        # Check for SOL transfers to/from treasury
        pre_balances = meta.get("preBalances", [])
        post_balances = meta.get("postBalances", [])
        account_keys = message.get("accountKeys", [])

        sol_event = _classify_sol_transfer(
            account_keys, pre_balances, post_balances, signature
        )
        return sol_event

    # Classify based on transfer direction relative to treasury
    for transfer in fndry_transfers:
        amount = transfer.get("amount", Decimal("0"))
        direction = transfer.get("direction")

        if direction == "incoming":
            return IndexedEventCreate(
                source=EventSource.SOLANA,
                category=IndexedEventCategory.ESCROW_FUNDED,
                title=f"Escrow funded: {amount} $FNDRY",
                description=f"Treasury received {amount} $FNDRY via transaction {signature[:16]}...",
                transaction_hash=signature,
                amount=amount,
                payload={
                    "signature": signature,
                    "direction": "incoming",
                    "token_mint": FNDRY_TOKEN_MINT,
                    "block_time": block_time,
                },
            )
        elif direction == "outgoing":
            return IndexedEventCreate(
                source=EventSource.SOLANA,
                category=IndexedEventCategory.PAYOUT_CONFIRMED,
                title=f"Payout confirmed: {amount} $FNDRY",
                description=f"Treasury sent {amount} $FNDRY via transaction {signature[:16]}...",
                transaction_hash=signature,
                amount=amount,
                payload={
                    "signature": signature,
                    "direction": "outgoing",
                    "token_mint": FNDRY_TOKEN_MINT,
                    "block_time": block_time,
                },
            )

    return None


def _detect_token_transfers(
    pre_balances: List[Dict],
    post_balances: List[Dict],
    target_mint: str,
) -> List[Dict[str, Any]]:
    """Detect token transfers involving a specific mint.

    Compares pre and post token balances to find accounts where the
    balance changed for the target token mint.

    Args:
        pre_balances: Pre-transaction token balances from RPC.
        post_balances: Post-transaction token balances from RPC.
        target_mint: The SPL token mint address to filter for.

    Returns:
        List of transfer dictionaries with 'amount', 'direction', and
        'account_index' keys.
    """
    pre_map: Dict[int, float] = {}
    post_map: Dict[int, float] = {}

    for balance in pre_balances:
        if balance.get("mint") == target_mint:
            account_index = balance.get("accountIndex", -1)
            ui_amount = (
                balance.get("uiTokenAmount", {}).get("uiAmount") or 0
            )
            pre_map[account_index] = float(ui_amount)

    for balance in post_balances:
        if balance.get("mint") == target_mint:
            account_index = balance.get("accountIndex", -1)
            ui_amount = (
                balance.get("uiTokenAmount", {}).get("uiAmount") or 0
            )
            post_map[account_index] = float(ui_amount)

    transfers = []
    all_indices = set(pre_map.keys()) | set(post_map.keys())

    for index in all_indices:
        pre_amount = pre_map.get(index, 0.0)
        post_amount = post_map.get(index, 0.0)
        difference = post_amount - pre_amount

        if abs(difference) > 0.001:
            direction = "incoming" if difference > 0 else "outgoing"
            transfers.append({
                "account_index": index,
                "amount": Decimal(str(abs(difference))),
                "direction": direction,
            })

    return transfers


def _classify_sol_transfer(
    account_keys: List,
    pre_balances: List[int],
    post_balances: List[int],
    signature: str,
) -> Optional[IndexedEventCreate]:
    """Classify SOL transfers to/from the treasury wallet.

    Args:
        account_keys: List of account keys from the transaction message.
        pre_balances: Pre-transaction SOL balances in lamports.
        post_balances: Post-transaction SOL balances in lamports.
        signature: Transaction signature for reference.

    Returns:
        An IndexedEventCreate if a significant SOL transfer is detected,
        else None.
    """
    for index, key_info in enumerate(account_keys):
        key = key_info if isinstance(key_info, str) else key_info.get("pubkey", "")
        if key != TREASURY_WALLET:
            continue

        if index < len(pre_balances) and index < len(post_balances):
            pre_lamports = pre_balances[index]
            post_lamports = post_balances[index]
            diff_sol = (post_lamports - pre_lamports) / 1e9

            if abs(diff_sol) > 0.001:
                direction = "incoming" if diff_sol > 0 else "outgoing"
                category = (
                    IndexedEventCategory.ESCROW_FUNDED
                    if direction == "incoming"
                    else IndexedEventCategory.PAYOUT_CONFIRMED
                )
                return IndexedEventCreate(
                    source=EventSource.SOLANA,
                    category=category,
                    title=f"SOL {'received' if direction == 'incoming' else 'sent'}: {abs(diff_sol):.4f} SOL",
                    description=f"Treasury {'received' if direction == 'incoming' else 'sent'} {abs(diff_sol):.4f} SOL",
                    transaction_hash=signature,
                    amount=Decimal(str(abs(diff_sol))),
                    payload={
                        "signature": signature,
                        "direction": direction,
                        "token": "SOL",
                        "lamports_diff": post_lamports - pre_lamports,
                    },
                )

    return None


async def poll_solana_events() -> int:
    """Poll the Solana RPC for new treasury transactions.

    Fetches recent transaction signatures, processes any new ones
    since the last poll, and ingests classified events into the
    indexer.

    Returns:
        Number of new events ingested during this poll cycle.
    """
    global _last_processed_signature

    try:
        signatures = await fetch_recent_signatures(
            limit=20, before=None
        )
    except Exception as error:
        logger.error("Failed to fetch Solana signatures: %s", error)
        return 0

    if not signatures:
        return 0

    new_events_count = 0

    for sig_info in signatures:
        signature = sig_info.get("signature", "")

        # Stop at last processed signature
        if signature == _last_processed_signature:
            break

        # Skip failed transactions
        if sig_info.get("err") is not None:
            continue

        try:
            transaction_details = await fetch_transaction_details(signature)
            if not transaction_details:
                continue

            event_data = classify_transaction(transaction_details)
            if event_data:
                from app.services.event_indexer_service import ingest_event, DuplicateEventError

                try:
                    await ingest_event(event_data)
                    new_events_count += 1
                except DuplicateEventError:
                    logger.debug("Duplicate transaction %s, skipping", signature[:16])
                except Exception as ingest_error:
                    logger.error(
                        "Failed to ingest Solana event for tx %s: %s",
                        signature[:16],
                        ingest_error,
                    )
        except Exception as process_error:
            logger.error(
                "Failed to process transaction %s: %s",
                signature[:16],
                process_error,
            )

    # Update last processed signature to newest
    if signatures:
        _last_processed_signature = signatures[0].get("signature")

    if new_events_count > 0:
        logger.info("Solana indexer: ingested %d new events", new_events_count)

    return new_events_count


async def periodic_solana_poll(interval_seconds: int = POLL_INTERVAL_SECONDS) -> None:
    """Background task that polls Solana transactions at regular intervals.

    Runs indefinitely, polling every ``interval_seconds``.  Handles
    errors gracefully to prevent the background task from dying.

    Args:
        interval_seconds: Seconds between poll cycles (default: 30).
    """
    logger.info(
        "Starting Solana event indexer (polling every %ds)", interval_seconds
    )
    while True:
        try:
            await poll_solana_events()
        except Exception as error:
            logger.error("Solana poll cycle failed: %s", error)
        await asyncio.sleep(interval_seconds)
