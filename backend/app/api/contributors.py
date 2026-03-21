from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from ..db import SessionLocal
from ..models.database import Contributor
from ..models.schemas import ContributorRead
from sqlalchemy import select

router = APIRouter()

# Dependency to get the database session
async def get_db():
    async with SessionLocal() as session:
        yield session

@router.get("/", response_model=List[ContributorRead])
async def list_contributors(db: AsyncSession = Depends(get_db)):
    """
    Fetch all contributors from PostgreSQL.
    Requirement: Zero downtime migration path (Schema stays compatible)
    """
    result = await db.execute(select(Contributor))
    contributors = result.scalars().all()
    return contributors

@router.get("/{github_id}", response_model=ContributorRead)
async def get_contributor(github_id: int, db: AsyncSession = Depends(get_db)):
    """
    Fetch a single contributor by their GitHub ID.
    """
    result = await db.execute(
        select(Contributor).where(Contributor.github_id == github_id)
    )
    contributor = result.scalar_one_or_none()
    if not contributor:
        raise HTTPException(status_code=44, detail="Contributor not found")
    return contributor
