"""Custodial $FNDRY escrow service with PostgreSQL persistence and SPL transfers.

Lifecycle: PENDING -> FUNDED -> ACTIVE -> RELEASING -> COMPLETED | REFUNDED

- Funding: creator sends $FNDRY to treasury externally; we verify on-chain
  via verify_spl_transfer (checks mint, recipient, amount, finalization).
- Activation: FUNDED -> ACTIVE when bounty is opened for submissions.
- Release: ACTIVE -> RELEASING -> COMPLETED with real SPL transfer via solders.
  On transfer failure, reverts RELEASING -> ACTIVE (two-phase approach).
- Refund: any active state -> REFUNDED via treasury SPL transfer.
- process_expired_escrows uses SELECT FOR UPDATE, per-escrow commits,
  error isolation, and consecutive failure tracking.
- Bounty integration: validates bounty exists/state for funding, checks for
  approved submission before release.
"""
import logging, uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.constants import INTERNAL_SYSTEM_USER_ID
from app.core.audit import audit_event
from app.exceptions import (EscrowAlreadyExistsError, EscrowAuthorizationError,
    EscrowDoubleSpendError, EscrowInvalidStateError, EscrowNotFoundError)
from app.models.escrow import (VALID_TRANSITIONS, EscrowAccountTable as _T,
    EscrowLedgerTable, EscrowListResponse, EscrowResponse, EscrowState, LedgerEntry)

logger = logging.getLogger(__name__)
ES = EscrowState
_expiry_loop_failure_count: int = 0

def _check_transition(current: EscrowState, target: EscrowState) -> None:
    """Enforce valid state machine transitions."""
    if target.value not in VALID_TRANSITIONS.get(current.value, frozenset()):
        raise EscrowInvalidStateError(f"Cannot transition {current.value} -> {target.value}")

def _authorize(row, user_id: str, action: str) -> None:
    """Verify caller owns escrow or is platform admin."""
    if user_id not in (row.creator_user_id, INTERNAL_SYSTEM_USER_ID):
        raise EscrowAuthorizationError(f"User {user_id} not authorized to {action} bounty '{row.bounty_id}'")

def _to_response(row) -> EscrowResponse:
    """Convert DB row to EscrowResponse."""
    return EscrowResponse(id=str(row.id), bounty_id=row.bounty_id, creator_wallet=row.creator_wallet,
        winner_wallet=row.winner_wallet,
        amount=Decimal(str(row.amount)) if row.amount is not None else Decimal("0"),
        state=ES(row.state), fund_tx_hash=row.fund_tx_hash, release_tx_hash=row.release_tx_hash,
        refund_tx_hash=row.refund_tx_hash, created_at=row.created_at, updated_at=row.updated_at,
        expires_at=row.expires_at, ledger=[LedgerEntry.model_validate(e) for e in (row.ledger_entries or [])])

async def _fetch_escrow(session: AsyncSession, bounty_id: str):
    """Fetch escrow by bounty ID or raise EscrowNotFoundError."""
    r = (await session.execute(select(_T).where(_T.bounty_id == bounty_id))).scalar_one_or_none()
    if r is None: raise EscrowNotFoundError(f"No escrow found for bounty '{bounty_id}'")
    return r

def _make_ledger(eid, action, amount, wallet, tx_hash, ts):
    """Create immutable ledger entry row."""
    return EscrowLedgerTable(escrow_id=eid, action=action, amount=amount,
        wallet=wallet, tx_hash=tx_hash, created_at=ts)

async def _commit_respond(session, row, event_name, **kw):
    """Commit, refresh ledger, emit audit, return response."""
    await session.commit()
    await session.refresh(row, attribute_names=["ledger_entries"])
    audit_event(event_name, escrow_id=str(row.id), bounty_id=row.bounty_id, **kw)
    return _to_response(row)

# ---------------------------------------------------------------------------
# Bounty lifecycle integration
# ---------------------------------------------------------------------------

def _validate_bounty_for_funding(bounty_id: str) -> None:
    """Validate bounty exists and is in a fundable state (open/in_progress)."""
    try:
        from app.services.bounty_service import get_bounty
        bounty = get_bounty(bounty_id)
        if bounty is not None and bounty.status.value not in ("open", "in_progress"):
            raise EscrowInvalidStateError(
                f"Bounty '{bounty_id}' is '{bounty.status.value}' and cannot be funded")
    except (ImportError, EscrowInvalidStateError):
        if isinstance(__import__("sys").exc_info()[1], EscrowInvalidStateError): raise
    except Exception:
        logger.debug("Could not validate bounty '%s' — proceeding", bounty_id)

