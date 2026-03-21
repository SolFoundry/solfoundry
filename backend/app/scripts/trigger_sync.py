import asyncio
import os
import logging
from app.services.github_sync import sync_all
from app.database import init_db

# Configure logging to see output
logging.basicConfig(level=logging.INFO)

async def main():
    print("Initializing DB...")
    await init_db()
    print("Running full sync from GitHub...")
    result = await sync_all()
    print(f"Sync complete: {result}")

if __name__ == "__main__":
    asyncio.run(main())
