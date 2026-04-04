"""Bearer JWT dependency for protected routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.config import Settings, get_settings
from app.services.tokens import decode_token


def get_current_user(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict:
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = auth[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        return decode_token(settings, token, "access")
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
