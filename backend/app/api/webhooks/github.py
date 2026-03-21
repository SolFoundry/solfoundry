"""GitHub webhook receiver endpoint."""

from __future__ import annotations

import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, Header, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.webhook_service import (
    WebhookVerificationError,
    verify_signature,
)
from app.services.webhook_processor import WebhookProcessor
from app.core.audit import audit_log

logger = logging.getLogger(__name__)

router = APIRouter()

WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")


@router.post("/github")
async def receive_github_webhook(
    request: Request,
    x_github_event: Optional[str] = Header(None, alias="X-GitHub-Event"),
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
    x_github_delivery: Optional[str] = Header(None, alias="X-GitHub-Delivery"),
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    """
    Receive and process GitHub webhook events.

    Verifies HMAC-SHA256 signature, then processes based on event type:
    - pull_request: Match to bounty, update status
    - issues: Auto-create bounty on label

    Headers:
    - X-GitHub-Event: Event type (pull_request, issues, push, ping)
    - X-Hub-Signature-256: HMAC signature
    - X-GitHub-Delivery: Unique delivery ID for idempotency
    """
    payload = await request.body()

    # ── Signature verification (FAIL CLOSED — reject all if no secret) ──
    if not WEBHOOK_SECRET:
        logger.error(
            "GITHUB_WEBHOOK_SECRET not set — rejecting ALL webhooks (fail closed)"
        )
        return JSONResponse(
            status_code=503, content={"error": "Webhook secret not configured"}
        )

    try:
        verify_signature(payload, x_hub_signature_256 or "", WEBHOOK_SECRET)
    except WebhookVerificationError as exc:
        logger.warning(
            "Webhook verification failed (delivery=%s): %s", x_github_delivery, exc
        )
        return JSONResponse(status_code=401, content={"error": str(exc)})

    event_type = x_github_event or "unknown"
    delivery_id = x_github_delivery or "unknown"

    # Handle ping
    if event_type == "ping":
        logger.info("Received ping from GitHub (delivery=%s)", delivery_id)
        return JSONResponse(status_code=200, content={"msg": "pong"})

    # Parse payload
    try:
        body = json.loads(payload)
    except json.JSONDecodeError as exc:
        logger.error("Invalid JSON payload (delivery=%s): %s", delivery_id, exc)
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    # Process event
    processor = WebhookProcessor(db)

    try:
        if event_type == "pull_request":
            action = body.get("action", "")
            pr = body.get("pull_request", {})
            repo = body.get("repository", {})

            result = await processor.process_pull_request(
                action=action,
                pr_number=pr.get("number", 0),
                pr_body=pr.get("body"),
                repository=repo.get("full_name", ""),
                sender=body.get("sender", {}).get("login", ""),
                delivery_id=delivery_id,
                payload=payload,
            )

            logger.info(
                "Processed pull_request.%s (PR #%d, delivery=%s)",
                action,
                pr.get("number"),
                delivery_id,
            )
            audit_log(
                "webhook.pull_request", "webhook",
                resource_id=delivery_id,
                details={"action": action, "pr_number": pr.get("number"), "repo": repo.get("full_name")},
            )

            return JSONResponse(status_code=200, content=result)

        elif event_type == "issues":
            action = body.get("action", "")
            issue = body.get("issue", {})
            repo = body.get("repository", {})
            labels = issue.get("labels", [])

            result = await processor.process_issues(
                action=action,
                issue_number=issue.get("number", 0),
                issue_title=issue.get("title", ""),
                issue_body=issue.get("body"),
                labels=labels,
                repository=repo.get("full_name", ""),
                sender=body.get("sender", {}).get("login", ""),
                delivery_id=delivery_id,
                payload=payload,
            )

            logger.info(
                "Processed issues.%s (issue #%d, delivery=%s)",
                action,
                issue.get("number"),
                delivery_id,
            )
            audit_log(
                "webhook.issues", "webhook",
                resource_id=delivery_id,
                details={"action": action, "issue_number": issue.get("number"), "repo": repo.get("full_name")},
            )
            return JSONResponse(status_code=200, content=result)

        else:
            # Unhandled event type
            logger.info(
                "Unhandled event type: %s (delivery=%s)", event_type, delivery_id
            )
            return JSONResponse(
                status_code=202,
                content={"status": "accepted", "event": event_type, "handled": False},
            )

    except Exception as exc:
        logger.error(
            "Error processing %s event (delivery=%s): %s", event_type, delivery_id, exc
        )
        return JSONResponse(status_code=500, content={"error": str(exc)})
