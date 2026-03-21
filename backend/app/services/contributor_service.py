from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models.database import Contributor

class ContributorService:
    @staticmethod
    async def get_all_contributors(db: AsyncSession):
        # Querying the Postgres DB instead of a local list
        result = await db.execute(select(Contributor))
        return result.scalars().all()

    @staticmethod
    async def get_contributor_by_github_id(db: AsyncSession, github_id: int):
        result = await db.execute(
            select(Contributor).where(Contributor.github_id == github_id)
        )
        return result.scalar_one_or_none()
