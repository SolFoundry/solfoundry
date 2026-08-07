"""API router aggregator — mounts the email-notification endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.endpoints import notifications, webhooks

api_router = APIRouter()

api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])