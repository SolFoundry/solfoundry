"""Tests for $FNDRY custodial escrow: lifecycle, double-spend, state machine, validation."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.escrow_service import reset_stores

c = TestClient(app)
W1, W2 = "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF", "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp"
TX1, TX2, TX3, TX4 = chr(52)*88, chr(53)*88, chr(54)*88, chr(55)*88
B, H = "bounty-42", {"X-User-ID": "00000000-0000-0000-0000-000000000042"}
MV = "app.api.escrow.verify_transaction_confirmed"
F = lambda **kw: {"bounty_id":kw.get("b",B),"creator_wallet":kw.get("w",W1),"amount":kw.get("a",50000.0),**({} if not kw.get("t") else {"tx_hash":kw["t"]}),**({} if not kw.get("e") else {"expires_at":kw["e"]})}

@pytest.fixture(autouse=True)
def _r(): reset_stores(); yield; reset_stores()

def _f(**kw): return c.post("/api/escrow/fund", json=F(**kw), headers=H)

class TestLifecycle:
    """Full lifecycle: fund->release, fund->refund."""
    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_fund_release(self, _):
        """FUNDED->COMPLETED with ledger."""
        r = _f(t=TX1); assert r.status_code==201; d=r.json()
        assert d["state"]=="FUNDED" and len(d["ledger"])==1 and d["ledger"][0]["action"]=="deposit"
        r = c.post("/api/escrow/release", headers=H, json={"bounty_id":B,"winner_wallet":W2,"tx_hash":TX2})
        assert r.status_code==200; d=r.json()
        assert d["state"]=="COMPLETED" and d["winner_wallet"]==W2 and len(d["ledger"])==2

    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_fund_refund(self, _):
        """FUNDED->REFUNDED with ledger."""
        _f(t=TX1)
        r = c.post("/api/escrow/refund", headers=H, json={"bounty_id":B,"tx_hash":TX3})
        assert r.status_code==200 and r.json()["state"]=="REFUNDED" and len(r.json()["ledger"])==2

class TestFund:
    """POST /api/escrow/fund."""
    def test_pending(self):
        """No tx -> PENDING."""
        r = _f(); assert r.status_code==201 and r.json()["state"]=="PENDING"

    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_funded(self, _):
        """With confirmed tx -> FUNDED."""
        r = _f(t=TX1); assert r.status_code==201 and r.json()["state"]=="FUNDED"

    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_dup_bounty(self, _):
        """Duplicate bounty_id -> 409."""
        _f(t=TX1); assert _f(a=1.0).status_code==409

    @patch(MV, new_callable=AsyncMock, return_value=False)
    def test_unconfirmed(self, _):
        """Unconfirmed tx -> 400."""
        assert _f(t=TX1).status_code==400

    def test_expiration(self):
        """Escrow with expires_at."""
        r = _f(e=(datetime.now(timezone.utc)+timedelta(days=7)).isoformat())
        assert r.status_code==201 and r.json()["expires_at"] is not None

class TestRelease:
    """POST /api/escrow/release."""
    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_ok(self, _):
        _f(t=TX1); assert c.post("/api/escrow/release", headers=H, json={"bounty_id":B,"winner_wallet":W2,"tx_hash":TX2}).status_code==200

    def test_pending_409(self):
        _f(); assert c.post("/api/escrow/release", headers=H, json={"bounty_id":B,"winner_wallet":W2}).status_code==409

    def test_404(self):
        assert c.post("/api/escrow/release", headers=H, json={"bounty_id":"x","winner_wallet":W2}).status_code==404

class TestRefund:
    """POST /api/escrow/refund."""
    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_funded(self, _):
        _f(t=TX1); assert c.post("/api/escrow/refund", headers=H, json={"bounty_id":B,"tx_hash":TX3}).status_code==200

    def test_pending(self):
        _f(); assert c.post("/api/escrow/refund", headers=H, json={"bounty_id":B}).json()["state"]=="REFUNDED"

    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_completed_409(self, _):
        _f(t=TX1); c.post("/api/escrow/release", headers=H, json={"bounty_id":B,"winner_wallet":W2,"tx_hash":TX2})
        assert c.post("/api/escrow/refund", headers=H, json={"bounty_id":B}).status_code==409

    def test_404(self):
        assert c.post("/api/escrow/refund", headers=H, json={"bounty_id":"x"}).status_code==404

class TestDoubleSpend:
    """Double-spend protection via tx_hash dedup."""
    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_dup_fund(self, _):
        _f(b="b1",t=TX1); r = _f(b="b2",t=TX1)
        assert r.status_code==409 and "double-spend" in r.json().get("detail",r.json().get("message","")).lower()

    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_dup_release(self, _):
        _f(t=TX1); assert c.post("/api/escrow/release", headers=H, json={"bounty_id":B,"winner_wallet":W2,"tx_hash":TX1}).status_code==409

class TestStateMachine:
    """Invalid state transitions rejected."""
    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_double_release(self, _):
        _f(t=TX1); c.post("/api/escrow/release", headers=H, json={"bounty_id":B,"winner_wallet":W2,"tx_hash":TX2})
        assert c.post("/api/escrow/release", headers=H, json={"bounty_id":B,"winner_wallet":W2,"tx_hash":TX4}).status_code==409

    @patch(MV, new_callable=AsyncMock, return_value=True)
    def test_double_refund(self, _):
        _f(t=TX1); c.post("/api/escrow/refund", headers=H, json={"bounty_id":B,"tx_hash":TX3})
        assert c.post("/api/escrow/refund", headers=H, json={"bounty_id":B,"tx_hash":TX4}).status_code==409

class TestListing:
    """GET /api/escrow and GET /api/escrow/{id}."""
    def test_status(self): _f(); assert c.get(f"/api/escrow/{B}").status_code==200
    def test_404(self): assert c.get("/api/escrow/nope").status_code==404
    def test_empty(self): assert c.get("/api/escrow").json()["total"]==0
    def test_items(self):
        for i in range(3): _f(b=f"b{i}")
        assert c.get("/api/escrow").json()["total"]==3
    def test_filter_state(self):
        _f(b="b1"); _f(b="b2",t=TX1)
        assert c.get("/api/escrow?state=PENDING").json()["total"]==1
    def test_filter_wallet(self):
        _f(b="b1",w=W1); _f(b="b2",w=W2)
        assert c.get(f"/api/escrow?creator_wallet={W1}").json()["total"]==1
    def test_pagination(self):
        for i in range(5): _f(b=f"b{i}")
        p = c.get("/api/escrow?skip=0&limit=2").json()
        assert len(p["items"])==2 and p["total"]==5

class TestValidation:
    """Input validation."""
    def test_missing(self):
        assert c.post("/api/escrow/fund", headers=H, json={"creator_wallet":W1,"amount":1.0}).status_code==422
        assert c.post("/api/escrow/fund", headers=H, json={"bounty_id":B,"amount":1.0}).status_code==422
    def test_amounts(self):
        assert _f(a=0).status_code==422 and _f(a=-1).status_code==422
    def test_wallets(self):
        assert c.post("/api/escrow/fund", headers=H, json={"bounty_id":B,"creator_wallet":"0x","amount":1.0}).status_code==422
    def test_bounds(self):
        assert c.get("/api/escrow?limit=101").status_code==422 and c.get("/api/escrow?skip=-1").status_code==422
    def test_auth(self):
        assert c.post("/api/escrow/fund", json=F()).status_code==401
        assert c.post("/api/escrow/release", json={"bounty_id":B,"winner_wallet":W2}).status_code==401
        assert c.post("/api/escrow/refund", json={"bounty_id":B}).status_code==401

class TestExpiration:
    """Auto-refund expired escrows."""
    @pytest.mark.asyncio
    async def test_expired(self):
        from app.services.escrow_service import process_expired_escrows
        _f(e=(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat())
        assert B in await process_expired_escrows()
        assert c.get(f"/api/escrow/{B}").json()["state"]=="REFUNDED"

class TestTxVerify:
    """Solana RPC tx verification."""
    @pytest.mark.asyncio
    async def test_verify(self):
        from app.services.escrow_service import verify_transaction_confirmed
        def _mr(d): r=MagicMock(); r.json.return_value=d; r.raise_for_status=MagicMock(); return r
        for d, exp in [
            ({"jsonrpc":"2.0","id":1,"result":{"meta":{"err":None}}}, True),
            ({"jsonrpc":"2.0","id":1,"result":{"meta":{"err":{"E":1}}}}, False),
            ({"jsonrpc":"2.0","id":1,"result":None}, False),
        ]:
            with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as m:
                m.return_value = _mr(d); assert await verify_transaction_confirmed(TX1) is exp
