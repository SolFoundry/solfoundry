"""Import record store — SQLite-based dedup tracking."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from app.models import ImportRecord, ImportStatus

logger = logging.getLogger(__name__)

# Simple in-memory store for development; swap to SQLite/Postgres for production
# This avoids heavy DB dependencies for the initial implementation


class ImportStore:
    """Tracks which GitHub issues have been imported as bounties.

    Uses SQLite for persistence by default, falls back to in-memory dict.
    """

    def __init__(self, database_url: str = ""):
        self._records: dict[str, ImportRecord] = {}
        self._next_id = 1
        self._db = None
        self._use_sqlite = False

        if database_url and "sqlite" in database_url.lower():
            self._use_sqlite = True
            self._init_sqlite(database_url)

    def _init_sqlite(self, database_url: str) -> None:
        """Initialize SQLite connection and create table."""
        try:
            import aiosqlite
            import sqlite3

            # Extract path from URL
            path = database_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
            if not path or path == ":memory:":
                path = ":memory:"

            self._sqlite_path = path
            self._sqlite_conn: Optional[sqlite3.Connection] = None

            # Create table synchronously (happens at startup)
            conn = sqlite3.connect(path)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS import_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    repo_owner TEXT NOT NULL,
                    repo_name TEXT NOT NULL,
                    issue_number INTEGER NOT NULL,
                    issue_url TEXT NOT NULL,
                    bounty_id TEXT,
                    tier INTEGER DEFAULT 2,
                    reward_amount INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    error_message TEXT,
                    imported_at TEXT,
                    updated_at TEXT,
                    UNIQUE(repo_owner, repo_name, issue_number)
                )
            """)
            conn.commit()
            conn.close()
            self._use_sqlite = True
            logger.info("Initialized SQLite store at %s", path)
        except ImportError:
            logger.warning("aiosqlite not available, using in-memory store")
            self._use_sqlite = False
        except Exception as e:
            logger.warning("Failed to init SQLite, using in-memory store: %s", e)
            self._use_sqlite = False

    def _get_sqlite_conn(self):
        """Get SQLite connection (sync for simplicity)."""
        import sqlite3

        if self._sqlite_conn is None:
            self._sqlite_conn = sqlite3.connect(self._sqlite_path)
            self._sqlite_conn.row_factory = sqlite3.Row
        return self._sqlite_conn

    def _key(self, owner: str, repo: str, number: int) -> str:
        return f"{owner}/{repo}#{number}"

    async def save(self, record: ImportRecord) -> ImportRecord:
        """Save an import record."""
        now = datetime.now(timezone.utc).isoformat()

        if self._use_sqlite:
            conn = self._get_sqlite_conn()
            conn.execute(
                """INSERT OR REPLACE INTO import_records
                   (repo_owner, repo_name, issue_number, issue_url, bounty_id,
                    tier, reward_amount, status, error_message, imported_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    record.repo_owner,
                    record.repo_name,
                    record.issue_number,
                    record.issue_url,
                    record.bounty_id,
                    record.tier,
                    record.reward_amount,
                    record.status,
                    record.error_message,
                    record.imported_at.isoformat() if record.imported_at else now,
                    now,
                ),
            )
            conn.commit()
            if record.id is None:
                record.id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        else:
            key = self._key(record.repo_owner, record.repo_name, record.issue_number)
            if record.id is None:
                record.id = self._next_id
                self._next_id += 1
            record.updated_at = datetime.now(timezone.utc)
            self._records[key] = record

        return record

    async def get_by_issue(
        self, owner: str, repo: str, issue_number: int
    ) -> Optional[ImportRecord]:
        """Look up an import record by repo + issue number."""
        if self._use_sqlite:
            conn = self._get_sqlite_conn()
            row = conn.execute(
                "SELECT * FROM import_records WHERE repo_owner=? AND repo_name=? AND issue_number=?",
                (owner, repo, issue_number),
            ).fetchone()
            if row:
                return ImportRecord(
                    id=row["id"],
                    repo_owner=row["repo_owner"],
                    repo_name=row["repo_name"],
                    issue_number=row["issue_number"],
                    issue_url=row["issue_url"],
                    bounty_id=row["bounty_id"],
                    tier=row["tier"],
                    reward_amount=row["reward_amount"],
                    status=row["status"],
                    error_message=row["error_message"],
                    imported_at=datetime.fromisoformat(row["imported_at"]) if row["imported_at"] else None,
                    updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else None,
                )
            return None
        else:
            key = self._key(owner, repo, issue_number)
            return self._records.get(key)

    async def list_records(
        self,
        limit: int = 50,
        offset: int = 0,
        status: Optional[str] = None,
    ) -> list[ImportRecord]:
        """List import records with optional filtering."""
        if self._use_sqlite:
            conn = self._get_sqlite_conn()
            query = "SELECT * FROM import_records"
            params: list = []
            if status:
                query += " WHERE status=?"
                params.append(status)
            query += " ORDER BY id DESC LIMIT ? OFFSET ?"
            params.extend([limit, offset])
            rows = conn.execute(query, params).fetchall()
            return [
                ImportRecord(
                    id=r["id"],
                    repo_owner=r["repo_owner"],
                    repo_name=r["repo_name"],
                    issue_number=r["issue_number"],
                    issue_url=r["issue_url"],
                    bounty_id=r["bounty_id"],
                    tier=r["tier"],
                    reward_amount=r["reward_amount"],
                    status=r["status"],
                    error_message=r["error_message"],
                    imported_at=datetime.fromisoformat(r["imported_at"]) if r["imported_at"] else None,
                    updated_at=datetime.fromisoformat(r["updated_at"]) if r["updated_at"] else None,
                )
                for r in rows
            ]
        else:
            records = list(self._records.values())
            if status:
                records = [r for r in records if r.status == status]
            records.sort(key=lambda r: r.id or 0, reverse=True)
            return records[offset : offset + limit]

    async def count(self, status: Optional[str] = None) -> int:
        """Count import records."""
        if self._use_sqlite:
            conn = self._get_sqlite_conn()
            if status:
                row = conn.execute(
                    "SELECT COUNT(*) FROM import_records WHERE status=?", (status,)
                ).fetchone()
            else:
                row = conn.execute("SELECT COUNT(*) FROM import_records").fetchone()
            return row[0]
        else:
            if status:
                return sum(1 for r in self._records.values() if r.status == status)
            return len(self._records)