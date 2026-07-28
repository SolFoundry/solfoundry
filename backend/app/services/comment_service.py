"""Comment service for bounty discussion threads.

This module provides the business logic for comment operations:
creating, listing, editing, deleting, and moderating comments
on bounty detail pages.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional
from datetime import datetime, timezone

from sqlalchemy import select, func, and_, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

if TYPE_CHECKING:
    pass

from app.models.comment import (
    CommentDB,
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CommentListResponse,
)


class CommentService:
    """Service for bounty comment operations."""

    SPAM_PATTERNS = [
        "http://",  # Unlinked URLs
        "check out my",  # Self-promotion
        "buy now",  # Commercial spam
        "click here",  # Phishing
        "free money",  # Scam
    ]

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _to_response(comment: CommentDB) -> CommentResponse:
        """Convert ORM model to Pydantic response model."""
        return CommentResponse(
            id=str(comment.id),
            bounty_id=str(comment.bounty_id),
            parent_id=str(comment.parent_id) if comment.parent_id else None,
            author_id=comment.author_id,
            author_username=comment.author_username,
            author_avatar=comment.author_avatar,
            body="[deleted]" if comment.is_deleted else comment.body,
            is_deleted=comment.is_deleted,
            is_moderated=comment.is_moderated,
            moderation_reason=comment.moderation_reason,
            reply_count=comment.reply_count,
            created_at=comment.created_at.isoformat() if comment.created_at else "",
            updated_at=comment.updated_at.isoformat() if comment.updated_at else "",
        )

    def _is_spam(self, body: str) -> bool:
        """Basic spam detection — returns True if body matches a spam pattern."""
        body_lower = body.lower()
        return any(pattern in body_lower for pattern in self.SPAM_PATTERNS)

    async def create_comment(
        self,
        bounty_id: str,
        author_id: str,
        author_username: Optional[str],
        author_avatar: Optional[str],
        comment_data: CommentCreate,
    ) -> CommentResponse:
        """Create a new comment on a bounty.

        Args:
            bounty_id: The UUID of the bounty.
            author_id: The authenticated user's ID.
            author_username: Optional display name.
            author_avatar: Optional avatar URL.
            comment_data: The comment creation payload.

        Returns:
            CommentResponse for the created comment.

        Raises:
            ValueError: If parent_id references a non-existent comment.
        """
        # Validate parent_id if set
        if comment_data.parent_id:
            parent_query = select(CommentDB).where(
                and_(
                    CommentDB.id == comment_data.parent_id,
                    CommentDB.bounty_id == bounty_id,
                    CommentDB.is_deleted == False,
                )
            )
            parent_result = await self.db.execute(parent_query)
            parent = parent_result.scalar_one_or_none()
            if not parent:
                raise ValueError("Parent comment not found")

        # Spam detection
        is_spam = self._is_spam(comment_data.body)

        comment = CommentDB(
            bounty_id=bounty_id,
            parent_id=comment_data.parent_id,
            author_id=author_id,
            author_username=author_username,
            author_avatar=author_avatar,
            body=comment_data.body,
            is_moderated=is_spam,
            moderation_reason="Flagged as spam" if is_spam else None,
        )

        self.db.add(comment)

        # Update parent reply count if this is a reply
        if comment_data.parent_id:
            parent = await self.db.get(CommentDB, comment_data.parent_id)
            if parent:
                parent.reply_count = CommentDB.reply_count + 1

        await self.db.commit()
        await self.db.refresh(comment)

        return self._to_response(comment)

    async def list_comments(
        self,
        bounty_id: str,
        parent_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> CommentListResponse:
        """List comments for a bounty, paginated.

        By default returns top-level comments (parent_id is None).
        Pass parent_id to get replies for a specific comment.

        Args:
            bounty_id: The UUID of the bounty.
            parent_id: Optional — filter by parent (for replies).
            skip: Pagination offset.
            limit: Maximum results per page.

        Returns:
            CommentListResponse with items and total count.
        """
        # Build query
        conditions = [CommentDB.bounty_id == bounty_id]
        if parent_id is not None:
            conditions.append(CommentDB.parent_id == parent_id)
        else:
            conditions.append(CommentDB.parent_id.is_(None))

        # Count total
        count_query = select(func.count()).select_from(CommentDB).where(and_(*conditions))
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Fetch items
        query = (
            select(CommentDB)
            .where(and_(*conditions))
            .order_by(CommentDB.created_at.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(query)
        comments = result.scalars().all()

        return CommentListResponse(
            items=[self._to_response(c) for c in comments],
            total=total,
            limit=limit,
            offset=skip,
        )

    async def get_comment(self, comment_id: str) -> Optional[CommentResponse]:
        """Get a single comment by ID.

        Args:
            comment_id: The UUID of the comment.

        Returns:
            CommentResponse if found, None otherwise.
        """
        query = select(CommentDB).where(CommentDB.id == comment_id)
        result = await self.db.execute(query)
        comment = result.scalar_one_or_none()
        return self._to_response(comment) if comment else None

    async def update_comment(
        self,
        comment_id: str,
        author_id: str,
        update_data: CommentUpdate,
    ) -> Optional[CommentResponse]:
        """Update (edit) a comment body.

        Only the original author can edit their comment.
        Deleted or moderated comments cannot be edited.

        Args:
            comment_id: The UUID of the comment.
            author_id: The authenticated user's ID (must match author).
            update_data: The updated comment body.

        Returns:
            Updated CommentResponse, or None if not found.

        Raises:
            PermissionError: If author_id doesn't match the comment author.
            ValueError: If the comment is deleted or moderated.
        """
        query = select(CommentDB).where(CommentDB.id == comment_id)
        result = await self.db.execute(query)
        comment = result.scalar_one_or_none()

        if not comment:
            return None

        if str(comment.author_id) != author_id:
            raise PermissionError("You can only edit your own comments")

        if comment.is_deleted:
            raise ValueError("Cannot edit a deleted comment")

        if comment.is_moderated:
            raise ValueError("Cannot edit a moderated comment")

        comment.body = update_data.body
        comment.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(comment)

        return self._to_response(comment)

    async def delete_comment(
        self,
        comment_id: str,
        author_id: str,
        is_admin: bool = False,
    ) -> bool:
        """Soft-delete a comment.

        Authors can delete their own comments. Admins can delete any comment.
        Deleted comments show "[deleted]" in place of the body.

        Args:
            comment_id: The UUID of the comment.
            author_id: The authenticated user's ID.
            is_admin: If True, bypasses author check.

        Returns:
            True if deleted, False if not found.

        Raises:
            PermissionError: If neither author nor admin.
        """
        query = select(CommentDB).where(CommentDB.id == comment_id)
        result = await self.db.execute(query)
        comment = result.scalar_one_or_none()

        if not comment:
            return False

        if not is_admin and str(comment.author_id) != author_id:
            raise PermissionError("You can only delete your own comments")

        comment.is_deleted = True
        comment.body = ""
        await self.db.commit()

        return True

    async def moderate_comment(
        self,
        comment_id: str,
        reason: str,
    ) -> Optional[CommentResponse]:
        """Moderate a comment (admin-only).

        Flags the comment as moderated with a reason.
        Moderated comments remain visible but are flagged.

        Args:
            comment_id: The UUID of the comment.
            reason: Moderation reason.

        Returns:
            Updated CommentResponse, or None if not found.
        """
        query = select(CommentDB).where(CommentDB.id == comment_id)
        result = await self.db.execute(query)
        comment = result.scalar_one_or_none()

        if not comment:
            return None

        comment.is_moderated = True
        comment.moderation_reason = reason
        await self.db.commit()
        await self.db.refresh(comment)

        return self._to_response(comment)