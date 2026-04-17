"""Scheduler for periodic GitHub scraping."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Callable, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)


class ScrapingScheduler:
    """Manages periodic scraping jobs using APScheduler."""

    def __init__(self, interval_seconds: int = 1800):
        self.interval_seconds = interval_seconds
        self._scheduler = AsyncIOScheduler()
        self._scrape_callback: Optional[Callable] = None
        self._running = False
        self._next_run: Optional[datetime] = None

    def set_callback(self, callback: Callable) -> None:
        """Set the async callback to invoke on each scrape cycle."""
        self._scrape_callback = callback

    async def start(self) -> None:
        """Start the periodic scraping scheduler."""
        if self._running:
            return

        if self._scrape_callback is None:
            logger.warning("No scrape callback set, scheduler not starting")
            return

        self._scheduler.add_job(
            self._run_scrape,
            "interval",
            seconds=self.interval_seconds,
            id="github_scrape",
            replace_existing=True,
            next_run_time=datetime.now(timezone.utc),
        )
        self._scheduler.start()
        self._running = True
        logger.info("Scraper scheduler started (interval: %ds)", self.interval_seconds)

    async def _run_scrape(self) -> None:
        """Execute the scrape callback with error handling."""
        if self._scrape_callback is None:
            return

        try:
            logger.info("Running scheduled scrape...")
            await self._scrape_callback()
            # Update next run time
            jobs = self._scheduler.get_jobs()
            for job in jobs:
                if job.id == "github_scrape":
                    self._next_run = job.next_run_time
                    break
        except Exception as e:
            logger.error("Scheduled scrape failed: %s", e, exc_info=True)

    async def stop(self) -> None:
        """Stop the scheduler."""
        if self._running:
            self._scheduler.shutdown(wait=False)
            self._running = False
            logger.info("Scraper scheduler stopped")

    @property
    def next_run(self) -> Optional[datetime]:
        jobs = self._scheduler.get_jobs()
        for job in jobs:
            if job.id == "github_scrape":
                return job.next_run_time
        return None

    @property
    def is_running(self) -> bool:
        return self._running