"""Application settings from environment variables."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # GitHub OAuth
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:5173/auth/callback"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://solfoundry:solfoundry@localhost:5432/solfoundry"

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"

    # GitHub API
    GITHUB_API_URL: str = "https://api.github.com"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
