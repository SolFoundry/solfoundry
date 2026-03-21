import os
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional
import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
import logging

logger = logging.getLogger(__name__)


class DatabaseConfig:
    """Database configuration settings"""

    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/solfoundry")
        self.test_database_url = os.getenv("TEST_DATABASE_URL", "postgresql://postgres:password@localhost:5432/solfoundry_test")
        self.pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
        self.max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "20"))
        self.pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))
        self.pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "3600"))
        self.echo = os.getenv("DB_ECHO", "false").lower() == "true"
        self.enable_logging = os.getenv("DB_LOGGING", "true").lower() == "true"

    @property
    def is_testing(self) -> bool:
        return os.getenv("TESTING", "false").lower() == "true"

    def get_database_url(self) -> str:
        """Get appropriate database URL based on environment"""
        return self.test_database_url if self.is_testing else self.database_url


# Global database configuration
db_config = DatabaseConfig()

# Database engine with connection pooling
engine = create_async_engine(
    db_config.get_database_url(),
    pool_size=db_config.pool_size,
    max_overflow=db_config.max_overflow,
    pool_timeout=db_config.pool_timeout,
    pool_recycle=db_config.pool_recycle,
    echo=db_config.echo,
    poolclass=NullPool if db_config.is_testing else None,
    future=True
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session with automatic cleanup"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db():
    """Dependency for FastAPI route handlers"""
    async with get_db_session() as session:
        yield session


async def check_database_connection() -> bool:
    """Check if database connection is healthy"""
    try:
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")
        logger.info("Database connection successful")
        return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False


async def close_database_connections():
    """Close all database connections"""
    try:
        await engine.dispose()
        logger.info("Database connections closed")
    except Exception as e:
        logger.error(f"Error closing database connections: {e}")


async def create_database_if_not_exists():
    """Create database if it doesn't exist"""
    db_url = db_config.get_database_url()

    # Parse database name from URL
    db_name = db_url.split("/")[-1]
    base_url = db_url.rsplit("/", 1)[0]

    try:
        # Connect to postgres database to create target database
        conn = await asyncpg.connect(base_url + "/postgres")
        try:
            # Check if database exists
            result = await conn.fetchval(
                "SELECT 1 FROM pg_database WHERE datname = $1", db_name
            )

            if not result:
                await conn.execute(f'CREATE DATABASE "{db_name}"')
                logger.info(f"Created database: {db_name}")
            else:
                logger.info(f"Database already exists: {db_name}")

        finally:
            await conn.close()

    except Exception as e:
        logger.error(f"Failed to create database {db_name}: {e}")
        raise


class DatabaseManager:
    """Database connection manager with health checks"""

    def __init__(self):
        self._engine = engine
        self._session_factory = AsyncSessionLocal
        self._health_check_interval = 30
        self._health_check_task: Optional[asyncio.Task] = None

    async def start_health_checks(self):
        """Start periodic database health checks"""
        if self._health_check_task is None:
            self._health_check_task = asyncio.create_task(self._periodic_health_check())

    async def stop_health_checks(self):
        """Stop periodic database health checks"""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
            self._health_check_task = None

    async def _periodic_health_check(self):
        """Perform periodic database health checks"""
        while True:
            try:
                await asyncio.sleep(self._health_check_interval)
                healthy = await check_database_connection()
                if not healthy:
                    logger.warning("Database health check failed")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check error: {e}")

    async def get_session(self) -> AsyncSession:
        """Get a new database session"""
        return self._session_factory()

    async def close(self):
        """Close database manager"""
        await self.stop_health_checks()
        await close_database_connections()


# Global database manager instance
db_manager = DatabaseManager()
