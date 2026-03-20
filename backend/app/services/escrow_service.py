"""Custodial escrow service for $FNDRY staking (in-memory MVP).

Manages escrowed $FNDRY in the treasury wallet. Tokens locked on fund,
released to winners or refunded on timeout. Double-spend protection via
unique tx hashes. PostgreSQL migration: escrow_ledger + escrow_audit_log.
"""
from __future__ import annotations
import logging, threading
from datetime import datetime, timezone
from typing import Optional
from app.models.escrow import (
    EscrowFundRequest, EscrowLedgerEntry, EscrowListResponse,
    EscrowRecord, EscrowReleaseRequest, EscrowResponse,
    EscrowState, VALID_TRANSITIONS,
)

logger = logging.getLogger(__name__)
SOLSCAN = "https://solscan.io/tx"
_lock = threading.Lock()
_escrow_store: dict[str, EscrowRecord] = {}
_ledger_store: list[EscrowLedgerEntry] = []


def _url(tx: Optional[str]) -> Optional[str]:
    """Solscan link or None."""
    return f"{SOLSCAN}/{tx}" if tx else None


def _resp(record: EscrowRecord) -> EscrowResponse:
    """Map record to response."""
    return EscrowResponse(**record.model_dump())


def _log(eid: str, act: str, fr: EscrowState, to: EscrowState,
         tx: Optional[str] = None, amt: Optional[float] = None,
         det: Optional[str] = None) -> None:
    """Append audit entry."""
    _ledger_store.append(EscrowLedgerEntry(
        escrow_id=eid, action=act, from_state=fr, to_state=to,
        tx_hash=tx, amount=amt, details=det))


def _chk(cur: EscrowState, tgt: EscrowState) -> None:
    """Validate state transition."""
    if tgt not in VALID_TRANSITIONS.get(cur, []):
        raise ValueError(f"Invalid transition: {cur.value} -> {tgt.value}")


def _active(bounty_id: str) -> Optional[EscrowRecord]:
    """Find non-terminal escrow (caller holds _lock)."""
    for r in _escrow_store.values():
        if r.bounty_id == bounty_id and r.state not in (EscrowState.COMPLETED, EscrowState.REFUNDED):
            return r
    return None


def _in_state(bounty_id: str, state: EscrowState) -> Optional[EscrowRecord]:
    """Find escrow in state (caller holds _lock)."""
    for r in _escrow_store.values():
        if r.bounty_id == bounty_id and r.state == state:
            return r
    return None


def create_escrow(data: EscrowFundRequest) -> EscrowResponse:
    """Create escrow in FUNDED state with double-spend protection."""
    now = datetime.now(timezone.utc)
    with _lock:
        for e in _escrow_store.values():
            if e.bounty_id == data.bounty_id and e.state not in (EscrowState.COMPLETED, EscrowState.REFUNDED):
                raise ValueError(f"Active escrow already exists for bounty '{data.bounty_id}'")
            if e.fund_tx_hash == data.tx_hash:
                raise ValueError(f"Escrow with fund_tx_hash '{data.tx_hash}' already exists")
        rec = EscrowRecord(
            bounty_id=data.bounty_id, creator_wallet=data.creator_wallet,
            amount=data.amount, state=EscrowState.FUNDED,
            fund_tx_hash=data.tx_hash, solscan_fund_url=_url(data.tx_hash),
            created_at=now, updated_at=now, expires_at=data.expires_at)
        _escrow_store[rec.id] = rec
        _log(rec.id, "fund", EscrowState.PENDING, EscrowState.FUNDED,
             data.tx_hash, data.amount, f"Funded {data.amount} FNDRY")
    return _resp(rec)


def get_escrow_by_bounty(bounty_id: str) -> Optional[EscrowResponse]:
    """Look up current escrow (active first, then most recent)."""
    with _lock:
        act = _active(bounty_id)
        if act:
            return _resp(act)
        recs = [r for r in _escrow_store.values() if r.bounty_id == bounty_id]
        if recs:
            return _resp(max(recs, key=lambda r: r.updated_at))
    return None


def get_escrow_by_id(escrow_id: str) -> Optional[EscrowResponse]:
    """Look up escrow by UUID."""
    with _lock:
        rec = _escrow_store.get(escrow_id)
    return _resp(rec) if rec else None


