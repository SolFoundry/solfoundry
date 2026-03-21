"""Custodial $FNDRY escrow service (in-memory MVP). Thread-locked for double-spend safety.
PostgreSQL DDL in ``app.models.escrow`` docstring.
"""
from __future__ import annotations
import logging, threading
from datetime import datetime, timezone
from typing import Optional

from app.core.audit import audit_event
from app.exceptions import (
    EscrowAlreadyExistsError, EscrowDoubleSpendError,
    EscrowInvalidStateError, EscrowNotFoundError,
)
from app.models.escrow import (
    VALID_TRANSITIONS, EscrowCreateRequest, EscrowListResponse, EscrowRecord,
    EscrowRefundRequest, EscrowReleaseRequest, EscrowResponse, EscrowState, LedgerEntry,
)

logger = logging.getLogger(__name__)
_lock = threading.Lock()
_escrow_store: dict[str, EscrowRecord] = {}
_bounty_index: dict[str, str] = {}
_ledger_store: dict[str, list[LedgerEntry]] = {}
_tx_hash_set: set[str] = set()

def _check_transition(cur: EscrowState, tgt: EscrowState) -> None:
    """Enforce state machine; raises EscrowInvalidStateError."""
    if tgt.value not in VALID_TRANSITIONS.get(cur.value, frozenset()):
        raise EscrowInvalidStateError(f"Cannot transition from {cur.value} to {tgt.value}")

def _check_dup_tx(tx: Optional[str]) -> None:
    """Reject duplicate tx hashes (double-spend protection)."""
    if tx and tx in _tx_hash_set:
        raise EscrowDoubleSpendError(f"Transaction {tx} has already been recorded (double-spend rejected)")

def _record_tx(tx: Optional[str]) -> None:
    if tx: _tx_hash_set.add(tx)

def _add_ledger(eid: str, action: str, amount: float, wallet: str, tx: Optional[str]=None) -> LedgerEntry:
    """Create and store a ledger entry."""
    e = LedgerEntry(escrow_id=eid, action=action, amount=amount, wallet=wallet, tx_hash=tx)
    _ledger_store.setdefault(eid, []).append(e)
    return e

def _resp(e: EscrowRecord) -> EscrowResponse:
    """Convert EscrowRecord to EscrowResponse."""
    return EscrowResponse(
        id=e.id, bounty_id=e.bounty_id, creator_wallet=e.creator_wallet,
        winner_wallet=e.winner_wallet, amount=e.amount, state=e.state,
        fund_tx_hash=e.fund_tx_hash, release_tx_hash=e.release_tx_hash,
        refund_tx_hash=e.refund_tx_hash, created_at=e.created_at,
        updated_at=e.updated_at, expires_at=e.expires_at,
        ledger=list(_ledger_store.get(e.id, [])))

def create_escrow(data: EscrowCreateRequest) -> EscrowResponse:
    """Create new escrow.  FUNDED if tx_hash given, else PENDING."""
    with _lock:
        if data.bounty_id in _bounty_index:
            raise EscrowAlreadyExistsError(f"Escrow already exists for bounty '{data.bounty_id}'")
        _check_dup_tx(data.tx_hash)
        state = EscrowState.FUNDED if data.tx_hash else EscrowState.PENDING
        now = datetime.now(timezone.utc)
        esc = EscrowRecord(bounty_id=data.bounty_id, creator_wallet=data.creator_wallet,
            amount=data.amount, state=state, fund_tx_hash=data.tx_hash,
            created_at=now, updated_at=now, expires_at=data.expires_at)
        _escrow_store[esc.id] = esc; _bounty_index[data.bounty_id] = esc.id; _record_tx(data.tx_hash)
        if data.tx_hash:
            _add_ledger(esc.id, "deposit", data.amount, data.creator_wallet, data.tx_hash)
        r = _resp(esc)
    audit_event("escrow_created", escrow_id=esc.id, bounty_id=data.bounty_id, amount=data.amount)
    logger.info("Escrow created: %s bounty=%s state=%s", esc.id, data.bounty_id, state.value)
    return r

