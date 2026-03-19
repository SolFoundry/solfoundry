"""GitHub webhook service — signature verification and event routing."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any

from app.models.webhook import EVENT_MODEL_MAP

logger = logging.getLogger(__name__)


class WebhookVerificationError(Exception):
    """Raised when HMAC signature verification fails."""


def verify_signature(payload: bytes, signature_header: str, secret: str) -> None:
    """Verify X-Hub-Signature-256 against payload using HMAC-SHA256."""
    if not signature_header:
        raise WebhookVerificationError("Missing X-Hub-Signature-256 header")

    if not signature_header.startswith("sha256="):
        raise WebhookVerificationError(f"Invalid signature format: {signature_header[:20]}")

    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"), payload, hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected, signature_header):
        raise WebhookVerificationError("HMAC signature mismatch")


def parse_event(event_type: str, payload: bytes) -> dict[str, Any]:
    """Parse and validate a webhook payload into the appropriate Pydantic model."""
    body = json.loads(payload)

    model_cls = EVENT_MODEL_MAP.get(event_type)
    if model_cls is None:
        logger.info("Unhandled event type: %s", event_type)
        return {"event_type": event_type, "data": body}

    validated = model_cls.model_validate(body)
    logger.info(
        "Parsed %s event for repo %s",
        event_type,
        getattr(getattr(validated, "repository", None), "full_name", "unknown"),
    )
    return {"event_type": event_type, "data": validated.model_dump()}
