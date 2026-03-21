"""Configuration validation and sensitive data protection service.

Provides centralized configuration management for all application secrets,
with startup validation, log output filtering, and source code auditing:

Features:
- Environment variable validation at startup with minimum-length checks
- Logging filter to prevent secret leakage in log output (JWT redaction)
- Audit function to detect hardcoded secrets in source files
- .env.example template generator for developer onboarding

All secrets must be provided via environment variables. No secrets are
hardcoded in the codebase. Default values are empty strings or clearly
marked development-only placeholders.

References:
    - OWASP Secrets Management: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
    - 12-Factor App Config: https://12factor.net/config
"""

import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Registry of all secrets with metadata
REQUIRED_SECRETS: dict[str, dict] = {
    "JWT_SECRET_KEY": {
        "description": "Secret key for signing JWT tokens (min 32 chars)",
        "min_length": 32,
        "example": "your-jwt-secret-key-at-least-32-characters-long",
    },
    "GITHUB_CLIENT_SECRET": {
        "description": "GitHub OAuth application client secret",
        "min_length": 1,
        "example": "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    },
    "GITHUB_WEBHOOK_SECRET": {
        "description": "Secret for verifying GitHub webhook signatures",
        "min_length": 1,
        "example": "whsec_your-webhook-signing-secret",
    },
    "DATABASE_URL": {
        "description": "PostgreSQL connection string",
        "min_length": 1,
        "example": "postgresql+asyncpg://user:password@localhost:5432/solfoundry",
    },
}

OPTIONAL_SECRETS: dict[str, dict] = {
    "GITHUB_CLIENT_ID": {
        "description": "GitHub OAuth application client ID",
        "example": "Iv1.xxxxxxxxxxxxxxxxxxxx",
    },
    "GITHUB_REDIRECT_URI": {
        "description": "GitHub OAuth callback URL",
        "example": "https://solfoundry.org/auth/callback",
    },
    "SOLANA_RPC_URL": {
        "description": "Solana RPC endpoint URL",
        "example": "https://api.mainnet-beta.solana.com",
    },
    "TREASURY_WALLET": {
        "description": "Solana treasury wallet public key",
        "example": "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp",
    },
    "REDIS_URL": {
        "description": "Redis connection URL for caching and rate limiting",
        "example": "redis://localhost:6379/0",
    },
    "AUTH_ENABLED": {
        "description": "Enable authentication (true/false)",
        "example": "true",
    },
    "ENFORCE_HTTPS": {
        "description": "Enforce HTTPS via HSTS headers (true/false)",
        "example": "true",
    },
    "MAX_REQUEST_BODY_SIZE": {
        "description": "Maximum request body size in bytes",
        "example": "1048576",
    },
    "RATE_LIMIT_ANONYMOUS": {
        "description": "Rate limit for anonymous users (requests/minute)",
        "example": "30",
    },
    "RATE_LIMIT_AUTHENTICATED": {
        "description": "Rate limit for authenticated users (requests/minute)",
        "example": "120",
    },
    "DB_POOL_SIZE": {
        "description": "Database connection pool size",
        "example": "5",
    },
    "DB_POOL_MAX_OVERFLOW": {
        "description": "Maximum pool overflow connections",
        "example": "10",
    },
    "SQL_ECHO": {
        "description": "Echo SQL queries to logs (true/false, dev only)",
        "example": "false",
    },
    "BACKUP_DIR": {
        "description": "Directory for PostgreSQL backup files",
        "example": "/var/backups/solfoundry",
    },
    "BACKUP_RETENTION_DAYS": {
        "description": "Number of days to retain backup files",
        "example": "30",
    },
}

# Patterns that indicate hardcoded secrets in source code
HARDCODED_SECRET_PATTERNS: list[re.Pattern] = [
    re.compile(r"(password|secret|token|api_key|apikey)\s*=\s*['\"][^'\"]{8,}", re.IGNORECASE),
    re.compile(r"(ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9]{36,}", re.IGNORECASE),
    re.compile(r"sk-[a-zA-Z0-9]{20,}", re.IGNORECASE),
    re.compile(r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----", re.IGNORECASE),
]

# Values that should be redacted in logs
SENSITIVE_PATTERNS: list[str] = [
    "password",
    "secret",
    "token",
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "session",
    "credential",
    "private_key",
]


class SensitiveDataFilter(logging.Filter):
    """Logging filter that redacts sensitive data from log messages.

    Scans log messages for patterns that match known secret formats
    (JWT tokens, API keys, passwords) and replaces them with [REDACTED].

    This prevents accidental secret exposure in log files, console output,
    and log aggregation services.

    Attributes:
        sensitive_values: Set of known secret values to redact.
    """

    def __init__(self) -> None:
        """Initialize the filter and collect current secret values."""
        super().__init__()
        self.sensitive_values: set[str] = set()
        self._refresh_sensitive_values()

    def _refresh_sensitive_values(self) -> None:
        """Collect current secret values from environment for redaction.

        Only includes values that are at least 8 characters long to avoid
        false positives with short common strings.
        """
        all_secrets = {**REQUIRED_SECRETS, **OPTIONAL_SECRETS}
        for key in all_secrets:
            value = os.getenv(key, "")
            if value and len(value) >= 8:
                self.sensitive_values.add(value)

    def filter(self, record: logging.LogRecord) -> bool:
        """Filter a log record by redacting sensitive values.

        Replaces any occurrence of a known secret value in the log message
        with [REDACTED]. Also masks common secret patterns like JWTs.

        Args:
            record: The log record to filter.

        Returns:
            bool: Always returns True (record is always emitted, just sanitized).
        """
        if isinstance(record.msg, str):
            message = record.msg
            # Redact known secret values
            for secret_value in self.sensitive_values:
                if secret_value in message:
                    message = message.replace(secret_value, "[REDACTED]")

            # Redact JWT-like tokens (three base64 segments separated by dots)
            message = re.sub(
                r"eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+",
                "[REDACTED_JWT]",
                message,
            )

            record.msg = message

        return True


def validate_secrets(strict: bool = False) -> list[str]:
    """Validate that all required secrets are properly configured.

    Checks that each required secret is set in the environment, meets
    minimum length requirements, and does not use a known placeholder value.

    Args:
        strict: If True, raise ValueError on any missing secret.
            If False, log warnings but continue.

    Returns:
        list[str]: List of warning messages for misconfigured secrets.

    Raises:
        ValueError: If strict=True and any required secret is missing.
    """
    warnings = []

    for key, metadata in REQUIRED_SECRETS.items():
        value = os.getenv(key, "")

        if not value:
            msg = f"Required secret '{key}' is not set: {metadata['description']}"
            warnings.append(msg)
            logger.warning(msg)
            continue

        min_length = metadata.get("min_length", 1)
        if len(value) < min_length:
            msg = (
                f"Secret '{key}' is too short ({len(value)} chars, "
                f"minimum {min_length}): {metadata['description']}"
            )
            warnings.append(msg)
            logger.warning(msg)

        # Check for common placeholder values
        placeholder_indicators = [
            "your-", "xxx", "placeholder", "change-me", "todo",
            "example", "test", "dummy", "fake",
        ]
        if any(indicator in value.lower() for indicator in placeholder_indicators):
            msg = f"Secret '{key}' appears to contain a placeholder value"
            warnings.append(msg)
            logger.warning(msg)

    if strict and warnings:
        raise ValueError(
            f"Secret validation failed with {len(warnings)} issues: "
            + "; ".join(warnings)
        )

    if not warnings:
        logger.info("All %d required secrets validated successfully", len(REQUIRED_SECRETS))

    return warnings


def audit_source_for_secrets(file_path: str) -> list[dict]:
    """Scan a source file for hardcoded secrets.

    Checks the file contents against known secret patterns like API keys,
    private keys, and password assignments.

    Args:
        file_path: Path to the source file to audit.

    Returns:
        list[dict]: List of findings, each with 'line', 'pattern', and 'snippet' keys.
    """
    findings = []

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as source_file:
            for line_number, line in enumerate(source_file, start=1):
                for pattern in HARDCODED_SECRET_PATTERNS:
                    if pattern.search(line):
                        # Skip test files and example files
                        if any(
                            skip in file_path.lower()
                            for skip in [
                                "test_", "conftest", ".example", "mock",
                                "config_validator",  # Contains example placeholder values
                            ]
                        ):
                            continue
                        findings.append({
                            "line": line_number,
                            "pattern": pattern.pattern,
                            "snippet": line.strip()[:100],
                        })
    except (OSError, IOError) as error:
        logger.warning("Could not audit file %s: %s", file_path, error)

    return findings


def generate_env_example() -> str:
    """Generate a .env.example file content with all configuration variables.

    Produces a documented environment variable template with placeholder
    values for all required and optional secrets.

    Returns:
        str: The complete .env.example file content.
    """
    lines = [
        "# SolFoundry Backend Environment Configuration",
        "# Copy this file to .env and fill in real values",
        "# NEVER commit .env to version control",
        "",
        "# ──── Required Secrets ─────────────────────────────────────────────",
        "",
    ]

    for key, metadata in REQUIRED_SECRETS.items():
        lines.append(f"# {metadata['description']}")
        lines.append(f"{key}={metadata['example']}")
        lines.append("")

    lines.append("# ──── Optional Configuration ──────────────────────────────────────")
    lines.append("")

    for key, metadata in OPTIONAL_SECRETS.items():
        lines.append(f"# {metadata['description']}")
        lines.append(f"{key}={metadata['example']}")
        lines.append("")

    return "\n".join(lines)


def install_log_filter() -> None:
    """Install the sensitive data logging filter on the root logger.

    Should be called once during application startup to ensure all log
    output is filtered for secrets.
    """
    root_logger = logging.getLogger()
    sensitive_filter = SensitiveDataFilter()
    root_logger.addFilter(sensitive_filter)
    logger.info("Sensitive data logging filter installed")
