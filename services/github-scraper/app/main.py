"""GitHub Issue Scraper for SolFoundry Bounties — FastAPI Application."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.services.github_client import GitHubClient
from app.services.solfoundry_client import SolFoundryClient
from app.services.import_store import ImportStore
from app.services.repo_config import RepoConfigManager
from app.services.scraper_service import ScraperService
from app.services.webhook_handler import WebhookHandler
from app.services.scheduler import ScrapingScheduler
from app.api import scraper as scraper_api
from app.api import webhooks as webhook_api

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Global service instances (initialized in lifespan)
# ---------------------------------------------------------------------------

github_client = GitHubClient()
solfoundry_client = SolFoundryClient()
import_store = ImportStore(database_url=settings.database_url)
repo_manager = RepoConfigManager(config_path=settings.repo_config_path)
webhook_handler = WebhookHandler(webhook_secret=settings.github_webhook_secret)
scraper_service = ScraperService(
    github_client=github_client,
    solfoundry_client=solfoundry_client,
    import_store=import_store,
)
scheduler = ScrapingScheduler(interval_seconds=settings.scraping_interval_seconds)


async def _run_scheduled_scrape() -> None:
    """Callback for the periodic scheduler."""
    repos = repo_manager.list_repos(enabled_only=True)
    result = await scraper_service.scrape_all(repos)
    logger.info("Scheduled scrape: %s", result.message)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — start/stop services."""
    logger.info("Starting GitHub Issue Scraper service")

    # Wire up API dependencies
    scraper_api.configure(repo_manager, scraper_service, scheduler, import_store)
    webhook_api.configure(webhook_handler, repo_manager, scraper_service)

    # Start scheduler if enabled
    if settings.scraping_enabled:
        scheduler.set_callback(_run_scheduled_scrape)
        await scheduler.start()
        logger.info("Periodic scraping enabled (every %ds)", settings.scraping_interval_seconds)
    else:
        logger.info("Periodic scraping disabled")

    yield

    # Shutdown
    logger.info("Shutting down GitHub Issue Scraper")
    await scheduler.stop()
    await github_client.close()
    await solfoundry_client.close()


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="SolFoundry GitHub Issue Scraper",
    description=(
        "Automatically scrapes GitHub issues from configured repositories "
        "and posts them as SolFoundry bounties with appropriate reward tiers."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Register routers
app.include_router(scraper_api.router)
app.include_router(webhook_api.router)


@app.get("/health")
async def health():
    """Health check endpoint."""
    sf_healthy = await solfoundry_client.health()
    repos = repo_manager.list_repos(enabled_only=True)
    return {
        "status": "healthy" if sf_healthy else "degraded",
        "version": "1.0.0",
        "solfoundry_api": "reachable" if sf_healthy else "unreachable",
        "repos_watched": len(repos),
        "scheduler": "running" if scheduler.is_running else "stopped",
    }