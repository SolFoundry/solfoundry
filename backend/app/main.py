"""SolFoundry API (Sovereign 14.0 Reconstruction).

Central FastAPI application with integrated security, rate limiting, and 
unified persistence for payouts and treasury operations.
"""

import os
import time
import uuid
import logging
from typing import Callable, Any

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, payouts, buybacks, bounties, leaderboard, auth, stats
from app.middleware.security import SecurityHeadersMiddleware, IPBlocklistMiddleware, ContentLimitMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.services.health import monitor

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
log = logging.getLogger(__name__)

app = FastAPI(
    title="SolFoundry API",
    description="Sovereign Absolute Reconstruction (14.0)",
    version="1.0.0",
)

# 1. Standard Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Security & Rate Limiting (Phase 11.0 / 14.0)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(IPBlocklistMiddleware)
app.add_middleware(ContentLimitMiddleware)
app.add_middleware(RateLimitMiddleware)

# 3. Request ID & Timing Middleware
@app.middleware("http")
async def add_request_id_and_timing(request: Request, call_next: Callable):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = str(process_time)
    
    # Track metrics in health monitor
    monitor.track_request(
        path=request.url.path, 
        method=request.method, 
        status_code=response.status_code, 
        duration=process_time
    )
    
    return response

# 4. Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("Unhandled error for %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": getattr(request.state, "request_id", None)}
    )

# 5. Router Registration (Restoring All Missing Routers)
app.include_router(health.router, prefix="/api", tags=["system"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(payouts.router, prefix="/api/payouts", tags=["payouts"])
app.include_router(buybacks.router, prefix="/api/buybacks", tags=["treasury"])
app.include_router(bounties.router, prefix="/api/bounties", tags=["bounties"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])

@app.on_event("startup")
async def startup_event():
    log.info("Sovereign 14.0 API Starting up...")
    monitor.start()

@app.on_event("shutdown")
async def shutdown_event():
    log.info("Sovereign 14.0 API Shutting down...")
    monitor.stop()

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
