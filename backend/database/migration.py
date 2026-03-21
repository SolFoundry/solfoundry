import asyncio
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path
from contextlib import asynccontextmanager

import asyncpg
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text, MetaData
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import QueuePool, NullPool

from ..config import settings
from ..models import Base

logger = logging.getLogger(__name__)

class MigrationManager:
    """Alembic migration manager with async support and zero-downtime utilities"""

    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or settings.DATABASE_URL
        self.async_database_url = self.database_url.replace('postgresql://', 'postgresql+asyncpg://')

        # Connection pool configuration
        self.pool_config = {
            'poolclass': QueuePool,
            'pool_size': 20,
            'max_overflow': 30,
            'pool_pre_ping': True,
            'pool_recycle': 3600
        }

        self._async_engine = None
        self._session_maker = None
        self.alembic_cfg = self._setup_alembic_config()

    def _setup_alembic_config(self) -> Config:
        """Initialize Alembic configuration"""
        alembic_cfg = Config()

        # Set the script location to migrations directory
        migrations_dir = Path(__file__).parent.parent / "migrations"
        migrations_dir.mkdir(exist_ok=True)

        alembic_cfg.set_main_option("script_location", str(migrations_dir))
        alembic_cfg.set_main_option("sqlalchemy.url", self.database_url)

        # Configure logging
        alembic_cfg.set_main_option("file_template", "%%(year)d%%(month).2d%%(day).2d_%%(hour).2d%%(minute).2d_%%(rev)s_%%(slug)s")

        return alembic_cfg

    @property
    def async_engine(self):
        """Get or create async engine with connection pooling"""
        if self._async_engine is None:
            self._async_engine = create_async_engine(
                self.async_database_url,
                **self.pool_config,
                echo=settings.DEBUG
            )
        return self._async_engine

    @property
    def session_maker(self):
        """Get or create async session maker"""
        if self._session_maker is None:
            self._session_maker = async_sessionmaker(
                bind=self.async_engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
        return self._session_maker

    @asynccontextmanager
    async def get_session(self):
        """Context manager for database sessions"""
        async with self.session_maker() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    async def ensure_database_exists(self) -> bool:
        """Create database if it doesn't exist"""
        try:
            # Parse database URL to get database name
            import urllib.parse
            parsed = urllib.parse.urlparse(self.database_url)
            db_name = parsed.path[1:]  # Remove leading slash

            # Connect to postgres database to create target database
            postgres_url = self.database_url.replace(f"/{db_name}", "/postgres")

            conn = await asyncpg.connect(postgres_url)
            try:
                # Check if database exists
                exists = await conn.fetchval(
                    "SELECT 1 FROM pg_database WHERE datname = $1", db_name
                )

                if not exists:
                    logger.info(f"Creating database: {db_name}")
                    await conn.execute(f'CREATE DATABASE "{db_name}"')
                    return True

                logger.info(f"Database {db_name} already exists")
                return False

            finally:
                await conn.close()

        except Exception as e:
            logger.error(f"Failed to ensure database exists: {e}")
            raise

    def create_migration(self, message: str) -> str:
        """Create a new migration file"""
        try:
            command.revision(self.alembic_cfg, autogenerate=True, message=message)
            logger.info(f"Created migration: {message}")

            # Get the latest revision
            script_dir = ScriptDirectory.from_config(self.alembic_cfg)
            return script_dir.get_current_head()

        except Exception as e:
            logger.error(f"Failed to create migration: {e}")
            raise

    async def run_migrations(self, target_revision: Optional[str] = None) -> None:
        """Run pending migrations with zero-downtime considerations"""
        try:
            logger.info("Starting database migrations...")

            # Check current migration state
            current_rev = await self.get_current_revision()
            logger.info(f"Current revision: {current_rev}")

            # Run migrations in sync context (Alembic requirement)
            sync_engine = create_engine(self.database_url, poolclass=NullPool)

            with sync_engine.begin() as connection:
                context = MigrationContext.configure(connection)

                if target_revision:
                    command.upgrade(self.alembic_cfg, target_revision)
                else:
                    command.upgrade(self.alembic_cfg, "head")

            new_rev = await self.get_current_revision()
            logger.info(f"Migrations completed. New revision: {new_rev}")

        except Exception as e:
            logger.error(f"Migration failed: {e}")
            raise

    async def get_current_revision(self) -> Optional[str]:
        """Get current database revision"""
        try:
            async with self.async_engine.begin() as conn:
                result = await conn.execute(
                    text("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1")
                )
                row = result.first()
                return row[0] if row else None

        except Exception:
            # Alembic version table doesn't exist yet
            return None

    async def rollback_migration(self, target_revision: str) -> None:
        """Rollback to a specific revision"""
        try:
            logger.warning(f"Rolling back to revision: {target_revision}")

            sync_engine = create_engine(self.database_url, poolclass=NullPool)
            with sync_engine.begin():
                command.downgrade(self.alembic_cfg, target_revision)

            logger.info(f"Rollback completed to: {target_revision}")

        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            raise

    async def validate_migration_safety(self) -> List[str]:
        """Validate that pending migrations are safe for zero-downtime deployment"""
        warnings = []

        try:
            # Check for potentially unsafe operations
            script_dir = ScriptDirectory.from_config(self.alembic_cfg)
            current = await self.get_current_revision()

            # Get pending revisions
            for revision in script_dir.walk_revisions(current, "head"):
                if revision.revision == current:
                    continue

                # Read migration file
                migration_path = script_dir.get_revision(revision.revision).path
                with open(migration_path, 'r') as f:
                    content = f.read()

                # Check for unsafe patterns
                unsafe_patterns = [
                    'DROP COLUMN',
                    'DROP TABLE',
                    'ALTER COLUMN',
                    'DROP INDEX',
                    'RENAME COLUMN',
                    'RENAME TABLE'
                ]

                for pattern in unsafe_patterns:
                    if pattern in content.upper():
                        warnings.append(f"Migration {revision.revision}: Contains potentially unsafe operation: {pattern}")

            return warnings

        except Exception as e:
            logger.error(f"Migration validation failed: {e}")
            return [f"Validation error: {e}"]

    async def create_schema_backup(self) -> str:
        """Create a backup of current schema"""
        import datetime

        backup_name = f"schema_backup_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"

        try:
            async with self.async_engine.begin() as conn:
                # Create schema dump
                await conn.execute(text(f'CREATE SCHEMA "{backup_name}"'))

                # Copy all tables to backup schema
                metadata = MetaData()
                await conn.run_sync(metadata.reflect)

                for table in metadata.tables.values():
                    backup_table = f'"{backup_name}"."{table.name}"'
                    await conn.execute(
                        text(f'CREATE TABLE {backup_table} AS SELECT * FROM "{table.name}"')
                    )

            logger.info(f"Schema backup created: {backup_name}")
            return backup_name

        except Exception as e:
            logger.error(f"Backup creation failed: {e}")
            raise

    async def seed_initial_data(self) -> None:
        """Seed database with initial data for existing bounties"""
        from ..services.bounty_service import BountyService
        from ..models.bounty import Bounty, BountySubmission
        from ..models.user import User

        try:
            logger.info("Starting data seeding...")

            async with self.get_session() as session:
                # Check if data already exists
                existing_bounties = await session.execute(text("SELECT COUNT(*) FROM bounties"))
                if existing_bounties.scalar() > 0:
                    logger.info("Data already exists, skipping seeding")
                    return

                # Seed initial bounties
                initial_bounties = self._get_initial_bounty_data()

                for bounty_data in initial_bounties:
                    bounty = Bounty(**bounty_data)
                    session.add(bounty)

                await session.commit()
                logger.info(f"Seeded {len(initial_bounties)} initial bounties")

        except Exception as e:
            logger.error(f"Data seeding failed: {e}")
            raise

    def _get_initial_bounty_data(self) -> List[Dict[str, Any]]:
        """Get initial bounty data from existing in-memory store"""
        return [
            {
                'id': '001',
                'title': 'PostgreSQL Full Migration',
                'description': 'Migrate ALL in-memory data stores to PostgreSQL',
                'reward_amount': 500000,
                'reward_token': 'FNDRY',
                'status': 'open',
                'tier': 'T2',
                'difficulty': 'high',
                'requirements': [
                    'Alembic migration scripts for all tables',
                    'Replace all in-memory dicts/lists with SQLAlchemy models',
                    'Seed script for initial data',
                    'Connection pooling with async support'
                ],
                'deadline': '2024-02-01T00:00:00Z',
                'created_by': 'system',
                'category': 'backend'
            },
            {
                'id': '002',
                'title': 'WebSocket Real-time Updates',
                'description': 'Implement real-time bounty status updates via WebSocket',
                'reward_amount': 250000,
                'reward_token': 'FNDRY',
                'status': 'open',
                'tier': 'T1',
                'difficulty': 'medium',
                'requirements': [
                    'WebSocket server integration',
                    'Real-time bounty updates',
                    'Frontend WebSocket client'
                ],
                'deadline': '2024-01-28T00:00:00Z',
                'created_by': 'system',
                'category': 'fullstack'
            }
        ]

    async def health_check(self) -> Dict[str, Any]:
        """Check database connection and migration status"""
        try:
            async with self.async_engine.begin() as conn:
                # Test connection
                result = await conn.execute(text("SELECT 1"))
                connection_ok = result.scalar() == 1

                # Check migration status
                current_rev = await self.get_current_revision()

                # Check pool status
                pool = self.async_engine.pool
                pool_status = {
                    'size': pool.size(),
                    'checked_in': pool.checkedin(),
                    'checked_out': pool.checkedout(),
                    'overflow': pool.overflow()
                }

                return {
                    'status': 'healthy' if connection_ok else 'unhealthy',
                    'connection': connection_ok,
                    'current_revision': current_rev,
                    'pool': pool_status,
                    'database_url': self.database_url.split('@')[-1]  # Hide credentials
                }

        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'connection': False
            }

    async def cleanup(self) -> None:
        """Clean up database connections"""
        if self._async_engine:
            await self._async_engine.dispose()
            logger.info("Database connections closed")

# Global migration manager instance
migration_manager = MigrationManager()

async def init_database():
    """Initialize database with migrations and seeding"""
    try:
        await migration_manager.ensure_database_exists()
        await migration_manager.run_migrations()
        await migration_manager.seed_initial_data()
        logger.info("Database initialization completed successfully")

    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

async def run_migrations():
    """Run database migrations"""
    await migration_manager.run_migrations()

async def create_migration(message: str) -> str:
    """Create new migration"""
    return migration_manager.create_migration(message)
