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

# Auth state
AUTH_ENABLED = os.getenv("AUTH_ENABLED", "true").lower() == "true"

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

# Persistence & Performance
MAX_DB_LOAD_LIMIT = int(os.getenv("MAX_DB_LOAD_LIMIT", "100000"))

# Blockchain & External URLs
SOLANA_RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
GITHUB_API_URL = os.getenv("GITHUB_API_URL", "https://api.github.com")
SOLSCAN_BASE_URL = os.getenv("SOLSCAN_BASE_URL", "https://solscan.io/tx/")

# Health Check Settings
HEALTH_CHECK_TIMEOUT = float(os.getenv("HEALTH_CHECK_TIMEOUT", "0.20"))
DISK_PARTITION = os.getenv("HEALTH_DISK_PARTITION", "/")

# Token Names
TOKEN_FNDRY = "FNDRY"
TOKEN_SOL = "SOL"

# Reputation & Quality Scoring
QUALITY_SCORE_MIN_BASE = 5.0
QUALITY_SCORE_THRESHOLD = 80.0
QUALITY_SCORE_WEIGHT_BOOST = 2.0
QUALITY_SCORE_REPUTATION_WEIGHT = 20.0

# Email (Resend)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
DEFAULT_FROM_EMAIL = os.getenv(
    "DEFAULT_FROM_EMAIL", "SolFoundry <notifications@solfoundry.org>"
)
EMAIL_NOTIFICATIONS_ENABLED = (
    os.getenv("EMAIL_NOTIFICATIONS_ENABLED", "true").lower() == "true"
)
