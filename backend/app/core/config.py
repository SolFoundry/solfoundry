"""Centralized application configuration managed by environment variables (Issue #161).

Provides environment-aware settings for CORS, Redis, and Rate Limiting.
"""

import os
from typing import List

# Environment: "development", "production", "test"
ENV = os.getenv("ENV", "development").lower()

# CORS: Production domains plus local dev
_default_origins = "https://solfoundry.org,https://www.solfoundry.org"
if ENV == "development":
    _default_origins += ",http://localhost:3000,http://localhost:5173"

ALLOWED_ORIGINS: List[str] = os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")

# Security config
# Default 10MB payload limit
MAX_PAYLOAD_SIZE = int(os.getenv("MAX_PAYLOAD_SIZE", 10 * 1024 * 1024))

# Rate limit defaults per group (Limit, Rate/s)
# auth: 5/min -> (5, 0.0833)
# api: 60/min -> (60, 1.0)
# webhooks: 120/min -> (120, 2.0)
RATE_LIMITS = {
    "auth_limit": int(os.getenv("RATE_LIMIT_AUTH", 5)),
    "api_limit": int(os.getenv("RATE_LIMIT_API", 60)),
    "webhooks_limit": int(os.getenv("RATE_LIMIT_WEBHOOKS", 120)),
}

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Email (Resend)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL", "SolFoundry <notifications@solfoundry.org>"
)
EMAIL_NOTIFICATIONS_ENABLED = (
    os.getenv("EMAIL_NOTIFICATIONS_ENABLED", "true").lower() == "true"
)
