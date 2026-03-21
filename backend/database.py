import sqlite3
import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Default database path
DATABASE_PATH = Path(__file__).parent / "solfoundry.db"

def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Get a database connection with proper configuration."""
    path = db_path or str(DATABASE_PATH)
    conn = sqlite3.Connection(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()

def create_tables():
    """Create all database tables if they don't exist."""
    with get_db() as conn:
        # Users table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                github_username TEXT UNIQUE NOT NULL,
                solana_address TEXT,
                telegram_id INTEGER,
                reputation_score INTEGER DEFAULT 0,
                tier_completions INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Bounties table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS bounties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                issue_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                reward_amount INTEGER NOT NULL,
                tier TEXT NOT NULL,
                status TEXT DEFAULT 'open',
                assigned_user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assigned_user_id) REFERENCES users (id)
            )
        """)

        # Agents table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                config TEXT,
                last_activity TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Payouts table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS payouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bounty_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                transaction_hash TEXT,
                solscan_url TEXT,
                retry_count INTEGER DEFAULT 0,
                admin_approved BOOLEAN DEFAULT FALSE,
                pr_number INTEGER,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                confirmed_at TIMESTAMP,
                FOREIGN KEY (bounty_id) REFERENCES bounties (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)

        # Create indexes for better performance
        conn.execute("CREATE INDEX IF NOT EXISTS idx_users_github ON users (github_username)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties (status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bounties_issue ON bounties (issue_number)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts (status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts (user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_payouts_bounty ON payouts (bounty_id)")

        conn.commit()
        logger.info("Database tables created successfully")

def init_database():
    """Initialize the database with required tables."""
    try:
        create_tables()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise

if __name__ == "__main__":
    init_database()
