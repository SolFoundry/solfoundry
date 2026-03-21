"""GitHub webhook receiver endpoint."""

from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

from backend.app.services.webhook_service import (
    WebhookVerificationError,
    parse_event,
    verify_signature,
)

logger = logging.getLogger(__name__)

router = APIRouter()

WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")


@router.post("/github")
async def receive_github_webhook(
    request: Request,
    x_github_event: str | None = Header(None, alias="X-GitHub-Event"),
    x_hub_signature_256: str | None = Header(None, alias="X-Hub-Signature-256"),
    x_github_delivery: str | None = Header(None, alias="X-GitHub-Delivery"),
) -> JSONResponse:
    """Receive and process GitHub webhook events.

    Verifies the HMAC-SHA256 signature, then routes to the appropriate handler
    based on the X-GitHub-Event header.
    """
    payload = await request.body()

    # ── Signature verification ─────────────────────────────────────────
    if WEBHOOK_SECRET:
        try:
            verify_signature(payload, x_hub_signature_256 or "", WEBHOOK_SECRET)
        except WebhookVerificationError as exc:
            logger.warning("Webhook verification failed (delivery=%s): %s", x_github_delivery, exc)
            return JSONResponse(status_code=401, content={"error": str(exc)})
    else:
        logger.warning("GITHUB_WEBHOOK_SECRET not set — skipping verification")

    event_type = x_github_event or "unknown"

    # ── Parse and route ────────────────────────────────────────────────
    try:
        parsed: dict[str, Any] = parse_event(event_type, payload)
    except Exception as exc:
        logger.error("Failed to parse %s event (delivery=%s): %s", event_type, x_github_delivery, exc)
        return JSONResponse(status_code=422, content={"error": f"Parse error: {exc}"})

    # ── Event-specific responses ───────────────────────────────────────
    if event_type == "ping":
        logger.info("Received ping from GitHub (hook_id=%s)", parsed.get("data", {}).get("hook_id"))
        return JSONResponse(status_code=200, content={"msg": "pong"})

    logger.info(
        "Processed %s event (delivery=%s) for repo=%s",
        event_type,
        x_github_delivery,
        parsed.get("data", {}).get("repository", {}).get("full_name") if isinstance(parsed.get("data"), dict) else None,
    )

    return JSONResponse(status_code=202, content={"status": "accepted", "event": event_type})
