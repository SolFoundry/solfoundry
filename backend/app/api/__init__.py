"""API routes."""
from app.api.auth import router as auth_router
from app.api.notifications import router as notifications_router
from app.api.bounties import router as bounties_router
from app.api.websocket import router as websocket_router

__all__ = ["auth_router", "notifications_router", "bounties_router", "websocket_router"]
