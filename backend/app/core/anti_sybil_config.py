"""Configurable thresholds for the anti-sybil and anti-gaming system.

All values are loaded from environment variables so they can be tuned
in production without a code change or redeploy.
"""

import os


def _int(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


def _float(name: str, default: float) -> float:
    return float(os.getenv(name, str(default)))


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).lower() in ("1", "true", "yes")


# ---------------------------------------------------------------------------
# GitHub account quality thresholds
# ---------------------------------------------------------------------------

#: Minimum account age in days before a GitHub user is allowed to register.
GITHUB_MIN_AGE_DAYS: int = _int("SYBIL_GITHUB_MIN_AGE_DAYS", 30)

#: Minimum number of public repositories (including forks) on the account.
GITHUB_MIN_PUBLIC_REPOS: int = _int("SYBIL_GITHUB_MIN_PUBLIC_REPOS", 1)

#: Minimum combined followers + following count (basic activity signal).
GITHUB_MIN_SOCIAL_SCORE: int = _int("SYBIL_GITHUB_MIN_SOCIAL_SCORE", 0)

#: Hard-block registrations that fail the age check (vs. soft-flag only).
GITHUB_AGE_HARD_BLOCK: bool = _bool("SYBIL_GITHUB_AGE_HARD_BLOCK", True)

#: Hard-block registrations that fail the activity check.
GITHUB_ACTIVITY_HARD_BLOCK: bool = _bool("SYBIL_GITHUB_ACTIVITY_HARD_BLOCK", False)

# ---------------------------------------------------------------------------
# Wallet clustering thresholds
# ---------------------------------------------------------------------------

#: Number of accounts sharing the same wallet funding source before flagging.
WALLET_CLUSTER_FLAG_THRESHOLD: int = _int("SYBIL_WALLET_CLUSTER_THRESHOLD", 2)

# ---------------------------------------------------------------------------
# Bounty claim / farming thresholds
# ---------------------------------------------------------------------------

#: Maximum concurrent active claims (IN_PROGRESS + UNDER_REVIEW) per contributor.
MAX_ACTIVE_CLAIMS: int = _int("SYBIL_MAX_ACTIVE_CLAIMS", 3)

#: Minimum hours between T1 bounty completions (anti-farming cooldown).
T1_COOLDOWN_HOURS: int = _int("SYBIL_T1_COOLDOWN_HOURS", 24)

#: Hard-block new claims when MAX_ACTIVE_CLAIMS is exceeded.
CLAIMS_HARD_BLOCK: bool = _bool("SYBIL_CLAIMS_HARD_BLOCK", True)

#: Hard-block T1 submissions during cooldown period.
T1_COOLDOWN_HARD_BLOCK: bool = _bool("SYBIL_T1_COOLDOWN_HARD_BLOCK", False)

# ---------------------------------------------------------------------------
# IP heuristics (flag-only — never hard-block)
# ---------------------------------------------------------------------------

#: Number of distinct accounts from the same IP before flagging.
IP_FLAG_THRESHOLD: int = _int("SYBIL_IP_FLAG_THRESHOLD", 3)

# ---------------------------------------------------------------------------
# Admin alert settings
# ---------------------------------------------------------------------------

#: Send Telegram alert for every new sybil flag.
ALERT_TELEGRAM_ENABLED: bool = _bool("SYBIL_ALERT_TELEGRAM", True)

#: Only alert for hard flags (HARD severity), not soft flags.
ALERT_HARD_FLAGS_ONLY: bool = _bool("SYBIL_ALERT_HARD_ONLY", False)
