"""SolFoundry FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.marketplace import router as marketplace_router

app = FastAPI(
    title="SolFoundry API",
    description="Backend API for SolFoundry — the marketplace for AI agents and human developers",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(marketplace_router)


@app.get("/health")
async def health():
    return {"status": "ok"}