#!/usr/bin/env python3
"""
Four-Layer Memory System — Persistent memory across agent sessions.

Architecture:
  Layer 1: Session Memory — Current conversation context (in-memory, ephemeral)
  Layer 2: Daily Memory — Daily notes and event logs (file-based, 7-day retention)
  Layer 3: Long-Term Memory — Curated insights and decisions (file-based, persistent)
  Layer 4: Knowledge Graph — Entity relationships and patterns (SQLite, queryable)

Bounty #861 | SolFoundry/solfoundry
"""

import json
import os
import time
import logging
import sqlite3
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class MemoryEntry:
    """A single memory record."""
    content: str
    layer: str  # session / daily / longterm / knowledge
    topic: str = ""
    importance: float = 0.5  # 0.0-1.0
    timestamp: float = field(default_factory=time.time)
    source: str = "agent"
    tags: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "layer": self.layer,
            "topic": self.topic,
            "importance": self.importance,
            "timestamp": self.timestamp,
            "source": self.source,
            "tags": self.tags,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "MemoryEntry":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


class SessionMemory:
    """
    Layer 1: Session Memory — Ephemeral, in-memory context.

    Stores current conversation context, active tasks, and temporary state.
    Lost when agent restarts (by design — use Daily Memory for persistence).
    """

    def __init__(self, max_entries: int = 100):
        self.max_entries = max_entries
        self._entries: list[MemoryEntry] = []
        self._context: dict[str, Any] = {}

    def add(self, content: str, topic: str = "", importance: float = 0.5, **meta: Any) -> None:
        entry = MemoryEntry(
            content=content,
            layer="session",
            topic=topic,
            importance=importance,
            metadata=meta,
        )
        self._entries.append(entry)
        # Evict oldest low-importance entries if over limit
        if len(self._entries) > self.max_entries:
            self._entries.sort(key=lambda e: e.importance, reverse=True)
            self._entries = self._entries[:self.max_entries]

    def set_context(self, key: str, value: Any) -> None:
        self._context[key] = value

    def get_context(self, key: str, default: Any = None) -> Any:
        return self._context.get(key, default)

    def search(self, query: str, limit: int = 10) -> list[MemoryEntry]:
        """Simple keyword search within session."""
        query_lower = query.lower()
        results = [
            e for e in self._entries
            if query_lower in e.content.lower() or query_lower in e.topic.lower()
        ]
        return sorted(results, key=lambda e: e.importance, reverse=True)[:limit]

    def recent(self, n: int = 5) -> list[MemoryEntry]:
        """Get N most recent entries."""
        return self._entries[-n:]

    def clear(self) -> None:
        self._entries.clear()
        self._context.clear()

    @property
    def size(self) -> int:
        return len(self._entries)