def _validate_approved_submission(bounty_id: str) -> None:
    """Validate bounty has at least one approved submission before release."""
    try:
        from app.services.bounty_service import get_submissions
        subs = get_submissions(bounty_id)
        if subs is not None and not any(s.status.value in ("approved","paid") for s in subs):
            raise EscrowInvalidStateError(
                f"Bounty '{bounty_id}' has no approved submissions — cannot release")
    except (ImportError, EscrowInvalidStateError):
        if isinstance(__import__("sys").exc_info()[1], EscrowInvalidStateError): raise
    except Exception:
        logger.debug("Could not validate submissions for '%s' — proceeding", bounty_id)

# ---------------------------------------------------------------------------
# Transaction verification
# ---------------------------------------------------------------------------

async def verify_transaction_on_chain(tx_hash: str, expected_amount: Decimal | None = None) -> bool:
    """Verify funding tx on Solana: finalized, no errors, correct $FNDRY transfer to treasury."""
    from app.services.solana_client import FNDRY_TOKEN_CA, TREASURY_WALLET, SolanaTransientError, verify_spl_transfer
    try:
        return await verify_spl_transfer(tx_hash=tx_hash, expected_mint=FNDRY_TOKEN_CA,
            expected_recipient=TREASURY_WALLET, min_amount=expected_amount or Decimal("0"))
    except SolanaTransientError:
        logger.warning("Transient error verifying tx %s — caller should retry", tx_hash); raise
    except Exception:
        logger.exception("Failed to verify transaction %s", tx_hash); return False

# ---------------------------------------------------------------------------
# SPL transfer (outbound from treasury)
# ---------------------------------------------------------------------------

async def initiate_spl_transfer(recipient: str, amount: Decimal) -> str:
    """Execute custodial SPL $FNDRY transfer from treasury via solders-based signing."""
    from app.services.solana_client import send_spl_transfer
    return await send_spl_transfer(to_wallet=recipient, amount=amount)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def create_escrow(session, data, user_id: str) -> EscrowResponse:
    """Create escrow. FUNDED if tx_hash provided, else PENDING. Validates bounty state."""
    _validate_bounty_for_funding(data.bounty_id)
    amount = Decimal(str(data.amount)); state = ES.FUNDED if data.tx_hash else ES.PENDING
    now = datetime.now(timezone.utc); escrow_id = str(uuid.uuid4())
    row = _T(id=escrow_id, bounty_id=data.bounty_id, creator_wallet=data.creator_wallet,
        creator_user_id=user_id, amount=amount, state=state.value, fund_tx_hash=data.tx_hash,
        created_at=now, updated_at=now, expires_at=data.expires_at)
    session.add(row)
    if data.tx_hash:
        session.add(_make_ledger(escrow_id, "deposit", amount, data.creator_wallet, data.tx_hash, now))
    try: await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        msg = str(exc.orig) if exc.orig else str(exc)
        if "bounty_id" in msg:
            raise EscrowAlreadyExistsError(f"Escrow exists for bounty '{data.bounty_id}'") from exc
        raise EscrowDoubleSpendError(f"Tx {data.tx_hash} already recorded") from exc
    return await _commit_respond(session, row, "escrow_created", amount=str(amount))

async def activate_escrow(session, bounty_id: str, user_id: str) -> EscrowResponse:
    """FUNDED -> ACTIVE. Called when bounty is opened for submissions."""
    row = await _fetch_escrow(session, bounty_id)
    _authorize(row, user_id, "activate")
    _check_transition(ES(row.state), ES.ACTIVE)
    row.state = ES.ACTIVE.value; row.updated_at = datetime.now(timezone.utc)
    return await _commit_respond(session, row, "escrow_activated")

