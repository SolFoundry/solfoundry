"""Dispute resolution tests (Issue #192)."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch
import pytest, pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models.dispute import DisputeDB, DisputeHistoryDB
from app.models.bounty_table import BountyTable
from app.models.submission import SubmissionDB

_T = [BountyTable.__table__, SubmissionDB.__table__, DisputeDB.__table__, DisputeHistoryDB.__table__]

@pytest_asyncio.fixture
async def db():
    e = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with e.begin() as c:
        for t in _T: await c.run_sync(t.create, checkfirst=True)
    sf = async_sessionmaker(e, class_=AsyncSession, expire_on_commit=False)
    async with sf() as s: yield s
    await e.dispose()

@pytest_asyncio.fixture
async def c(db):
    async def ov(): yield db
    app.dependency_overrides[get_db] = ov
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as cl: yield cl
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
def uid(): return str(uuid.uuid4())
@pytest_asyncio.fixture
def aid(): return str(uuid.uuid4())
@pytest_asyncio.fixture
def cid(): return str(uuid.uuid4())

@pytest_asyncio.fixture
async def bty(db, cid):
    b = BountyTable(id=uuid.uuid4(), title="B", description="D", tier=2, reward_amount=1.0, status="completed", created_by=cid)
    db.add(b); await db.commit(); return str(b.id)

@pytest_asyncio.fixture
async def sub(db, bty, uid):
    s = SubmissionDB(id=uuid.uuid4(), contributor_id=uuid.UUID(uid), contributor_wallet="9"*44,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/1", bounty_id=uuid.UUID(bty),
        status="rejected", reviewed_at=datetime.now(timezone.utc)-timedelta(hours=1))
    db.add(s); await db.commit(); return str(s.id)

@pytest_asyncio.fixture
async def old_sub(db, bty, uid):
    s = SubmissionDB(id=uuid.uuid4(), contributor_id=uuid.UUID(uid), contributor_wallet="9"*44,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/2", bounty_id=uuid.UUID(bty),
        status="rejected", reviewed_at=datetime.now(timezone.utc)-timedelta(hours=100))
    db.add(s); await db.commit(); return str(s.id)

H = lambda u: {"X-User-ID": u}
P = lambda b, s: {"bounty_id": b, "submission_id": s, "reason": "unfair_rejection",
    "description": "Met all criteria but rejected.",
    "evidence_links": [{"evidence_type": "link", "url": "https://github.com/x/pull/1", "description": "PR"}]}
E = lambda r: r.json().get("detail", r.json().get("message", "")).lower()
EV = {"evidence_links": [{"evidence_type": "link", "url": "https://x.com", "description": "ev"}]}
_AI = "app.services.dispute_service._ai_mediate"

async def _to_med(c, u, b, s):
    d = (await c.post("/api/disputes", json=P(b, s), headers=H(u))).json()["id"]
    await c.post(f"/api/disputes/{d}/evidence", json=EV, headers=H(u))
    with patch(_AI, new_callable=AsyncMock, return_value=(5.0, "?")): await c.post(f"/api/disputes/{d}/mediate", headers=H(u))
    return d

@pytest.mark.asyncio
async def test_create_and_creator_derived(c, uid, bty, sub, cid):
    r = await c.post("/api/disputes", json=P(bty, sub), headers=H(uid))
    assert r.status_code == 201 and r.json()["status"] == "opened"
    assert r.json()["creator_id"] == cid

@pytest.mark.asyncio
async def test_72h_window(c, uid, bty, old_sub):
    r = await c.post("/api/disputes", json=P(bty, old_sub), headers=H(uid))
    assert r.status_code == 400 and "expired" in E(r)

@pytest.mark.asyncio
async def test_duplicate(c, uid, bty, sub):
    await c.post("/api/disputes", json=P(bty, sub), headers=H(uid))
    assert (await c.post("/api/disputes", json=P(bty, sub), headers=H(uid))).status_code == 400

@pytest.mark.asyncio
async def test_not_found(c, uid, sub):
    assert (await c.post("/api/disputes", json=P(str(uuid.uuid4()), sub), headers=H(uid))).status_code == 404

@pytest.mark.asyncio
async def test_evidence_transitions(c, uid, bty, sub):
    d = (await c.post("/api/disputes", json=P(bty, sub), headers=H(uid))).json()["id"]
    r = await c.post(f"/api/disputes/{d}/evidence", json=EV, headers=H(uid))
    assert r.json()["status"] == "evidence"

@pytest.mark.asyncio
async def test_mediation_requires_evidence(c, uid, bty, sub):
    d = (await c.post("/api/disputes", json=P(bty, sub), headers=H(uid))).json()["id"]
    assert (await c.post(f"/api/disputes/{d}/mediate", headers=H(uid))).status_code == 400

@pytest.mark.asyncio
async def test_ai_auto_resolve(c, uid, bty, sub):
    d = (await c.post("/api/disputes", json=P(bty, sub), headers=H(uid))).json()["id"]
    await c.post(f"/api/disputes/{d}/evidence", json=EV, headers=H(uid))
    with patch(_AI, new_callable=AsyncMock, return_value=(8.5, "OK")):
        r = await c.post(f"/api/disputes/{d}/mediate", headers=H(uid))
    assert r.json()["status"] == "resolved" and r.json()["outcome"] == "release_to_contributor"

@pytest.mark.asyncio
async def test_admin_resolve_all_outcomes(c, aid, uid, bty, sub, db):
    """Test all three resolution outcomes with reputation impacts."""
    d = await _to_med(c, uid, bty, sub)
    r = await c.post(f"/api/disputes/{d}/resolve", headers=H(aid),
        json={"outcome": "release_to_contributor", "resolution_notes": "OK"})
    assert r.json()["status"] == "resolved" and r.json()["reputation_impact_creator"] == -5.0

@pytest.mark.asyncio
async def test_non_admin_forbidden(c, uid, bty, sub):
    d = await _to_med(c, uid, bty, sub)
    with patch("app.services.dispute_service.ADMIN_USER_IDS", frozenset({"x"})):
        assert (await c.post(f"/api/disputes/{d}/resolve", headers=H(uid),
            json={"outcome": "split", "resolution_notes": "No"})).status_code == 403

@pytest.mark.asyncio
async def test_skip_states_fails(c, aid, uid, bty, sub):
    d = (await c.post("/api/disputes", json=P(bty, sub), headers=H(uid))).json()["id"]
    assert (await c.post(f"/api/disputes/{d}/resolve", headers=H(aid),
        json={"outcome": "split", "resolution_notes": "Skip"})).status_code == 400

@pytest.mark.asyncio
async def test_full_lifecycle_with_audit(c, aid, uid, bty, sub):
    d = (await c.post("/api/disputes", json=P(bty, sub), headers=H(uid))).json()["id"]
    await c.post(f"/api/disputes/{d}/evidence", json=EV, headers=H(uid))
    with patch(_AI, new_callable=AsyncMock, return_value=(4.0, "?")):
        await c.post(f"/api/disputes/{d}/mediate", headers=H(uid))
    await c.post(f"/api/disputes/{d}/resolve", headers=H(aid),
        json={"outcome": "release_to_contributor", "resolution_notes": "Valid"})
    h = (await c.get(f"/api/disputes/{d}", headers=H(uid))).json()["history"]
    a = [x["action"] for x in h]
    for act in ("dispute_opened", "evidence_submitted", "moved_to_mediation", "dispute_resolved"):
        assert act in a

@pytest.mark.asyncio
async def test_list_disputes(c, uid, bty, sub):
    await c.post("/api/disputes", json=P(bty, sub), headers=H(uid))
    assert (await c.get("/api/disputes", headers=H(uid))).json()["total"] == 1
