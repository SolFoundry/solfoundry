"""Email notification service configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Service
    service_name: str = "solfoundry-email-notification"
    debug: bool = False

    # SMTP
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = "notifications@solfoundry.org"
    email_from_name: str = "SolFoundry"

    # SolFoundry API
    solfoundry_api_url: str = "http://backend:8000"
    solfoundry_api_token: str = ""

    # Redis (for queues and tracking)
    redis_url: str = "redis://redis:6379/0"

    # Rate limiting
    max_emails_per_minute: int = 50
    max_emails_per_hour: int = 1000

    # Bounce handling
    max_bounce_count: int = 3
    bounce_cooldown_hours: int = 24

    model_config = {"env_prefix": "EMAIL_", "env_file": ".env"}


settings = Settings()