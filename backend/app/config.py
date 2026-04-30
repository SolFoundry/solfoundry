import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "SolFoundry API"
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "sk-6fd286b54a804231a7f90d7f2de57540")
    deepseek_base_url: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    openrouter_base_url: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")


settings = Settings()
