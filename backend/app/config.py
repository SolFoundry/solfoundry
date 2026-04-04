"""Application settings (env-driven)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str = "change-me-in-production"
    env: str = "development"

    github_client_id: str = ""
    github_client_secret: str = ""
    oauth_redirect_uri: str = "http://localhost:5173/auth/github/callback"
    oauth_state_max_age_seconds: int = 600

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    access_token_minutes: int = 15
    refresh_token_days: int = 7

    # Bounty comments — moderation (JWT `sub` values, comma-separated)
    moderator_user_ids: str = ""
    comment_rate_limit: int = 10
    comment_rate_window_seconds: int = 60
    comment_max_thread_depth: int = 8

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def oauth_configured(self) -> bool:
        return bool(self.github_client_id and self.github_client_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
