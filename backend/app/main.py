"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db
from app.api import auth_router, notifications_router, bounties_router, websocket_router
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    await init_db()
    
    # Initialize search vectors and index
    from app.database import async_session_maker
    from app.services.search import search_service
    
    async with async_session_maker() as session:
        try:
            await search_service.create_search_index(session)
        except Exception:
            pass  # Index might already exist
    
    yield
    
    # Shutdown
    pass


app = FastAPI(
    title=settings.APP_NAME,
    description="SolFoundry Backend API - Authentication, Notifications, Bounty Search, and Real-time WebSocket",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(bounties_router, prefix="/api/v1")
app.include_router(websocket_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
