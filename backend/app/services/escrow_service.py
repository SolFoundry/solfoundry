"""Custodial $FNDRY escrow service with PostgreSQL persistence and SPL transfers.

Lifecycle:
    PENDING -> FUNDED -> ACTIVE -> RELEASING -> COMPLETED
                                -> REFUNDING -> REFUNDED

- Funding: creator sends $FNDRY to treasury externally; we verify on-chain
  via verify_spl_transfer (checks mint, recipient, amount, finalization).
- Activation: FUNDED -> ACTIVE when bounty is opened for submissions.
- Release: ACTIVE -> RELEASING -> COMPLETED with real SPL transfer via solders.
  On transfer failure, reverts RELEASING -> ACTIVE (two-phase approach).
  Release is restricted to INTERNAL_SYSTEM_USER_ID (admin only).
- Refund: any fundable state -> REFUNDING -> REFUNDED via treasury SPL transfer.
  On transfer failure, reverts REFUNDING -> prior state.
- process_expired_escrows uses SELECT FOR UPDATE with skip_locked,
  per-escrow commits, error isolation, and consecutive failure tracking.
- Bounty integration: validates bounty exists/state for funding, checks for
  approved submission before release.
"""
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import INTERNAL_SYSTEM_USER_ID
from app.core.audit import audit_event
from app.exceptions import (
    EscrowAlreadyExistsError,
    EscrowAuthorizationError,
    EscrowDoubleSpendError,
    EscrowInvalidStateError,
    EscrowNotFoundError,
)
from app.models.escrow import (
    VALID_TRANSITIONS,
    EscrowAccountTable as _T,
    EscrowLedgerTable,
    EscrowListResponse,
    EscrowResponse,
    EscrowState,
    LedgerEntry,
)

logger = logging.getLogger(__name__)
ES = EscrowState

# ---------------------------------------------------------------------------
# Expiry loop health metrics (exposed via /health)
# ---------------------------------------------------------------------------

_expiry_loop_consecutive_failures: int = 0
_expiry_loop_last_success: datetime | None = None
_expiry_loop_total_processed: int = 0
_expiry_loop_total_failures: int = 0


def get_expiry_health() -> dict:
    """Return health metrics for the escrow expiry background loop.

    Exposed via the /health endpoint so operators can monitor auto-refund
    reliability and detect stuck loops.
    """
    return {
        "consecutive_failures": _expiry_loop_consecutive_failures,
        "last_success": (
            _expiry_loop_last_success.isoformat()
            if _expiry_loop_last_success
            else None
        ),
        "total_processed": _expiry_loop_total_processed,
        "total_failures": _expiry_loop_total_failures,
    }


# ---------------------------------------------------------------------------
# State machine helpers
# ---------------------------------------------------------------------------


def _check_transition(current: EscrowState, target: EscrowState) -> None:
    """Enforce valid state machine transitions.

    Args:
        current: The escrow's current state.
        target: The desired target state.

    Raises:
        EscrowInvalidStateError: If the transition is not allowed by the state machine.
    """
    if target.value not in VALID_TRANSITIONS.get(current.value, frozenset()):
        raise EscrowInvalidStateError(
            f"Cannot transition {current.value} -> {target.value}"
        )


# ---------------------------------------------------------------------------
# Authorization helpers
# ---------------------------------------------------------------------------


def _authorize(row, user_id: str, action: str) -> None:
    """Verify caller owns escrow or is the platform admin.

    Args:
        row: The escrow database row.
        user_id: The calling user's ID.
        action: Human-readable action name for error messages.

    Raises:
        EscrowAuthorizationError: If the user is neither the creator nor admin.
    """
    if user_id not in (row.creator_user_id, INTERNAL_SYSTEM_USER_ID):
        raise EscrowAuthorizationError(
            f"User {user_id} not authorized to {action} bounty '{row.bounty_id}'"
        )


def _authorize_admin_only(user_id: str, action: str, bounty_id: str) -> None:
    """Verify caller is the platform admin (INTERNAL_SYSTEM_USER_ID).

    Release operations must be admin-only to prevent creators from releasing
    funds to themselves without a valid approved submission.

    Args:
        user_id: The calling user's ID.
        action: Human-readable action name for error messages.
        bounty_id: The bounty identifier for error context.

    Raises:
        EscrowAuthorizationError: If the user is not the system admin.
    """
    if user_id != INTERNAL_SYSTEM_USER_ID:
        raise EscrowAuthorizationError(
            f"User {user_id} not authorized to {action} bounty '{bounty_id}' — "
            f"only the platform system can release escrow funds"
        )


