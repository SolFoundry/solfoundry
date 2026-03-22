"""SPL token transfer service using the ``solders`` library.

Builds real ``transfer_checked`` instructions for $FNDRY payouts from the
treasury wallet.  Falls back to a deterministic mock signature when
``TREASURY_KEYPAIR_PATH`` is not configured (dev/test mode).

Retry policy: 3 attempts with exponential backoff (1s, 2s, 4s).

Environment variables:
    TREASURY_KEYPAIR_PATH: Path to the treasury wallet keypair JSON file.
        When absent, transfers produce a deterministic mock signature so
        the full payout pipeline can be exercised without real SOL.
    SOLANA_RPC_URL: Solana JSON-RPC endpoint (default: mainnet-beta).
    SOLANA_RPC_TIMEOUT: HTTP timeout in seconds for RPC calls (default: 30).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Optional, TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from solders.pubkey import Pubkey  # type: ignore[import-untyped]

from app.exceptions import TransferError
from app.services.solana_client import (
    FNDRY_TOKEN_CA,
    SOLANA_RPC_URL,
    TREASURY_WALLET,
    RPC_TIMEOUT,
    SolanaRPCError,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MAX_RETRIES: int = 3
"""Maximum number of transfer attempts before giving up."""

BASE_BACKOFF: float = 1.0
"""Base delay in seconds for exponential backoff between retries."""

TREASURY_KEYPAIR_PATH: str = os.getenv("TREASURY_KEYPAIR_PATH", "")
"""Filesystem path to the treasury keypair JSON.  Empty string = mock mode."""

CONFIRMATION_TIMEOUT: float = float(os.getenv("SOLANA_CONFIRMATION_TIMEOUT", "30"))
"""Maximum time (seconds) to wait for transaction confirmation."""

# Token decimals for transfer_checked instruction
FNDRY_TOKEN_DECIMALS: int = int(os.getenv("FNDRY_TOKEN_DECIMALS", "9"))
"""Decimal places for the $FNDRY SPL token (used in transfer_checked)."""


# ---------------------------------------------------------------------------
# Keypair loading
# ---------------------------------------------------------------------------


def _load_treasury_keypair() -> Optional[bytes]:
    """Load the treasury keypair bytes from the configured JSON file.

    Returns:
        The raw 64-byte secret key if the file exists and is valid,
        or ``None`` if ``TREASURY_KEYPAIR_PATH`` is empty or the file
        cannot be read.

    Raises:
        TransferError: If the file exists but contains invalid data.
    """
    if not TREASURY_KEYPAIR_PATH:
        return None
    keypair_path = Path(TREASURY_KEYPAIR_PATH)
    if not keypair_path.exists():
        logger.warning("Treasury keypair file not found: %s", keypair_path)
        return None
    try:
        raw = json.loads(keypair_path.read_text(encoding="utf-8"))
        if not isinstance(raw, list) or len(raw) != 64:
            raise TransferError(
                f"Invalid keypair format in {keypair_path}: expected list of 64 integers",
                attempts=0,
            )
        return bytes(raw)
    except (json.JSONDecodeError, TypeError, ValueError) as error:
        raise TransferError(
            f"Failed to parse treasury keypair at {keypair_path}: {error}",
            attempts=0,
        ) from error


def _build_mock_signature(recipient_wallet: str, amount: float, mint: str) -> str:
    """Generate a deterministic mock transaction signature for dev/test mode.

    The mock hash is a SHA-256 digest of the transfer parameters so tests
    can assert on predictable outputs without touching the Solana network.

    Args:
        recipient_wallet: The destination wallet address.
        amount: The token amount to transfer.
        mint: The SPL token mint address.

    Returns:
        A 64-character hex string that looks like a transaction signature.
    """
    payload = f"{TREASURY_WALLET}:{recipient_wallet}:{amount}:{mint}"
    return hashlib.sha256(payload.encode()).hexdigest()


# ---------------------------------------------------------------------------
# SPL transfer (solders-based)
# ---------------------------------------------------------------------------


async def _build_and_send_transfer(
    recipient_wallet: str,
    amount: float,
    mint: str,
    keypair_bytes: bytes,
) -> str:
    """Build a ``transfer_checked`` instruction and submit it to the RPC.

    Uses the ``solders`` library to construct a proper SPL token transfer
    instruction with the treasury wallet as the fee payer and token source.

    Args:
        recipient_wallet: Destination wallet (base-58 Solana address).
        amount: Human-readable token amount (will be multiplied by decimals).
        mint: SPL token mint address.
        keypair_bytes: Raw 64-byte treasury keypair.

    Returns:
        The base-58 encoded transaction signature string.

    Raises:
        TransferError: If the RPC call fails or returns an error.
    """
    try:
        from solders.keypair import Keypair  # type: ignore[import-untyped]
        from solders.pubkey import Pubkey  # type: ignore[import-untyped]
        from solders.transaction import Transaction  # type: ignore[import-untyped]
        from solders.message import Message  # type: ignore[import-untyped]
        from solders.hash import Hash  # type: ignore[import-untyped]
        from solders.instruction import Instruction, AccountMeta  # type: ignore[import-untyped]
    except ImportError as import_error:
        raise TransferError(
            "solders library is required for on-chain transfers: pip install solders",
            attempts=0,
        ) from import_error

    signer = Keypair.from_bytes(keypair_bytes)
    mint_pubkey = Pubkey.from_string(mint)
    destination_pubkey = Pubkey.from_string(recipient_wallet)
    token_program = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    associated_token_program = Pubkey.from_string(
        "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    )

    # Derive Associated Token Accounts (ATAs) for source and destination.
    # NOTE: If the destination ATA does not exist on-chain, the transaction
    # will fail.  In production, prepend a create_associated_token_account
    # instruction to handle first-time recipients.  The RPC error will be
    # caught by the retry loop and surfaced as a TransferError.
    source_ata = _derive_associated_token_address(
        signer.pubkey(), mint_pubkey, token_program, associated_token_program
    )
    destination_ata = _derive_associated_token_address(
        destination_pubkey, mint_pubkey, token_program, associated_token_program
    )

    # Convert human-readable amount to raw token units
    raw_amount = int(amount * (10**FNDRY_TOKEN_DECIMALS))

    # Build transfer_checked instruction (opcode 12 in Token Program)
    # Layout: [12 (u8), amount (u64 LE), decimals (u8)]
    instruction_data = (
        bytes([12]) + raw_amount.to_bytes(8, "little") + bytes([FNDRY_TOKEN_DECIMALS])
    )

    transfer_instruction = Instruction(
        program_id=token_program,
        accounts=[
            AccountMeta(pubkey=source_ata, is_signer=False, is_writable=True),
            AccountMeta(pubkey=mint_pubkey, is_signer=False, is_writable=False),
            AccountMeta(pubkey=destination_ata, is_signer=False, is_writable=True),
            AccountMeta(pubkey=signer.pubkey(), is_signer=True, is_writable=False),
        ],
        data=instruction_data,
    )

    # Fetch recent blockhash
    async with httpx.AsyncClient(timeout=RPC_TIMEOUT) as client:
        blockhash_response = await client.post(
            SOLANA_RPC_URL,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "getLatestBlockhash",
                "params": [],
            },
        )
        blockhash_response.raise_for_status()
        blockhash_data = blockhash_response.json()

    if "error" in blockhash_data:
        raise SolanaRPCError(f"Failed to get blockhash: {blockhash_data['error']}")

    blockhash_str = blockhash_data["result"]["value"]["blockhash"]
    recent_blockhash = Hash.from_string(blockhash_str)

    # Build and sign the transaction
    message = Message.new_with_blockhash(
        [transfer_instruction], signer.pubkey(), recent_blockhash
    )
    transaction = Transaction.new_unsigned(message)
    transaction.sign([signer], recent_blockhash)

    # Serialize and send
    serialized = bytes(transaction)
    encoded_transaction = base64.b64encode(serialized).decode("ascii")

    async with httpx.AsyncClient(timeout=RPC_TIMEOUT) as client:
        send_response = await client.post(
            SOLANA_RPC_URL,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "sendTransaction",
                "params": [
                    encoded_transaction,
                    {
                        "encoding": "base64",
                        "skipPreflight": False,
                        "preflightCommitment": "confirmed",
                    },
                ],
            },
        )
        send_response.raise_for_status()
        send_data = send_response.json()

    if "error" in send_data:
        error_message = send_data["error"].get("message", str(send_data["error"]))
        raise SolanaRPCError(f"sendTransaction failed: {error_message}")

    tx_signature = str(send_data.get("result", ""))
    logger.info(
        "SPL transfer submitted: tx=%s, recipient=%s, amount=%s",
        tx_signature,
        recipient_wallet,
        amount,
    )
    return tx_signature


def _derive_associated_token_address(
    wallet_address: "Pubkey",
    mint_address: "Pubkey",
    token_program: "Pubkey",
    associated_token_program: "Pubkey",
) -> "Pubkey":
    """Derive the Associated Token Account (ATA) address for a wallet and mint.

    Uses the standard PDA derivation: seeds = [wallet, token_program, mint],
    program = associated_token_program.

    Args:
        wallet_address: The owner wallet public key.
        mint_address: The SPL token mint public key.
        token_program: The SPL Token Program ID.
        associated_token_program: The Associated Token Program ID.

    Returns:
        The derived ATA public key.
    """
    from solders.pubkey import Pubkey  # type: ignore[import-untyped]

    derived, _bump = Pubkey.find_program_address(
        [bytes(wallet_address), bytes(token_program), bytes(mint_address)],
        associated_token_program,
    )
    return derived


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def send_spl_transfer(
    recipient_wallet: str,
    amount: float,
    mint: str = FNDRY_TOKEN_CA,
) -> str:
    """Execute an SPL token transfer with retry logic and exponential backoff.

    Attempts the transfer up to ``MAX_RETRIES`` times (default 3).  Each
    retry waits ``BASE_BACKOFF * 2^(attempt-1)`` seconds (1s, 2s, 4s).

    When ``TREASURY_KEYPAIR_PATH`` is not configured, returns a deterministic
    mock signature so the payout pipeline can be exercised in dev/test
    without connecting to Solana.

    Args:
        recipient_wallet: Destination Solana wallet address (base-58).
        amount: Token amount to transfer (human-readable, e.g. 1000.0).
        mint: SPL token mint address (defaults to $FNDRY).

    Returns:
        The on-chain transaction signature (base-58 string), or a mock
        signature in dev mode.

    Raises:
        TransferError: If all retry attempts are exhausted.
    """
    keypair_bytes = _load_treasury_keypair()

    last_error: Optional[Exception] = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if keypair_bytes is None:
                logger.info(
                    "Mock transfer (no keypair): recipient=%s, amount=%s, mint=%s",
                    recipient_wallet,
                    amount,
                    mint,
                )
                return _build_mock_signature(recipient_wallet, amount, mint)

            signature = await _build_and_send_transfer(
                recipient_wallet, amount, mint, keypair_bytes
            )
            return signature

        except Exception as error:
            last_error = error
            logger.warning(
                "Transfer attempt %d/%d failed: %s",
                attempt,
                MAX_RETRIES,
                error,
            )
            if attempt < MAX_RETRIES:
                backoff_seconds = BASE_BACKOFF * (2 ** (attempt - 1))
                await asyncio.sleep(backoff_seconds)

    raise TransferError(
        f"SPL transfer failed after {MAX_RETRIES} attempts: {last_error}",
        attempts=MAX_RETRIES,
    )


async def confirm_transaction(
    tx_signature: str,
    max_retries: int = MAX_RETRIES,
    base_backoff: float = BASE_BACKOFF,
) -> bool:
    """Poll Solana RPC to confirm a transaction with exponential backoff.

    Checks ``getSignatureStatuses`` up to ``max_retries`` times, waiting
    longer between each poll.  Returns ``True`` once the transaction
    reaches ``confirmed`` or ``finalized`` status.

    Args:
        tx_signature: The transaction signature to check (base-58).
        max_retries: Maximum number of confirmation polling attempts.
        base_backoff: Base delay in seconds between polls.

    Returns:
        ``True`` if the transaction is confirmed/finalized, ``False``
        if it failed on-chain or was not confirmed within the retry
        window.
    """
    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=RPC_TIMEOUT) as client:
                response = await client.post(
                    SOLANA_RPC_URL,
                    json={
                        "jsonrpc": "2.0",
                        "id": 1,
                        "method": "getSignatureStatuses",
                        "params": [
                            [tx_signature],
                            {"searchTransactionHistory": True},
                        ],
                    },
                )
                response.raise_for_status()

            statuses = response.json().get("result", {}).get("value", [])
            if statuses and statuses[0]:
                status_entry = statuses[0]
                if status_entry.get("err"):
                    logger.warning(
                        "Transaction %s failed on-chain: %s",
                        tx_signature,
                        status_entry["err"],
                    )
                    return False
                confirmation_status = status_entry.get("confirmationStatus", "")
                if confirmation_status in ("confirmed", "finalized"):
                    logger.info(
                        "Transaction %s confirmed (status=%s)",
                        tx_signature,
                        confirmation_status,
                    )
                    return True

        except Exception as error:
            logger.warning(
                "Confirmation poll %d/%d failed for %s: %s",
                attempt,
                max_retries,
                tx_signature,
                error,
            )

        if attempt < max_retries:
            backoff_seconds = base_backoff * (2 ** (attempt - 1))
            await asyncio.sleep(backoff_seconds)

    logger.warning(
        "Transaction %s not confirmed after %d attempts", tx_signature, max_retries
    )
    return False