class DailyMemory:
    """
    Layer 2: Daily Memory — File-based daily notes.

    Stores daily event logs, task completions, and observations.
    Automatically rotates (7-day retention by default).
    """

    def __init__(self, base_dir: str, retention_days: int = 7):
        self.base_dir = base_dir
        self.retention_days = retention_days
        os.makedirs(base_dir, exist_ok=True)

    def _today_file(self) -> str:
        today = datetime.now().strftime("%Y-%m-%d")
        return os.path.join(self.base_dir, f"{today}.jsonl")

    def add(self, content: str, topic: str = "", importance: float = 0.5, **meta: Any) -> None:
        """Append entry to today's daily file."""
        entry = MemoryEntry(
            content=content,
            layer="daily",
            topic=topic,
            importance=importance,
            metadata=meta,
        )
        with open(self._today_file(), "a") as f:
            f.write(json.dumps(entry.to_dict()) + "\n")

    def read_day(self, date_str: str) -> list[MemoryEntry]:
        """Read all entries for a specific date."""
        filepath = os.path.join(self.base_dir, f"{date_str}.jsonl")
        if not os.path.exists(filepath):
            return []
        entries = []
        with open(filepath, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(MemoryEntry.from_dict(json.loads(line)))
                    except json.JSONDecodeError:
                        continue
        return entries

    def read_recent(self, days: int = 3) -> list[MemoryEntry]:
        """Read entries from the last N days."""
        all_entries = []
        for i in range(days):
            date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            all_entries.extend(self.read_day(date))
        return sorted(all_entries, key=lambda e: e.timestamp, reverse=True)

    def search(self, query: str, days: int = 7, limit: int = 20) -> list[MemoryEntry]:
        """Search across recent daily files."""
        results = []
        query_lower = query.lower()
        for entry in self.read_recent(days):
            if query_lower in entry.content.lower() or query_lower in entry.topic.lower():
                results.append(entry)
        return sorted(results, key=lambda e: e.importance, reverse=True)[:limit]

    def cleanup(self) -> int:
        """Delete files older than retention period. Returns count of deleted files."""
        cutoff = datetime.now() - timedelta(days=self.retention_days)
        deleted = 0
        for filename in os.listdir(self.base_dir):
            if not filename.endswith(".jsonl"):
                continue
            try:
                date_str = filename.replace(".jsonl", "")
                file_date = datetime.strptime(date_str, "%Y-%m-%d")
                if file_date < cutoff:
                    os.remove(os.path.join(self.base_dir, filename))
                    deleted += 1
            except ValueError:
                continue
        return deleted


class LongTermMemory:
    """
    Layer 3: Long-Term Memory — Curated, persistent insights.

    Stores important decisions, learned patterns, and reference knowledge.
    Manually curated (high signal, low noise).
    """

    def __init__(self, filepath: str):
        self.filepath = filepath
        self._entries: list[MemoryEntry] = []
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.filepath):
            self._entries = []
            return
        try:
            with open(self.filepath, "r") as f:
                data = json.load(f)
            self._entries = [MemoryEntry.from_dict(e) for e in data]
        except (json.JSONDecodeError, IOError):
            self._entries = []

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self.filepath) or ".", exist_ok=True)
        with open(self.filepath, "w") as f:
            json.dump([e.to_dict() for e in self._entries], f, indent=2)

    def add(self, content: str, topic: str = "", importance: float = 0.8, **meta: Any) -> None:
        """Add entry (high importance by default — this is curated memory)."""
        entry = MemoryEntry(
            content=content,
            layer="longterm",
            topic=topic,
            importance=importance,
            metadata=meta,
        )
        self._entries.append(entry)
        self._save()

    def remove(self, index: int) -> None:
        """Remove entry by index."""
        if 0 <= index < len(self._entries):
            self._entries.pop(index)
            self._save()

    def search(self, query: str, limit: int = 10) -> list[MemoryEntry]:
        query_lower = query.lower()
        results = [
            e for e in self._entries
            if query_lower in e.content.lower()
            or query_lower in e.topic.lower()
            or any(query_lower in tag for tag in e.tags)
        ]
        return sorted(results, key=lambda e: e.importance, reverse=True)[:limit]

    def get_all(self) -> list[MemoryEntry]:
        return sorted(self._entries, key=lambda e: e.importance, reverse=True)

    @property
    def size(self) -> int:
        return len(self._entries)


