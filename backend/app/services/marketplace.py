"""Business logic for the GitHub Repo Marketplace."""
import uuid

from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RepoListing, FundingGoal, Contribution, Distribution
from app.schemas import (
    ContributionCreate, DistributionCreate, FundingGoalCreate, RepoListingCreate,
)
from app.github_client import GitHubClient


class MarketplaceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.gh = GitHubClient()

    # ── Repo Listing ──────────────────────────────────────────────────────────

    async def list_repos(
        self,
        language: str | None = None,
        min_stars: int = 0,
        search: str | None = None,
        sort_by: str = "stars",
        limit: int = 20,
        offset: int = 0,
    ) -> list[RepoListing]:
        stmt = select(RepoListing)
        if language:
            stmt = stmt.where(RepoListing.language == language)
        if min_stars > 0:
            stmt = stmt.where(RepoListing.stars >= min_stars)
        if search:
            stmt = stmt.where(
                RepoListing.name.ilike(f"%{search}%")
                | RepoListing.description.ilike(f"%{search}%")
            )
        if sort_by == "stars":
            stmt = stmt.order_by(RepoListing.stars.desc())
        elif sort_by == "name":
            stmt = stmt.order_by(RepoListing.name)
        stmt = stmt.offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def add_repo(self, data: RepoListingCreate) -> RepoListing:
        owner, name = GitHubClient.parse_repo_url(data.repo_url)
        repo = RepoListing(
            repo_url=data.repo_url,
            owner=owner,
            name=name,
            description=data.description,
            language=data.language,
            topics=data.topics or [],
        )
        # Enrich with GitHub metadata
        try:
            meta = await self.gh.get_repo_metadata(owner, name)
            repo.description = repo.description or meta.get("description")
            repo.language = repo.language or meta.get("language")
            repo.stars = meta.get("stargazers_count", 0)
            repo.topics = meta.get("topics", repo.topics)
        except Exception:
            pass  # keep minimal data if GitHub API is unavailable
        self.db.add(repo)
        await self.db.commit()
        await self.db.refresh(repo)
        return repo

    async def get_repo(self, repo_id: uuid.UUID) -> RepoListing | None:
        result = await self.db.execute(select(RepoListing).where(RepoListing.id == repo_id))
        return result.scalar_one_or_none()

    # ── Funding Goal ──────────────────────────────────────────────────────────

    async def create_funding_goal(
        self, repo_id: uuid.UUID, data: FundingGoalCreate
    ) -> FundingGoal:
        goal = FundingGoal(
            repo_listing_id=repo_id,
            title=data.title,
            description=data.description,
            target_amount=data.target_amount,
            currency=data.currency,
            deadline=data.deadline,
        )
        self.db.add(goal)
        await self.db.commit()
        await self.db.refresh(goal)
        return goal

    async def list_funding_goals(
        self, repo_id: uuid.UUID | None = None, status: str | None = None
    ) -> list[FundingGoal]:
        stmt = select(FundingGoal)
        if repo_id:
            stmt = stmt.where(FundingGoal.repo_listing_id == repo_id)
        if status:
            stmt = stmt.where(FundingGoal.status == status)
        stmt = stmt.order_by(FundingGoal.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_funding_goal_stats(self) -> dict:
        """Aggregate stats across all funding goals."""
        total_stmt = select(func.count(FundingGoal.id))
        active_stmt = select(func.count(FundingGoal.id)).where(FundingGoal.status == "active")
        raised_stmt = select(func.coalesce(func.sum(FundingGoal.raised_amount), 0))
        goal_stmt = select(func.coalesce(func.sum(FundingGoal.target_amount), 0))
        total = (await self.db.execute(total_stmt)).scalar() or 0
        active = (await self.db.execute(active_stmt)).scalar() or 0
        raised = float((await self.db.execute(raised_stmt)).scalar())
        target = float((await self.db.execute(goal_stmt)).scalar())
        return {
            "total_funding_goals": total,
            "active_funding_goals": active,
            "total_raised": raised,
            "total_target": target,
            "completion_pct": round((raised / target * 100) if target > 0 else 0, 2),
        }

    # ── Contribution ──────────────────────────────────────────────────────────

    async def contribute(self, goal_id: uuid.UUID, data: ContributionCreate) -> Contribution:
        contrib = Contribution(
            funding_goal_id=goal_id,
            contributor_address=data.contributor_address,
            amount=data.amount,
            currency=data.currency,
            message=data.message,
            transaction_signature=data.transaction_signature,
        )
        self.db.add(contrib)
        # Update raised amount
        stmt = select(FundingGoal).where(FundingGoal.id == goal_id)
        goal = (await self.db.execute(stmt)).scalar_one()
        goal.raised_amount = float(goal.raised_amount) + data.amount
        if float(goal.raised_amount) >= float(goal.target_amount):
            goal.status = "funded"
        await self.db.commit()
        await self.db.refresh(contrib)
        return contrib

    async def list_contributions(self, goal_id: uuid.UUID) -> list[Contribution]:
        stmt = (
            select(Contribution)
            .where(Contribution.funding_goal_id == goal_id)
            .order_by(Contribution.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ── Distribution (Payment) ────────────────────────────────────────────────

    async def create_distribution(
        self, goal_id: uuid.UUID, data: DistributionCreate
    ) -> Distribution:
        dist = Distribution(
            funding_goal_id=goal_id,
            recipient_address=data.recipient_address,
            amount=data.amount,
            currency=data.currency,
            milestone=data.milestone,
        )
        self.db.add(dist)
        await self.db.commit()
        await self.db.refresh(dist)
        return dist

    async def list_distributions(self, goal_id: uuid.UUID) -> list[Distribution]:
        stmt = (
            select(Distribution)
            .where(Distribution.funding_goal_id == goal_id)
            .order_by(Distribution.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def complete_distribution(self, dist_id: uuid.UUID, tx_sig: str) -> Distribution | None:
        stmt = select(Distribution).where(Distribution.id == dist_id)
        dist = (await self.db.execute(stmt)).scalar_one_or_none()
        if dist:
            dist.status = "completed"
            dist.transaction_signature = tx_sig
            await self.db.commit()
            await self.db.refresh(dist)
        return dist