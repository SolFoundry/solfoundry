"""Tests for $FNDRY custodial escrow service."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest, pytest_asyncio
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.database import Base
from app.exceptions import (EscrowAlreadyExistsError, EscrowAuthorizationError,
    EscrowInvalidStateError, EscrowNotFoundError)
from app.models.escrow import (EscrowCreateRequest as CR, EscrowRefundRequest as RfR,
    EscrowReleaseRequest as RlR, EscrowState)
from app.services.escrow_service import (create_escrow, get_escrow_status, initiate_spl_transfer,
    list_escrows, process_expired_escrows, refund_escrow, release_escrow, verify_transaction_confirmed)
pytestmark = pytest.mark.asyncio
W1, W2 = "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF", "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp"
TX1, TX2, TX3 = "4" * 88, "5" * 88, "6" * 88
B, U1, U2, ADMIN = "bounty-42", "user-042", "user-099", "00000000-0000-0000-0000-000000000001"
S, E = "app.services.escrow_service.initiate_spl_transfer", EscrowState
_rl = lambda: RlR(bounty_id=B, winner_wallet=W2)
_rf = lambda: RfR(bounty_id=B)
@pytest_asyncio.fixture
async def db():
    """In-memory SQLite per test."""
    eng = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    @event.listens_for(eng.sync_engine, "connect")
    def enable_fk(conn, _):
        """Enable SQLite foreign keys."""
        conn.execute("PRAGMA foreign_keys=ON")
    async with eng.begin() as c: await c.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)() as s: yield s
    await eng.dispose()
def _req(bid=B, w=W1, a=50000.0, tx=None, exp=None):
    """Build CR with defaults."""
    kw = {"bounty_id": bid, "creator_wallet": w, "amount": a}
    if tx: kw["tx_hash"] = tx
    if exp: kw["expires_at"] = exp
    return CR(**kw)
@patch(S, new_callable=AsyncMock, return_value=TX2)
async def test_fund_release(_, db):
    """FUNDED -> RELEASING -> COMPLETED."""
    r = await create_escrow(db, _req(tx=TX1), U1)
    assert r.state == E.FUNDED and len(r.ledger) == 1
    r = await release_escrow(db, _rl(), U1)
    assert r.state == E.COMPLETED and r.winner_wallet == W2 and len(r.ledger) == 2
@patch(S, new_callable=AsyncMock, return_value=TX3)
async def test_fund_refund(_, db):
    """FUNDED -> REFUNDED."""
    await create_escrow(db, _req(tx=TX1), U1)
    r = await refund_escrow(db, _rf(), U1)
    assert r.state == E.REFUNDED and len(r.ledger) == 2
@pytest.mark.parametrize("tx,expected", [(None, E.PENDING), (TX1, E.FUNDED)])
async def test_fund_states(db, tx, expected):
    """PENDING without tx, FUNDED with tx."""
    assert (await create_escrow(db, _req(tx=tx), U1)).state == expected
async def test_duplicates_rejected(db):
    """Duplicate bounty and tx rejected."""
    await create_escrow(db, _req(tx=TX1), U1)
    with pytest.raises(EscrowAlreadyExistsError): await create_escrow(db, _req(a=1.0), U1)
    await create_escrow(db, _req(bid="b2", tx=TX2), U1)
    with pytest.raises(Exception): await create_escrow(db, _req(bid="b3", tx=TX2), U1)
async def test_expiry_stored(db):
    """Escrow stores expires_at."""
    exp = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    assert (await create_escrow(db, _req(exp=exp), U1)).expires_at is not None
@patch(S, new_callable=AsyncMock, return_value=TX2)
async def test_release(_, db):
    """FUNDED releases; PENDING fails."""
    await create_escrow(db, _req(tx=TX1), U1)
    assert (await release_escrow(db, _rl(), U1)).state == E.COMPLETED
    await create_escrow(db, _req(bid="p"), U1)
    with pytest.raises(EscrowInvalidStateError): await release_escrow(db, RlR(bounty_id="p", winner_wallet=W2), U1)
@pytest.mark.parametrize("tx", [TX1, None])
@patch(S, new_callable=AsyncMock, return_value=TX3)
async def test_refund_ok(_, db, tx):
    """FUNDED and PENDING can be refunded."""
    await create_escrow(db, _req(tx=tx), U1)
    assert (await refund_escrow(db, _rf(), U1)).state == E.REFUNDED
@patch(S, new_callable=AsyncMock, return_value=TX2)
async def test_refund_completed_fail(_, db):
    """COMPLETED cannot refund."""
    await create_escrow(db, _req(tx=TX1), U1)
    await release_escrow(db, _rl(), U1)
    with pytest.raises(EscrowInvalidStateError): await refund_escrow(db, _rf(), U1)
@pytest.mark.parametrize("fn", [
    lambda db: release_escrow(db, RlR(bounty_id="x", winner_wallet=W2), U1),
    lambda db: refund_escrow(db, RfR(bounty_id="x"), U1),
    lambda db: get_escrow_status(db, "x")])
async def test_not_found(db, fn):
    """Nonexistent bounty raises NotFound."""
    with pytest.raises(EscrowNotFoundError): await fn(db)
@pytest.mark.parametrize("action", ["release", "refund"])
@patch(S, new_callable=AsyncMock, return_value=TX2)
async def test_stranger_blocked(_, db, action):
    """Non-owner blocked."""
    await create_escrow(db, _req(tx=TX1), U1)
    svc, req = (release_escrow, _rl()) if action == "release" else (refund_escrow, _rf())
    with pytest.raises(EscrowAuthorizationError): await svc(db, req, U2)
@pytest.mark.parametrize("action,exp", [("release", E.COMPLETED), ("refund", E.REFUNDED)])
@patch(S, new_callable=AsyncMock, return_value=TX2)
async def test_admin_allowed(_, db, action, exp):
    """Admin can release or refund."""
    await create_escrow(db, _req(tx=TX1), U1)
    svc, req = (release_escrow, _rl()) if action == "release" else (refund_escrow, _rf())
    assert (await svc(db, req, ADMIN)).state == exp
@pytest.mark.parametrize("action", ["release", "refund"])
@patch(S, new_callable=AsyncMock, return_value=TX2)
async def test_double_action_blocked(_, db, action):
    """Terminal states reject mutations."""
    await create_escrow(db, _req(tx=TX1), U1)
    svc, mk = (release_escrow, _rl) if action == "release" else (refund_escrow, _rf)
    await svc(db, mk(), U1)
    with pytest.raises(EscrowInvalidStateError): await svc(db, mk(), U1)
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
@pytest.mark.parametrize("delta,refunded", [(-1, True), (168, False)])
@patch(S, new_callable=AsyncMock, return_value=TX3)
async def test_expiry_autorefund(_, db, delta, refunded):
    """Auto-refund expired; skip future."""
    exp = (datetime.now(timezone.utc) + timedelta(hours=delta)).isoformat()
    await create_escrow(db, _req(exp=exp), U1)
    assert (B in await process_expired_escrows(db)) == refunded
@pytest.mark.parametrize("result,expected", [
    ({"meta": {"err": None}}, True), ({"meta": {"err": {"E": 1}}}, False), (None, False)])
async def test_tx_verify(result, expected):
    """Tx verification."""
    m = MagicMock(); m.json.return_value = {"result": result}; m.raise_for_status = MagicMock()
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=m):
        assert await verify_transaction_confirmed(TX1) is expected
async def test_spl_transfer():
    """SPL transfer test."""
    P = "app.services.escrow_service"
    acct = lambda pk: {"result": {"value": [{"pubkey": pk, "account": {"data": {
        "parsed": {"info": {"tokenAmount": {"decimals": 9}}}}}}]}}
    calls = []
    async def rpc(method, params=None):
        """Mock RPC."""
        calls.append(method)
        return acct("T" * 44 if len(calls) == 1 else "R" * 44) if method == "getTokenAccountsByOwner" else {"result": "Tx"}
    with patch(f"{P}._rpc_call", side_effect=rpc), patch(f"{P}.TREASURY_WALLET", "T" * 44), patch(f"{P}.FNDRY_TOKEN_CA", "F" * 44):
        assert await initiate_spl_transfer(W2, 1000.0) == "Tx"
