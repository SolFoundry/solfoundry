"""JWT access/refresh tokens with embedded user claims for stateless /me."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.config import Settings


def stable_user_id(github_numeric_id: int) -> str:
    """Deterministic UUID so the same GitHub user always gets the same SolFoundry id."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"https://github.com/{github_numeric_id}"))


def _now() -> datetime:
    return datetime.now(tz=UTC)


def create_access_token(settings: Settings, claims: dict[str, Any]) -> str:
    exp = _now() + timedelta(minutes=settings.access_token_minutes)
    payload = {
        **claims,
        "typ": "access",
        "exp": exp,
        "iat": _now(),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_refresh_token(settings: Settings, claims: dict[str, Any]) -> str:
    exp = _now() + timedelta(days=settings.refresh_token_days)
    payload = {
        **claims,
        "typ": "refresh",
        "exp": exp,
        "iat": _now(),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_token(settings: Settings, token: str, expected_typ: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "sub", "typ"]},
        )
    except jwt.ExpiredSignatureError as e:
        raise ValueError("Token expired") from e
    except jwt.InvalidTokenError as e:
        raise ValueError("Invalid token") from e
    if payload.get("typ") != expected_typ:
        raise ValueError("Wrong token type")
    return payload


def claims_to_user_response(claims: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": claims["sub"],
        "username": claims.get("username", "user"),
        "email": claims.get("email"),
        "avatar_url": claims.get("avatar_url"),
        "github_id": claims.get("github_id"),
        "created_at": claims.get("created_at"),
    }