def release_escrow(data: EscrowReleaseRequest) -> EscrowResponse:
    """Release escrowed $FNDRY to winner (FUNDED/ACTIVE -> COMPLETED)."""
    with _lock:
        eid = _bounty_index.get(data.bounty_id)
        if not eid: raise EscrowNotFoundError(f"No escrow found for bounty '{data.bounty_id}'")
        esc = _escrow_store[eid]
        if esc.state not in (EscrowState.FUNDED, EscrowState.ACTIVE):
            _check_transition(esc.state, EscrowState.RELEASING)
        _check_dup_tx(data.tx_hash)
        now = datetime.now(timezone.utc)
        esc.state = EscrowState.COMPLETED; esc.winner_wallet = data.winner_wallet
        esc.release_tx_hash = data.tx_hash; esc.updated_at = now; _record_tx(data.tx_hash)
        _add_ledger(esc.id, "release", esc.amount, data.winner_wallet, data.tx_hash)
        r = _resp(esc)
    audit_event("escrow_released", escrow_id=esc.id, bounty_id=data.bounty_id, winner=data.winner_wallet)
    logger.info("Escrow released: %s bounty=%s winner=%s", esc.id, data.bounty_id, data.winner_wallet)
    return r

def refund_escrow(data: EscrowRefundRequest) -> EscrowResponse:
    """Refund escrowed $FNDRY to creator (timeout/cancellation)."""
    with _lock:
        eid = _bounty_index.get(data.bounty_id)
        if not eid: raise EscrowNotFoundError(f"No escrow found for bounty '{data.bounty_id}'")
        esc = _escrow_store[eid]
        _check_transition(esc.state, EscrowState.REFUNDED); _check_dup_tx(data.tx_hash)
        now = datetime.now(timezone.utc)
        esc.state = EscrowState.REFUNDED; esc.refund_tx_hash = data.tx_hash
        esc.updated_at = now; _record_tx(data.tx_hash)
        _add_ledger(esc.id, "refund", esc.amount, esc.creator_wallet, data.tx_hash)
        r = _resp(esc)
    audit_event("escrow_refunded", escrow_id=esc.id, bounty_id=data.bounty_id, amount=esc.amount)
    logger.info("Escrow refunded: %s bounty=%s", esc.id, data.bounty_id)
    return r

def get_escrow_status(bounty_id: str) -> EscrowResponse:
    """Get escrow status for a bounty; raises EscrowNotFoundError."""
    with _lock:
        eid = _bounty_index.get(bounty_id)
        if not eid: raise EscrowNotFoundError(f"No escrow found for bounty '{bounty_id}'")
        return _resp(_escrow_store[eid])

def list_escrows(state: Optional[EscrowState]=None, creator_wallet: Optional[str]=None,
                 skip: int=0, limit: int=20) -> EscrowListResponse:
    """List escrows with optional filters and pagination."""
    with _lock:
        results = sorted(_escrow_store.values(), key=lambda e: e.created_at, reverse=True)
    if state: results = [e for e in results if e.state == state]
    if creator_wallet: results = [e for e in results if e.creator_wallet == creator_wallet]
    total = len(results); page = results[skip:skip+limit]
    with _lock: items = [_resp(e) for e in page]
    return EscrowListResponse(items=items, total=total, skip=skip, limit=limit)

async def verify_transaction_confirmed(tx_hash: str) -> bool:
    """Check Solana RPC that a transaction is confirmed on-chain."""
    import httpx
    from app.services.solana_client import SOLANA_RPC_URL, RPC_TIMEOUT
    payload = {"jsonrpc":"2.0","id":1,"method":"getTransaction",
               "params":[tx_hash,{"encoding":"jsonParsed","maxSupportedTransactionVersion":0}]}
    try:
        async with httpx.AsyncClient(timeout=RPC_TIMEOUT) as client:
            resp = await client.post(SOLANA_RPC_URL, json=payload); resp.raise_for_status()
        data = resp.json(); result = data.get("result")
        return result is not None and result.get("meta",{}).get("err") is None
    except Exception:
        logger.exception("Failed to verify transaction %s", tx_hash); return False

async def process_expired_escrows() -> list[str]:
    """Auto-refund expired escrows (background task)."""
    now = datetime.now(timezone.utc); expired: list[str] = []
    with _lock:
        for e in list(_escrow_store.values()):
            if e.expires_at and e.expires_at <= now and e.state in (EscrowState.PENDING, EscrowState.FUNDED, EscrowState.ACTIVE):
                expired.append(e.bounty_id)
    for bid in expired:
        try: refund_escrow(EscrowRefundRequest(bounty_id=bid)); logger.info("Auto-refunded expired escrow: %s", bid)
        except (EscrowNotFoundError, EscrowInvalidStateError): pass
    return expired

def reset_stores() -> None:
    """Clear all in-memory escrow data (tests/dev)."""
    with _lock:
        _escrow_store.clear(); _bounty_index.clear(); _ledger_store.clear(); _tx_hash_set.clear()
