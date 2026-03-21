"""Alembic async env (Issue #162). Reads DATABASE_URL from os.getenv."""
import asyncio, os
from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from app.database import Base
from app.models.tables import PayoutTable, BuybackTable, ReputationHistoryTable  # noqa
from app.models.contributor import ContributorDB  # noqa
from app.models.bounty_table import BountyTable  # noqa
target_metadata = Base.metadata
DB = os.getenv("DATABASE_URL", context.config.get_main_option("sqlalchemy.url", ""))
def offline():
    context.configure(url=DB, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction(): context.run_migrations()
async def online():
    e = create_async_engine(DB, poolclass=pool.NullPool)
    async with e.connect() as c:
        await c.run_sync(lambda cn: context.configure(connection=cn, target_metadata=target_metadata))
        await c.run_sync(lambda cn: context.run_migrations())
    await e.dispose()
if context.is_offline_mode(): offline()
else: asyncio.run(online())
