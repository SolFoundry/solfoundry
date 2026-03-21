"""Payout service with queue management, locks, admin approval, and transfer execution.

Provides the business logic layer for the automated payout pipeline:

- **Create**: Record a new payout (with optional pre-confirmed tx_hash).
- **Approve / Reject**: Admin gate before on-chain execution.
- **Process**: Execute the SPL transfer and confirm on-chain.
- **Query**: List, filter, and look up payouts by various criteria.

In-memory MVP -- data is lost on restart.  See ``PayoutRecord`` docstring
for the PostgreSQL migration schema that preserves the same semantics with
UNIQUE constraints replacing in-memory duplicate checks.
"""

from __future__ import annotations

import asyncio
import threading
from datetime import datetime, timezone
from typing import Optional

from app.core.audit import audit_event
from app.exceptions import (
    DoublePayError,
    InvalidPayoutTransitionError,
    PayoutLockError,
    PayoutNotFoundError,
)
from app.models.payout import (
    ALLOWED_TRANSITIONS,
    AdminApprovalResponse,
    BuybackCreate,
    BuybackRecord,
    BuybackResponse,
    BuybackListResponse,
    PayoutCreate,
    PayoutRecord,
    PayoutResponse,
    PayoutListResponse,
    PayoutStatus,
)
from app.services.transfer_service import confirm_transaction, send_spl_transfer

# ---------------------------------------------------------------------------
# In-memory storage (MVP)
# ---------------------------------------------------------------------------

_lock = threading.Lock()
"""Global lock protecting all in-memory store mutations."""

_payout_store: dict[str, PayoutRecord] = {}
"""Primary payout store keyed by payout UUID."""

_buyback_store: dict[str, BuybackRecord] = {}
"""Primary buyback store keyed by buyback UUID."""

_bounty_locks: dict[str, threading.Lock] = {}
"""Per-bounty locks for double-pay prevention."""

SOLSCAN_TX_BASE: str = "https://solscan.io/tx"
"""Base URL for Solscan transaction explorer links."""


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _solscan_url(tx_hash: Optional[str]) -> Optional[str]:
    """Return a Solscan explorer link for *tx_hash*, or ``None``.

    Args:
        tx_hash: The on-chain transaction signature, or ``None``.

    Returns:
        A full Solscan URL string, or ``None`` if no hash is provided.
    """
    if not tx_hash:
        return None
    return f"{SOLSCAN_TX_BASE}/{tx_hash}"


def _touch_updated_at(record: PayoutRecord) -> None:
    """Refresh the ``updated_at`` timestamp on a payout record.

    Args:
        record: The payout record to update.
    """
    record.updated_at = datetime.now(timezone.utc)


def _payout_to_response(payout_record: PayoutRecord) -> PayoutResponse:
    """Map an internal ``PayoutRecord`` to the public ``PayoutResponse`` schema.

    Args:
        payout_record: The internal payout record.

    Returns:
        A ``PayoutResponse`` suitable for API serialization.
    """
    return PayoutResponse(
        id=payout_record.id,
        recipient=payout_record.recipient,
        recipient_wallet=payout_record.recipient_wallet,
        amount=payout_record.amount,
        token=payout_record.token,
        bounty_id=payout_record.bounty_id,
        bounty_title=payout_record.bounty_title,
        tx_hash=payout_record.tx_hash,
        status=payout_record.status,
        solscan_url=payout_record.solscan_url,
        retry_count=payout_record.retry_count,
        failure_reason=payout_record.failure_reason,
        created_at=payout_record.created_at,
        updated_at=payout_record.updated_at,
    )


def _buyback_to_response(buyback_record: BuybackRecord) -> BuybackResponse:
    """Map an internal ``BuybackRecord`` to the public ``BuybackResponse`` schema.

    Args:
        buyback_record: The internal buyback record.

    Returns:
        A ``BuybackResponse`` suitable for API serialization.
    """
    return BuybackResponse(
        id=buyback_record.id,
        amount_sol=buyback_record.amount_sol,
        amount_fndry=buyback_record.amount_fndry,
        price_per_fndry=buyback_record.price_per_fndry,
        tx_hash=buyback_record.tx_hash,
        solscan_url=buyback_record.solscan_url,
        created_at=buyback_record.created_at,
    )


# ---------------------------------------------------------------------------
# Payout CRUD
# ---------------------------------------------------------------------------

