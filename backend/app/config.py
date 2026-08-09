from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://solfoundry:solfoundry_dev@localhost:5432/solfoundry"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-in-production"
    github_token: str = ""
    github_webhook_secret: str = ""
    solana_rpc_url: str = "https://api.devnet.solana.com"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()