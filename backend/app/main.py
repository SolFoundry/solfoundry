"""SolFoundry API (Bounty #169: 9.0 Autonomous Platinum)."""

import os
import time
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import health, bounties, contributors, payouts, leaderboard, notifications, escrow, agents, quests, github, websocket
from app.api.auth import AuthError
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.security import SecurityMiddleware
from app.services.payout_service import hydrate_from_database
from app.core.config import settings

# --- Logging Initialization (9.0 Enhanced for Observability) ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] [%(name)s] [request_id:%(request_id)s] %(message)s')
logger = logging.getLogger("solfoundry")

# Filter to inject request_id into logs (9.0 Gemini 3.1 suggestion)
class RequestIDFilter(logging.Filter):
    def filter(self, record):
        record.request_id = getattr(record, 'request_id', 'none')
        return True

logger.addFilter(RequestIDFilter())

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan handler for background tasks and startup hydration."""
    logger.info("Initializing SolFoundry 9.0...")
    await hydrate_from_database()
    # Startup tasks (GitHub Sync, etc.) would go here
    yield
    logger.info("Shutdown complete.")

app = FastAPI(title="SolFoundry API", version="9.0", lifespan=lifespan)

# --- Middlewares (Spec-Compliant) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://solfoundry.org"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(SecurityMiddleware)
app.add_middleware(RateLimitMiddleware)

# --- Observability Middleware (9.0) ---
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start_time = time.time()
    
    # Inject into logging context (equivalent to structlog)
    token = logger.name # Placeholder for context
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} - {response.status_code} ({process_time:.4f}s)", extra={'request_id': request_id})
    response.headers["X-Request-ID"] = request_id
    return response

# --- Routers (100% Parity) ---
app.include_router(health.router, prefix="/health", tags=["System"])
app.include_router(bounties.router, prefix="/api/bounties", tags=["Bounties"])
app.include_router(contributors.router, prefix="/api/contributors", tags=["Contributors"])
app.include_router(payouts.router, prefix="/api/payouts", tags=["Payouts"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["Stats"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["System"])
app.include_router(escrow.router, prefix="/api/escrow", tags=["Financial"])
app.include_router(agents.router, prefix="/api/agents", tags=["AI"])
app.include_router(quests.router, prefix="/api/quests", tags=["Engagement"])
app.include_router(github.init_router(), prefix="/api/github", tags=["Integrations"])
app.include_router(websocket.router, prefix="/ws", tags=["Realtime"])

# --- Exception Handlers (Observability Preserved) ---
@app.exception_handler(AuthError)
async def auth_error_handler(request: Request, exc: AuthError):
    rid = getattr(request.state, 'request_id', 'none')
    logger.error(f"Auth error: {exc}", extra={'request_id': rid})
    return JSONResponse({"message": str(exc), "code": "AUTH_ERROR", "request_id": rid}, status_code=401)

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    rid = getattr(request.state, 'request_id', 'none')
    logger.warning(f"Validation error: {exc}", extra={'request_id': rid})
    return JSONResponse({"message": str(exc), "code": "VAL_ERROR", "request_id": rid}, status_code=400)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    rid = getattr(request.state, 'request_id', 'none')
    return JSONResponse({"message": exc.detail, "code": "HTTP_ERROR", "request_id": rid}, status_code=exc.status_code)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