def create_payout(data: PayoutCreate) -> PayoutResponse:
    """Create a new payout record in the queue.

    If ``tx_hash`` is provided, the payout is immediately marked
    ``CONFIRMED``; otherwise it enters the queue as ``PENDING`` and
    requires admin approval before execution.

    Acquires a per-bounty lock when ``bounty_id`` is set to prevent
    double-pay (only one non-failed payout per bounty is allowed).

    Args:
        data: The payout creation request with recipient, amount, etc.

    Returns:
        The created payout as a ``PayoutResponse``.

    Raises:
        DoublePayError: If the bounty already has an active (non-failed) payout.
        PayoutLockError: If the per-bounty lock cannot be acquired within 5 seconds.
        ValueError: If a payout with the same ``tx_hash`` already exists.
    """
    solscan = _solscan_url(data.tx_hash)
    status = PayoutStatus.CONFIRMED if data.tx_hash else PayoutStatus.PENDING
    record = PayoutRecord(
        recipient=data.recipient,
        recipient_wallet=data.recipient_wallet,
        amount=data.amount,
        token=data.token,
        bounty_id=data.bounty_id,
        bounty_title=data.bounty_title,
        tx_hash=data.tx_hash,
        status=status,
        solscan_url=solscan,
    )

    def _insert() -> None:
        """Validate uniqueness constraints and insert the record under lock."""
        if data.tx_hash:
            for existing in _payout_store.values():
                if existing.tx_hash == data.tx_hash:
                    raise ValueError("Payout with this tx_hash already exists")
        if data.bounty_id:
            for existing in _payout_store.values():
                if (
                    existing.bounty_id == data.bounty_id
                    and existing.status != PayoutStatus.FAILED
                ):
                    raise DoublePayError(
                        f"Bounty '{data.bounty_id}' already has an active payout "
                        f"(id={existing.id}, status={existing.status.value})"
                    )
        _payout_store[record.id] = record

    if data.bounty_id:
        with _lock:
            if data.bounty_id not in _bounty_locks:
                _bounty_locks[data.bounty_id] = threading.Lock()
            bounty_lock = _bounty_locks[data.bounty_id]
        if not bounty_lock.acquire(timeout=5):
            raise PayoutLockError(
                f"Could not acquire lock for bounty '{data.bounty_id}'"
            )
        try:
            with _lock:
                _insert()
        finally:
            bounty_lock.release()
    else:
        with _lock:
            _insert()

    audit_event(
        "payout_created",
        payout_id=record.id,
        recipient=record.recipient,
        amount=record.amount,
        token=record.token,
        tx_hash=record.tx_hash,
    )
    return _payout_to_response(record)


def get_payout_by_id(payout_id: str) -> Optional[PayoutResponse]:
    """Look up a single payout by its internal UUID.

    Args:
        payout_id: The UUID of the payout to retrieve.

    Returns:
        A ``PayoutResponse`` if found, otherwise ``None``.
    """
    with _lock:
        record = _payout_store.get(payout_id)
    return _payout_to_response(record) if record else None


def get_payout_by_tx_hash(tx_hash: str) -> Optional[PayoutResponse]:
    """Look up a single payout by its on-chain transaction hash.

    Args:
        tx_hash: The Solana transaction signature to search for.

    Returns:
        A ``PayoutResponse`` if found, otherwise ``None``.
    """
    with _lock:
        for record in _payout_store.values():
            if record.tx_hash == tx_hash:
                return _payout_to_response(record)
    return None


def list_payouts(
    recipient: Optional[str] = None,
    status: Optional[PayoutStatus] = None,
    bounty_id: Optional[str] = None,
    token: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 20,
) -> PayoutListResponse:
    """Return a filtered, paginated list of payouts (newest first).

    Supports filtering by recipient, status, bounty_id, token type,
    and date range (``start_date`` / ``end_date`` on ``created_at``).

    Args:
        recipient: Filter by recipient username (exact match).
        status: Filter by payout lifecycle status.
        bounty_id: Filter by associated bounty UUID.
        token: Filter by token type (``FNDRY`` or ``SOL``).
        start_date: Include only payouts created at or after this datetime.
        end_date: Include only payouts created at or before this datetime.
        skip: Number of records to skip (for pagination).
        limit: Maximum number of records to return.

    Returns:
        A ``PayoutListResponse`` with the matching page and total count.
    """
    with _lock:
        results = sorted(
            _payout_store.values(), key=lambda p: p.created_at, reverse=True
        )
    if recipient:
        results = [p for p in results if p.recipient == recipient]
    if status:
        results = [p for p in results if p.status == status]
    if bounty_id:
        results = [p for p in results if p.bounty_id == bounty_id]
    if token:
        results = [p for p in results if p.token == token]
    if start_date:
        # Ensure timezone-aware comparison (add UTC if naive)
        effective_start = start_date if start_date.tzinfo else start_date.replace(tzinfo=timezone.utc)
        results = [p for p in results if p.created_at >= effective_start]
    if end_date:
        effective_end = end_date if end_date.tzinfo else end_date.replace(tzinfo=timezone.utc)
        results = [p for p in results if p.created_at <= effective_end]
    total = len(results)
    page = results[skip : skip + limit]
    return PayoutListResponse(
        items=[_payout_to_response(p) for p in page],
        total=total,
        skip=skip,
        limit=limit,
    )


