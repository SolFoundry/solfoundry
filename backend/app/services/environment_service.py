"""Environment management service for local, devnet, and mainnet configurations.

Provides a centralized system for managing deployment environment configurations
including Solana RPC endpoints, program IDs, and service URLs. Configurations
are stored in PostgreSQL and support secret masking for sensitive values.

Each environment (local, devnet, staging, mainnet) maintains its own isolated
set of configuration key-value pairs. The service ensures that secret values
are never exposed in API responses or logs.

References:
    - Solana Clusters: https://docs.solanalabs.com/clusters
    - Environment Variables Best Practices: https://12factor.net/config
"""

import logging
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline import DeploymentEnvironment
from app.services.pipeline_service import (
    get_environment_configs,
    set_environment_config,
)

logger = logging.getLogger(__name__)

# Default configurations for each environment
_DEFAULT_CONFIGS: dict[str, list[dict[str, Any]]] = {
    "local": [
        {
            "key": "SOLANA_RPC_URL",
            "value": "http://localhost:8899",
            "is_secret": False,
            "description": "Local Solana validator RPC endpoint",
        },
        {
            "key": "SOLANA_WS_URL",
            "value": "ws://localhost:8900",
            "is_secret": False,
            "description": "Local Solana validator WebSocket endpoint",
        },
        {
            "key": "DATABASE_URL",
            "value": "postgresql+asyncpg://solfoundry:solfoundry_dev@localhost:5432/solfoundry",
            "is_secret": False,
            "description": "PostgreSQL connection string for local development",
        },
        {
            "key": "REDIS_URL",
            "value": "redis://localhost:6379/0",
            "is_secret": False,
            "description": "Redis connection string for local caching and rate limiting",
        },
        {
            "key": "BACKEND_URL",
            "value": "http://localhost:8000",
            "is_secret": False,
            "description": "Backend API base URL",
        },
        {
            "key": "FRONTEND_URL",
            "value": "http://localhost:5173",
            "is_secret": False,
            "description": "Frontend development server URL",
        },
    ],
    "devnet": [
        {
            "key": "SOLANA_RPC_URL",
            "value": "https://api.devnet.solana.com",
            "is_secret": False,
            "description": "Solana devnet RPC endpoint",
        },
        {
            "key": "SOLANA_WS_URL",
            "value": "wss://api.devnet.solana.com",
            "is_secret": False,
            "description": "Solana devnet WebSocket endpoint",
        },
        {
            "key": "DATABASE_URL",
            "value": "postgresql+asyncpg://solfoundry:${DB_PASSWORD}@db.devnet.solfoundry.org:5432/solfoundry",
            "is_secret": True,
            "description": "PostgreSQL connection string for devnet staging database",
        },
        {
            "key": "REDIS_URL",
            "value": "redis://redis.devnet.solfoundry.org:6379/0",
            "is_secret": False,
            "description": "Redis connection string for devnet",
        },
        {
            "key": "BACKEND_URL",
            "value": "https://api.devnet.solfoundry.org",
            "is_secret": False,
            "description": "Backend API base URL for devnet",
        },
        {
            "key": "FRONTEND_URL",
            "value": "https://devnet.solfoundry.org",
            "is_secret": False,
            "description": "Frontend URL for devnet preview deployment",
        },
    ],
    "mainnet": [
        {
            "key": "SOLANA_RPC_URL",
            "value": "https://api.mainnet-beta.solana.com",
            "is_secret": False,
            "description": "Solana mainnet RPC endpoint",
        },
        {
            "key": "SOLANA_WS_URL",
            "value": "wss://api.mainnet-beta.solana.com",
            "is_secret": False,
            "description": "Solana mainnet WebSocket endpoint",
        },
        {
            "key": "DATABASE_URL",
            "value": "postgresql+asyncpg://solfoundry:${DB_PASSWORD}@db.solfoundry.org:5432/solfoundry",
            "is_secret": True,
            "description": "PostgreSQL connection string for production database",
        },
        {
            "key": "REDIS_URL",
            "value": "redis://redis.solfoundry.org:6379/0",
            "is_secret": True,
            "description": "Redis connection string for production",
        },
        {
            "key": "BACKEND_URL",
            "value": "https://api.solfoundry.org",
            "is_secret": False,
            "description": "Backend API base URL for production",
        },
        {
            "key": "FRONTEND_URL",
            "value": "https://solfoundry.org",
            "is_secret": False,
            "description": "Frontend URL for production",
        },
    ],
}


async def seed_default_configs(session: AsyncSession) -> dict[str, int]:
    """Seed default environment configurations for all environments.

    Populates the environment_configs table with sensible defaults for
    local, devnet, and mainnet environments. Existing entries are updated
    (upsert behavior) so this is safe to call multiple times.

    Args:
        session: Active database session for the transaction.

    Returns:
        Dictionary mapping environment names to the count of configs seeded.
    """
    counts: dict[str, int] = {}

    for env_name, configs in _DEFAULT_CONFIGS.items():
        count = 0
        for config_item in configs:
            await set_environment_config(
                session=session,
                environment=env_name,
                key=config_item["key"],
                value=config_item["value"],
                is_secret=config_item.get("is_secret", False),
                description=config_item.get("description"),
            )
            count += 1
        counts[env_name] = count

    logger.info(
        "Default environment configs seeded: %s",
        ", ".join(f"{env}={count}" for env, count in counts.items()),
    )
    return counts


async def get_environment_summary(
    session: AsyncSession,
) -> dict[str, Any]:
    """Get a summary of all environment configurations.

    Returns a dictionary mapping each environment name to its config
    count and the list of non-secret config keys. Secret values are
    masked with asterisks.

    Args:
        session: Active database session.

    Returns:
        Dictionary with environment summaries including config counts
        and masked key-value listings.
    """
    summary: dict[str, Any] = {}

    for env_name in ["local", "devnet", "staging", "mainnet"]:
        try:
            configs = await get_environment_configs(session, env_name)
        except ValueError:
            configs = []

        config_list = []
        for config_entry in configs:
            masked_value = (
                "********" if config_entry.is_secret else config_entry.value
            )
            config_list.append(
                {
                    "key": config_entry.key,
                    "value": masked_value,
                    "is_secret": bool(config_entry.is_secret),
                    "description": config_entry.description,
                }
            )

        summary[env_name] = {
            "config_count": len(configs),
            "configs": config_list,
        }

    return summary


def get_solana_cluster_for_environment(environment: str) -> str:
    """Map an environment name to its Solana cluster identifier.

    Used by deployment scripts to determine which Solana cluster to
    target for program deployments.

    Args:
        environment: Environment name (local, devnet, staging, mainnet).

    Returns:
        Solana cluster identifier string.

    Raises:
        ValueError: If the environment name is not recognized.
    """
    cluster_map = {
        "local": "localhost",
        "devnet": "devnet",
        "staging": "devnet",
        "mainnet": "mainnet-beta",
    }

    cluster = cluster_map.get(environment.lower())
    if cluster is None:
        raise ValueError(
            f"Unknown environment: {environment}. "
            f"Valid options: {', '.join(cluster_map.keys())}"
        )
    return cluster
