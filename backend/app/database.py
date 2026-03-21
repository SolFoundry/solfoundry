"""Database configuration and session management.

This module provides database connection pooling and session management
following the Unit of Work pattern. All transaction handling is done
automatically by the session context manager.
"""

import os
import logging
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

# Configure logging
logger = logging.getLogger(__name__)

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost/solfoundry"
)
if DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Connection pool settings
is_sqlite = DATABASE_URL.startswith("sqlite")
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
POOL_MAX_OVERFLOW = int(os.getenv("DB_POOL_MAX_OVERFLOW", "10"))
POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))

engine_kwargs = {
    "echo": os.getenv("SQL_ECHO", "false").lower() == "true",
}
if is_sqlite:
    # Use StaticPool for in-memory SQLite so all connections share the
    # same database — required for tests where multiple async sessions
    # must see each other's writes.
    engine_kwargs.update(
        {
            "poolclass": StaticPool,
            "connect_args": {"check_same_thread": False},
        }
    )
else:
    engine_kwargs.update(
        {
            "pool_pre_ping": True,
            "pool_size": POOL_SIZE,
            "max_overflow": POOL_MAX_OVERFLOW,
            "pool_timeout": POOL_TIMEOUT,
        }
    )

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides a database session."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            raise


@asynccontextmanager
async def get_db_session():
    """Context manager for database sessions outside of FastAPI."""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Initialize the database schema. Safe to call multiple times."""
    logger.info("Initializing database schema...")

    try:
        async with engine.begin() as conn:
            from app.models.notification import NotificationDB  # noqa: F401
            from app.models.user import User  # noqa: F401
            from app.models.bounty_table import BountyTable  # noqa: F401
            from app.models.agent import Agent  # noqa: F401
            from app.models.contributor import ContributorTable  # noqa: F401

            await conn.run_sync(Base.metadata.create_all)

            logger.info("Database schema initialized successfully")
    except Exception as e:
        logger.warning(f"Database init warning (non-fatal): {e}")
        # Non-fatal — tables may already exist. In-memory services work without DB.


async def close_db() -> None:
    """Close all database connections in the pool."""
    logger.info("Closing database connections...")
    await engine.dispose()
    logger.info("Database connections closed")
