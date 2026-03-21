"""Alembic async environment for PostgreSQL migrations (Issue #162)."""

import asyncio
import os
from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from app.database import Base
from app.models.tables import PayoutTable, BuybackTable, ReputationHistoryTable  # noqa: F401
from app.models.contributor import ContributorDB  # noqa: F401

target_metadata = Base.metadata
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost/solfoundry")


def run_migrations_offline() -> None:
    """Generate SQL without a live connection."""
    context.configure(url=DATABASE_URL, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live async database."""
    engine = create_async_engine(DATABASE_URL, poolclass=pool.NullPool)
    async with engine.connect() as conn:
        await conn.run_sync(
            lambda c: context.configure(connection=c, target_metadata=target_metadata))
        await conn.run_sync(lambda c: context.run_migrations())
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
