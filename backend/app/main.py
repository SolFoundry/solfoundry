"""SolFoundry API — health, CORS, GitHub OAuth, JWT auth, bounty comments."""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth_github, comments
from app.ws.comment_hub import get_comment_hub

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
app.include_router(comments.router, prefix="/api/bounties")


@app.websocket("/ws/bounties/{bounty_id}/comments")
async def bounty_comments_websocket(websocket: WebSocket, bounty_id: str) -> None:
    """Subscribe to real-time comment_created / comment_hidden / comment_deleted for a bounty."""
    hub = get_comment_hub()
    await hub.connect(bounty_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(bounty_id, websocket)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
