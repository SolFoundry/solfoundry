"""SolFoundry FastAPI entry point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.enhance import router as enhance_router
from app.config import settings

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs",
)

# CORS — allow the frontend to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.cors_origins == "*" else settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(enhance_router)


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
