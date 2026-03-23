"""Database configuration and session management.

This module provides database connection pooling and session management
following the Unit of Work pattern. All transaction handling is done
automatically by the session context manager.
"""

import os
import uuid
import logging
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
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
    # same database -- required for tests where multiple async sessions
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


def reinit_engine(url: str, **kwargs):
    """Re-initialize the global engine and session factory. Used for tests."""
    global engine, async_session_factory, DATABASE_URL
    DATABASE_URL = url
    # Force StaticPool for SQLite tests
    if url.startswith("sqlite"):
        kwargs.setdefault("poolclass", StaticPool)
        kwargs.setdefault("connect_args", {"check_same_thread": False})

    engine = create_async_engine(url, **kwargs)
    async_session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


class GUID(TypeDecorator):
    """Cross-database UUID type.

    Uses PostgreSQL's native UUID type when available, falls back to
    CHAR(36) for SQLite and other databases.  Automatically converts
    between Python ``uuid.UUID`` objects and string representations.

    This ensures models using UUID primary/foreign keys work identically
    in both production (PostgreSQL) and test (SQLite) environments.
    """

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        """Select the concrete column type based on the database dialect.

        Args:
            dialect: The SQLAlchemy dialect in use.

        Returns:
            The dialect-specific column type.
        """
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        """Convert a Python value to a database-compatible format.

        Args:
            value: The Python value to bind.
            dialect: The SQLAlchemy dialect in use.

        Returns:
            The value formatted for the database.
        """
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        return str(value)

    def process_result_value(self, value, dialect):
        """Convert a database value back to a Python UUID.

        Args:
            value: The raw value from the database.
            dialect: The SQLAlchemy dialect in use.

        Returns:
            A Python ``uuid.UUID`` instance, or None.
        """
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


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
            from app.models.dispute import DisputeDB, DisputeHistoryDB  # noqa: F401
            from app.models.contributor import ContributorTable  # noqa: F401
            from app.models.submission import SubmissionDB  # noqa: F401
            from app.models.tables import (  # noqa: F401
                PayoutTable,
                BuybackTable,
                ReputationHistoryTable,
                BountySubmissionTable,
            )
            from app.models.review import AIReviewScoreDB  # noqa: F401
            from app.models.lifecycle import BountyLifecycleLogDB  # noqa: F401
            from app.models.escrow import EscrowTable, EscrowLedgerTable  # noqa: F401
            from app.models.boost import BountyBoostTable  # noqa: F401

            # NOTE: create_all is idempotent (skips existing tables). For
            # production schema changes use ``alembic upgrade head`` instead.
            await conn.run_sync(Base.metadata.create_all)

            # Log created tables for troubleshooting
            def get_tables(connection):
                from sqlalchemy import inspect

                return inspect(connection).get_table_names()

            tables = await conn.run_sync(get_tables)
            logger.info("Initialized tables: %s", tables)

            logger.info("Database schema initialized successfully")
    except Exception as e:
        logger.warning(f"Database init warning (non-fatal): {e}")
        # Non-fatal -- tables may already exist. In-memory services work without DB.


async def close_db() -> None:
    """Close all database connections in the pool."""
    logger.info("Closing database connections...")
    await engine.dispose()
    logger.info("Database connections closed")
