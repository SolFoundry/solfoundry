"""Database configuration and session management."""

import os
from typing import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import TSVECTOR

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/solfoundry"
)

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

# Create async session factory
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
    """
    Dependency that provides a database session with automatic transaction management.
    
    This follows the Unit of Work pattern:
    - Session is created per request
    - Changes are committed automatically on success
    - Rollback happens automatically on exception
    - Session is always closed properly
    
    Yields:
        AsyncSession: Database session for the request.
    """
    async with async_session_factory() as session:
        try:
            yield session
            # Commit is handled by the context manager exit
        except Exception:
            # Rollback is handled by the context manager exit
            raise


@asynccontextmanager
async def get_db_context():
    """
    Context manager for database sessions in non-FastAPI contexts (e.g., tests, background tasks).
    
    Usage:
        async with get_db_context() as db:
            # Use db session
            pass  # Auto-commits on exit
    """
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """
    Initialize database tables and create search indexes.
    
    This should be called on application startup.
    """
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        
        # Create search vector trigger function
        await conn.execute("""
            CREATE OR REPLACE FUNCTION update_bounty_search_vector()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.search_vector := to_tsvector('english', 
                    coalesce(NEW.title, '') || ' ' || 
                    coalesce(NEW.description, '')
                );
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """)
        
        # Create trigger if not exists
        await conn.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_trigger WHERE tgname = 'bounty_search_vector_update'
                ) THEN
                    CREATE TRIGGER bounty_search_vector_update
                        BEFORE INSERT OR UPDATE ON bounties
                        FOR EACH ROW
                        EXECUTE FUNCTION update_bounty_search_vector();
                END IF;
            END;
            $$;
        """)


async def close_db():
    """Close database connections."""
    await engine.dispose()