"""Bounty comments REST API."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.deps.auth import get_current_user
from app.schemas.comments import CommentCreate, CommentListResponse, CommentPublic
from app.services.comment_spam import RateLimiter, assess_spam
from app.services.comment_store import get_comment_store
from app.ws.comment_hub import get_comment_hub

router = APIRouter(tags=["comments"])

_rl_singleton: RateLimiter | None = None


def _rate_limiter(settings: Settings) -> RateLimiter:
    global _rl_singleton
    if _rl_singleton is None or (
        _rl_singleton.limit != settings.comment_rate_limit
        or abs(_rl_singleton.window_seconds - float(settings.comment_rate_window_seconds)) > 0.01
    ):
        _rl_singleton = RateLimiter(
            settings.comment_rate_limit,
            float(settings.comment_rate_window_seconds),
        )
    return _rl_singleton


def _moderator_ids(settings: Settings) -> set[str]:
    return {x.strip() for x in settings.moderator_user_ids.split(",") if x.strip()}


def _is_moderator(user_sub: str, settings: Settings) -> bool:
    return user_sub in _moderator_ids(settings)


@router.get("/{bounty_id}/comments", response_model=CommentListResponse)
async def list_comments(bounty_id: str) -> CommentListResponse:
    store = get_comment_store()
    rows = await store.list_for_bounty(bounty_id, include_hidden=False)
    return CommentListResponse(items=[CommentPublic(**store.to_public(c)) for c in rows])


@router.post("/{bounty_id}/comments", response_model=CommentPublic)
async def create_comment(
    bounty_id: str,
    payload: CommentCreate,
    user: Annotated[dict, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CommentPublic:
    ok, rate_msg = _rate_limiter(settings).check(f"user:{user['sub']}")
    if not ok:
        raise HTTPException(status_code=429, detail=rate_msg)

    spam, reason = assess_spam(payload.body)
    if spam:
        raise HTTPException(status_code=400, detail=reason or "Comment rejected by spam filter")

    store = get_comment_store()
    try:
        c = await store.add(
            bounty_id=bounty_id,
            parent_id=payload.parent_id,
            author_id=user["sub"],
            author_username=str(user.get("username") or "user"),
            author_avatar_url=user.get("avatar_url"),
            body=payload.body.strip(),
            max_depth=settings.comment_max_thread_depth,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    public = CommentPublic(**store.to_public(c))
    await get_comment_hub().broadcast(
        bounty_id,
        {"type": "comment_created", "comment": public.model_dump()},
    )
    return public


@router.delete("/{bounty_id}/comments/{comment_id}")
async def delete_comment(
    bounty_id: str,
    comment_id: str,
    user: Annotated[dict, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, bool]:
    store = get_comment_store()
    c = await store.get(comment_id)
    if not c or c.bounty_id != bounty_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    if c.author_id != user["sub"] and not _is_moderator(user["sub"], settings):
        raise HTTPException(status_code=403, detail="Not allowed to delete this comment")
    await store.delete(comment_id, bounty_id)
    await get_comment_hub().broadcast(bounty_id, {"type": "comment_deleted", "comment_id": comment_id})
    return {"ok": True}


@router.post("/{bounty_id}/comments/{comment_id}/hide")
async def hide_comment(
    bounty_id: str,
    comment_id: str,
    user: Annotated[dict, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, bool]:
    if not _is_moderator(user["sub"], settings):
        raise HTTPException(status_code=403, detail="Moderation requires moderator privileges")
    store = get_comment_store()
    c = await store.get(comment_id)
    if not c or c.bounty_id != bounty_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    await store.hide(comment_id, bounty_id)
    await get_comment_hub().broadcast(bounty_id, {"type": "comment_hidden", "comment_id": comment_id})
    return {"ok": True}
