from fastapi import FastAPI

from app.api import bounty_notifications


app = FastAPI(title="SolFoundry Backend", version="0.1.0")
app.include_router(bounty_notifications.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
