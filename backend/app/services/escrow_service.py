"""Custodial $FNDRY escrow service with PostgreSQL persistence and SPL transfers."""
import logging
from datetime import datetime, timezone
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
def _check(current: EscrowState, target: EscrowState) -> None:
    """Enforce state machine transitions."""
    if target.value not in VALID_TRANSITIONS.get(current.value, frozenset()):
        raise EscrowInvalidStateError(f"Cannot transition {current.value} -> {target.value}")
def _auth(row, user_id: str, action: str) -> None:
    """Verify caller owns escrow or is platform admin."""
    if user_id not in (row.creator_user_id, INTERNAL_SYSTEM_USER_ID):
        raise EscrowAuthorizationError(f"User {user_id} not authorized to {action} bounty '{row.bounty_id}'")
def _resp(row) -> EscrowResponse:
    """Convert DB row to API response."""
    return EscrowResponse(id=str(row.id), bounty_id=row.bounty_id, creator_wallet=row.creator_wallet,
        winner_wallet=row.winner_wallet, amount=row.amount, state=ES(row.state),
        fund_tx_hash=row.fund_tx_hash, release_tx_hash=row.release_tx_hash,
        refund_tx_hash=row.refund_tx_hash, created_at=row.created_at, updated_at=row.updated_at,
        expires_at=row.expires_at, ledger=[LedgerEntry.model_validate(e) for e in (row.ledger_entries or [])])
async def _row(session: AsyncSession, bounty_id: str):
    """Fetch escrow by bounty ID or raise NotFound."""
    r = (await session.execute(select(_T).where(_T.bounty_id == bounty_id))).scalar_one_or_none()
    if r is None: raise EscrowNotFoundError(f"No escrow for bounty '{bounty_id}'")
    return r
async def _accts(wallet, rpc, mint):
    """Resolve SPL token accounts for a wallet."""
    d = await rpc("getTokenAccountsByOwner", [wallet, {"mint": mint}, {"encoding": "jsonParsed"}])
    return d.get("result", {}).get("value", [])
async def initiate_spl_transfer(recipient: str, amount: float) -> str:
    """Custodial SPL $FNDRY transfer from treasury via Solana RPC."""
    from app.services.solana_client import FNDRY_TOKEN_CA, TREASURY_WALLET, _rpc_call
    src = await _accts(TREASURY_WALLET, _rpc_call, FNDRY_TOKEN_CA)
    if not src: raise RuntimeError("Treasury has no $FNDRY token account")
    dst = await _accts(recipient, _rpc_call, FNDRY_TOKEN_CA)
    if not dst: raise RuntimeError(f"Recipient {recipient} has no $FNDRY token account")
    info = src[0].get("account", {}).get("data", {}).get("parsed", {}).get("info", {})
    dec = int(info.get("tokenAmount", {}).get("decimals", 9))
    r = await _rpc_call("sendTransaction", [{"from": src[0]["pubkey"], "to": dst[0]["pubkey"],
        "amount": int(amount * 10 ** dec), "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"}])
    return r.get("result", "")
async def verify_transaction_confirmed(tx_hash: str) -> bool:
    """Check Solana RPC that a transaction is confirmed."""
    import httpx
    from app.services.solana_client import SOLANA_RPC_URL, RPC_TIMEOUT
    try:
        async with httpx.AsyncClient(timeout=RPC_TIMEOUT) as c:
            resp = await c.post(SOLANA_RPC_URL, json={"jsonrpc": "2.0", "id": 1,
                "method": "getTransaction", "params": [tx_hash, {"encoding": "jsonParsed",
                "maxSupportedTransactionVersion": 0}]})
            resp.raise_for_status()
        result = resp.json().get("result")
        return result is not None and result.get("meta", {}).get("err") is None
    except Exception:
        logger.exception("Failed to verify tx %s", tx_hash)
        return False
def _ledger(eid, action, amount, wallet, tx_hash, now):
    """Create ledger entry row."""
    return EscrowLedgerTable(escrow_id=eid, action=action, amount=amount,
        wallet=wallet, tx_hash=tx_hash, created_at=now)
async def _save(session, row, event_name, **kw):
    """Commit, refresh ledger, emit audit, return response."""
    await session.commit()
    await session.refresh(row, attribute_names=["ledger_entries"])
    audit_event(event_name, escrow_id=str(row.id), bounty_id=row.bounty_id, **kw)
    return _resp(row)
