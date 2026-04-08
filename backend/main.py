"""SolFoundry FastAPI entrypoint (monorepo stub; production API lives in solfoundry-api)."""

from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.analytics import router as analytics_router

app = FastAPI(
    title="SolFoundry API",
    description="Bounty analytics and health endpoints for local / Docker dev.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics_router, prefix="/api")


@app.get("/")
def read_root() -> Dict[str, str]:
    return {"message": "Welcome to the Bounty Analytics Dashboard API"}


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok"}