def activate_escrow(bounty_id: str) -> EscrowResponse:
    """FUNDED -> ACTIVE."""
    now = datetime.now(timezone.utc)
    with _lock:
        rec = _in_state(bounty_id, EscrowState.FUNDED)
        if not rec:
            raise ValueError(f"No escrow in FUNDED state found for bounty '{bounty_id}'")
        rec.state = EscrowState.ACTIVE
        rec.updated_at = now
        _log(rec.id, "state_change", EscrowState.FUNDED, EscrowState.ACTIVE)
    return _resp(rec)


def release_escrow(bounty_id: str, data: EscrowReleaseRequest) -> EscrowResponse:
    """ACTIVE -> RELEASING with winner wallet."""
    now = datetime.now(timezone.utc)
    with _lock:
        rec = _active(bounty_id)
        if not rec:
            raise ValueError(f"No active escrow found for bounty '{bounty_id}'")
        _chk(rec.state, EscrowState.RELEASING)
        old = rec.state
        rec.state = EscrowState.RELEASING
        rec.winner_wallet = data.winner_wallet
        rec.updated_at = now
        _log(rec.id, "release", old, EscrowState.RELEASING, amt=rec.amount)
    return _resp(rec)


def confirm_release(bounty_id: str, release_tx_hash: str) -> EscrowResponse:
    """RELEASING -> COMPLETED with on-chain confirmation."""
    now = datetime.now(timezone.utc)
    with _lock:
        rec = _in_state(bounty_id, EscrowState.RELEASING)
        if not rec:
            raise ValueError(f"No escrow in RELEASING state found for bounty '{bounty_id}'")
        for e in _escrow_store.values():
            if e.release_tx_hash == release_tx_hash and e.id != rec.id:
                raise ValueError(f"Release tx_hash '{release_tx_hash}' already used")
        rec.state = EscrowState.COMPLETED
        rec.release_tx_hash = release_tx_hash
        rec.solscan_release_url = _url(release_tx_hash)
        rec.updated_at = now
        _log(rec.id, "release", EscrowState.RELEASING, EscrowState.COMPLETED, release_tx_hash, rec.amount)
    return _resp(rec)


def refund_escrow(bounty_id: str) -> EscrowResponse:
    """Refund escrowed $FNDRY to creator."""
    now = datetime.now(timezone.utc)
    with _lock:
        rec = _active(bounty_id)
        if not rec:
            raise ValueError(f"No active escrow found for bounty '{bounty_id}'")
        _chk(rec.state, EscrowState.REFUNDED)
        old = rec.state
        rec.state = EscrowState.REFUNDED
        rec.updated_at = now
        _log(rec.id, "refund", old, EscrowState.REFUNDED, amt=rec.amount)
    return _resp(rec)


def process_expired_escrows() -> list[EscrowResponse]:
    """Auto-refund escrows past expires_at."""
    now = datetime.now(timezone.utc)
    out: list[EscrowResponse] = []
    with _lock:
        for rec in list(_escrow_store.values()):
            if (rec.expires_at and rec.expires_at <= now
                    and rec.state not in (EscrowState.COMPLETED, EscrowState.REFUNDED)):
                old = rec.state
                rec.state = EscrowState.REFUNDED
                rec.updated_at = now
                _log(rec.id, "expire", old, EscrowState.REFUNDED, amt=rec.amount)
                out.append(_resp(rec))
    return out


def list_escrows(creator_wallet: Optional[str] = None,
                 state: Optional[EscrowState] = None,
                 skip: int = 0, limit: int = 20) -> EscrowListResponse:
    """Return filtered, paginated escrows."""
    with _lock:
        results = sorted(_escrow_store.values(), key=lambda r: r.updated_at, reverse=True)
    if creator_wallet:
        results = [r for r in results if r.creator_wallet == creator_wallet]
    if state:
        results = [r for r in results if r.state == state]
    total = len(results)
    return EscrowListResponse(
        items=[_resp(r) for r in results[skip:skip + limit]],
        total=total, skip=skip, limit=limit)


def get_ledger_entries(escrow_id: str) -> list[EscrowLedgerEntry]:
    """Return ledger entries newest first."""
    with _lock:
        entries = [e for e in _ledger_store if e.escrow_id == escrow_id]
    return sorted(entries, key=lambda e: e.timestamp, reverse=True)


def get_total_escrowed() -> float:
    """Total $FNDRY in non-terminal escrows."""
    with _lock:
        return sum(r.amount for r in _escrow_store.values()
                   if r.state not in (EscrowState.COMPLETED, EscrowState.REFUNDED))


def reset_stores() -> None:
    """Clear stores. Used by tests."""
    with _lock:
        _escrow_store.clear()
        _ledger_store.clear()
