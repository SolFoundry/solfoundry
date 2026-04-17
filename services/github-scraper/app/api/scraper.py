"""Scraper API endpoints — repo management, trigger, status, history."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models import (
    AddRepoRequest,
    AddRepoResponse,
    ImportRecord,
    RepoConfig,
    ScraperStatus,
    TriggerScrapeResponse,
)
from app.services.repo_config import RepoConfigManager
from app.services.scraper_service import ScraperService
from app.services.scheduler import ScrapingScheduler
from app.services.import_store import ImportStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scraper", tags=["scraper"])

# These are set by the main app at startup
_repo_manager: Optional[RepoConfigManager] = None
_scraper_service: Optional[ScraperService] = None
_scheduler: Optional[ScrapingScheduler] = None
_import_store: Optional[ImportStore] = None


def configure(
    repo_manager: RepoConfigManager,
    scraper_service: ScraperService,
    scheduler: ScrapingScheduler,
    import_store: ImportStore,
) -> None:
    global _repo_manager, _scraper_service, _scheduler, _import_store
    _repo_manager = repo_manager
    _scraper_service = scraper_service
    _scheduler = scheduler
    _import_store = import_store


@router.get("/repos", response_model=list[RepoConfig])
async def list_repos(enabled_only: bool = Query(default=False)):
    """List all watched repositories."""
    return _repo_manager.list_repos(enabled_only=enabled_only)


@router.post("/repos", response_model=AddRepoResponse)
async def add_repo(request: AddRepoRequest):
    """Add a repository to the watch list."""
    config = RepoConfig(
        owner=request.owner,
        repo=request.repo,
        default_tier=request.default_tier,
        category=request.category,
        enabled=request.enabled,
    )
    _repo_manager.add_repo(config)
    return AddRepoResponse(
        message=f"Added {request.owner}/{request.repo}",
        repo=config,
    )


@router.delete("/repos/{owner}/{repo}")
async def remove_repo(owner: str, repo: str):
    """Remove a repository from the watch list."""
    if _repo_manager.remove_repo(owner, repo):
        return {"message": f"Removed {owner}/{repo}"}
    raise HTTPException(status_code=404, detail=f"Repository {owner}/{repo} not found")


@router.post("/trigger", response_model=TriggerScrapeResponse)
async def trigger_scrape():
    """Manually trigger a scrape of all enabled repositories."""
    repos = _repo_manager.list_repos(enabled_only=True)
    result = await _scraper_service.scrape_all(repos)
    return result


@router.get("/status", response_model=ScraperStatus)
async def scraper_status():
    """Get scraper status and last run info."""
    total = await _import_store.count()
    repos = _repo_manager.list_repos()
    return ScraperStatus(
        enabled=_scheduler.is_running if _scheduler else False,
        interval_seconds=_scheduler.interval_seconds if _scheduler else 0,
        last_run=_scraper_service.last_run,
        next_run=_scheduler.next_run if _scheduler else None,
        repos_watched=len([r for r in repos if r.enabled]),
        total_imported=total,
    )


@router.get("/history", response_model=list[ImportRecord])
async def import_history(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    status: Optional[str] = Query(default=None),
):
    """Get import history."""
    return await _import_store.list_records(limit=limit, offset=offset, status=status)