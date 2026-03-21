import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost/solfoundry"
)
if DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

async def main():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        try:
            u_count = (await conn.execute(text("SELECT count(*) FROM users"))).scalar()
            s_count = (await conn.execute(text("SELECT count(*) FROM submissions"))).scalar()
            print(f"Users: {u_count}, Submissions: {s_count}")
        except Exception as e:
            print(f"Error: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
