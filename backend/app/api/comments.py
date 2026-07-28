"""Bounty Comments API endpoints.

This module provides REST endpoints for the bounty comments/discussion
thread feature (Bounty #838). Supports nested replies, moderation,
and pagination.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import (
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CommentListResponse,
    ErrorResponse,
)
from app.models.errors import ErrorResponse as GenericError
from app.services.comment_service import CommentService
from app.database import get_db
from app.auth import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bounties", tags=["bounty-comments"])


@router.post(
    "/{bounty_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a comment on a bounty",
    description="Add a new comment or nested reply to a bounty's discussion thread. "
    "Supports Markdown in the body. Basic spam filtering is applied.",
    responses={
        201: {"model": CommentResponse, "description": "Comment created successfully"},
        400: {"model": GenericError, "description": "Validation error (e.g., parent not found)"},
        401: {"model": GenericError, "description": "Authentication required"},
        404: {"model": GenericError, "description": "Bounty not found"},
    },
)
async def create_comment(
    bounty_id: str,
    comment_data: CommentCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> CommentResponse:
    """Create a new comment on a bounty.

    The comment will be attributed to the authenticated user.
    If `parent_id` is provided, the comment is a nested reply.

    Args:
        bounty_id: The UUID of the bounty to comment on.
        comment_data: The comment payload (body + optional parent_id).
        user_id: The authenticated user's ID (from auth middleware).
        db: Database session.

    Returns:
        The created comment with full metadata.

    Raises:
        HTTPException 400: If parent comment not found or body is invalid.
        HTTPException 401: If not authenticated.
    """
    service = CommentService(db)

    try:
        comment = await service.create_comment(
            bounty_id=bounty_id,
            author_id=user_id,
            author_username=None,
            author_avatar=None,
            comment_data=comment_data,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return comment


@router.get(
    "/{bounty_id}/comments",
    response_model=CommentListResponse,
    summary="List comments for a bounty",
    description="Retrieve paginated comments for a bounty. "
    "By default returns top-level comments. "
    "Use `parent_id` to get replies for a specific comment.",
    responses={
        200: {"model": CommentListResponse, "description": "Paginated comment list"},
    },
)
async def list_comments(
    bounty_id: str,
    parent_id: Optional[str] = Query(
        None,
        description="Filter by parent comment ID to get nested replies. "
        "Omit for top-level comments.",
    ),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(
        20, ge=1, le=100, description="Maximum results per page"
    ),
    db: AsyncSession = Depends(get_db),
) -> CommentListResponse:
    """List comments for a bounty.

    Returns top-level comments by default (no parent_id).
    Pass `parent_id` to get replies for a specific comment.

    Args:
        bounty_id: The UUID of the bounty.
        parent_id: Optional filter for nested replies.
        skip: Number of comments to skip (pagination).
        limit: Maximum comments to return.
        db: Database session.

    Returns:
        Paginated list of comments.
    """
    service = CommentService(db)
    return await service.list_comments(
        bounty_id=bounty_id,
        parent_id=parent_id,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{bounty_id}/comments/{comment_id}",
    response_model=CommentResponse,
    summary="Get a single comment",
    description="Retrieve a specific comment by its ID.",
    responses={
        200: {"model": CommentResponse, "description": "Comment found"},
        404: {"model": GenericError, "description": "Comment not found"},
    },
)
async def get_comment(
    bounty_id: str,
    comment_id: str,
    db: AsyncSession = Depends(get_db),
) -> CommentResponse:
    """Get a single comment by ID.

    Args:
        bounty_id: The UUID of the bounty (path validation).
        comment_id: The UUID of the comment.
        db: Database session.

    Returns:
        The comment data.

    Raises:
        HTTPException 404: If the comment is not found.
    """
    service = CommentService(db)
    comment = await service.get_comment(comment_id)

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    return comment


@router.patch(
    "/{bounty_id}/comments/{comment_id}",
    response_model=CommentResponse,
    summary="Edit a comment",
    description="Update the body of an existing comment. Only the original author can edit.",
    responses={
        200: {"model": CommentResponse, "description": "Comment updated"},
        400: {"model": GenericError, "description": "Cannot edit deleted/moderated comment"},
        401: {"model": GenericError, "description": "Authentication required"},
        403: {"model": GenericError, "description": "Not the comment author"},
        404: {"model": GenericError, "description": "Comment not found"},
    },
)
async def update_comment(
    bounty_id: str,
    comment_id: str,
    update_data: CommentUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> CommentResponse:
    """Edit a comment's body text.

    Args:
        bounty_id: The UUID of the bounty (path validation).
        comment_id: The UUID of the comment to edit.
        update_data: The new body text.
        user_id: The authenticated user's ID.
        db: Database session.

    Returns:
        The updated comment.

    Raises:
        HTTPException 403: If not the comment author.
        HTTPException 400: If comment is deleted or moderated.
        HTTPException 404: If comment not found.
    """
    service = CommentService(db)

    try:
        comment = await service.update_comment(
            comment_id=comment_id,
            author_id=user_id,
            update_data=update_data,
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )

    return comment


@router.delete(
    "/{bounty_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a comment",
    description="Soft-delete a comment. The comment body is replaced with '[deleted]'. "
    "Only the original author or an admin can delete.",
    responses={
        204: {"description": "Comment deleted successfully"},
        401: {"model": GenericError, "description": "Authentication required"},
        403: {"model": GenericError, "description": "Not authorized to delete"},
        404: {"model": GenericError, "description": "Comment not found"},
    },
)
async def delete_comment(
    bounty_id: str,
    comment_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a comment.

    Args:
        bounty_id: The UUID of the bounty (path validation).
        comment_id: The UUID of the comment to delete.
        user_id: The authenticated user's ID.
        db: Database session.

    Raises:
        HTTPException 403: If not authorized.
        HTTPException 404: If comment not found.
    """
    service = CommentService(db)

    try:
        deleted = await service.delete_comment(
            comment_id=comment_id,
            author_id=user_id,
            is_admin=False,
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found",
        )