class KnowledgeGraph:
    """
    Layer 4: Knowledge Graph — SQLite-backed entity relationships.

    Stores entities (agents, bounties, repositories, tools) and their
    relationships. Supports graph queries for pattern discovery.
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS entities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    properties TEXT DEFAULT '{}',
                    created_at REAL DEFAULT (strftime('%s', 'now'))
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS relations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id INTEGER NOT NULL,
                    target_id INTEGER NOT NULL,
                    relation_type TEXT NOT NULL,
                    weight REAL DEFAULT 1.0,
                    created_at REAL DEFAULT (strftime('%s', 'now')),
                    FOREIGN KEY (source_id) REFERENCES entities(id),
                    FOREIGN KEY (target_id) REFERENCES entities(id)
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_entity_name ON entities(name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(type)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_relation_type ON relations(relation_type)")
            conn.commit()

    def add_entity(self, name: str, entity_type: str, properties: dict = None) -> int:
        """Add an entity. Returns entity ID."""
        props = json.dumps(properties or {})
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "INSERT OR IGNORE INTO entities (name, type, properties) VALUES (?, ?, ?)",
                (name, entity_type, props),
            )
            conn.commit()
            if cursor.lastrowid:
                return cursor.lastrowid
            # Entity already exists, return existing ID
            row = conn.execute(
                "SELECT id FROM entities WHERE name = ? AND type = ?",
                (name, entity_type),
            ).fetchone()
            return row[0] if row else 0

    def add_relation(
        self, source_name: str, target_name: str, relation_type: str, weight: float = 1.0
    ) -> None:
        """Add a relationship between two entities."""
        with sqlite3.connect(self.db_path) as conn:
            # Get or create source and target
            source_id = self.add_entity(source_name, "unknown")
            target_id = self.add_entity(target_name, "unknown")

            conn.execute(
                """INSERT INTO relations (source_id, target_id, relation_type, weight)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT DO NOTHING""",
                (source_id, target_id, relation_type, weight),
            )
            conn.commit()

    def get_entity(self, name: str) -> Optional[dict]:
        """Get entity by name."""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT id, name, type, properties, created_at FROM entities WHERE name = ?",
                (name,),
            ).fetchone()
            if not row:
                return None
            return {
                "id": row[0],
                "name": row[1],
                "type": row[2],
                "properties": json.loads(row[3]),
                "created_at": row[4],
            }

    def get_relations(self, entity_name: str, relation_type: str = None) -> list[dict]:
        """Get all relations for an entity."""
        with sqlite3.connect(self.db_path) as conn:
            entity = self.get_entity(entity_name)
            if not entity:
                return []

            query = """
                SELECT e.name, e.type, r.relation_type, r.weight
                FROM relations r
                JOIN entities e ON r.target_id = e.id
                WHERE r.source_id = ?
            """
            params: list = [entity["id"]]

            if relation_type:
                query += " AND r.relation_type = ?"
                params.append(relation_type)

            rows = conn.execute(query, params).fetchall()
            return [
                {"name": row[0], "type": row[1], "relation": row[2], "weight": row[3]}
                for row in rows
            ]

    def search_entities(self, query: str, entity_type: str = None, limit: int = 20) -> list[dict]:
        """Search entities by name (fuzzy match)."""
        with sqlite3.connect(self.db_path) as conn:
            sql = "SELECT id, name, type, properties FROM entities WHERE name LIKE ?"
            params: list = [f"%{query}%"]

            if entity_type:
                sql += " AND type = ?"
                params.append(entity_type)

            sql += f" LIMIT {limit}"
            rows = conn.execute(sql, params).fetchall()
            return [
                {"id": row[0], "name": row[1], "type": row[2], "properties": json.loads(row[3])}
                for row in rows
            ]

    @property
    def entity_count(self) -> int:
        with sqlite3.connect(self.db_path) as conn:
            return conn.execute("SELECT COUNT(*) FROM entities").fetchone()[0]

    @property
    def relation_count(self) -> int:
        with sqlite3.connect(self.db_path) as conn:
            return conn.execute("SELECT COUNT(*) FROM relations").fetchone()[0]


class MemoryManager:
    """
    Four-Layer Memory Manager — Unified interface for all memory layers.

    Usage:
        mm = MemoryManager(base_dir="/home/agent/data")
        mm.remember("Found high-value bounty #861", topic="bounty", importance=0.9)
        results = mm.recall("bounty #861")
        mm.promote_to_longterm("bounty #861", topic="important-decisions")
    """

    def __init__(
        self,
        base_dir: str = "./data",
        session_max: int = 100,
        daily_retention_days: int = 7,
    ):
        self.base_dir = base_dir
        os.makedirs(base_dir, exist_ok=True)

        # Layer 1: Session (in-memory)
        self.session = SessionMemory(max_entries=session_max)

        # Layer 2: Daily (file-based)
        daily_dir = os.path.join(base_dir, "daily")
        self.daily = DailyMemory(daily_dir, retention_days=daily_retention_days)

        # Layer 3: Long-term (file-based, curated)
        lt_path = os.path.join(base_dir, "longterm.json")
        self.longterm = LongTermMemory(lt_path)

        # Layer 4: Knowledge graph (SQLite)
        kg_path = os.path.join(base_dir, "knowledge.db")
        self.knowledge = KnowledgeGraph(kg_path)

    def remember(
        self, content: str, topic: str = "", importance: float = 0.5, layer: str = "auto", **meta: Any
    ) -> None:
        """Store a memory entry. Layer='auto' selects based on importance."""
        if layer == "auto":
            if importance >= 0.9:
                # Critical: store in all layers
                self.session.add(content, topic, importance, **meta)
                self.daily.add(content, topic, importance, **meta)
                self.longterm.add(content, topic, importance, **meta)
            elif importance >= 0.7:
                # Important: session + daily
                self.session.add(content, topic, importance, **meta)
                self.daily.add(content, topic, importance, **meta)
            else:
                # Normal: session only
                self.session.add(content, topic, importance, **meta)
        elif layer == "session":
            self.session.add(content, topic, importance, **meta)
        elif layer == "daily":
            self.daily.add(content, topic, importance, **meta)
        elif layer == "longterm":
            self.longterm.add(content, topic, importance, **meta)

    def recall(self, query: str, limit: int = 10) -> list[MemoryEntry]:
        """Search across all layers, ranked by importance."""
        results = []

        # Search all layers
        results.extend(self.session.search(query, limit=limit))
        results.extend(self.daily.search(query, limit=limit))
        results.extend(self.longterm.search(query, limit=limit))

        # Deduplicate by content similarity
        seen = set()
        unique = []
        for entry in results:
            key = entry.content[:100]
            if key not in seen:
                seen.add(key)
                unique.append(entry)

        return sorted(unique, key=lambda e: e.importance, reverse=True)[:limit]

    def promote_to_longterm(self, content_substr: str, topic: str = "") -> bool:
        """Promote a daily/session memory to long-term."""
        # Search in daily memory
        for entry in self.daily.search(content_substr, limit=5):
            if content_substr.lower() in entry.content.lower():
                self.longterm.add(entry.content, topic or entry.topic, importance=0.85)
                logger.info(f"[memory] Promoted to long-term: {entry.content[:50]}...")
                return True

        # Search in session memory
        for entry in self.session.search(content_substr, limit=5):
            if content_substr.lower() in entry.content.lower():
                self.longterm.add(entry.content, topic or entry.topic, importance=0.85)
                logger.info(f"[memory] Promoted to long-term: {entry.content[:50]}...")
                return True

        return False

    def add_knowledge(self, entity_name: str, entity_type: str, relations: list[dict] = None) -> None:
        """Add entity and relations to knowledge graph."""
        self.knowledge.add_entity(entity_name, entity_type)
        if relations:
            for rel in relations:
                self.knowledge.add_relation(
                    entity_name,
                    rel["target"],
                    rel["type"],
                    rel.get("weight", 1.0),
                )

    def get_status(self) -> dict:
        """Get memory system status for monitoring."""
        return {
            "session_entries": self.session.size,
            "daily_recent": len(self.daily.read_recent(1)),
            "longterm_entries": self.longterm.size,
            "knowledge_entities": self.knowledge.entity_count,
            "knowledge_relations": self.knowledge.relation_count,
        }

    def cleanup(self) -> dict:
        """Run maintenance tasks. Returns cleanup stats."""
        deleted = self.daily.cleanup()
        return {"daily_files_deleted": deleted}