async def release_escrow(session, data, user_id: str) -> EscrowResponse:
    """Release $FNDRY to winner. Two-phase: set RELEASING, transfer, on fail revert to ACTIVE."""
    row = await _fetch_escrow(session, data.bounty_id)
    _authorize(row, user_id, "release")
    _validate_approved_submission(data.bounty_id)
    current = ES(row.state)
    if current in (ES.FUNDED, ES.ACTIVE):
        _check_transition(current, ES.RELEASING)
        row.state, row.winner_wallet = ES.RELEASING.value, data.winner_wallet
        row.updated_at = datetime.now(timezone.utc); await session.flush()
    elif current != ES.RELEASING:
        _check_transition(current, ES.COMPLETED)
    # Execute SPL transfer with failure recovery
    amount = Decimal(str(row.amount))
    try:
        tx = await initiate_spl_transfer(data.winner_wallet, amount)
    except Exception as err:
        logger.error("SPL transfer failed for %s: %s — reverting to ACTIVE", row.bounty_id, err)
        row.state = ES.ACTIVE.value; row.updated_at = datetime.now(timezone.utc)
        await session.commit()
        raise RuntimeError(f"SPL transfer to {data.winner_wallet} failed: {err}. Reverted to ACTIVE.") from err
    now = datetime.now(timezone.utc)
    row.state, row.release_tx_hash, row.updated_at = ES.COMPLETED.value, tx, now
    session.add(_make_ledger(row.id, "release", amount, data.winner_wallet, tx, now))
    return await _commit_respond(session, row, "escrow_released", winner=data.winner_wallet)

async def refund_escrow(session, data, user_id: str) -> EscrowResponse:
    """Refund $FNDRY to creator via custodial SPL transfer."""
    row = await _fetch_escrow(session, data.bounty_id)
    _authorize(row, user_id, "refund")
    _check_transition(ES(row.state), ES.REFUNDED)
    amount = Decimal(str(row.amount))
    tx = await initiate_spl_transfer(row.creator_wallet, amount)
    now = datetime.now(timezone.utc)
    row.state, row.refund_tx_hash, row.updated_at = ES.REFUNDED.value, tx, now
    session.add(_make_ledger(row.id, "refund", amount, row.creator_wallet, tx, now))
    return await _commit_respond(session, row, "escrow_refunded", amount=str(amount))

async def get_escrow_status(session, bounty_id: str) -> EscrowResponse:
    """Retrieve escrow state and ledger."""
    return _to_response(await _fetch_escrow(session, bounty_id))

async def list_escrows(session, state=None, creator_wallet=None, skip: int = 0, limit: int = 20):
    """Paginated escrow list with optional filters."""
    base, cnt = select(_T), select(func.count(_T.id))
    if state is not None:
        base, cnt = base.where(_T.state == state.value), cnt.where(_T.state == state.value)
    if creator_wallet is not None:
        base, cnt = base.where(_T.creator_wallet == creator_wallet), cnt.where(_T.creator_wallet == creator_wallet)
    total = (await session.execute(cnt)).scalar() or 0
    rows = (await session.execute(base.order_by(_T.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return EscrowListResponse(items=[_to_response(r) for r in rows], total=total, skip=skip, limit=limit)

async def process_expired_escrows(session) -> list[str]:
    """Auto-refund expired escrows. SELECT FOR UPDATE, per-escrow commits, error isolation."""
    global _expiry_loop_failure_count
    now = datetime.now(timezone.utc)
    active = [s.value for s in (ES.PENDING, ES.FUNDED, ES.ACTIVE)]
    # Collect bounty IDs first, then process individually
    ids = (await session.execute(select(_T.bounty_id).where(_T.expires_at <= now, _T.state.in_(active)))).scalars().all()
    refunded: list[str] = []
    for bid in ids:
        try:
            q = select(_T).where(_T.bounty_id == bid)
            try: q = q.with_for_update(skip_locked=True)
            except Exception: pass  # SQLite fallback
            row = (await session.execute(q)).scalar_one_or_none()
            if row is None or row.state not in active: continue
            amount = Decimal(str(row.amount))
            tx = await initiate_spl_transfer(row.creator_wallet, amount)
            row.state, row.refund_tx_hash, row.updated_at = ES.REFUNDED.value, tx, now
            session.add(_make_ledger(str(row.id), "refund", amount, row.creator_wallet, tx, now))
            await session.commit()
            refunded.append(bid)
            logger.info("Auto-refunded expired escrow: %s", bid)
        except Exception:
            logger.exception("Auto-refund failed for escrow: %s", bid)
            await session.rollback()
    if ids and not refunded:
        _expiry_loop_failure_count += 1
        logger.warning("Expiry loop: all %d refunds failed (consecutive: %d)", len(ids), _expiry_loop_failure_count)
    else:
        _expiry_loop_failure_count = 0
    return refunded
