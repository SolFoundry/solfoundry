"""GitHub webhook receiver endpoint.

## Overview

This endpoint receives and processes GitHub webhook events for automated
bounty management and PR tracking.

## Supported Events

| Event | Description |
|-------|-------------|
| pull_request | PR opened, synchronized, closed |
| issues | Issue opened, labeled, closed |
| ping | Webhook configuration test |

## Event Processing

### pull_request Events

1. Matches PR to bounty via `Closes #N` in PR body
2. Updates bounty status based on PR state
3. Triggers review pipeline when PR is ready

### issues Events

1. Auto-creates bounty when issue gets `bounty` label
2. Extracts bounty details from issue labels and body
3. Sets tier, category, and reward based on labels

## Security

All webhooks must include a valid HMAC-SHA256 signature in the
`X-Hub-Signature-256` header. Webhooks without valid signatures
are rejected with 401 Unauthorized.

## Headers

| Header | Required | Description |
|--------|----------|-------------|
| X-GitHub-Event | Yes | Event type (pull_request, issues, ping) |
| X-Hub-Signature-256 | Yes | HMAC-SHA256 signature |
| X-GitHub-Delivery | No | Unique delivery ID for idempotency |

## Rate Limit

No rate limit for webhooks (GitHub controls the rate).
"""

import json
import os

from fastapi import APIRouter, Header, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.webhook_service import (
    WebhookVerificationError,
    verify_signature,
)
from app.services.webhook_processor import WebhookProcessor
from app.core.errors import ErrorCode, ErrorResponse
from app.core.logging_config import get_logger
from app.core.audit import audit_log, AuditAction


logger = get_logger(__name__)
router = APIRouter()

WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")


