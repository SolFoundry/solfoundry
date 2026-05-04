"""CLI interface for the GitHub Issue Scraper."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

from github_scraper.models.config import ScraperConfig
from github_scraper.models.issue import BountyMapping
from github_scraper.services.scraper import GitHubScraper
from github_scraper.services.poster import SolFoundryPoster
from github_scraper.services.webhook import WebhookServer
from github_scraper.utils.tier_classifier import TierClassifier


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


async def run_scrape(config: ScraperConfig, dry_run: bool = False) -> list[BountyMapping]:
    """Run a single scrape cycle."""
    scraper = GitHubScraper(config)
    classifier = TierClassifier()
    poster = SolFoundryPoster(
        api_url=config.solfoundry_api_url,
        api_key=config.solfoundry_api_key,
    )

    try:
        issues = await scraper.scrape_all()
        mappings: list[BountyMapping] = []

        for issue in issues:
            tier = classifier.classify(issue)
            reward = classifier.get_reward(tier)

            mapping = BountyMapping(
                issue=issue,
                tier=tier,
                reward=reward,
                title=f"[{tier.value}] {issue.title}",
                description=f"Auto-scraped from {issue.html_url}\n\n{issue.body[:500]}",
                domain=_infer_domain(issue),
            )
            mappings.append(mapping)

        if dry_run:
            for m in mappings:
                print(f"  [{m.tier.value}] {m.reward:20s} | {m.issue.source_repo}#{m.issue.issue_number} | {m.issue.title[:60]}")
            print(f"\nTotal: {len(mappings)} bounties (dry run, not posted)")
        else:
            results = await poster.post_batch(mappings)
            posted = sum(1 for r in results if r is not None)
            print(f"Posted: {posted}/{len(mappings)} bounties")

        return mappings
    finally:
        await scraper.close()
        await poster.close()


def _infer_domain(issue) -> str:
    """Infer the bounty domain from issue labels."""
    labels_str = " ".join(issue.labels).lower()
    if any(kw in labels_str for kw in ["frontend", "ui", "css", "react", "design"]):
        return "Frontend"
    if any(kw in labels_str for kw in ["backend", "api", "server", "database"]):
        return "Backend"
    if any(kw in labels_str for kw in ["infra", "devops", "ci", "deploy"]):
        return "Infrastructure"
    if any(kw in labels_str for kw in ["security", "auth", "vulnerability"]):
        return "Security"
    if any(kw in labels_str for kw in ["docs", "documentation"]):
        return "Documentation"
    return "Backend"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="SolFoundry GitHub Issue Scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--config", "-c",
        type=Path,
        default=Path("config/scraper.yaml"),
        help="Path to config YAML file",
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Scrape but don't post to SolFoundry",
    )
    parser.add_argument(
        "--webhook", "-w",
        action="store_true",
        help="Start webhook server instead of one-shot scrape",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level",
    )
    args = parser.parse_args()

    setup_logging(args.log_level)

    if not args.config.exists():
        print(f"Config file not found: {args.config}", file=sys.stderr)
        print("Create one with: github-scraper init", file=sys.stderr)
        sys.exit(1)

    config = ScraperConfig.from_yaml(args.config)

    if args.webhook:
        # Start webhook server
        webhook = WebhookServer(config)
        print(f"Webhook server on port {config.webhook_port}")
        # In production, this would use a proper ASGI server
    else:
        asyncio.run(run_scrape(config, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
