"""Alembic async environment configuration (Issue #162).

Reads DATABASE_URL from the environment and imports all ORM models
so that autogenerate can detect schema changes.
"""

import asyncio
import os

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from app.database import Base

# Import all models so metadata reflects every table
from app.models.tables import (
    PayoutTable,  # noqa: F401
    BuybackTable,  # noqa: F401
    ReputationHistoryTable,  # noqa: F401
    BountySubmissionTable,  # noqa: F401
)  # noqa: F401
from app.models.contributor import ContributorDB  # noqa: F401
from app.models.bounty_table import BountyTable  # noqa: F401
from app.models.submission import SubmissionDB  # noqa: F401
from app.models.user import User  # noqa: F401

target_metadata = Base.metadata

DB_URL = os.getenv(
    "DATABASE_URL",
    context.config.get_main_option("sqlalchemy.url", ""),
)


def run_offline_migrations() -> None:
    """Run migrations in offline mode (SQL script generation)."""
    context.configure(
        url=DB_URL,
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_online_migrations() -> None:
    """Run migrations against a live async database connection."""
    engine = create_async_engine(DB_URL, poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(
            lambda conn: context.configure(
                connection=conn, target_metadata=target_metadata
            )
        )
        await connection.run_sync(lambda conn: context.run_migrations())
    await engine.dispose()


if context.is_offline_mode():
    run_offline_migrations()
else:
    asyncio.run(run_online_migrations())