@router.post(
    "/github",
    summary="Receive GitHub webhook",
    description="""
Receive and process GitHub webhook events.

## Event Types

### pull_request

Processes pull request events:
- `opened`: New PR submitted
- `synchronize`: PR updated with new commits
- `closed`: PR merged or closed

The PR body is parsed for `Closes #N` to match to bounty issues.

### issues

Processes issue events:
- `opened` with `bounty` label: Auto-creates bounty
- `labeled`: Adds/removes bounty labels
- `closed`: Updates bounty status

### ping

Returns `pong` for webhook configuration testing.

## Signature Verification

All requests must include a valid HMAC-SHA256 signature:
```
X-Hub-Signature-256: sha256=<hex_signature>
```

The signature is computed using the webhook secret configured in GitHub.

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Event processed successfully |
| 202 | Event accepted but not handled (unknown event type) |
| 400 | Invalid JSON payload |
| 401 | Invalid or missing signature |
| 503 | Webhook secret not configured |

## Example Payload (pull_request)

```json
{
  "action": "opened",
  "pull_request": {
    "number": 42,
    "body": "Closes #123\\n\\nWallet: ABC123..."
  },
  "repository": {
    "full_name": "SolFoundry/solfoundry"
  },
  "sender": {
    "login": "contributor"
  }
}
```
""",
    responses={
        200: {
            "description": "Event processed successfully",
            "content": {
                "application/json": {
                    "examples": {
                        "pull_request": {
                            "summary": "PR processed",
                            "value": {"status": "processed", "event": "pull_request", "bounty_id": "550e8400-..."}
                        },
                        "ping": {
                            "summary": "Ping response",
                            "value": {"msg": "pong"}
                        }
                    }
                }
            }
        },
        202: {
            "description": "Event accepted but not handled",
            "content": {
                "application/json": {
                    "example": {"status": "accepted", "event": "push", "handled": False}
                }
            }
        },
        400: {
            "description": "Invalid JSON payload",
            "content": {
                "application/json": {
                    "example": {"error": "Invalid JSON"}
                }
            }
        },
        401: {
            "description": "Invalid signature",
            "content": {
                "application/json": {
                    "example": {"error": "Invalid signature"}
                }
            }
        },
        503: {
            "description": "Webhook secret not configured",
            "content": {
                "application/json": {
                    "example": {"error": "Webhook secret not configured"}
                }
            }
        }
    }
)
async def receive_github_webhook(
    request: Request,
    x_github_event: str | None = Header(None, alias="X-GitHub-Event"),
    x_hub_signature_256: str | None = Header(None, alias="X-Hub-Signature-256"),
    x_github_delivery: str | None = Header(None, alias="X-GitHub-Delivery"),
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
    client_ip = request.headers.get("x-forwarded-for", "unknown")

    # ── Signature verification (FAIL CLOSED — reject all if no secret) ──
    if not WEBHOOK_SECRET:
        logger.error(
            "GITHUB_WEBHOOK_SECRET not set — rejecting ALL webhooks (fail closed)"
        )

        # Audit log
        audit_log(
            action=AuditAction.WEBHOOK_REJECTED,
            actor="github",
            resource="webhook",
            resource_id=x_github_delivery or "unknown",
            result="failure",
            ip_address=client_ip,
            metadata={"reason": "Webhook secret not configured"},
        )

        return JSONResponse(
            status_code=503,
            content=ErrorResponse(
                error=ErrorCode.SERVICE_UNAVAILABLE,
                message="Webhook secret not configured",
                path="/webhooks/github",
            ).model_dump(mode="json", exclude_none=True),
        )

    try:
        verify_signature(payload, x_hub_signature_256 or "", WEBHOOK_SECRET)
    except WebhookVerificationError as exc:
        logger.warning(
            f"Webhook verification failed (delivery={x_github_delivery}): {exc}"
        )

        # Audit log
        audit_log(
            action=AuditAction.WEBHOOK_REJECTED,
            actor="github",
            resource="webhook",
            resource_id=x_github_delivery or "unknown",
            result="failure",
            ip_address=client_ip,
            metadata={
                "reason": str(exc),
                "event_type": x_github_event,
            },
        )

        return JSONResponse(
            status_code=401,
            content=ErrorResponse(
                error=ErrorCode.WEBHOOK_SIGNATURE_INVALID,
                message=str(exc),
                path="/webhooks/github",
            ).model_dump(mode="json", exclude_none=True),
        )

    event_type = x_github_event or "unknown"
    delivery_id = x_github_delivery or "unknown"

    logger.info(
        f"Webhook received: {event_type}",
        extra={
            "extra_data": {
                "event_type": event_type,
                "delivery_id": delivery_id,
                "client_ip": client_ip,
            }
        },
    )

    # Audit log - webhook verified
    audit_log(
        action=AuditAction.WEBHOOK_VERIFIED,
        actor="github",
        resource="webhook",
        resource_id=delivery_id,
        ip_address=client_ip,
        metadata={"event_type": event_type},
    )

    # Handle ping
    if event_type == "ping":
        logger.info(f"Received ping from GitHub (delivery={delivery_id})")
        return JSONResponse(status_code=200, content={"msg": "pong"})

    # Parse payload
    try:
        body = json.loads(payload)
    except json.JSONDecodeError as exc:
        logger.error(f"Invalid JSON payload (delivery={delivery_id}): {exc}")

        audit_log(
            action=AuditAction.WEBHOOK_FAILED,
            actor="github",
            resource="webhook",
            resource_id=delivery_id,
            result="failure",
            ip_address=client_ip,
            metadata={"reason": "Invalid JSON", "error": str(exc)},
        )

        return JSONResponse(
            status_code=400,
            content=ErrorResponse(
                error=ErrorCode.WEBHOOK_PAYLOAD_INVALID,
                message="Invalid JSON payload",
                path="/webhooks/github",
            ).model_dump(mode="json", exclude_none=True),
        )

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
                f"Processed pull_request.{action}",
                extra={
                    "extra_data": {
                        "action": action,
                        "pr_number": pr.get("number"),
                        "delivery_id": delivery_id,
                    }
                },
            )

            # Audit log
            audit_log(
                action=AuditAction.WEBHOOK_RECEIVED,
                actor=body.get("sender", {}).get("login", "unknown"),
                resource="webhook",
                resource_id=delivery_id,
                ip_address=client_ip,
                metadata={
                    "event_type": event_type,
                    "action": action,
                    "pr_number": pr.get("number"),
                    "repository": repo.get("full_name"),
                },
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
                f"Processed issues.{action}",
                extra={
                    "extra_data": {
                        "action": action,
                        "issue_number": issue.get("number"),
                        "delivery_id": delivery_id,
                    }
                },
            )

            # Audit log
            audit_log(
                action=AuditAction.WEBHOOK_RECEIVED,
                actor=body.get("sender", {}).get("login", "unknown"),
                resource="webhook",
                resource_id=delivery_id,
                ip_address=client_ip,
                metadata={
                    "event_type": event_type,
                    "action": action,
                    "issue_number": issue.get("number"),
                    "repository": repo.get("full_name"),
                },
            )

            return JSONResponse(status_code=200, content=result)

        else:
            # Unhandled event type
            logger.info(f"Unhandled event type: {event_type} (delivery={delivery_id})")
            return JSONResponse(
                status_code=202,
                content={"status": "accepted", "event": event_type, "handled": False},
            )

    except Exception as exc:
        logger.error(
            f"Error processing {event_type} event (delivery={delivery_id}): {exc}",
            exc_info=True,
            extra={
                "extra_data": {
                    "event_type": event_type,
                    "delivery_id": delivery_id,
                }
            },
        )

        # Audit log
        audit_log(
            action=AuditAction.WEBHOOK_FAILED,
            actor="github",
            resource="webhook",
            resource_id=delivery_id,
            result="failure",
            ip_address=client_ip,
            metadata={
                "event_type": event_type,
                "error": str(exc),
            },
        )

        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error=ErrorCode.INTERNAL_ERROR,
                message="Error processing webhook",
                path="/webhooks/github",
            ).model_dump(mode="json", exclude_none=True),
        )