# ---------------------------------------------------------------------------
# Conversion helpers
# ---------------------------------------------------------------------------


def _to_response(row) -> EscrowResponse:
    """Convert a database row to an EscrowResponse Pydantic model.

    Args:
        row: SQLAlchemy EscrowAccountTable row with eager-loaded ledger_entries.

    Returns:
        EscrowResponse with all fields populated from the database row.
    """
    return EscrowResponse(
        id=str(row.id),
        bounty_id=row.bounty_id,
        creator_wallet=row.creator_wallet,
        winner_wallet=row.winner_wallet,
        amount=Decimal(str(row.amount)) if row.amount is not None else Decimal("0"),
        state=ES(row.state),
        fund_tx_hash=row.fund_tx_hash,
        release_tx_hash=row.release_tx_hash,
        refund_tx_hash=row.refund_tx_hash,
        created_at=row.created_at,
        updated_at=row.updated_at,
        expires_at=row.expires_at,
        ledger=[
            LedgerEntry.model_validate(e) for e in (row.ledger_entries or [])
        ],
    )


async def _fetch_escrow(session: AsyncSession, bounty_id: str):
    """Fetch escrow by bounty ID or raise EscrowNotFoundError.

    Args:
        session: The async database session.
        bounty_id: The bounty identifier to look up.

    Returns:
        The EscrowAccountTable row for the given bounty.

    Raises:
        EscrowNotFoundError: If no escrow exists for the bounty.
    """
    result = await session.execute(select(_T).where(_T.bounty_id == bounty_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise EscrowNotFoundError(f"No escrow found for bounty '{bounty_id}'")
    return row


def _make_ledger(escrow_id, action, amount, wallet, tx_hash, timestamp):
    """Create an immutable ledger entry row.

    Args:
        escrow_id: The parent escrow's UUID.
        action: One of 'deposit', 'release', 'refund'.
        amount: The Decimal token amount.
        wallet: The Solana wallet address involved.
        tx_hash: The on-chain transaction signature (may be None for pending).
        timestamp: When the entry was created.

    Returns:
        EscrowLedgerTable instance ready to be added to the session.
    """
    return EscrowLedgerTable(
        escrow_id=escrow_id,
        action=action,
        amount=amount,
        wallet=wallet,
        tx_hash=tx_hash,
        created_at=timestamp,
    )


async def _commit_respond(session, row, event_name, **audit_kwargs):
    """Commit the session, refresh ledger entries, emit audit event, and return response.

    Args:
        session: The async database session.
        row: The escrow row to refresh and convert.
        event_name: The audit event name to emit.
        **audit_kwargs: Additional keyword arguments for the audit event.

    Returns:
        EscrowResponse with refreshed data.
    """
    await session.commit()
    await session.refresh(row, attribute_names=["ledger_entries"])
    audit_event(
        event_name,
        escrow_id=str(row.id),
        bounty_id=row.bounty_id,
        **audit_kwargs,
    )
    return _to_response(row)


# ---------------------------------------------------------------------------
# Bounty lifecycle integration
# ---------------------------------------------------------------------------


def _validate_bounty_for_funding(bounty_id: str) -> None:
    """Validate bounty exists and is in a fundable state (open or in_progress).

    Gracefully degrades if the bounty service is unavailable (e.g. during
    testing or when the service is not yet deployed). Only blocks funding
    when the bounty is confirmed to be in a non-fundable state.

    Args:
        bounty_id: The bounty identifier to validate.

    Raises:
        EscrowInvalidStateError: If the bounty exists but is in a non-fundable state.
    """
    try:
        from app.services.bounty_service import get_bounty

        bounty = get_bounty(bounty_id)
        if bounty is not None and bounty.status.value not in ("open", "in_progress"):
            raise EscrowInvalidStateError(
                f"Bounty '{bounty_id}' is '{bounty.status.value}' and cannot be funded"
            )
    except EscrowInvalidStateError:
        raise
    except ImportError:
        logger.debug("Bounty service not available — skipping funding validation")
    except Exception:
        logger.debug("Could not validate bounty '%s' — proceeding", bounty_id)


def _validate_approved_submission(bounty_id: str) -> None:
    """Validate bounty has at least one approved submission before release.

    Ensures the platform only releases funds when a submission has been reviewed
    and approved. Gracefully degrades if the bounty service is unavailable.

    Args:
        bounty_id: The bounty identifier to check for approved submissions.

    Raises:
        EscrowInvalidStateError: If the bounty exists but has no approved submissions.
    """
    try:
        from app.services.bounty_service import get_submissions

        subs = get_submissions(bounty_id)
        if subs is not None and not any(
            s.status.value in ("approved", "paid") for s in subs
        ):
            raise EscrowInvalidStateError(
                f"Bounty '{bounty_id}' has no approved submissions — cannot release"
            )
    except EscrowInvalidStateError:
        raise
    except ImportError:
        logger.debug("Bounty service not available — skipping submission validation")
    except Exception:
        logger.debug(
            "Could not validate submissions for '%s' — proceeding", bounty_id
        )


# ---------------------------------------------------------------------------
# Transaction verification
# ---------------------------------------------------------------------------


async def verify_transaction_on_chain(
    tx_hash: str, expected_amount: Decimal | None = None
) -> bool:
    """Verify funding tx on Solana: finalized, no errors, correct $FNDRY transfer to treasury.

    Distinguishes transient errors (timeouts, network failures, rate limits)
    from permanent errors (invalid params, malformed tx). Transient errors
    are re-raised as SolanaTransientError so callers can retry. Permanent
    errors return False.

    Args:
        tx_hash: The Solana transaction signature to verify.
        expected_amount: Minimum token amount expected (optional).

    Returns:
        True if the transaction is a valid $FNDRY transfer to treasury.

    Raises:
        SolanaTransientError: On recoverable network/RPC failures.
    """
    from app.services.solana_client import (
        FNDRY_TOKEN_CA,
        TREASURY_WALLET,
        SolanaTransientError,
        verify_spl_transfer,
    )

    try:
        return await verify_spl_transfer(
            tx_hash=tx_hash,
            expected_mint=FNDRY_TOKEN_CA,
            expected_recipient=TREASURY_WALLET,
            min_amount=expected_amount or Decimal("0"),
        )
    except SolanaTransientError:
        logger.warning(
            "Transient error verifying tx %s — caller should retry", tx_hash
        )
        raise
    except Exception:
        logger.exception("Permanent failure verifying transaction %s", tx_hash)
        return False


# ---------------------------------------------------------------------------
# SPL transfer (outbound from treasury)
# ---------------------------------------------------------------------------


async def initiate_spl_transfer(recipient: str, amount: Decimal) -> str:
    """Execute custodial SPL $FNDRY transfer from treasury via solders-based signing.

    Delegates to solana_client.send_spl_transfer which constructs a proper
    transfer_checked instruction, signs with the treasury keypair, and
    submits via sendTransaction RPC.

    Args:
        recipient: The Solana wallet address to receive tokens.
        amount: The Decimal token amount to transfer.

    Returns:
        The on-chain transaction signature string.

    Raises:
        RuntimeError: If the transfer fails (missing keypair, no token account, etc.).
        SolanaTransientError: On recoverable network failures.
    """
    from app.services.solana_client import send_spl_transfer

    return await send_spl_transfer(to_wallet=recipient, amount=amount)


# ---------------------------------------------------------------------------
# IntegrityError handling
# ---------------------------------------------------------------------------


def _classify_integrity_error(
    exc: IntegrityError, bounty_id: str, tx_hash: str | None
) -> Exception:
    """Classify a database IntegrityError into a specific escrow exception.

    Uses PostgreSQL constraint name via psycopg2 diagnostic info when available,
    falling back to string matching for SQLite compatibility in tests.

    Args:
        exc: The SQLAlchemy IntegrityError to classify.
        bounty_id: The bounty ID from the failed operation.
        tx_hash: The transaction hash from the failed operation (may be None).

    Returns:
        An EscrowAlreadyExistsError or EscrowDoubleSpendError as appropriate.
    """
    # Try PostgreSQL-specific constraint name detection first
    constraint_name = None
    if exc.orig and hasattr(exc.orig, "diag") and hasattr(exc.orig.diag, "constraint_name"):
        constraint_name = exc.orig.diag.constraint_name

    if constraint_name:
        if "bounty_id" in constraint_name:
            return EscrowAlreadyExistsError(
                f"Escrow already exists for bounty '{bounty_id}'"
            )
        if "fund_tx_hash" in constraint_name or "tx_hash" in constraint_name:
            return EscrowDoubleSpendError(
                f"Transaction {tx_hash} already recorded"
            )
        # Any other unique constraint violation with a tx_hash is likely double-spend
        if tx_hash:
            return EscrowDoubleSpendError(
                f"Transaction {tx_hash} already recorded (constraint: {constraint_name})"
            )
        return EscrowAlreadyExistsError(
            f"Escrow already exists for bounty '{bounty_id}' (constraint: {constraint_name})"
        )

    # Fallback: string matching for SQLite and other backends
    msg = str(exc.orig) if exc.orig else str(exc)
    if "bounty_id" in msg:
        return EscrowAlreadyExistsError(
            f"Escrow already exists for bounty '{bounty_id}'"
        )
    if tx_hash:
        return EscrowDoubleSpendError(
            f"Transaction {tx_hash} already recorded"
        )
    return EscrowAlreadyExistsError(
        f"Escrow already exists for bounty '{bounty_id}'"
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def create_escrow(session, data, user_id: str) -> EscrowResponse:
    """Create a new escrow account for a bounty.

    If tx_hash is provided and verified, the escrow starts in FUNDED state.
    Otherwise it starts in PENDING, awaiting external funding.

    Validates that the bounty exists and is in a fundable state before creating.
    Uses constraint-based IntegrityError classification for duplicate detection.

    Args:
        session: The async database session.
        data: EscrowCreateRequest with bounty_id, creator_wallet, amount, optional tx_hash.
        user_id: The authenticated user creating the escrow.

    Returns:
        EscrowResponse with the newly created escrow.

    Raises:
        EscrowAlreadyExistsError: If an escrow already exists for this bounty.
        EscrowDoubleSpendError: If the tx_hash has already been used.
        EscrowInvalidStateError: If the bounty is not in a fundable state.
    """
    _validate_bounty_for_funding(data.bounty_id)
    amount = Decimal(str(data.amount))
    state = ES.FUNDED if data.tx_hash else ES.PENDING
    now = datetime.now(timezone.utc)
    escrow_id = str(uuid.uuid4())
    row = _T(
        id=escrow_id,
        bounty_id=data.bounty_id,
        creator_wallet=data.creator_wallet,
        creator_user_id=user_id,
        amount=amount,
        state=state.value,
        fund_tx_hash=data.tx_hash,
        created_at=now,
        updated_at=now,
        expires_at=data.expires_at,
    )
    session.add(row)
    if data.tx_hash:
        session.add(
            _make_ledger(escrow_id, "deposit", amount, data.creator_wallet, data.tx_hash, now)
        )
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise _classify_integrity_error(exc, data.bounty_id, data.tx_hash) from exc
    return await _commit_respond(session, row, "escrow_created", amount=str(amount))


async def activate_escrow(session, bounty_id: str, user_id: str) -> EscrowResponse:
    """Transition escrow from FUNDED to ACTIVE.

    Called when the bounty is opened for submissions. Only the creator
    or system admin can activate.

    Args:
        session: The async database session.
        bounty_id: The bounty whose escrow to activate.
        user_id: The authenticated user requesting activation.

    Returns:
        EscrowResponse with the updated state.

    Raises:
        EscrowNotFoundError: If no escrow exists for the bounty.
        EscrowAuthorizationError: If the user is not authorized.
        EscrowInvalidStateError: If the current state does not allow activation.
    """
    row = await _fetch_escrow(session, bounty_id)
    _authorize(row, user_id, "activate")
    _check_transition(ES(row.state), ES.ACTIVE)
    row.state = ES.ACTIVE.value
    row.updated_at = datetime.now(timezone.utc)
    return await _commit_respond(session, row, "escrow_activated")


async def release_escrow(session, data, user_id: str) -> EscrowResponse:
    """Release escrowed $FNDRY to the bounty winner.

    Two-phase approach: sets state to RELEASING, executes SPL transfer,
    then sets to COMPLETED. On transfer failure, reverts to ACTIVE.

    This operation is restricted to INTERNAL_SYSTEM_USER_ID only — creators
    cannot release funds to prevent self-dealing without approved submissions.

    Args:
        session: The async database session.
        data: EscrowReleaseRequest with bounty_id and winner_wallet.
        user_id: The authenticated user (must be system admin).

    Returns:
        EscrowResponse with COMPLETED state and release tx hash.

    Raises:
        EscrowNotFoundError: If no escrow exists for the bounty.
        EscrowAuthorizationError: If the user is not the system admin.
        EscrowInvalidStateError: If the bounty has no approved submissions
            or the current state does not allow release.
        RuntimeError: If the SPL transfer fails (state reverted to ACTIVE).
    """
    _authorize_admin_only(user_id, "release", data.bounty_id)
    row = await _fetch_escrow(session, data.bounty_id)
    _validate_approved_submission(data.bounty_id)
    current = ES(row.state)
    if current in (ES.FUNDED, ES.ACTIVE):
        _check_transition(current, ES.RELEASING)
        row.state = ES.RELEASING.value
        row.winner_wallet = data.winner_wallet
        row.updated_at = datetime.now(timezone.utc)
        await session.flush()
    elif current != ES.RELEASING:
        _check_transition(current, ES.COMPLETED)
    # Execute SPL transfer with failure recovery
    amount = Decimal(str(row.amount))
    try:
        tx_signature = await initiate_spl_transfer(data.winner_wallet, amount)
    except Exception as err:
        logger.error(
            "SPL transfer failed for %s: %s — reverting to ACTIVE",
            row.bounty_id,
            err,
        )
        row.state = ES.ACTIVE.value
        row.updated_at = datetime.now(timezone.utc)
        await session.commit()
        raise RuntimeError(
            f"SPL transfer to {data.winner_wallet} failed: {err}. Reverted to ACTIVE."
        ) from err
    now = datetime.now(timezone.utc)
    row.state = ES.COMPLETED.value
    row.release_tx_hash = tx_signature
    row.updated_at = now
    session.add(
        _make_ledger(row.id, "release", amount, data.winner_wallet, tx_signature, now)
    )
    return await _commit_respond(
        session, row, "escrow_released", winner=data.winner_wallet
    )


async def refund_escrow(session, data, user_id: str) -> EscrowResponse:
    """Refund escrowed $FNDRY back to the creator via custodial SPL transfer.

    Two-phase approach: sets state to REFUNDING, executes SPL transfer,
    then sets to REFUNDED. On transfer failure, reverts to the prior state.

    Can be initiated by the creator or the system admin.

    Args:
        session: The async database session.
        data: EscrowRefundRequest with bounty_id.
        user_id: The authenticated user (creator or system admin).

    Returns:
        EscrowResponse with REFUNDED state and refund tx hash.

    Raises:
        EscrowNotFoundError: If no escrow exists for the bounty.
        EscrowAuthorizationError: If the user is not authorized.
        EscrowInvalidStateError: If the current state does not allow refund.
        RuntimeError: If the SPL transfer fails (state reverted to prior).
    """
    row = await _fetch_escrow(session, data.bounty_id)
    _authorize(row, user_id, "refund")
    prior_state = ES(row.state)
    _check_transition(prior_state, ES.REFUNDING)
    row.state = ES.REFUNDING.value
    row.updated_at = datetime.now(timezone.utc)
    await session.flush()
    amount = Decimal(str(row.amount))
    try:
        tx_signature = await initiate_spl_transfer(row.creator_wallet, amount)
    except Exception as err:
        logger.error(
            "SPL refund transfer failed for %s: %s — reverting to %s",
            row.bounty_id,
            err,
            prior_state.value,
        )
        row.state = prior_state.value
        row.updated_at = datetime.now(timezone.utc)
        await session.commit()
        raise RuntimeError(
            f"SPL refund to {row.creator_wallet} failed: {err}. "
            f"Reverted to {prior_state.value}."
        ) from err
    now = datetime.now(timezone.utc)
    row.state = ES.REFUNDED.value
    row.refund_tx_hash = tx_signature
    row.updated_at = now
    session.add(
        _make_ledger(row.id, "refund", amount, row.creator_wallet, tx_signature, now)
    )
    return await _commit_respond(
        session, row, "escrow_refunded", amount=str(amount)
    )


async def get_escrow_status(session, bounty_id: str) -> EscrowResponse:
    """Retrieve escrow state and full ledger history for a bounty.

    Args:
        session: The async database session.
        bounty_id: The bounty identifier.

    Returns:
        EscrowResponse with current state and all ledger entries.

    Raises:
        EscrowNotFoundError: If no escrow exists for the bounty.
    """
    return _to_response(await _fetch_escrow(session, bounty_id))


async def list_escrows(
    session, state=None, creator_wallet=None, skip: int = 0, limit: int = 20
):
    """Paginated escrow list with optional state and wallet filters.

    Args:
        session: The async database session.
        state: Optional EscrowState filter.
        creator_wallet: Optional Solana wallet address filter.
        skip: Number of records to skip (pagination offset).
        limit: Maximum number of records to return (default 20, max 100).

    Returns:
        EscrowListResponse with matching items, total count, and pagination info.
    """
    base = select(_T)
    cnt = select(func.count(_T.id))
    if state is not None:
        base = base.where(_T.state == state.value)
        cnt = cnt.where(_T.state == state.value)
    if creator_wallet is not None:
        base = base.where(_T.creator_wallet == creator_wallet)
        cnt = cnt.where(_T.creator_wallet == creator_wallet)
    total = (await session.execute(cnt)).scalar() or 0
    rows = (
        await session.execute(
            base.order_by(_T.created_at.desc()).offset(skip).limit(limit)
        )
    ).scalars().all()
    return EscrowListResponse(
        items=[_to_response(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


async def process_expired_escrows(session) -> list[str]:
    """Auto-refund expired escrows with SELECT FOR UPDATE and per-escrow error isolation.

    Each expired escrow is processed individually within its own flush/commit
    cycle so that a failure on one does not block others. Uses SELECT FOR UPDATE
    with skip_locked to prevent concurrent processing of the same escrow.

    Updates global health metrics for monitoring via /health endpoint.

    Args:
        session: The async database session.

    Returns:
        List of bounty IDs that were successfully refunded.
    """
    global _expiry_loop_consecutive_failures, _expiry_loop_last_success
    global _expiry_loop_total_processed, _expiry_loop_total_failures

    now = datetime.now(timezone.utc)
    active_states = [s.value for s in (ES.PENDING, ES.FUNDED, ES.ACTIVE)]
    # Collect bounty IDs first, then process individually with row-level locks
    id_result = await session.execute(
        select(_T.bounty_id).where(_T.expires_at <= now, _T.state.in_(active_states))
    )
    bounty_ids = id_result.scalars().all()
    refunded: list[str] = []

    for bounty_id in bounty_ids:
        try:
            # SELECT FOR UPDATE with skip_locked for concurrency safety
            query = select(_T).where(_T.bounty_id == bounty_id)
            try:
                query = query.with_for_update(skip_locked=True)
            except Exception:
                pass  # SQLite does not support FOR UPDATE — graceful fallback for tests
            row = (await session.execute(query)).scalar_one_or_none()
            if row is None or row.state not in active_states:
                continue
            amount = Decimal(str(row.amount))
            tx_signature = await initiate_spl_transfer(row.creator_wallet, amount)
            row.state = ES.REFUNDED.value
            row.refund_tx_hash = tx_signature
            row.updated_at = now
            session.add(
                _make_ledger(
                    str(row.id), "refund", amount, row.creator_wallet, tx_signature, now
                )
            )
            await session.commit()
            refunded.append(bounty_id)
            _expiry_loop_total_processed += 1
            logger.info("Auto-refunded expired escrow: %s", bounty_id)
        except Exception:
            logger.exception("Auto-refund failed for escrow: %s", bounty_id)
            _expiry_loop_total_failures += 1
            await session.rollback()

    if bounty_ids and not refunded:
        _expiry_loop_consecutive_failures += 1
        logger.warning(
            "Expiry loop: all %d refunds failed (consecutive: %d)",
            len(bounty_ids),
            _expiry_loop_consecutive_failures,
        )
    elif refunded:
        _expiry_loop_consecutive_failures = 0
        _expiry_loop_last_success = datetime.now(timezone.utc)

    return refunded
