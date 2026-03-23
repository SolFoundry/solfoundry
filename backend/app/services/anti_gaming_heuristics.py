"""Pure anti-gaming heuristics (unit-testable, no I/O).

Each function returns a small result object describing pass/fail and context
for audit logging. Thresholds come from ``AntiGamingSettings``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.core.anti_gaming_settings import AntiGamingSettings


@dataclass(frozen=True)
class HeuristicResult:
    """Outcome of a single heuristic check."""

    passed: bool
    code: str
    message: str
    details: dict[str, Any]


def evaluate_github_account_age(
    *,
    github_created_at: Optional[datetime],
    now: datetime,
    settings: AntiGamingSettings,
) -> HeuristicResult:
    """Require GitHub account to be at least ``github_min_account_age_days`` old."""
    if github_created_at is None:
        return HeuristicResult(
            False,
            "github_age_unknown",
            "GitHub account creation date is missing",
            {"min_days": settings.github_min_account_age_days},
        )
    if github_created_at.tzinfo is None:
        github_created_at = github_created_at.replace(tzinfo=timezone.utc)
    age = now - github_created_at
    min_delta = timedelta(days=settings.github_min_account_age_days)
    ok = age >= min_delta
    return HeuristicResult(
        ok,
        "github_account_age" if ok else "github_account_too_new",
        "GitHub account age OK" if ok else "GitHub account is too new",
        {
            "min_days": settings.github_min_account_age_days,
            "created_at": github_created_at.isoformat(),
            "age_days": age.total_seconds() / 86400.0,
        },
    )


def evaluate_github_public_repos(
    *,
    public_repos: Optional[int],
    settings: AntiGamingSettings,
) -> HeuristicResult:
    """Minimum public repository count."""
    pr = 0 if public_repos is None else int(public_repos)
    ok = pr >= settings.github_min_public_repos
    return HeuristicResult(
        ok,
        "github_public_repos" if ok else "github_insufficient_repos",
        "Public repo count OK" if ok else "Not enough public repositories",
        {"public_repos": pr, "min_required": settings.github_min_public_repos},
    )


def evaluate_github_commit_total(
    *,
    commit_total: Optional[int],
    settings: AntiGamingSettings,
) -> HeuristicResult:
    """Minimum estimated commits (e.g. from GitHub search API total_count).

    ``commit_total`` of ``None`` means unknown (API failure) — treated as fail
    when enforcement is on; callers may skip this check when discovery failed.
    """
    if commit_total is None:
        return HeuristicResult(
            False,
            "github_commits_unknown",
            "Could not verify commit activity",
            {"min_required": settings.github_min_commit_total},
        )
    ok = commit_total >= settings.github_min_commit_total
    return HeuristicResult(
        ok,
        "github_commits" if ok else "github_insufficient_commits",
        "Commit activity OK" if ok else "Not enough commits on GitHub",
        {
            "commit_total": commit_total,
            "min_required": settings.github_min_commit_total,
        },
    )


def evaluate_github_nonempty_account(
    *,
    public_repos: Optional[int],
    followers: Optional[int],
    settings: AntiGamingSettings,
) -> HeuristicResult:
    """Reject obviously empty shells: no repos and below follower threshold."""
    if not settings.github_reject_empty_profile:
        return HeuristicResult(
            True,
            "github_nonempty_skipped",
            "Empty-profile check disabled",
            {},
        )
    pr = 0 if public_repos is None else int(public_repos)
    fol = 0 if followers is None else int(followers)
    if settings.github_min_followers > 0:
        nonempty = pr > 0 or fol >= settings.github_min_followers
    else:
        nonempty = pr > 0 or fol > 0
    return HeuristicResult(
        nonempty,
        "github_nonempty" if nonempty else "github_empty_account",
        "Account has visible activity" if nonempty else "Account appears empty",
        {
            "public_repos": pr,
            "followers": fol,
            "min_followers": settings.github_min_followers,
        },
    )


def evaluate_active_claim_limit(
    *,
    active_claim_count: int,
    settings: AntiGamingSettings,
) -> HeuristicResult:
    """Cap simultaneous active bounty claims per contributor id."""
    max_c = settings.max_active_claims_per_user
    ok = active_claim_count < max_c
    return HeuristicResult(
        ok,
        "claim_limit_ok" if ok else "claim_limit_exceeded",
        "Within claim limit" if ok else "Too many active bounty claims",
        {"active_claims": active_claim_count, "max_allowed": max_c},
    )


def evaluate_t1_completion_cooldown(
    *,
    last_completion_at: Optional[datetime],
    now: datetime,
    settings: AntiGamingSettings,
) -> HeuristicResult:
    """Minimum spacing between T1 completions for the same actor key."""
    hours = settings.t1_completion_cooldown_hours
    if last_completion_at is None:
        return HeuristicResult(True, "t1_cooldown_none", "No prior T1 completion", {})
    if last_completion_at.tzinfo is None:
        last_completion_at = last_completion_at.replace(tzinfo=timezone.utc)
    delta = (now - last_completion_at).total_seconds() / 3600.0
    ok = delta >= hours
    return HeuristicResult(
        ok,
        "t1_cooldown_ok" if ok else "t1_cooldown_active",
        "T1 cooldown satisfied" if ok else "T1 completed too recently",
        {
            "hours_since_last": delta,
            "required_hours": hours,
            "last_completion_at": last_completion_at.isoformat(),
        },
    )


def evaluate_shared_ip_accounts(
    *,
    distinct_accounts_on_ip: int,
    settings: AntiGamingSettings,
) -> HeuristicResult:
    """Flag when many accounts share an IP (never a hard block — always ``passed=True``)."""
    threshold = settings.ip_flag_account_threshold
    flag = distinct_accounts_on_ip >= threshold
    return HeuristicResult(
        True,
        "ip_shared_accounts_flag" if flag else "ip_shared_accounts_ok",
        "Multiple accounts from same IP"
        if flag
        else "IP concentration below flag threshold",
        {
            "distinct_accounts": distinct_accounts_on_ip,
            "flag_threshold": threshold,
            "suspicious": flag,
        },
    )


def evaluate_wallet_cluster_concentration(
    *,
    users_sharing_funding_source: int,
    settings: AntiGamingSettings,
) -> HeuristicResult:
    """Flag funding-source clustering for admin review (does not block linking)."""
    threshold = settings.wallet_cluster_flag_user_threshold
    flag = users_sharing_funding_source >= threshold
    return HeuristicResult(
        True,
        "wallet_cluster_flag" if flag else "wallet_cluster_ok",
        "Several accounts share a funding source"
        if flag
        else "Funding-source concentration below threshold",
        {
            "users_on_cluster": users_sharing_funding_source,
            "flag_threshold": threshold,
            "suspicious": flag,
        },
    )
