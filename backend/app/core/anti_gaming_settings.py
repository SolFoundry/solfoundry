"""Configurable thresholds for anti-sybil / anti-gaming (env-driven)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


def _env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(key: str, default: float) -> float:
    raw = os.getenv(key)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class AntiGamingSettings:
    """Runtime anti-gaming configuration (no hardcoded thresholds in logic)."""

    enabled: bool
    github_min_account_age_days: int
    github_min_public_repos: int
    github_min_commit_total: int
    github_min_followers: int
    github_reject_empty_profile: bool
    max_active_claims_per_user: int
    t1_completion_cooldown_hours: float
    ip_flag_account_threshold: int
    wallet_cluster_flag_user_threshold: int
    wallet_clustering_enabled: bool
    wallet_funder_probe_max_signatures: int
    github_skip_commits_if_unavailable: bool


@lru_cache
def get_anti_gaming_settings() -> AntiGamingSettings:
    """Load settings from environment (cached; call ``reset_anti_gaming_settings_cache`` in tests)."""
    return AntiGamingSettings(
        enabled=_env_bool("ANTIGAMING_ENABLED", True),
        github_min_account_age_days=_env_int("ANTIGAMING_GITHUB_MIN_ACCOUNT_AGE_DAYS", 30),
        github_min_public_repos=_env_int("ANTIGAMING_GITHUB_MIN_PUBLIC_REPOS", 1),
        github_min_commit_total=_env_int("ANTIGAMING_GITHUB_MIN_COMMIT_TOTAL", 5),
        github_min_followers=_env_int("ANTIGAMING_GITHUB_MIN_FOLLOWERS", 0),
        github_reject_empty_profile=_env_bool("ANTIGAMING_GITHUB_REJECT_EMPTY_PROFILE", True),
        max_active_claims_per_user=_env_int("ANTIGAMING_MAX_ACTIVE_CLAIMS", 3),
        t1_completion_cooldown_hours=_env_float("ANTIGAMING_T1_COMPLETION_COOLDOWN_HOURS", 24.0),
        ip_flag_account_threshold=_env_int("ANTIGAMING_IP_FLAG_ACCOUNT_THRESHOLD", 3),
        wallet_cluster_flag_user_threshold=_env_int(
            "ANTIGAMING_WALLET_CLUSTER_FLAG_USER_THRESHOLD", 2
        ),
        wallet_clustering_enabled=_env_bool("ANTIGAMING_WALLET_CLUSTERING_ENABLED", True),
        wallet_funder_probe_max_signatures=_env_int(
            "ANTIGAMING_WALLET_FUNDER_PROBE_MAX_SIGNATURES", 25
        ),
        github_skip_commits_if_unavailable=_env_bool(
            "ANTIGAMING_GITHUB_SKIP_COMMITS_IF_UNAVAILABLE", False
        ),
    )


def reset_anti_gaming_settings_cache() -> None:
    """Clear the LRU cache (pytest / dynamic env changes)."""
    get_anti_gaming_settings.cache_clear()
