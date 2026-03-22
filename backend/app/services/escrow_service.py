"""Custodial escrow service for $FNDRY bounty staking.

Manages the full escrow lifecycle: fund → active → release/refund.
Tokens are transferred via SPL token instructions through the existing
transfer_service. Every state change is recorded in the escrow_ledger
table for auditability.

All database operations use the async session factory. The service
is the single source of truth for escrow state — no in-memory cache.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_event
from app.database import get_db_session
from app.exceptions import (
    EscrowAlreadyExistsError,
    EscrowDoubleSpendError,
    EscrowFundingError,
    EscrowNotFoundError,
    InvalidEscrowTransitionError,
)
from app.models.escrow import (
    ALLOWED_ESCROW_TRANSITIONS,
    EscrowLedgerEntry,
    EscrowLedgerTable,
    EscrowResponse,
    EscrowState,
    EscrowStatusResponse,
    EscrowTable,
    LedgerAction,
)
from app.services.solana_client import TREASURY_WALLET
from app.services.transfer_service import confirm_transaction, send_spl_transfer

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _row_to_response(row: EscrowTable) -> EscrowResponse:
    return EscrowResponse(
        id=str(row.id),
        bounty_id=str(row.bounty_id),
        creator_wallet=row.creator_wallet,
        winner_wallet=row.winner_wallet,
        amount=float(row.amount),
        state=EscrowState(row.state),
        fund_tx_hash=row.fund_tx_hash,
        release_tx_hash=row.release_tx_hash,
        expires_at=row.expires_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _ledger_row_to_entry(row: EscrowLedgerTable) -> EscrowLedgerEntry:
    return EscrowLedgerEntry(
        id=str(row.id),
        escrow_id=str(row.escrow_id),
        action=LedgerAction(row.action),
        from_state=row.from_state,
        to_state=row.to_state,
        amount=float(row.amount),
        wallet=row.wallet,
        tx_hash=row.tx_hash,
        note=row.note,
        created_at=row.created_at,
    )


def _validate_transition(current: EscrowState, target: EscrowState) -> None:
    allowed = ALLOWED_ESCROW_TRANSITIONS.get(current, frozenset())
    if target not in allowed:
        raise InvalidEscrowTransitionError(
            f"Cannot transition escrow from '{current.value}' to '{target.value}'"
        )


async def _record_ledger(
    db: AsyncSession,
    escrow_id,
    action: LedgerAction,
    from_state: str,
    to_state: str,
    amount: float,
    wallet: str,
    tx_hash: str | None = None,
    note: str | None = None,
) -> EscrowLedgerTable:
    entry = EscrowLedgerTable(
        escrow_id=escrow_id,
        action=action.value,
        from_state=from_state,
        to_state=to_state,
        amount=amount,
        wallet=wallet,
        tx_hash=tx_hash,
        note=note,
    )
    db.add(entry)
    return entry


async def _get_escrow_by_bounty(
    db: AsyncSession, bounty_id: str
) -> EscrowTable | None:
    result = await db.execute(
        select(EscrowTable).where(EscrowTable.bounty_id == bounty_id)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def create_escrow(
    bounty_id: str,
    creator_wallet: str,
    amount: float,
    expires_at: datetime | None = None,
) -> EscrowResponse:
    """Create a new escrow in PENDING state and initiate funding.

    Transfers $FNDRY from the creator's wallet to the treasury,
    verifies the transaction on-chain, then moves to FUNDED state.

    Raises:
        EscrowAlreadyExistsError: If an escrow already exists for this bounty.
        EscrowFundingError: If the SPL transfer fails.
        EscrowDoubleSpendError: If the transaction cannot be confirmed.
    """
    async with get_db_session() as db:
        existing = await _get_escrow_by_bounty(db, bounty_id)
        if existing is not None:
            raise EscrowAlreadyExistsError(
                f"Escrow already exists for bounty '{bounty_id}'"
            )

        escrow = EscrowTable(
            bounty_id=bounty_id,
            creator_wallet=creator_wallet,
            amount=amount,
            state=EscrowState.PENDING.value,
            expires_at=expires_at,
        )
        db.add(escrow)
        await db.flush()

        await _record_ledger(
            db,
            escrow_id=escrow.id,
            action=LedgerAction.STATE_CHANGE,
            from_state="none",
            to_state=EscrowState.PENDING.value,
            amount=amount,
            wallet=creator_wallet,
            note="Escrow created",
        )
        await db.commit()
        await db.refresh(escrow)

        audit_event(
            "escrow_created",
            escrow_id=str(escrow.id),
            bounty_id=bounty_id,
            creator_wallet=creator_wallet,
            amount=amount,
        )

    # Initiate the SPL transfer from creator → treasury
    tx_hash: str | None = None
    try:
        tx_hash = await send_spl_transfer(
            recipient_wallet=TREASURY_WALLET,
            amount=amount,
        )
    except Exception as exc:
        logger.error("Escrow funding transfer failed for bounty %s: %s", bounty_id, exc)
        async with get_db_session() as db:
            escrow_row = await _get_escrow_by_bounty(db, bounty_id)
            if escrow_row:
                escrow_row.state = EscrowState.REFUNDED.value
                await _record_ledger(
                    db,
                    escrow_id=escrow_row.id,
                    action=LedgerAction.STATE_CHANGE,
                    from_state=EscrowState.PENDING.value,
                    to_state=EscrowState.REFUNDED.value,
                    amount=amount,
                    wallet=creator_wallet,
                    note=f"Funding failed: {exc}",
                )
                await db.commit()
        raise EscrowFundingError(f"Funding transfer failed: {exc}") from exc

    confirmed = False
    try:
        confirmed = await confirm_transaction(tx_hash)
    except Exception as exc:
        logger.warning("Confirmation check failed for tx %s: %s", tx_hash, exc)

    async with get_db_session() as db:
        escrow_row = await _get_escrow_by_bounty(db, bounty_id)
        if not escrow_row:
            raise EscrowNotFoundError(f"Escrow disappeared for bounty '{bounty_id}'")

        if confirmed:
            escrow_row.state = EscrowState.FUNDED.value
            escrow_row.fund_tx_hash = tx_hash
            await _record_ledger(
                db,
                escrow_id=escrow_row.id,
                action=LedgerAction.DEPOSIT,
                from_state=EscrowState.PENDING.value,
                to_state=EscrowState.FUNDED.value,
                amount=amount,
                wallet=creator_wallet,
                tx_hash=tx_hash,
                note="Funding confirmed on-chain",
            )
            await db.commit()
            await db.refresh(escrow_row)

            audit_event(
                "escrow_funded",
                escrow_id=str(escrow_row.id),
                bounty_id=bounty_id,
                tx_hash=tx_hash,
                amount=amount,
            )
            return _row_to_response(escrow_row)
        else:
            escrow_row.state = EscrowState.REFUNDED.value
            await _record_ledger(
                db,
                escrow_id=escrow_row.id,
                action=LedgerAction.STATE_CHANGE,
                from_state=EscrowState.PENDING.value,
                to_state=EscrowState.REFUNDED.value,
                amount=amount,
                wallet=creator_wallet,
                tx_hash=tx_hash,
                note="Funding tx not confirmed (double-spend protection)",
            )
            await db.commit()
            raise EscrowDoubleSpendError(
                f"Funding transaction {tx_hash} could not be confirmed"
            )


async def activate_escrow(bounty_id: str) -> EscrowResponse:
    """Move a FUNDED escrow to ACTIVE (bounty is now open for work)."""
    async with get_db_session() as db:
        escrow = await _get_escrow_by_bounty(db, bounty_id)
        if not escrow:
            raise EscrowNotFoundError(f"No escrow found for bounty '{bounty_id}'")

        current = EscrowState(escrow.state)
        _validate_transition(current, EscrowState.ACTIVE)

        old_state = escrow.state
        escrow.state = EscrowState.ACTIVE.value
        await _record_ledger(
            db,
            escrow_id=escrow.id,
            action=LedgerAction.STATE_CHANGE,
            from_state=old_state,
            to_state=EscrowState.ACTIVE.value,
            amount=float(escrow.amount),
            wallet=escrow.creator_wallet,
            note="Escrow activated",
        )
        await db.commit()
        await db.refresh(escrow)
        return _row_to_response(escrow)


async def release_escrow(
    bounty_id: str, winner_wallet: str
) -> EscrowResponse:
    """Release escrowed $FNDRY to the bounty winner.

    Transitions: ACTIVE → RELEASING → COMPLETED (or back to ACTIVE on failure).
    Transfers tokens from treasury to the winner's wallet.

    Raises:
        EscrowNotFoundError: No escrow for this bounty.
        InvalidEscrowTransitionError: Escrow not in ACTIVE state.
        EscrowFundingError: SPL transfer to winner failed.
    """
    async with get_db_session() as db:
        escrow = await _get_escrow_by_bounty(db, bounty_id)
        if not escrow:
            raise EscrowNotFoundError(f"No escrow found for bounty '{bounty_id}'")

        current = EscrowState(escrow.state)
        _validate_transition(current, EscrowState.RELEASING)

        escrow.state = EscrowState.RELEASING.value
        escrow.winner_wallet = winner_wallet
        await _record_ledger(
            db,
            escrow_id=escrow.id,
            action=LedgerAction.STATE_CHANGE,
            from_state=current.value,
            to_state=EscrowState.RELEASING.value,
            amount=float(escrow.amount),
            wallet=winner_wallet,
            note="Release initiated",
        )
        await db.commit()
        escrow_id = escrow.id
        amount = float(escrow.amount)

    tx_hash: str | None = None
    try:
        tx_hash = await send_spl_transfer(
            recipient_wallet=winner_wallet,
            amount=amount,
        )
    except Exception as exc:
        logger.error("Escrow release transfer failed for bounty %s: %s", bounty_id, exc)
        # Revert to ACTIVE so it can be retried
        async with get_db_session() as db:
            await db.execute(
                update(EscrowTable)
                .where(EscrowTable.id == escrow_id)
                .values(state=EscrowState.ACTIVE.value)
            )
            result = await db.execute(
                select(EscrowTable).where(EscrowTable.id == escrow_id)
            )
            escrow_row = result.scalar_one()
            await _record_ledger(
                db,
                escrow_id=escrow_id,
                action=LedgerAction.STATE_CHANGE,
                from_state=EscrowState.RELEASING.value,
                to_state=EscrowState.ACTIVE.value,
                amount=amount,
                wallet=winner_wallet,
                note=f"Release failed, reverting: {exc}",
            )
            await db.commit()
        raise EscrowFundingError(
            f"Release transfer failed: {exc}", tx_hash=None
        ) from exc

    # Verify confirmation
    confirmed = False
    try:
        confirmed = await confirm_transaction(tx_hash)
    except Exception as exc:
        logger.warning("Release confirmation check failed for tx %s: %s", tx_hash, exc)

    async with get_db_session() as db:
        if confirmed:
            await db.execute(
                update(EscrowTable)
                .where(EscrowTable.id == escrow_id)
                .values(
                    state=EscrowState.COMPLETED.value,
                    release_tx_hash=tx_hash,
                )
            )
            await _record_ledger(
                db,
                escrow_id=escrow_id,
                action=LedgerAction.RELEASE,
                from_state=EscrowState.RELEASING.value,
                to_state=EscrowState.COMPLETED.value,
                amount=amount,
                wallet=winner_wallet,
                tx_hash=tx_hash,
                note="Release confirmed",
            )
            await db.commit()

            audit_event(
                "escrow_released",
                escrow_id=str(escrow_id),
                bounty_id=bounty_id,
                winner_wallet=winner_wallet,
                tx_hash=tx_hash,
                amount=amount,
            )
        else:
            # Revert to ACTIVE for retry
            await db.execute(
                update(EscrowTable)
                .where(EscrowTable.id == escrow_id)
                .values(state=EscrowState.ACTIVE.value)
            )
            await _record_ledger(
                db,
                escrow_id=escrow_id,
                action=LedgerAction.STATE_CHANGE,
                from_state=EscrowState.RELEASING.value,
                to_state=EscrowState.ACTIVE.value,
                amount=amount,
                wallet=winner_wallet,
                tx_hash=tx_hash,
                note="Release tx not confirmed, reverting",
            )
            await db.commit()
            raise EscrowDoubleSpendError(
                f"Release transaction {tx_hash} could not be confirmed"
            )

        result = await db.execute(
            select(EscrowTable).where(EscrowTable.id == escrow_id)
        )
        escrow_row = result.scalar_one()
        return _row_to_response(escrow_row)


async def refund_escrow(bounty_id: str) -> EscrowResponse:
    """Refund escrowed $FNDRY back to the bounty creator.

    Valid from FUNDED or ACTIVE states (timeout/cancellation).
    Transfers tokens from treasury back to the creator's wallet.

    Raises:
        EscrowNotFoundError: No escrow for this bounty.
        InvalidEscrowTransitionError: Escrow not in a refundable state.
    """
    async with get_db_session() as db:
        escrow = await _get_escrow_by_bounty(db, bounty_id)
        if not escrow:
            raise EscrowNotFoundError(f"No escrow found for bounty '{bounty_id}'")

        current = EscrowState(escrow.state)
        _validate_transition(current, EscrowState.REFUNDED)

        escrow_id = escrow.id
        amount = float(escrow.amount)
        creator_wallet = escrow.creator_wallet
        old_state = escrow.state

    tx_hash: str | None = None
    try:
        tx_hash = await send_spl_transfer(
            recipient_wallet=creator_wallet,
            amount=amount,
        )
    except Exception as exc:
        logger.error("Escrow refund transfer failed for bounty %s: %s", bounty_id, exc)
        raise EscrowFundingError(
            f"Refund transfer failed: {exc}", tx_hash=None
        ) from exc

    async with get_db_session() as db:
        await db.execute(
            update(EscrowTable)
            .where(EscrowTable.id == escrow_id)
            .values(
                state=EscrowState.REFUNDED.value,
                release_tx_hash=tx_hash,
            )
        )
        await _record_ledger(
            db,
            escrow_id=escrow_id,
            action=LedgerAction.REFUND,
            from_state=old_state,
            to_state=EscrowState.REFUNDED.value,
            amount=amount,
            wallet=creator_wallet,
            tx_hash=tx_hash,
            note="Refund completed",
        )
        await db.commit()

        audit_event(
            "escrow_refunded",
            escrow_id=str(escrow_id),
            bounty_id=bounty_id,
            creator_wallet=creator_wallet,
            tx_hash=tx_hash,
            amount=amount,
        )

        result = await db.execute(
            select(EscrowTable).where(EscrowTable.id == escrow_id)
        )
        escrow_row = result.scalar_one()
        return _row_to_response(escrow_row)


async def get_escrow_status(bounty_id: str) -> EscrowStatusResponse:
    """Return the current escrow state, balance, and full audit ledger.

    Raises:
        EscrowNotFoundError: No escrow for this bounty.
    """
    async with get_db_session() as db:
        escrow = await _get_escrow_by_bounty(db, bounty_id)
        if not escrow:
            raise EscrowNotFoundError(f"No escrow found for bounty '{bounty_id}'")

        ledger_result = await db.execute(
            select(EscrowLedgerTable)
            .where(EscrowLedgerTable.escrow_id == escrow.id)
            .order_by(EscrowLedgerTable.created_at.asc())
        )
        ledger_rows = ledger_result.scalars().all()

        return EscrowStatusResponse(
            escrow=_row_to_response(escrow),
            ledger=[_ledger_row_to_entry(row) for row in ledger_rows],
        )


# ---------------------------------------------------------------------------
# Auto-refund expired escrows
# ---------------------------------------------------------------------------

async def refund_expired_escrows() -> int:
    """Find and refund all escrows past their expires_at deadline.

    Only processes escrows in FUNDED or ACTIVE state with an
    expires_at in the past. Returns the number of escrows refunded.
    """
    now = datetime.now(timezone.utc)
    refunded_count = 0

    async with get_db_session() as db:
        result = await db.execute(
            select(EscrowTable).where(
                EscrowTable.expires_at <= now,
                EscrowTable.state.in_([
                    EscrowState.FUNDED.value,
                    EscrowState.ACTIVE.value,
                ]),
            )
        )
        expired = result.scalars().all()

    for escrow_row in expired:
        bounty_id = str(escrow_row.bounty_id)
        try:
            await refund_escrow(bounty_id)
            refunded_count += 1
            logger.info(
                "Auto-refunded expired escrow for bounty %s", bounty_id
            )
        except Exception as exc:
            logger.error(
                "Auto-refund failed for bounty %s: %s", bounty_id, exc
            )

    return refunded_count


async def periodic_escrow_refund(interval_seconds: int = 60) -> None:
    """Background task that periodically checks for and refunds expired escrows."""
    while True:
        try:
            count = await refund_expired_escrows()
            if count > 0:
                logger.info("Periodic escrow refund: refunded %d expired escrows", count)
        except Exception as exc:
            logger.error("Periodic escrow refund error: %s", exc)
        await asyncio.sleep(interval_seconds)
