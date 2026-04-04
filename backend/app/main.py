"""SolFoundry API — health, CORS, GitHub OAuth, JWT auth."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth_github

app = FastAPI(title="SolFoundry API", version="0.1.0")

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_github.router, prefix="/api/auth")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
