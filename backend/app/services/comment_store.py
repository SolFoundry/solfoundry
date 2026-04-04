"""In-memory bounty comments (threaded via parent_id)."""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any


@dataclass
class StoredComment:
    id: str
    bounty_id: str
    parent_id: str | None
    author_id: str
    author_username: str
    author_avatar_url: str | None
    body: str
    created_at: str
    hidden: bool = False


class CommentStore:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._by_id: dict[str, StoredComment] = {}
        self._by_bounty: dict[str, list[str]] = {}

    async def list_for_bounty(self, bounty_id: str, include_hidden: bool = False) -> list[StoredComment]:
        async with self._lock:
            ids = list(self._by_bounty.get(bounty_id, []))
            out: list[StoredComment] = []
            for cid in ids:
                c = self._by_id.get(cid)
                if not c:
                    continue
                if c.hidden and not include_hidden:
                    continue
                out.append(c)
            out.sort(key=lambda x: x.created_at)
            return out

    async def get(self, comment_id: str) -> StoredComment | None:
        async with self._lock:
            return self._by_id.get(comment_id)

    def _depth(self, parent_id: str | None) -> int:
        d = 0
        pid = parent_id
        while pid:
            p = self._by_id.get(pid)
            if not p:
                break
            d += 1
            pid = p.parent_id
            if d > 32:
                break
        return d

    async def add(
        self,
        bounty_id: str,
        parent_id: str | None,
        author_id: str,
        author_username: str,
        author_avatar_url: str | None,
        body: str,
        max_depth: int = 8,
    ) -> StoredComment:
        async with self._lock:
            if parent_id:
                parent = self._by_id.get(parent_id)
                if not parent or parent.bounty_id != bounty_id:
                    raise ValueError("Invalid parent comment")
                if self._depth(parent_id) >= max_depth:
                    raise ValueError("Maximum reply depth reached")

            cid = str(uuid.uuid4())
            now = datetime.now(tz=UTC).isoformat()
            c = StoredComment(
                id=cid,
                bounty_id=bounty_id,
                parent_id=parent_id,
                author_id=author_id,
                author_username=author_username,
                author_avatar_url=author_avatar_url,
                body=body,
                created_at=now,
                hidden=False,
            )
            self._by_id[cid] = c
            self._by_bounty.setdefault(bounty_id, []).append(cid)
            return c

    async def delete(self, comment_id: str, bounty_id: str) -> bool:
        async with self._lock:
            c = self._by_id.get(comment_id)
            if not c or c.bounty_id != bounty_id:
                return False
            del self._by_id[comment_id]
            lst = self._by_bounty.get(bounty_id, [])
            if comment_id in lst:
                lst.remove(comment_id)
            return True

    async def hide(self, comment_id: str, bounty_id: str) -> bool:
        async with self._lock:
            c = self._by_id.get(comment_id)
            if not c or c.bounty_id != bounty_id:
                return False
            c.hidden = True
            return True

    def to_public(self, c: StoredComment) -> dict[str, Any]:
        return {
            "id": c.id,
            "bounty_id": c.bounty_id,
            "parent_id": c.parent_id,
            "author_id": c.author_id,
            "author_username": c.author_username,
            "author_avatar_url": c.author_avatar_url,
            "body": c.body,
            "created_at": c.created_at,
            "hidden": c.hidden,
        }

    def clear_all(self) -> None:
        """Testing / dev only."""
        self._by_id.clear()
        self._by_bounty.clear()


_store: CommentStore | None = None


def get_comment_store() -> CommentStore:
    global _store
    if _store is None:
        _store = CommentStore()
    return _store
