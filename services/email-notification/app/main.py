"""SolFoundry Email Notification Service — FastAPI application."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router
from .config import settings

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifecycle ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle handler."""
    logger.info(
        "Starting %s (SMTP: %s:%d, TLS: %s)",
        settings.service_name,
        settings.smtp_host,
        settings.smtp_port,
        settings.smtp_use_tls,
    )
    yield
    logger.info("Shutting down %s", settings.service_name)


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SolFoundry Email Notification Service",
    description="Handles email notifications for bounty events, user preferences, and digest emails.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins in dev; restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)


# ── Root ─────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "service": settings.service_name,
        "version": "1.0.0",
        "docs": "/docs",
    }