def get_total_paid_out() -> tuple[float, float]:
    """Return ``(total_fndry, total_sol)`` for CONFIRMED payouts only.

    Only payouts that have reached the ``CONFIRMED`` state are included
    in the totals; pending, approved, processing, and failed payouts
    are excluded.

    Returns:
        A tuple of (total FNDRY paid, total SOL paid).
    """
    total_fndry = 0.0
    total_sol = 0.0
    with _lock:
        for payout_record in _payout_store.values():
            if payout_record.status == PayoutStatus.CONFIRMED:
                if payout_record.token == "FNDRY":
                    total_fndry += payout_record.amount
                elif payout_record.token == "SOL":
                    total_sol += payout_record.amount
    return total_fndry, total_sol


# ---------------------------------------------------------------------------
# Buyback CRUD
# ---------------------------------------------------------------------------

def create_buyback(data: BuybackCreate) -> BuybackResponse:
    """Record a new buyback event; rejects duplicate ``tx_hash``.

    Args:
        data: The buyback creation request.

    Returns:
        The created buyback as a ``BuybackResponse``.

    Raises:
        ValueError: If a buyback with the same ``tx_hash`` already exists.
    """
    solscan = _solscan_url(data.tx_hash)
    record = BuybackRecord(
        amount_sol=data.amount_sol,
        amount_fndry=data.amount_fndry,
        price_per_fndry=data.price_per_fndry,
        tx_hash=data.tx_hash,
        solscan_url=solscan,
    )
    with _lock:
        if data.tx_hash:
            for existing in _buyback_store.values():
                if existing.tx_hash == data.tx_hash:
                    raise ValueError("Buyback with this tx_hash already exists")
        _buyback_store[record.id] = record

    audit_event(
        "buyback_created",
        buyback_id=record.id,
        amount_sol=record.amount_sol,
        amount_fndry=record.amount_fndry,
        tx_hash=record.tx_hash,
    )
    return _buyback_to_response(record)


def list_buybacks(skip: int = 0, limit: int = 20) -> BuybackListResponse:
    """Return a paginated list of buybacks (newest first).

    Args:
        skip: Number of records to skip.
        limit: Maximum number of records to return.

    Returns:
        A ``BuybackListResponse`` with the matching page and total count.
    """
    with _lock:
        results = sorted(
            _buyback_store.values(), key=lambda b: b.created_at, reverse=True
        )
    total = len(results)
    page = results[skip : skip + limit]
    return BuybackListResponse(
        items=[_buyback_to_response(b) for b in page],
        total=total,
        skip=skip,
        limit=limit,
    )


def get_total_buybacks() -> tuple[float, float]:
    """Return ``(total_sol_spent, total_fndry_acquired)`` across all buybacks.

    Returns:
        A tuple of (total SOL spent, total FNDRY acquired).
    """
    total_sol = 0.0
    total_fndry = 0.0
    with _lock:
        for buyback_record in _buyback_store.values():
            total_sol += buyback_record.amount_sol
            total_fndry += buyback_record.amount_fndry
    return total_sol, total_fndry


# ---------------------------------------------------------------------------
# State machine transitions
# ---------------------------------------------------------------------------

def _transition_status(record: PayoutRecord, new_status: PayoutStatus) -> None:
    """Apply a state-machine transition and refresh ``updated_at``.

    Validates that the transition is allowed according to
    ``ALLOWED_TRANSITIONS`` before applying.

    Args:
        record: The payout record to transition.
        new_status: The target status.

    Raises:
        InvalidPayoutTransitionError: If the transition is not allowed
            from the current status.
    """
    allowed = ALLOWED_TRANSITIONS.get(record.status, frozenset())
    if new_status not in allowed:
        raise InvalidPayoutTransitionError(
            f"Cannot transition from '{record.status.value}' to '{new_status.value}'"
        )
    record.status = new_status
    _touch_updated_at(record)


# ---------------------------------------------------------------------------
# Admin approval / rejection
# ---------------------------------------------------------------------------

