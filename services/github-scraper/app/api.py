"""SolFoundry GitHub Issue Scraper — API routes."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from .config import settings
from .models import HealthResponse, ScrapeRequest, ScrapeResult, WebhookPayload
from .scraper import GitHubClient, ScraperService

logger = logging.getLogger(__name__)

router = APIRouter()
scraper = ScraperService()


@router.get("/health", response_model=HealthResponse)
async def health_check() -> dict[str, Any]:
    """Health check endpoint."""
    stats = scraper.stats
    return {
        "status": "ok",
        "service": settings.service_name,
        "scraped_repos": stats["scraped_repos"],
        "issues_posted": stats["issues_posted"],
        "last_scrape": stats["last_scrape"],
    }


@router.post("/scrape", response_model=ScrapeResult)
async def scrape_repository(request: ScrapeRequest) -> ScrapeResult:
    """Scrape a GitHub repository for bounty-worthy issues."""
    if not request.owner or not request.repo:
        raise HTTPException(status_code=400, detail="owner and repo are required")

    result = await scraper.scrape_repo(
        owner=request.owner,
        repo=request.repo,
        labels=request.labels,
        since=request.since,
    )
    return result


@router.post("/scrape/all")
async def scrape_all_repos() -> dict[str, Any]:
    """Scrape all configured repositories."""
    repos_str = settings.default_repos
    if not repos_str:
        return {"status": "no_repos_configured", "message": "Set SCRAPER_DEFAULT_REPOS env var"}

    repos = [r.strip() for r in repos_str.split(",") if r.strip()]
    results = []
    for repo_full in repos:
        parts = repo_full.split("/")
        if len(parts) != 2:
            continue
        owner, repo = parts
        try:
            result = await scraper.scrape_repo(owner, repo)
            results.append(result.dict())
        except Exception as e:
            logger.error("Failed to scrape %s/%s: %s", owner, repo, e)
            results.append({"repo": repo_full, "error": str(e)})

    return {
        "status": "completed",
        "repos_scraped": len(results),
        "results": results,
        "last_scrape": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/webhook")
async def handle_webhook(request: Request) -> dict[str, Any]:
    """Handle GitHub webhook events for issue updates."""
    payload_bytes = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    event = request.headers.get("X-GitHub-Event", "")

    if event not in ("issues", "issues.opened", "issues.labeled"):
        return {"status": "ignored", "event": event}

    # Verify webhook signature if configured
    webhook_secret = settings.github_token
    if webhook_secret:
        gh = GitHubClient()
        valid = await gh.verify_webhook(payload_bytes, signature, webhook_secret)
        if not valid:
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json
    payload = WebhookPayload(**json.loads(payload_bytes))

    if payload.action == "opened" and payload.issue:
        # Auto-scrape the newly opened issue
        repo_full = payload.repository.get("full_name", "") if payload.repository else ""
        if repo_full:
            parts = repo_full.split("/")
            if len(parts) == 2:
                result = await scraper.scrape_repo(parts[0], parts[1])
                return {"status": "processed", "result": result.dict()}

    return {"status": "acknowledged", "event": event, "action": payload.action}


@router.get("/stats")
async def get_stats() -> dict[str, Any]:
    """Get scraper statistics."""
    return scraper.stats