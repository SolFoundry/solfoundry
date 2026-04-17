"""GitHub webhook endpoint."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request

from app.models import RepoConfig
from app.services.repo_config import RepoConfigManager
from app.services.scraper_service import ScraperService
from app.services.webhook_handler import WebhookHandler

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhooks"])

_webhook_handler: Optional[WebhookHandler] = None
_repo_manager: Optional[RepoConfigManager] = None
_scraper_service: Optional[ScraperService] = None


def configure(
    webhook_handler: WebhookHandler,
    repo_manager: RepoConfigManager,
    scraper_service: ScraperService,
) -> None:
    global _webhook_handler, _repo_manager, _scraper_service
    _webhook_handler = webhook_handler
    _repo_manager = repo_manager
    _scraper_service = scraper_service


@router.post("/api/webhooks/github")
async def github_webhook(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None),
    x_github_event: Optional[str] = Header(None),
):
    """Receive and process GitHub webhook events.

    Supported events: issues, label, milestone, ping.
    """
    body = await request.body()

    # Verify HMAC signature
    if not _webhook_handler.verify_signature(body, x_hub_signature_256 or ""):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Handle ping event (GitHub sends this when webhook is created)
    if x_github_event == "ping":
        return {"message": "pong"}

    # Parse the payload
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = _webhook_handler.parse_event(payload)
    if event is None:
        return {"message": "Event not processable"}

    # Only process events with issues
    if event.issue is None:
        return {"message": f"Event type '{x_github_event}/{event.action}' has no issue"}

    # Check if the repo is in our watch list
    repo_config = _repo_manager.get_repo(event.repo_owner, event.repo_name)
    if repo_config is None:
        # Auto-add the repo with defaults if it sent a webhook
        logger.info(
            "Received webhook from unwatched repo %s/%s — auto-adding",
            event.repo_owner,
            event.repo_name,
        )
        repo_config = RepoConfig(
            owner=event.repo_owner,
            repo=event.repo_name,
        )
        _repo_manager.add_repo(repo_config)

    # Process the issue
    bounty_id = await _scraper_service.process_webhook_issue(
        repo_config, event.issue, event.action
    )

    return {
        "message": f"Processed {x_github_event}/{event.action}",
        "issue": event.issue.number,
        "bounty_id": bounty_id,
    }