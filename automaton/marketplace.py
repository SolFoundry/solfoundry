"""Marketplace API — GitHub repo discovery, funding goals, and contributions."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])

DB_PATH = "marketplace.db"

# ── DB helpers ──────────────────────────────────────────────────────────────

def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _init_db() -> None:
    with open("marketplace_schema.sql") as f:
        schema = f.read()
    conn = _get_db()
    conn.executescript(schema)
    conn.close()


# Initialise on import
_init_db()


def _row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


# ── Pydantic schemas ───────────────────────────────────────────────────────

class RegisterRepoIn(BaseModel):
    github_id: int

class CreateGoalIn(BaseModel):
    title: str
    description: str
    target_amount: float
    target_token: str  # 'USDC' | 'FNDRY'
    deadline: Optional[str] = None

class ContributeIn(BaseModel):
    amount: float
    token: str  # 'USDC' | 'FNDRY'
    tx_signature: Optional[str] = None


# ── Repos ───────────────────────────────────────────────────────────────────

@router.get("/repos")
def search_repos(
    q: Optional[str] = None,
    language: Optional[str] = None,
    min_stars: Optional[int] = None,
    sort: str = Query("stars", regex="^(stars|funded|recent)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    conn = _get_db()
    clauses: list[str] = []
    params: list = []

    if q:
        clauses.append("(r.name LIKE ? OR r.full_name LIKE ? OR r.description LIKE ?)")
        params += [f"%{q}%"] * 3
    if language:
        clauses.append("r.language = ?")
        params.append(language)
    if min_stars is not None:
        clauses.append("r.stars >= ?")
        params.append(min_stars)

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""

    order_map = {
        "stars": "r.stars DESC",
        "funded": "r.total_funded_usdc DESC",
        "recent": "r.created_at DESC",
    }
    order = order_map.get(sort, "r.stars DESC")

    total = conn.execute(f"SELECT COUNT(*) FROM marketplace_repos r{where}", params).fetchone()[0]

    offset = (page - 1) * limit
    rows = conn.execute(
        f"SELECT r.* FROM marketplace_repos r{where} ORDER BY {order} LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    conn.close()

    return {"repos": [_row_to_dict(r) for r in rows], "total": total}


@router.get("/repos/{repo_id}")
def get_repo(repo_id: str):
    conn = _get_db()
    row = conn.execute("SELECT * FROM marketplace_repos WHERE id = ?", (repo_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Repo not found")
    return _row_to_dict(row)


@router.post("/repos", status_code=201)
def register_repo(body: RegisterRepoIn):
    conn = _get_db()
    existing = conn.execute(
        "SELECT * FROM marketplace_repos WHERE github_id = ?", (body.github_id,)
    ).fetchone()
    if existing:
        conn.close()
        return _row_to_dict(existing)

    repo_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO marketplace_repos
           (id, github_id, name, full_name, description, language, stars,
            owner_login, owner_avatar_url, html_url,
            total_funded_usdc, total_funded_fndry, active_goals, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (repo_id, body.github_id, "", "", None, None, 0, "", None, "", 0, 0, 0, now),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM marketplace_repos WHERE id = ?", (repo_id,)).fetchone()
    conn.close()
    return _row_to_dict(row)


# ── Funding Goals ───────────────────────────────────────────────────────────

@router.post("/repos/{repo_id}/funding-goals", status_code=201)
def create_funding_goal(repo_id: str, body: CreateGoalIn):
    if body.target_token not in ("USDC", "FNDRY"):
        raise HTTPException(400, "target_token must be USDC or FNDRY")

    conn = _get_db()
    repo = conn.execute("SELECT id FROM marketplace_repos WHERE id = ?", (repo_id,)).fetchone()
    if not repo:
        conn.close()
        raise HTTPException(404, "Repo not found")

    goal_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """INSERT INTO funding_goals
           (id, repo_id, creator_id, creator_username, title, description,
            target_amount, target_token, current_amount, contributor_count,
            status, deadline, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (goal_id, repo_id, "", None, body.title, body.description,
         body.target_amount, body.target_token, 0, 0,
         "active", body.deadline, now),
    )
    conn.execute(
        "UPDATE marketplace_repos SET active_goals = active_goals + 1 WHERE id = ?",
        (repo_id,),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM funding_goals WHERE id = ?", (goal_id,)).fetchone()
    conn.close()
    return _row_to_dict(row)


@router.get("/funding-goals")
def list_funding_goals(
    repo_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    conn = _get_db()
    clauses: list[str] = []
    params: list = []

    if repo_id:
        clauses.append("repo_id = ?")
        params.append(repo_id)
    if status:
        clauses.append("status = ?")
        params.append(status)

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    total = conn.execute(f"SELECT COUNT(*) FROM funding_goals{where}", params).fetchone()[0]

    offset = (page - 1) * limit
    rows = conn.execute(
        f"SELECT * FROM funding_goals{where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    conn.close()
    return {"goals": [_row_to_dict(r) for r in rows], "total": total}


@router.get("/funding-goals/{goal_id}")
def get_goal_progress(goal_id: str):
    conn = _get_db()
    goal = conn.execute("SELECT * FROM funding_goals WHERE id = ?", (goal_id,)).fetchone()
    if not goal:
        conn.close()
        raise HTTPException(404, "Goal not found")

    contributions = conn.execute(
        "SELECT * FROM contributions WHERE goal_id = ? ORDER BY created_at DESC",
        (goal_id,),
    ).fetchall()
    conn.close()

    result = _row_to_dict(goal)
    result["contributions"] = [_row_to_dict(c) for c in contributions]
    return result


@router.post("/funding-goals/{goal_id}/contribute", status_code=201)
def contribute(goal_id: str, body: ContributeIn):
    if body.token not in ("USDC", "FNDRY"):
        raise HTTPException(400, "token must be USDC or FNDRY")

    conn = _get_db()
    goal = conn.execute("SELECT * FROM funding_goals WHERE id = ?", (goal_id,)).fetchone()
    if not goal:
        conn.close()
        raise HTTPException(404, "Goal not found")
    if goal["status"] != "active":
        conn.close()
        raise HTTPException(400, "Goal is not active")

    c_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # If goal token matches contribution token, update current_amount
    amount_field = "current_amount"
    conn.execute(
        """INSERT INTO contributions
           (id, goal_id, contributor_id, contributor_username, amount, token, tx_signature, created_at)
           VALUES (?,?,?,?,?,?,?,?)""",
        (c_id, goal_id, "", None, body.amount, body.token, body.tx_signature, now),
    )
    conn.execute(
        f"UPDATE funding_goals SET {amount_field} = {amount_field} + ?, contributor_count = contributor_count + 1 WHERE id = ?",
        (body.amount, goal_id),
    )

    # Check completion
    updated = conn.execute("SELECT * FROM funding_goals WHERE id = ?", (goal_id,)).fetchone()
    if updated["current_amount"] >= updated["target_amount"]:
        conn.execute("UPDATE funding_goals SET status = 'completed' WHERE id = ?", (goal_id,))
        conn.execute(
            "UPDATE marketplace_repos SET active_goals = active_goals - 1 WHERE id = ?",
            (goal["repo_id"],),
        )

    conn.commit()
    row = conn.execute("SELECT * FROM contributions WHERE id = ?", (c_id,)).fetchone()
    conn.close()
    return _row_to_dict(row)


@router.post("/funding-goals/{goal_id}/distribute")
def distribute(goal_id: str):
    conn = _get_db()
    goal = conn.execute("SELECT * FROM funding_goals WHERE id = ?", (goal_id,)).fetchone()
    if not goal:
        conn.close()
        raise HTTPException(404, "Goal not found")
    if goal["status"] != "completed":
        conn.close()
        raise HTTPException(400, "Goal must be completed before distribution")

    contributions = conn.execute(
        "SELECT COUNT(*) as cnt, SUM(amount) as total FROM contributions WHERE goal_id = ?",
        (goal_id,),
    ).fetchone()

    # Mark as distributed — in production this would trigger on-chain transfers
    conn.execute("UPDATE funding_goals SET status = 'distributed' WHERE id = ?", (goal_id,))

    # Update repo totals
    token = goal["target_token"]
    field = "total_funded_usdc" if token == "USDC" else "total_funded_fndry"
    conn.execute(
        f"UPDATE marketplace_repos SET {field} = {field} + ? WHERE id = ?",
        (goal["current_amount"], goal["repo_id"]),
    )

    conn.commit()
    conn.close()
    return {"distributed": contributions["total"] or 0, "recipients": contributions["cnt"]}


@router.get("/repos/{repo_id}/leaderboard")
def repo_leaderboard(repo_id: str, limit: int = Query(10, ge=1, le=100)):
    conn = _get_db()
    rows = conn.execute(
        """SELECT contributor_id,
                  MAX(contributor_username) as username,
                  SUM(amount) as total_contributed,
                  COUNT(DISTINCT goal_id) as goals_funded
           FROM contributions
           WHERE goal_id IN (SELECT id FROM funding_goals WHERE repo_id = ?)
           GROUP BY contributor_id
           ORDER BY total_contributed DESC
           LIMIT ?""",
        (repo_id, limit),
    ).fetchall()
    conn.close()

    result = []
    for idx, r in enumerate(rows, start=1):
        entry = _row_to_dict(r)
        entry["rank"] = idx
        entry["avatar_url"] = None
        result.append(entry)
    return result
