"""FastAPI application entry point.

This module initializes the FastAPI application with:
- Structured logging with correlation IDs
- Global error handling middleware
- Health check endpoints with dependency status
- CORS middleware for cross-origin requests
- API routers for all endpoints
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.contributors import router as contributors_router
from app.api.bounties import router as bounties_router
from app.api.notifications import router as notifications_router
from app.api.leaderboard import router as leaderboard_router
from app.api.webhooks.github import router as github_webhook_router
from app.database import init_db, close_db
from app.core.logging_config import setup_logging, get_logger
from app.core.middleware import (
    ErrorHandlingMiddleware,
    CorrelationIdMiddleware,
    AccessLoggingMiddleware,
)
from app.core.health import router as health_router


# Initialize logging system
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown.
    
    Startup:
    - Initialize database connection and schema
    - Log application startup
    
    Shutdown:
    - Close database connections
    - Log application shutdown
    """
    logger.info(
        "Application starting up",
        extra={"extra_data": {
            "version": "0.1.0",
            "environment": "development",
        }}
    )
    
    try:
        # Initialize database
        await init_db()
        logger.info("Database initialized successfully")
        
        yield
        
    finally:
        # Cleanup
        logger.info("Application shutting down")
        await close_db()
        logger.info("Database connections closed")


# Create FastAPI application
app = FastAPI(
    title="SolFoundry Backend",
    description="Autonomous AI Software Factory on Solana",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
ALLOWED_ORIGINS = [
    "https://solfoundry.dev",
    "https://www.solfoundry.dev",
    "https://solfoundry.org",
    "https://www.solfoundry.org",
    "http://localhost:3000",  # Local dev only
    "http://localhost:5173",  # Vite dev server
]

# Add CORS middleware (order matters - must be before other middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-Correlation-ID",
        "X-Request-ID",
    ],
)

# Add custom middleware (order matters - last added runs first)
# 1. Correlation ID middleware - adds request tracing
app.add_middleware(CorrelationIdMiddleware)

# 2. Access logging middleware - logs all requests
app.add_middleware(AccessLoggingMiddleware)

# 3. Error handling middleware - catches all exceptions
app.add_middleware(ErrorHandlingMiddleware)


# Include API routers
app.include_router(health_router)  # Health check endpoints (no prefix)
app.include_router(contributors_router)
app.include_router(bounties_router, prefix="/api", tags=["bounties"])
app.include_router(notifications_router, prefix="/api", tags=["notifications"])
app.include_router(leaderboard_router)
app.include_router(github_webhook_router, prefix="/api/webhooks", tags=["webhooks"])


# Legacy health check endpoint (redirects to new endpoint)
@app.get("/health", deprecated=True, include_in_schema=False)
async def legacy_health_check():
    """Legacy health check - use /health/detailed for full status."""
    return {"status": "ok"}