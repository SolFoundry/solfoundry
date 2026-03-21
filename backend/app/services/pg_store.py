"""PostgreSQL write-through persistence (Issue #162). Errors non-fatal."""
import json, logging
from sqlalchemy import text
from app.database import get_db_session
log = logging.getLogger(__name__)

async def _ex(sql, p):
    try:
        async with get_db_session() as s:
            await s.execute(text(sql), p); await s.commit()
    except Exception: pass

async def insert_payout(r):
    await _ex("INSERT INTO payouts (id,recipient,recipient_wallet,amount,token,"
        "bounty_id,bounty_title,tx_hash,status,solscan_url) VALUES "
        "(:id,:r,:w,:a,:t,:bid,:bt,:tx,:s,:su) ON CONFLICT (id) DO NOTHING",
        {"id":r.id,"r":r.recipient,"w":r.recipient_wallet,"a":r.amount,
         "t":r.token,"bid":r.bounty_id,"bt":r.bounty_title,"tx":r.tx_hash,
         "s":r.status.value,"su":r.solscan_url})

async def insert_buyback(r):
    await _ex("INSERT INTO buybacks (id,amount_sol,amount_fndry,price_per_fndry,"
        "tx_hash,solscan_url) VALUES (:id,:sol,:f,:p,:tx,:su) "
        "ON CONFLICT (id) DO NOTHING",
        {"id":r.id,"sol":r.amount_sol,"f":r.amount_fndry,
         "p":r.price_per_fndry,"tx":r.tx_hash,"su":r.solscan_url})

async def insert_reputation_entry(e):
    await _ex("INSERT INTO reputation_history (id,contributor_id,bounty_id,"
        "bounty_title,bounty_tier,review_score,earned_reputation,"
        "anti_farming_applied) VALUES (:id,:cid,:bid,:t,:tier,:s,:r,:a) "
        "ON CONFLICT (contributor_id,bounty_id) DO NOTHING",
        {"id":e.entry_id,"cid":e.contributor_id,"bid":e.bounty_id,
         "t":e.bounty_title,"tier":e.bounty_tier,"s":e.review_score,
         "r":e.earned_reputation,"a":e.anti_farming_applied})

async def persist_bounty(b):
    tier = b.tier.value if hasattr(b.tier,"value") else b.tier
    st = b.status.value if hasattr(b.status,"value") else b.status
    sc = len(b.submissions) if hasattr(b,"submissions") else 0
    await _ex("INSERT INTO bounties (id,title,description,tier,reward_amount,"
        "status,skills,github_issue_url,created_by,submission_count,"
        "popularity,created_at,updated_at,deadline) VALUES "
        "(:id::uuid,:t,:d,:tier,:rw,:st,:sk::jsonb,:gu,:cb,:sc,0,:ca,:ua,:dl) "
        "ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,"
        "description=EXCLUDED.description,status=EXCLUDED.status,"
        "reward_amount=EXCLUDED.reward_amount,skills=EXCLUDED.skills,"
        "submission_count=EXCLUDED.submission_count,updated_at=EXCLUDED.updated_at",
        {"id":b.id,"t":b.title,"d":b.description,"tier":tier,
         "rw":b.reward_amount,"st":st,"sk":json.dumps(b.required_skills),
         "gu":b.github_issue_url,"cb":b.created_by,"sc":sc,
         "ca":b.created_at,"ua":b.updated_at,"dl":b.deadline})

async def delete_bounty(bid):
    await _ex("DELETE FROM bounties WHERE id=:id::uuid",{"id":bid})

async def load_payouts():
    from app.models.payout import PayoutRecord, PayoutStatus
    out = {}
    try:
        async with get_db_session() as s:
            for r in await s.execute(text("SELECT * FROM payouts")):
                out[str(r.id)] = PayoutRecord(id=str(r.id),recipient=r.recipient,
                    recipient_wallet=r.recipient_wallet,amount=r.amount,token=r.token,
                    bounty_id=r.bounty_id,bounty_title=r.bounty_title,tx_hash=r.tx_hash,
                    status=PayoutStatus(r.status),solscan_url=r.solscan_url,
                    created_at=r.created_at)
    except Exception: pass
    return out

async def load_buybacks():
    from app.models.payout import BuybackRecord
    out = {}
    try:
        async with get_db_session() as s:
            for r in await s.execute(text("SELECT * FROM buybacks")):
                out[str(r.id)] = BuybackRecord(id=str(r.id),amount_sol=r.amount_sol,
                    amount_fndry=r.amount_fndry,price_per_fndry=r.price_per_fndry,
                    tx_hash=r.tx_hash,solscan_url=r.solscan_url,created_at=r.created_at)
    except Exception: pass
    return out

async def load_reputation():
    from app.models.reputation import ReputationHistoryEntry
    out = {}
    try:
        async with get_db_session() as s:
            for r in await s.execute(text(
                "SELECT * FROM reputation_history ORDER BY created_at")):
                out.setdefault(r.contributor_id,[]).append(ReputationHistoryEntry(
                    entry_id=str(r.id),contributor_id=r.contributor_id,
                    bounty_id=r.bounty_id,bounty_title=r.bounty_title,
                    bounty_tier=r.bounty_tier,review_score=r.review_score,
                    earned_reputation=r.earned_reputation,
                    anti_farming_applied=r.anti_farming_applied,created_at=r.created_at))
    except Exception: pass
    return out