async def create_escrow(session, data, user_id: str) -> EscrowResponse:
    """Create escrow account. FUNDED if tx_hash provided, else PENDING."""
    state = ES.FUNDED if data.tx_hash else ES.PENDING
    now = datetime.now(timezone.utc)
    row = _T(bounty_id=data.bounty_id, creator_wallet=data.creator_wallet,
        creator_user_id=user_id, amount=data.amount, state=state.value,
        fund_tx_hash=data.tx_hash, created_at=now, updated_at=now, expires_at=data.expires_at)
    session.add(row)
    if data.tx_hash:
        session.add(_ledger(row.id, "deposit", data.amount, data.creator_wallet, data.tx_hash, now))
    try: await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        msg = str(exc.orig) if exc.orig else str(exc)
        if "bounty_id" in msg:
            raise EscrowAlreadyExistsError(f"Escrow exists for bounty '{data.bounty_id}'") from exc
        raise EscrowDoubleSpendError(f"Tx {data.tx_hash} already recorded") from exc
    return await _save(session, row, "escrow_created", amount=data.amount)
async def release_escrow(session, data, user_id: str) -> EscrowResponse:
    """Release $FNDRY to winner: FUNDED/ACTIVE -> RELEASING -> COMPLETED."""
    row = await _row(session, data.bounty_id)
    _auth(row, user_id, "release")
    if ES(row.state) in (ES.FUNDED, ES.ACTIVE):
        _check(ES(row.state), ES.RELEASING)
        row.state, row.winner_wallet = ES.RELEASING.value, data.winner_wallet
        row.updated_at = datetime.now(timezone.utc)
        await session.flush()
    _check(ES(row.state), ES.COMPLETED)
    tx = await initiate_spl_transfer(data.winner_wallet, row.amount)
    now = datetime.now(timezone.utc)
    row.state, row.release_tx_hash, row.updated_at = ES.COMPLETED.value, tx, now
    session.add(_ledger(row.id, "release", row.amount, data.winner_wallet, tx, now))
    return await _save(session, row, "escrow_released", winner=data.winner_wallet)
async def refund_escrow(session, data, user_id: str) -> EscrowResponse:
    """Refund $FNDRY to creator via custodial SPL transfer."""
    row = await _row(session, data.bounty_id)
    _auth(row, user_id, "refund")
    _check(ES(row.state), ES.REFUNDED)
    tx = await initiate_spl_transfer(row.creator_wallet, row.amount)
    now = datetime.now(timezone.utc)
    row.state, row.refund_tx_hash, row.updated_at = ES.REFUNDED.value, tx, now
    session.add(_ledger(row.id, "refund", row.amount, row.creator_wallet, tx, now))
    return await _save(session, row, "escrow_refunded", amount=row.amount)
async def get_escrow_status(session, bounty_id: str) -> EscrowResponse:
    """Retrieve escrow state and ledger."""
    return _resp(await _row(session, bounty_id))
async def list_escrows(session, state=None, creator_wallet=None, skip: int = 0, limit: int = 20):
    """Paginated escrow list with optional filters."""
    base, cnt = select(_T), select(func.count(_T.id))
    for col, val in [(_T.state, state.value if state else None), (_T.creator_wallet, creator_wallet)]:
        if val is not None: base, cnt = base.where(col == val), cnt.where(col == val)
    total = (await session.execute(cnt)).scalar() or 0
    rows = (await session.execute(base.order_by(_T.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return EscrowListResponse(items=[_resp(r) for r in rows], total=total, skip=skip, limit=limit)
async def process_expired_escrows(session) -> list[str]:
    """Auto-refund expired escrows via custodial SPL transfer."""
    now = datetime.now(timezone.utc)
    active = [s.value for s in (ES.PENDING, ES.FUNDED, ES.ACTIVE)]
    expired = (await session.execute(select(_T).where(_T.expires_at <= now, _T.state.in_(active)))).scalars().all()
    refunded: list[str] = []
    for row in expired:
        try:
            tx = await initiate_spl_transfer(row.creator_wallet, row.amount)
            row.state, row.refund_tx_hash, row.updated_at = ES.REFUNDED.value, tx, now
            session.add(_ledger(row.id, "refund", row.amount, row.creator_wallet, tx, now))
            refunded.append(row.bounty_id)
        except Exception:
            logger.exception("Auto-refund failed: %s", row.bounty_id)
    if refunded: await session.commit()
    return refunded
