import os
from enum import Enum
from typing import Optional, Dict, Any
from dataclasses import dataclass


class Environment(Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


@dataclass
class DatabaseConfig:
    url: str
    pool_size: int = 10
    max_overflow: int = 20
    echo: bool = False


@dataclass
class RedisConfig:
    url: str
    decode_responses: bool = True
    socket_timeout: int = 30


@dataclass
class AuthConfig:
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7


@dataclass
class CorsConfig:
    allow_origins: list[str]
    allow_credentials: bool = True
    allow_methods: list[str] = None
    allow_headers: list[str] = None

    def __post_init__(self):
        if self.allow_methods is None:
            self.allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
        if self.allow_headers is None:
            self.allow_headers = ["*"]


@dataclass
class SolanaConfig:
    rpc_url: str
    commitment: str = "confirmed"
    timeout: int = 60


@dataclass
class APIConfig:
    environment: Environment
    debug: bool
    host: str
    port: int
    base_url: str
    api_prefix: str
    database: DatabaseConfig
    redis: RedisConfig
    auth: AuthConfig
    cors: CorsConfig
    solana: SolanaConfig
    rate_limit_per_minute: int = 60


def get_environment() -> Environment:
    env_str = os.getenv("ENVIRONMENT", "development").lower()
    try:
        return Environment(env_str)
    except ValueError:
        return Environment.DEVELOPMENT


def create_database_config(env: Environment) -> DatabaseConfig:
    if env == Environment.PRODUCTION:
        return DatabaseConfig(
            url=os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/solfoundry"),
            pool_size=20,
            max_overflow=40,
            echo=False
        )
    elif env == Environment.STAGING:
        return DatabaseConfig(
            url=os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/solfoundry_staging"),
            pool_size=15,
            max_overflow=30,
            echo=False
        )
    else:  # development
        return DatabaseConfig(
            url=os.getenv("DATABASE_URL", "postgresql://user:pass@localhost/solfoundry_dev"),
            pool_size=5,
            max_overflow=10,
            echo=os.getenv("DB_ECHO", "false").lower() == "true"
        )


def create_redis_config(env: Environment) -> RedisConfig:
    if env == Environment.PRODUCTION:
        return RedisConfig(
            url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            socket_timeout=60
        )
    elif env == Environment.STAGING:
        return RedisConfig(
            url=os.getenv("REDIS_URL", "redis://localhost:6379/1"),
            socket_timeout=45
        )
    else:  # development
        return RedisConfig(
            url=os.getenv("REDIS_URL", "redis://localhost:6379/2"),
            socket_timeout=30
        )


def create_cors_config(env: Environment) -> CorsConfig:
    if env == Environment.PRODUCTION:
        allowed_origins = os.getenv("CORS_ORIGINS", "https://solfoundry.com").split(",")
        return CorsConfig(allow_origins=[origin.strip() for origin in allowed_origins])
    elif env == Environment.STAGING:
        allowed_origins = os.getenv("CORS_ORIGINS", "https://staging.solfoundry.com,http://localhost:3000").split(",")
        return CorsConfig(allow_origins=[origin.strip() for origin in allowed_origins])
    else:  # development
        return CorsConfig(
            allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"]
        )


def create_solana_config(env: Environment) -> SolanaConfig:
    if env == Environment.PRODUCTION:
        return SolanaConfig(
            rpc_url=os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com"),
            commitment="finalized",
            timeout=90
        )
    elif env == Environment.STAGING:
        return SolanaConfig(
            rpc_url=os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
            commitment="confirmed",
            timeout=60
        )
    else:  # development
        return SolanaConfig(
            rpc_url=os.getenv("SOLANA_RPC_URL", "http://localhost:8899"),
            commitment="processed",
            timeout=30
        )


def create_api_config() -> APIConfig:
    env = get_environment()

    # Base configuration by environment
    if env == Environment.PRODUCTION:
        config_base = {
            "debug": False,
            "host": "0.0.0.0",
            "port": int(os.getenv("PORT", "8000")),
            "base_url": os.getenv("BASE_URL", "https://api.solfoundry.com"),
            "rate_limit_per_minute": 120
        }
    elif env == Environment.STAGING:
        config_base = {
            "debug": True,
            "host": "0.0.0.0",
            "port": int(os.getenv("PORT", "8001")),
            "base_url": os.getenv("BASE_URL", "https://api-staging.solfoundry.com"),
            "rate_limit_per_minute": 240
        }
    else:  # development
        config_base = {
            "debug": True,
            "host": "127.0.0.1",
            "port": int(os.getenv("PORT", "8002")),
            "base_url": os.getenv("BASE_URL", "http://localhost:8002"),
            "rate_limit_per_minute": 600
        }

    return APIConfig(
        environment=env,
        api_prefix="/api/v1",
        database=create_database_config(env),
        redis=create_redis_config(env),
        auth=AuthConfig(
            jwt_secret=os.getenv("JWT_SECRET", "dev-secret-key-change-in-production"),
            access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")),
            refresh_token_expire_days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
        ),
        cors=create_cors_config(env),
        solana=create_solana_config(env),
        **config_base
    )


# Global config instance
config = create_api_config()


def get_config() -> APIConfig:
    return config


def update_config(**kwargs: Any) -> None:
    """Update configuration at runtime (mainly for testing)"""
    global config
    for key, value in kwargs.items():
        if hasattr(config, key):
            setattr(config, key, value)
