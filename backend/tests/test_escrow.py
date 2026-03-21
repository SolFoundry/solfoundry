"""Tests for $FNDRY custodial escrow service.

Covers: state machine (PENDING/FUNDED/ACTIVE/RELEASING/COMPLETED/REFUNDED),
authorization, Decimal precision, on-chain verification, SPL transfers,
bounty integration, race-condition rollback, auto-refund with error isolation.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
import pytest, pytest_asyncio
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.database import Base
from app.exceptions import (EscrowAlreadyExistsError, EscrowAuthorizationError,
    EscrowDoubleSpendError, EscrowInvalidStateError, EscrowNotFoundError)
from app.models.escrow import (EscrowCreateRequest as CR, EscrowRefundRequest as RfR,
    EscrowReleaseRequest as RlR, EscrowAccountTable, EscrowState)
from app.services.escrow_service import (activate_escrow, create_escrow, get_escrow_status,
    initiate_spl_transfer, list_escrows, process_expired_escrows, refund_escrow,
    release_escrow, verify_transaction_on_chain)

pytestmark = pytest.mark.asyncio
W1, W2 = "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF", "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp"
TX1, TX2, TX3 = "4" * 88, "5" * 88, "6" * 88
B, U1, U2, ADMIN = "bounty-42", "user-042", "user-099", "00000000-0000-0000-0000-000000000001"
S_MOCK = "app.services.escrow_service.initiate_spl_transfer"
E = EscrowState
_rl = lambda: RlR(bounty_id=B, winner_wallet=W2)
_rf = lambda: RfR(bounty_id=B)

@pytest_asyncio.fixture
async def db():
    """In-memory SQLite per test."""
    eng = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    @event.listens_for(eng.sync_engine, "connect")
    def fk(conn, _):
        """Enable SQLite foreign keys."""
        conn.execute("PRAGMA foreign_keys=ON")
    async with eng.begin() as c: await c.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)() as s: yield s
    await eng.dispose()

def _req(bid=B, w=W1, a=Decimal("50000"), tx=None, exp=None):
    """Build CR with defaults."""
    kw = {"bounty_id": bid, "creator_wallet": w, "amount": a}
    if tx: kw["tx_hash"] = tx
    if exp: kw["expires_at"] = exp
    return CR(**kw)

# -- Lifecycle: FUNDED -> RELEASING -> COMPLETED ----
@patch(S_MOCK, new_callable=AsyncMock, return_value=TX2)
async def test_fund_release(_, db):
    """FUNDED -> release -> COMPLETED with ledger."""
    r = await create_escrow(db, _req(tx=TX1), U1)
    assert r.state == E.FUNDED and len(r.ledger) == 1 and r.amount == Decimal("50000")
    r = await release_escrow(db, _rl(), U1)
    assert r.state == E.COMPLETED and r.winner_wallet == W2 and len(r.ledger) == 2

# -- FUNDED -> REFUNDED ----
@patch(S_MOCK, new_callable=AsyncMock, return_value=TX3)
async def test_fund_refund(_, db):
    """FUNDED -> REFUNDED with ledger trail."""
    await create_escrow(db, _req(tx=TX1), U1)
    r = await refund_escrow(db, _rf(), U1)
    assert r.state == E.REFUNDED and len(r.ledger) == 2

# -- Initial state depends on tx_hash ----
@pytest.mark.parametrize("tx,expected", [(None, E.PENDING), (TX1, E.FUNDED)])
async def test_initial_state(db, tx, expected):
    """PENDING without tx, FUNDED with tx."""
    assert (await create_escrow(db, _req(tx=tx), U1)).state == expected

# -- FUNDED -> ACTIVE transition ----
@patch(S_MOCK, new_callable=AsyncMock, return_value=TX2)
async def test_funded_to_active(_, db):
    """FUNDED -> ACTIVE -> release -> COMPLETED."""
    await create_escrow(db, _req(tx=TX1), U1)
    assert (await activate_escrow(db, B, U1)).state == E.ACTIVE
    assert (await release_escrow(db, _rl(), U1)).state == E.COMPLETED

async def test_activate_pending_fails(db):
    """PENDING cannot be activated."""
    await create_escrow(db, _req(), U1)
    with pytest.raises(EscrowInvalidStateError): await activate_escrow(db, B, U1)

# -- Duplicate rejection ----
async def test_duplicate_bounty(db):
    """Duplicate bounty escrow rejected."""
    await create_escrow(db, _req(tx=TX1), U1)
    with pytest.raises(EscrowAlreadyExistsError): await create_escrow(db, _req(a=Decimal("1")), U1)

async def test_duplicate_tx(db):
    """Duplicate tx hash rejected (double-spend)."""
    await create_escrow(db, _req(tx=TX1), U1)
    with pytest.raises(EscrowDoubleSpendError): await create_escrow(db, _req(bid="b2", tx=TX1), U1)

# -- Expiry stored ----
async def test_expiry_stored(db):
    """Escrow stores expires_at."""
    exp = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    assert (await create_escrow(db, _req(exp=exp), U1)).expires_at is not None

# -- Release validations ----
@patch(S_MOCK, new_callable=AsyncMock, return_value=TX2)
async def test_funded_can_release(_, db):
    """FUNDED can release directly."""
    await create_escrow(db, _req(tx=TX1), U1)
    assert (await release_escrow(db, _rl(), U1)).state == E.COMPLETED

async def test_pending_cannot_release(db):
    """PENDING cannot release."""
    await create_escrow(db, _req(), U1)
    with pytest.raises(EscrowInvalidStateError): await release_escrow(db, RlR(bounty_id=B, winner_wallet=W2), U1)

# -- Refund validations ----
@pytest.mark.parametrize("tx", [TX1, None])
@patch(S_MOCK, new_callable=AsyncMock, return_value=TX3)
async def test_refund_ok(_, db, tx):
    """FUNDED and PENDING can be refunded."""
    await create_escrow(db, _req(tx=tx), U1)
    assert (await refund_escrow(db, _rf(), U1)).state == E.REFUNDED

@patch(S_MOCK, new_callable=AsyncMock, return_value=TX2)
async def test_refund_completed_fail(_, db):
    """COMPLETED cannot refund."""
    await create_escrow(db, _req(tx=TX1), U1)
    await release_escrow(db, _rl(), U1)
    with pytest.raises(EscrowInvalidStateError): await refund_escrow(db, _rf(), U1)

# -- Not found ----
@pytest.mark.parametrize("fn", [
    lambda db: release_escrow(db, RlR(bounty_id="x", winner_wallet=W2), U1),
    lambda db: refund_escrow(db, RfR(bounty_id="x"), U1),
    lambda db: get_escrow_status(db, "x")])
async def test_not_found(db, fn):
    """Nonexistent bounty raises NotFound."""
    with pytest.raises(EscrowNotFoundError): await fn(db)

# -- Authorization ----
@pytest.mark.parametrize("action", ["release", "refund"])
@patch(S_MOCK, new_callable=AsyncMock, return_value=TX2)
async def test_stranger_blocked(_, db, action):
    """Non-owner blocked."""
    await create_escrow(db, _req(tx=TX1), U1)
    svc, req = (release_escrow, _rl()) if action == "release" else (refund_escrow, _rf())
    with pytest.raises(EscrowAuthorizationError): await svc(db, req, U2)

@pytest.mark.parametrize("action,exp", [("release", E.COMPLETED), ("refund", E.REFUNDED)])
@patch(S_MOCK, new_callable=AsyncMock, return_value=TX2)
async def test_admin_allowed(_, db, action, exp):
    """Admin can release or refund."""
    await create_escrow(db, _req(tx=TX1), U1)
    svc, req = (release_escrow, _rl()) if action == "release" else (refund_escrow, _rf())
    assert (await svc(db, req, ADMIN)).state == exp

# -- Terminal states reject mutations ----
@pytest.mark.parametrize("action", ["release", "refund"])
@patch(S_MOCK, new_callable=AsyncMock, return_value=TX2)
async def test_double_action_blocked(_, db, action):
    """Terminal states reject mutations."""
    await create_escrow(db, _req(tx=TX1), U1)
    svc, mk = (release_escrow, _rl) if action == "release" else (refund_escrow, _rf)
    await svc(db, mk(), U1)
    with pytest.raises(EscrowInvalidStateError): await svc(db, mk(), U1)

# -- List and status ----
async def test_list_and_status(db):
    """Status, list, count, pagination."""
    assert (await list_escrows(db)).total == 0
    await create_escrow(db, _req(), U1)
    assert (await get_escrow_status(db, B)).bounty_id == B
    for i in range(4): await create_escrow(db, _req(bid=f"b{i}"), U1)
    assert (await list_escrows(db)).total == 5
    r = await list_escrows(db, skip=0, limit=2)
    assert len(r.items) == 2 and r.total == 5

@pytest.mark.parametrize("filt,kw,exp", [
    ("state", {"state": E.PENDING}, 1), ("wallet", {"creator_wallet": W1}, 1)])
async def test_list_filters(db, filt, kw, exp):
    """State and wallet filters."""
    await create_escrow(db, _req(bid="b1"), U1)
    await create_escrow(db, _req(bid="b2", tx=TX1, w=W2 if filt == "wallet" else W1), U2 if filt == "wallet" else U1)
    assert (await list_escrows(db, **kw)).total == exp

# -- Auto-refund expired escrows ----
@pytest.mark.parametrize("delta,refunded", [(-1, True), (168, False)])
@patch(S_MOCK, new_callable=AsyncMock, return_value=TX3)
async def test_expiry_autorefund(_, db, delta, refunded):
    """Auto-refund expired; skip future."""
    await create_escrow(db, _req(), U1)
    row = (await db.execute(select(EscrowAccountTable).where(EscrowAccountTable.bounty_id == B))).scalar_one()
    row.expires_at = datetime.now(timezone.utc) + timedelta(hours=delta)
    await db.commit()
    assert (B in await process_expired_escrows(db)) == refunded

# -- Transfer failure rollback (RELEASING -> ACTIVE) ----
async def test_release_failure_reverts(db):
    """SPL transfer failure during release reverts to ACTIVE."""
    await create_escrow(db, _req(tx=TX1), U1)
    assert (await activate_escrow(db, B, U1)).state == E.ACTIVE
    with patch(S_MOCK, new_callable=AsyncMock, side_effect=RuntimeError("Insufficient SOL")):
        with pytest.raises(RuntimeError, match="Insufficient SOL"):
            await release_escrow(db, _rl(), U1)
    assert (await get_escrow_status(db, B)).state == E.ACTIVE

# -- Transaction verification ----
@pytest.mark.parametrize("result,expected", [
    ({"meta": {"err": None, "innerInstructions": [], "postTokenBalances": [
        {"accountIndex": 1, "owner": "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp"}]},
      "transaction": {"message": {"accountKeys": [W1, "TokenAcct" + "1" * 34],
        "instructions": [{"parsed": {"type": "transferChecked", "info": {
            "mint": "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS",
            "destination": "TokenAcct" + "1" * 34,
            "tokenAmount": {"uiAmountString": "50000"}}}}]}}}, True),
    ({"meta": {"err": {"E": 1}}, "transaction": {"message": {"accountKeys": [], "instructions": []}}}, False),
    (None, False)])
async def test_tx_verify(result, expected):
    """On-chain verification checks finalization, errors, SPL transfer match."""
    m = MagicMock(); m.json.return_value = {"result": result}; m.raise_for_status = MagicMock(); m.status_code = 200
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=m):
        assert await verify_transaction_on_chain(TX1) is expected

# -- SPL transfer delegates to send_spl_transfer ----
async def test_spl_transfer():
    """initiate_spl_transfer delegates to solana_client.send_spl_transfer."""
    with patch("app.services.solana_client.send_spl_transfer", new_callable=AsyncMock, return_value="SigTx") as mock:
        assert await initiate_spl_transfer(W2, Decimal("1000")) == "SigTx"
        mock.assert_called_once_with(to_wallet=W2, amount=Decimal("1000"))

# -- Decimal precision ----
async def test_decimal_precision(db):
    """Escrow amounts preserve Decimal precision through DB round-trip."""
    amt = Decimal("123456789.123456789")
    assert (await create_escrow(db, _req(a=amt), U1)).amount == amt

# -- Validation: past expiry rejected ----
def test_past_expiry_rejected():
    """EscrowCreateRequest rejects past timestamps for expires_at."""
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    with pytest.raises(ValueError, match="future"): _req(exp=past)

# -- Validation: amount upper bound ----
def test_amount_upper_bound_rejected():
    """EscrowCreateRequest rejects amounts exceeding maximum."""
    with pytest.raises(ValueError, match="exceeds maximum"): _req(a=Decimal("999999999999"))

# -- RELEASING -> ACTIVE in VALID_TRANSITIONS ----
def test_releasing_can_revert():
    """State machine allows RELEASING -> ACTIVE for failure recovery."""
    from app.models.escrow import VALID_TRANSITIONS
    assert "ACTIVE" in VALID_TRANSITIONS["RELEASING"]

# -- Auto-refund error isolation ----
@patch(S_MOCK, new_callable=AsyncMock)
async def test_autorefund_error_isolation(mock_transfer, db):
    """One auto-refund failure does not block others."""
    await create_escrow(db, _req(bid="exp-1"), U1)
    await create_escrow(db, _req(bid="exp-2"), U1)
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    for bid in ("exp-1", "exp-2"):
        row = (await db.execute(select(EscrowAccountTable).where(EscrowAccountTable.bounty_id == bid))).scalar_one()
        row.expires_at = past
    await db.commit()
    mock_transfer.side_effect = [RuntimeError("Net error"), TX3]
    refunded = await process_expired_escrows(db)
    assert "exp-1" not in refunded and "exp-2" in refunded
