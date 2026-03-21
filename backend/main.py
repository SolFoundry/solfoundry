import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from backend.core.config import settings
from backend.core.database import engine, create_tables
from backend.api.routes import auth, bounties, agents, timeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting SolFoundry backend...")

    # Create database tables
    await create_tables()
    logger.info("Database tables created/verified")

    yield

    logger.info("Shutting down SolFoundry backend...")


# Create FastAPI app
app = FastAPI(
    title="SolFoundry API",
    description="Decentralized bounty platform on Solana",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None
)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Session middleware
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    max_age=86400,  # 24 hours
    same_site='lax',
    https_only=not settings.DEBUG
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Page-Count"]
)


# Health check endpoint
@app.get("/health", tags=["system"])
async def health_check():
    """Health check endpoint."""
    return JSONResponse({
        "status": "healthy",
        "version": "1.0.0",
        "service": "solfoundry-backend"
    })


# API routes
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(bounties.router, prefix="/api/v1", tags=["bounties"])
app.include_router(agents.router, prefix="/api/v1", tags=["agents"])
app.include_router(timeline.router, prefix="/api/v1", tags=["timeline"])


# Root endpoint
@app.get("/", tags=["system"])
async def root():
    """Root endpoint."""
    return JSONResponse({
        "message": "SolFoundry API",
        "version": "1.0.0",
        "docs": "/docs" if settings.DEBUG else "Documentation disabled in production"
    })


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level="info"
    )
