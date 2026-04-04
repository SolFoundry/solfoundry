"""Comment API models."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=8000)
    parent_id: str | None = None


class CommentPublic(BaseModel):
    id: str
    bounty_id: str
    parent_id: str | None
    author_id: str
    author_username: str
    author_avatar_url: str | None = None
    body: str
    created_at: str
    hidden: bool = False


class CommentListResponse(BaseModel):
    items: list[CommentPublic]