def approve_payout(payout_id: str, admin_id: str) -> AdminApprovalResponse:
    """Admin-approve a pending payout, advancing it to APPROVED status.

    Args:
        payout_id: The UUID of the payout to approve.
        admin_id: Identifier of the admin performing the approval.

    Returns:
        An ``AdminApprovalResponse`` confirming the action.

    Raises:
        PayoutNotFoundError: If the payout does not exist.
        InvalidPayoutTransitionError: If the payout is not in PENDING status.
    """
    with _lock:
        record = _payout_store.get(payout_id)
        if record is None:
            raise PayoutNotFoundError(f"Payout '{payout_id}' not found")
        _transition_status(record, PayoutStatus.APPROVED)
        record.admin_approved_by = admin_id
    audit_event("payout_approved", payout_id=payout_id, admin_id=admin_id)
    return AdminApprovalResponse(
        payout_id=payout_id,
        status=PayoutStatus.APPROVED,
        admin_id=admin_id,
        message=f"Payout approved by {admin_id}",
    )


def reject_payout(
    payout_id: str, admin_id: str, reason: Optional[str] = None
) -> AdminApprovalResponse:
    """Admin-reject a pending payout, moving it to FAILED status.

    Args:
        payout_id: The UUID of the payout to reject.
        admin_id: Identifier of the admin performing the rejection.
        reason: Optional human-readable reason for rejection.

    Returns:
        An ``AdminApprovalResponse`` confirming the action.

    Raises:
        PayoutNotFoundError: If the payout does not exist.
        InvalidPayoutTransitionError: If the payout is not in PENDING status.
    """
    with _lock:
        record = _payout_store.get(payout_id)
        if record is None:
            raise PayoutNotFoundError(f"Payout '{payout_id}' not found")
        _transition_status(record, PayoutStatus.FAILED)
        record.admin_approved_by = admin_id
        record.failure_reason = reason
    audit_event(
        "payout_rejected",
        payout_id=payout_id,
        admin_id=admin_id,
        reason=reason,
    )
    return AdminApprovalResponse(
        payout_id=payout_id,
        status=PayoutStatus.FAILED,
        admin_id=admin_id,
        message=f"Payout rejected by {admin_id}",
    )


# ---------------------------------------------------------------------------
# On-chain transfer execution
# ---------------------------------------------------------------------------

async def process_payout(payout_id: str) -> PayoutResponse:
    """Execute the on-chain SPL transfer for an APPROVED payout.

    Transitions the payout through ``PROCESSING`` and then to either
    ``CONFIRMED`` (on success) or ``FAILED`` (on error).  Tracks the
    retry count from the transfer service.

    Uses ``asyncio.to_thread`` to safely acquire threading locks from
    within an async context.

    Args:
        payout_id: The UUID of the payout to process.

    Returns:
        The updated ``PayoutResponse`` after transfer execution.

    Raises:
        PayoutNotFoundError: If the payout does not exist.
        InvalidPayoutTransitionError: If the payout is not in APPROVED status.
    """

    def _start_processing() -> PayoutRecord:
        """Transition payout to PROCESSING under lock."""
        with _lock:
            record = _payout_store.get(payout_id)
            if record is None:
                raise PayoutNotFoundError(f"Payout '{payout_id}' not found")
            _transition_status(record, PayoutStatus.PROCESSING)
            return record

    record = await asyncio.to_thread(_start_processing)

    try:
        tx_signature = await send_spl_transfer(
            record.recipient_wallet or "", record.amount, "FNDRY"
        )
        await confirm_transaction(tx_signature)

        def _mark_confirmed() -> None:
            """Set payout to CONFIRMED with tx details under lock."""
            with _lock:
                record.tx_hash = tx_signature
                record.solscan_url = _solscan_url(tx_signature)
                record.status = PayoutStatus.CONFIRMED
                _touch_updated_at(record)

        await asyncio.to_thread(_mark_confirmed)
        audit_event(
            "payout_confirmed",
            payout_id=payout_id,
            tx_hash=tx_signature,
        )

    except Exception as transfer_error:

        def _mark_failed() -> None:
            """Set payout to FAILED with error details under lock."""
            with _lock:
                record.status = PayoutStatus.FAILED
                record.failure_reason = str(transfer_error)
                record.retry_count = getattr(transfer_error, "attempts", 0)
                _touch_updated_at(record)

        await asyncio.to_thread(_mark_failed)
        audit_event(
            "payout_failed",
            payout_id=payout_id,
            error=str(transfer_error),
            retry_count=getattr(transfer_error, "attempts", 0),
        )

    return _payout_to_response(record)


# ---------------------------------------------------------------------------
# Test utilities
# ---------------------------------------------------------------------------

def reset_stores() -> None:
    """Clear all in-memory data stores.  Used by tests and development resets.

    This function is NOT safe for production use -- it is intended only
    for test fixtures and development tooling.
    """
    with _lock:
        _payout_store.clear()
        _buyback_store.clear()
        _bounty_locks.clear()
