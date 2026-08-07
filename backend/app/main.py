"""SolFoundry email notification backend.

FastAPI application that serves the notification endpoints:

  GET    /api/notifications/preferences
  PUT    /api/notifications/preferences
  POST   /api/notifications/send
  POST   /api/webhooks/sendgrid/events
  GET    /health

Wire this into the private SolFoundry API backend (SolFoundry/solfoundry-api)
by mounting ``app.main:app`` or by including the notifications router directly.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router


def build_app() -> FastAPI:
    app = FastAPI(
        title="SolFoundry Email Notifications",
        version="0.1.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api")

    @app.get("/health")
    async def health():
        return {"status": "ok", "service": "solfoundry-notifications"}

    return app


app = build_app()