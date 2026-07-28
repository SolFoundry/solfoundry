"""Comment database and Pydantic models.

This module defines the data models for the bounty comments/discussion thread
feature (Bounty #838). Comments support nested replies, moderation, and
real-time updates via WebSocket events.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


def _now() -> datetime:
    """Return the current UTC timestamp for column defaults."""
    return datetime.now(timezone.utc)


class CommentDB(Base):
    """Bounty comment database model.

    Each row represents a single comment on a bounty detail page.
    Comments can be top-level (parent_id is NULL) or nested replies.
    Soft-delete via is_deleted flag instead of removing the row.
    """

    __tablename__ = "bounty_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(
        UUID(as_uuid=True),
        ForeignKey("bounties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("bounty_comments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    author_id = Column(String(100), nullable=False, index=True)
    author_username = Column(String(100), nullable=True)
    author_avatar = Column(String(500), nullable=True)
    body = Column(Text, nullable=False)
    is_deleted = Column(Boolean, nullable=False, default=False)
    is_moderated = Column(Boolean, nullable=False, default=False)
    moderation_reason = Column(String(200), nullable=True)
    reply_count = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )


# ── Pydantic Models ──────────────────────────────────────────────────────


class CommentCreate(BaseModel):
    """Request model for creating a new comment."""

    body: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Comment body text (Markdown supported)",
    )
    parent_id: Optional[str] = Field(
        None,
        description="Parent comment ID for nested replies. Null for top-level.",
    )


class CommentUpdate(BaseModel):
    """Request model for updating (editing) a comment."""

    body: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Updated comment body text",
    )


class CommentResponse(BaseModel):
    """Response model for a single comment."""

    id: str = Field(..., description="Comment UUID")
    bounty_id: str = Field(..., description="Bounty UUID")
    parent_id: Optional[str] = Field(None, description="Parent comment UUID")
    author_id: str = Field(..., description="Author user ID")
    author_username: Optional[str] = Field(None, description="Author display name")
    author_avatar: Optional[str] = Field(None, description="Author avatar URL")
    body: str = Field(..., description="Comment body text")
    is_deleted: bool = Field(False, description="Soft-delete flag")
    is_moderated: bool = Field(False, description="Moderation flag")
    moderation_reason: Optional[str] = Field(None, description="Moderation reason")
    reply_count: int = Field(0, description="Number of direct replies")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")
    updated_at: str = Field(..., description="ISO 8601 update timestamp")

    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    """Response model for a paginated list of comments."""

    items: List[CommentResponse] = Field(..., description="List of comments")
    total: int = Field(..., description="Total number of comments")
    limit: int = Field(..., description="Page size")
    offset: int = Field(..., description="Current offset")


class ErrorResponse(BaseModel):
    """Standard error response."""

    message: str = Field(..., description="Error message")
    code: str = Field(..., description="Error code")