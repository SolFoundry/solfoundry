"""Automated payout pipeline with SPL transfer, retry, and confirmation.

Orchestrates wallet validation, payout lock, SPL token transfer via Solana
RPC with exponential-backoff retry (3 attempts), and confirmation tracking.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import Optional

from app.models.payout import KNOWN_PROGRAM_ADDRESSES, PayoutResponse, PayoutStatus, WalletValidationResponse
from app.services.payout_service import (
    _lock, _payout_store, _payout_to_response,
    acquire_payout_lock, release_payout_lock,
    transition_to_confirmed, transition_to_failed, transition_to_processing,
)
from app.services.solana_client import confirm_transaction, send_spl_token_transfer

logger = logging.getLogger(__name__)
_BASE58_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
MAX_RETRIES: int = 3


def validate_wallet_address(wallet_address: str) -> WalletValidationResponse:
    """Validate a Solana wallet for payout eligibility."""
    if not _BASE58_RE.match(wallet_address):
        return WalletValidationResponse(wallet_address=wallet_address, is_valid=False,
            rejection_reason="Address is not valid base-58 format (32-44 characters)")
    if wallet_address in KNOWN_PROGRAM_ADDRESSES:
        return WalletValidationResponse(wallet_address=wallet_address, is_valid=False,
            is_program_address=True, rejection_reason="Address is a known Solana program address")
    return WalletValidationResponse(wallet_address=wallet_address, is_valid=True)


async def process_single_payout(payout_id: str) -> PayoutResponse:
    """Execute the full payout pipeline for a single approved payout."""
    with _lock:
        r = _payout_store.get(payout_id)
        if not r:
            raise ValueError(f"Payout {payout_id} not found")
        if r.status != PayoutStatus.PENDING:
            raise ValueError(f"Payout {payout_id} is {r.status.value}, expected pending")
        if not r.admin_approved:
            raise ValueError(f"Payout {payout_id} not admin-approved")
        wallet, bid, amount, token = r.recipient_wallet, r.bounty_id or payout_id, r.amount, r.token
    transition_to_processing(payout_id)
    if not wallet:
        return transition_to_failed(payout_id, "No recipient wallet address provided", increment_retry=False)
    v = validate_wallet_address(wallet)
    if not v.is_valid:
        return transition_to_failed(payout_id, f"Invalid wallet: {v.rejection_reason}", increment_retry=False)
    if not acquire_payout_lock(bid):
        return transition_to_failed(payout_id, "Payout lock already held (double-pay prevention)", increment_retry=False)
    try:
        tx = await _retry_transfer(wallet, amount, token)
        if tx and await _retry_confirm(tx):
            return transition_to_confirmed(payout_id, tx)
        return transition_to_failed(payout_id, f"Transfer failed after {MAX_RETRIES} attempts")
    finally:
        release_payout_lock(bid)


async def _retry_transfer(wallet: str, amount: float, token: str) -> Optional[str]:
    """Attempt SPL token transfer with exponential backoff (3 attempts)."""
    backoff = 1.0
    for i in range(MAX_RETRIES):
        try:
            tx = await send_spl_token_transfer(recipient_wallet=wallet, amount=amount, token=token)
            if tx:
                return tx
        except Exception:
            logger.warning("Transfer attempt %d/%d failed", i + 1, MAX_RETRIES, exc_info=True)
        if i < MAX_RETRIES - 1:
            await asyncio.sleep(backoff)
            backoff *= 2.0
    return None


async def _retry_confirm(tx_hash: str) -> bool:
    """Confirm transaction with exponential backoff retry."""
    backoff = 1.0
    for i in range(MAX_RETRIES):
        try:
            if await confirm_transaction(tx_hash):
                return True
        except Exception:
            logger.warning("Confirm attempt %d/%d failed", i + 1, MAX_RETRIES, exc_info=True)
        if i < MAX_RETRIES - 1:
            await asyncio.sleep(backoff)
            backoff *= 2.0
    return False


async def process_approved_queue() -> list[PayoutResponse]:
    """Process all approved pending payouts in the queue."""
    with _lock:
        approved = [_payout_to_response(p) for p in sorted(_payout_store.values(), key=lambda x: x.created_at)
                     if p.status == PayoutStatus.PENDING and p.admin_approved]
    results: list[PayoutResponse] = []
    for payout in approved:
        try:
            results.append(await process_single_payout(payout.id))
        except ValueError as e:
            logger.error("Failed to process payout %s: %s", payout.id, e)
    return results
