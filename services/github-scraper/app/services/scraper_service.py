"""Core scraper service — orchestrates GitHub scraping and bounty creation."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from app.models import (
    BountyCreateRequest,
    GitHubIssue,
    ImportRecord,
    ImportStatus,
    RepoConfig,
    TriggerScrapeResponse,
)
from app.services.github_client import GitHubClient
from app.services.solfoundry_client import SolFoundryClient
from app.services.import_store import ImportStore

logger = logging.getLogger(__name__)


class ScraperService:
    """Orchestrates GitHub issue scraping and SolFoundry bounty creation."""

    def __init__(
        self,
        github_client: GitHubClient,
        solfoundry_client: SolFoundryClient,
        import_store: ImportStore,
    ):
        self.github = github_client
        self.solfoundry = solfoundry_client
        self.store = import_store
        self.last_run: Optional[datetime] = None

    async def scrape_repo(self, repo_config: RepoConfig) -> TriggerScrapeResponse:
        """Scrape a single repository for bounty issues."""
        result = TriggerScrapeResponse(
            message=f"Scraping {repo_config.full_name}",
            issues_found=0,
            bounties_created=0,
            bounties_skipped=0,
            errors=0,
        )

        # Determine which labels to filter by
        bounty_label = None
        for key, val in repo_config.label_mapping.items():
            if val is True:
                bounty_label = key
                break

        try:
            issues = await self.github.list_issues(
                owner=repo_config.owner,
                repo=repo_config.repo,
                labels=bounty_label,
                per_page=100,
            )
        except Exception as e:
            logger.error("Failed to fetch issues from %s: %s", repo_config.full_name, e)
            result.message = f"Error fetching issues: {e}"
            result.errors = 1
            return result

        result.issues_found = len(issues)

        for issue in issues:
            try:
                created = await self._process_issue(issue, repo_config)
                if created is True:
                    result.bounties_created += 1
                elif created is False:
                    result.bounties_skipped += 1
            except Exception as e:
                logger.error(
                    "Error processing issue %s#%d: %s",
                    repo_config.full_name,
                    issue.number,
                    e,
                )
                result.errors += 1

        result.message = (
            f"Scraped {repo_config.full_name}: "
            f"{result.issues_found} issues, "
            f"{result.bounties_created} created, "
            f"{result.bounties_skipped} skipped, "
            f"{result.errors} errors"
        )
        return result

    async def scrape_all(self, repos: list[RepoConfig]) -> TriggerScrapeResponse:
        """Scrape all enabled repositories."""
        total = TriggerScrapeResponse(message="Scrape all repos")

        for repo in repos:
            if not repo.enabled:
                continue
            result = await self.scrape_repo(repo)
            total.issues_found += result.issues_found
            total.bounties_created += result.bounties_created
            total.bounties_skipped += result.bounties_skipped
            total.errors += result.errors

        self.last_run = datetime.now(timezone.utc)
        total.message = (
            f"Full scrape complete: "
            f"{total.issues_found} issues, "
            f"{total.bounties_created} created, "
            f"{total.bounties_skipped} skipped, "
            f"{total.errors} errors"
        )
        return total

    async def process_webhook_issue(
        self,
        repo_config: RepoConfig,
        issue: GitHubIssue,
        action: str,
    ) -> Optional[str]:
        """Process a single issue from a webhook event.

        Returns the bounty ID if created/updated, None if skipped.
        """
        # For "closed" issues, check if we need to update existing bounty
        if action == "closed" or action == "deleted":
            existing = await self.store.get_by_issue(
                repo_config.owner, repo_config.repo, issue.number
            )
            if existing and existing.bounty_id:
                try:
                    await self.solfoundry.update_bounty(existing.bounty_id, {"status": "completed"})
                    existing.status = ImportStatus.UPDATED
                    await self.store.save(existing)
                    logger.info("Marked bounty %s as completed (issue closed)", existing.bounty_id)
                    return existing.bounty_id
                except Exception as e:
                    logger.error("Failed to update bounty on issue close: %s", e)
            return None

        # For opened/edited/reopened/labeled — process as potential new bounty
        created = await self._process_issue(issue, repo_config)
        if created is True:
            existing = await self.store.get_by_issue(
                repo_config.owner, repo_config.repo, issue.number
            )
            return existing.bounty_id if existing else None
        return None

    async def _process_issue(self, issue: GitHubIssue, repo_config: RepoConfig) -> Optional[bool]:
        """Process a single issue: determine tier, check dedup, create bounty.

        Returns:
            True — bounty created
            False — skipped (already imported or not a bounty)
            None — error
        """
        # Check if already imported
        existing = await self.store.get_by_issue(
            repo_config.owner, repo_config.repo, issue.number
        )
        if existing and existing.status in (ImportStatus.IMPORTED, ImportStatus.UPDATED):
            logger.debug(
                "Skipping %s#%d — already imported as %s",
                repo_config.full_name,
                issue.number,
                existing.bounty_id,
            )
            return False

        # Check if issue has the bounty label
        if not repo_config.has_bounty_label(issue.labels):
            logger.debug(
                "Skipping %s#%d — no bounty label", repo_config.full_name, issue.number
            )
            return False

        # Determine tier and reward
        tier = repo_config.get_tier(issue.labels)
        reward = repo_config.get_reward(tier)

        # Extract skills from labels (non-tier, non-bounty labels)
        skills = []
        for label in issue.labels:
            lower = label.lower().strip()
            if lower in ("bounty",) or lower.startswith("tier-"):
                continue
            # Skip boolean-mapped labels
            mapped = repo_config.label_mapping.get(lower)
            if mapped is True or isinstance(mapped, int):
                continue
            skills.append(label)

        # Build description
        description = issue.body or ""
        if issue.milestone:
            description = f"**Milestone:** {issue.milestone}\n\n{description}"

        # Create bounty via SolFoundry API
        bounty_request = BountyCreateRequest(
            title=issue.title,
            description=description[:5000] if description else "",
            tier=tier,
            category=repo_config.category,
            reward_amount=reward,
            required_skills=skills[:10],
            github_issue_url=issue.html_url,
            created_by="github-scraper",
        )

        try:
            result = await self.solfoundry.create_bounty(bounty_request)
            bounty_id = result.get("id", "")

            # Save import record
            record = ImportRecord(
                repo_owner=repo_config.owner,
                repo_name=repo_config.repo,
                issue_number=issue.number,
                issue_url=issue.html_url,
                bounty_id=bounty_id,
                tier=tier,
                reward_amount=reward,
                status=ImportStatus.IMPORTED,
                imported_at=datetime.now(timezone.utc),
            )
            await self.store.save(record)

            logger.info(
                "Created bounty %s for %s#%d (T%d, %d $FNDRY)",
                bounty_id,
                repo_config.full_name,
                issue.number,
                tier,
                reward,
            )
            return True

        except Exception as e:
            logger.error(
                "Failed to create bounty for %s#%d: %s",
                repo_config.full_name,
                issue.number,
                e,
            )

            # Record failure
            record = ImportRecord(
                repo_owner=repo_config.owner,
                repo_name=repo_config.repo,
                issue_number=issue.number,
                issue_url=issue.html_url,
                tier=tier,
                reward_amount=reward,
                status=ImportStatus.FAILED,
                error_message=str(e)[:500],
            )
            await self.store.save(record)
            return None