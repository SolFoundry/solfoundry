# SPDX-License-Identifier: MIT

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional, Type, TypeVar, Union
import logging

import asyncpg
from pydantic import BaseModel, ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool

from backend.models.database import Base
from backend.models.bounty import BountyCreate, BountyUpdate, BountyResponse
from backend.models.contributor import ContributorCreate, ContributorUpdate, ContributorResponse
from backend.models.payout import PayoutCreate, PayoutResponse
from backend.models.submission import SubmissionCreate, SubmissionUpdate, SubmissionResponse

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseModel)

class DatabaseError(Exception):
    """Base database error"""
    pass

class ValidationError(DatabaseError):
    """Data validation error"""
    pass

class ConnectionError(DatabaseError):
    """Database connection error"""
    pass

class DatabaseService:
    """Async database service with connection pooling and transaction management"""

    def __init__(self, database_url: str, pool_size: int = 20, max_overflow: int = 40):
        self.database_url = database_url
        self.pool_size = pool_size
        self.max_overflow = max_overflow

        # Async engine for main operations
        self.async_engine = create_async_engine(
            database_url.replace('postgresql://', 'postgresql+asyncpg://'),
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=False
        )

        # Sync engine for migrations
        self.sync_engine = create_engine(
            database_url,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=True,
            pool_recycle=3600,
            poolclass=QueuePool
        )

        self.async_session_factory = async_sessionmaker(
            self.async_engine,
            class_=AsyncSession,
            expire_on_commit=False
        )

        self.session_factory = sessionmaker(
            self.sync_engine,
            class_=Session
        )

        self._connection_pool = None
        self._is_connected = False

    async def initialize(self) -> None:
        """Initialize database connections and create tables"""
        try:
            # Test async connection
            async with self.async_engine.begin() as conn:
                await conn.execute(text("SELECT 1"))

            # Create tables if they don't exist
            async with self.async_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

            self._is_connected = True
            logger.info("Database service initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize database: {str(e)}")
            raise ConnectionError(f"Database initialization failed: {str(e)}")

    async def close(self) -> None:
        """Close database connections"""
        try:
            await self.async_engine.dispose()
            self.sync_engine.dispose()
            self._is_connected = False
            logger.info("Database connections closed")
        except Exception as e:
            logger.error(f"Error closing database connections: {str(e)}")

    @asynccontextmanager
    async def session(self):
        """Async context manager for database sessions"""
        if not self._is_connected:
            raise ConnectionError("Database not initialized")

        session = self.async_session_factory()
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {str(e)}")
            raise
        finally:
            await session.close()

    @asynccontextmanager
    async def transaction(self):
        """Async context manager for transactions"""
        async with self.session() as session:
            try:
                await session.begin()
                yield session
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error(f"Transaction error: {str(e)}")
                raise

    def validate_data(self, data: Dict[str, Any], model_class: Type[T]) -> T:
        """Validate data against Pydantic model"""
        try:
            return model_class(**data)
        except ValidationError as e:
            raise ValidationError(f"Data validation failed: {str(e)}")

    async def health_check(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            async with self.session() as session:
                result = await session.execute(text("SELECT 1 as healthy"))
                row = result.fetchone()

                pool_info = {
                    'size': self.async_engine.pool.size(),
                    'checked_in': self.async_engine.pool.checkedin(),
                    'checked_out': self.async_engine.pool.checkedout(),
                    'overflow': self.async_engine.pool.overflow(),
                    'invalid': self.async_engine.pool.invalidated()
                }

                return {
                    'status': 'healthy' if row and row.healthy == 1 else 'unhealthy',
                    'pool_info': pool_info,
                    'timestamp': datetime.utcnow().isoformat()
                }
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }

    # Bounty CRUD Operations
    async def create_bounty(self, bounty_data: Dict[str, Any]) -> BountyResponse:
        """Create a new bounty"""
        validated_data = self.validate_data(bounty_data, BountyCreate)

        async with self.transaction() as session:
            from backend.models.database import Bounty

            db_bounty = Bounty(**validated_data.dict())
            session.add(db_bounty)
            await session.flush()
            await session.refresh(db_bounty)

            return BountyResponse.from_orm(db_bounty)

    async def get_bounty(self, bounty_id: int) -> Optional[BountyResponse]:
        """Get bounty by ID"""
        async with self.session() as session:
            from backend.models.database import Bounty

            result = await session.get(Bounty, bounty_id)
            return BountyResponse.from_orm(result) if result else None

    async def update_bounty(self, bounty_id: int, update_data: Dict[str, Any]) -> Optional[BountyResponse]:
        """Update bounty"""
        validated_data = self.validate_data(update_data, BountyUpdate)

        async with self.transaction() as session:
            from backend.models.database import Bounty

            bounty = await session.get(Bounty, bounty_id)
            if not bounty:
                return None

            for field, value in validated_data.dict(exclude_unset=True).items():
                setattr(bounty, field, value)

            await session.flush()
            await session.refresh(bounty)

            return BountyResponse.from_orm(bounty)

    async def list_bounties(self, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> List[BountyResponse]:
        """List bounties with pagination and filtering"""
        async with self.session() as session:
            from backend.models.database import Bounty
            from sqlalchemy import select

            query = select(Bounty)
            if status:
                query = query.where(Bounty.status == status)

            query = query.offset(skip).limit(limit)
            result = await session.execute(query)
            bounties = result.scalars().all()

            return [BountyResponse.from_orm(bounty) for bounty in bounties]

    # Contributor CRUD Operations
    async def create_contributor(self, contributor_data: Dict[str, Any]) -> ContributorResponse:
        """Create a new contributor"""
        validated_data = self.validate_data(contributor_data, ContributorCreate)

        async with self.transaction() as session:
            from backend.models.database import Contributor

            db_contributor = Contributor(**validated_data.dict())
            session.add(db_contributor)
            await session.flush()
            await session.refresh(db_contributor)

            return ContributorResponse.from_orm(db_contributor)

    async def get_contributor(self, contributor_id: int) -> Optional[ContributorResponse]:
        """Get contributor by ID"""
        async with self.session() as session:
            from backend.models.database import Contributor

            result = await session.get(Contributor, contributor_id)
            return ContributorResponse.from_orm(result) if result else None

    async def get_contributor_by_github(self, github_username: str) -> Optional[ContributorResponse]:
        """Get contributor by GitHub username"""
        async with self.session() as session:
            from backend.models.database import Contributor
            from sqlalchemy import select

            query = select(Contributor).where(Contributor.github_username == github_username)
            result = await session.execute(query)
            contributor = result.scalar_one_or_none()

            return ContributorResponse.from_orm(contributor) if contributor else None

    # Submission CRUD Operations
    async def create_submission(self, submission_data: Dict[str, Any]) -> SubmissionResponse:
        """Create a new submission"""
        validated_data = self.validate_data(submission_data, SubmissionCreate)

        async with self.transaction() as session:
            from backend.models.database import Submission

            db_submission = Submission(**validated_data.dict())
            session.add(db_submission)
            await session.flush()
            await session.refresh(db_submission)

            return SubmissionResponse.from_orm(db_submission)

    async def get_submissions_for_bounty(self, bounty_id: int) -> List[SubmissionResponse]:
        """Get all submissions for a bounty"""
        async with self.session() as session:
            from backend.models.database import Submission
            from sqlalchemy import select

            query = select(Submission).where(Submission.bounty_id == bounty_id)
            result = await session.execute(query)
            submissions = result.scalars().all()

            return [SubmissionResponse.from_orm(submission) for submission in submissions]

    # Payout Operations
    async def create_payout(self, payout_data: Dict[str, Any]) -> PayoutResponse:
        """Create a new payout"""
        validated_data = self.validate_data(payout_data, PayoutCreate)

        async with self.transaction() as session:
            from backend.models.database import Payout

            db_payout = Payout(**validated_data.dict())
            session.add(db_payout)
            await session.flush()
            await session.refresh(db_payout)

            return PayoutResponse.from_orm(db_payout)

    async def get_payouts_for_contributor(self, contributor_id: int) -> List[PayoutResponse]:
        """Get all payouts for a contributor"""
        async with self.session() as session:
            from backend.models.database import Payout
            from sqlalchemy import select

            query = select(Payout).where(Payout.contributor_id == contributor_id)
            result = await session.execute(query)
            payouts = result.scalars().all()

            return [PayoutResponse.from_orm(payout) for payout in payouts]

    # Bulk Operations
    async def bulk_create(self, model_class: Type, data_list: List[Dict[str, Any]]) -> List[Any]:
        """Bulk create records"""
        async with self.transaction() as session:
            records = [model_class(**data) for data in data_list]
            session.add_all(records)
            await session.flush()

            for record in records:
                await session.refresh(record)

            return records

    # Statistics and Analytics
    async def get_bounty_stats(self) -> Dict[str, Any]:
        """Get bounty statistics"""
        async with self.session() as session:
            from backend.models.database import Bounty
            from sqlalchemy import func, select

            total_query = select(func.count(Bounty.id))
            active_query = select(func.count(Bounty.id)).where(Bounty.status == 'active')
            completed_query = select(func.count(Bounty.id)).where(Bounty.status == 'completed')

            total_bounties = await session.scalar(total_query) or 0
            active_bounties = await session.scalar(active_query) or 0
            completed_bounties = await session.scalar(completed_query) or 0

            return {
                'total_bounties': total_bounties,
                'active_bounties': active_bounties,
                'completed_bounties': completed_bounties,
                'completion_rate': (completed_bounties / total_bounties * 100) if total_bounties > 0 else 0
            }

# Global database service instance
db_service = None

async def get_database_service() -> DatabaseService:
    """Get database service instance"""
    global db_service
    if db_service is None:
        raise RuntimeError("Database service not initialized")
    return db_service

async def initialize_database(database_url: str, pool_size: int = 20, max_overflow: int = 40) -> DatabaseService:
    """Initialize global database service"""
    global db_service
    db_service = DatabaseService(database_url, pool_size, max_overflow)
    await db_service.initialize()
    return db_service

async def close_database():
    """Close global database service"""
    global db_service
    if db_service:
        await db_service.close()
        db_service = None
