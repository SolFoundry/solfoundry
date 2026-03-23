"""Anti-sybil and anti-gaming detection service.

Heuristics implemented:
1. GitHub account age (minimum configured days)
2. GitHub activity (public repos, social score)
3. Wallet clustering (shared funding source)
4. Bounty claim rate (max active claims)
5. T1 farming cooldown (minimum hours between T1 completions)
6. IP clustering (multiple accounts per IP, flag-only)

All detections write to the sybil_flags table and emit an audit event.
Admin alerts are sent via Telegram (fire-and-forget, same pattern as
the existing boost notification code).
"""

from __future__ import annotations

import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import httpx
from sqlalchemy import select, func

from app.core.anti_sybil_config import (
    ALERT_HARD_FLAGS_ONLY,
    ALERT_TELEGRAM_ENABLED,
    CLAIMS_HARD_BLOCK,
    GITHUB_ACTIVITY_HARD_BLOCK,
    GITHUB_AGE_HARD_BLOCK,
    GITHUB_MIN_AGE_DAYS,
    GITHUB_MIN_PUBLIC_REPOS,
    GITHUB_MIN_SOCIAL_SCORE,
    IP_FLAG_THRESHOLD,
    MAX_ACTIVE_CLAIMS,
    T1_COOLDOWN_HARD_BLOCK,
    T1_COOLDOWN_HOURS,
    WALLET_CLUSTER_FLAG_THRESHOLD,
)
from app.core.audit import audit_event
from app.database import get_db_session
from app.models.anti_sybil import (
    AppealStatus,
    CheckResult,
    FlagSeverity,
    FlagType,
    IpAccountMapTable,
    SybilAppealTable,
    SybilFlagTable,
    WalletFundingMapTable,
    now_utc,
)
from app.models.tables import BountySubmissionTable, ReputationHistoryTable

logger = logging.getLogger(__name__)

_TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
_TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")


# ---------------------------------------------------------------------------
# Telegram admin alert (fire-and-forget)
# ---------------------------------------------------------------------------


async def _send_admin_alert(flag: SybilFlagTable) -> None:
    """Send a Telegram alert for a new sybil flag (best-effort)."""
    if not ALERT_TELEGRAM_ENABLED:
        return
    if ALERT_HARD_FLAGS_ONLY and flag.severity != FlagSeverity.HARD:
        return
    if not _TELEGRAM_BOT_TOKEN or not _TELEGRAM_CHAT_ID:
        logger.debug("Telegram not configured — skipping sybil alert")
        return

    severity_icon = "🔴" if flag.severity == FlagSeverity.HARD else "🟡"
    message = (
        f"{severity_icon} *Anti-Sybil Alert*\n"
        f"Flag: `{flag.flag_type.value}`\n"
        f"User: `{flag.user_id}`\n"
        f"Severity: `{flag.severity.value}`\n"
        f"Details: {flag.details}"
    )
    url = f"https://api.telegram.org/bot{_TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, json={"chat_id": _TELEGRAM_CHAT_ID, "text": message, "parse_mode": "Markdown"})
    except Exception as exc:
        logger.warning("Failed to send Telegram sybil alert: %s", exc)


# ---------------------------------------------------------------------------
# Flag persistence
# ---------------------------------------------------------------------------


async def flag_user(
    user_id: str,
    flag_type: FlagType,
    severity: FlagSeverity,
    details: dict[str, Any],
) -> SybilFlagTable:
    """Persist a sybil flag and emit an audit event."""
    flag = SybilFlagTable(
        id=str(uuid.uuid4()),
        user_id=user_id,
        flag_type=flag_type,
        severity=severity,
        details=details,
        resolved=False,
    )
    async with get_db_session() as session:
        session.add(flag)
        await session.commit()
        await session.refresh(flag)

    await audit_event(
        "sybil_flag_created",
        user_id=user_id,
        flag_id=str(flag.id),
        flag_type=flag_type.value,
        severity=severity.value,
        details=details,
    )
    await _send_admin_alert(flag)
    logger.info(
        "Sybil flag created user=%s type=%s severity=%s",
        user_id,
        flag_type.value,
        severity.value,
    )
    return flag


# ---------------------------------------------------------------------------
# 1. GitHub account age check
# ---------------------------------------------------------------------------


def check_github_age(
    user_id: str,
    github_created_at: str | datetime,
) -> CheckResult:
    """Return a failed CheckResult if the GitHub account is too young.

    Args:
        user_id: SolFoundry user identifier (for logging).
        github_created_at: ISO-8601 string or datetime from GitHub API.
    """
    if isinstance(github_created_at, str):
        created = datetime.fromisoformat(github_created_at.replace("Z", "+00:00"))
    else:
        created = github_created_at.replace(tzinfo=timezone.utc) if created.tzinfo is None else github_created_at

    age_days = (datetime.now(timezone.utc) - created).days

    if age_days < GITHUB_MIN_AGE_DAYS:
        return CheckResult(
            passed=False,
            flag_type=FlagType.GITHUB_AGE,
            severity=FlagSeverity.HARD if GITHUB_AGE_HARD_BLOCK else FlagSeverity.SOFT,
            details={
                "account_age_days": age_days,
                "minimum_required_days": GITHUB_MIN_AGE_DAYS,
                "github_created_at": github_created_at if isinstance(github_created_at, str) else github_created_at.isoformat(),
            },
            message=f"GitHub account is only {age_days} days old (minimum: {GITHUB_MIN_AGE_DAYS})",
        )
    return CheckResult(passed=True, message="GitHub account age check passed")


# ---------------------------------------------------------------------------
# 2. GitHub activity heuristics
# ---------------------------------------------------------------------------


def check_github_activity(
    user_id: str,
    public_repos: int,
    followers: int = 0,
    following: int = 0,
) -> CheckResult:
    """Return a failed CheckResult if the GitHub account looks empty/inactive.

    Args:
        user_id: SolFoundry user identifier.
        public_repos: Number of public repositories on the account.
        followers: GitHub followers count.
        following: GitHub following count.
    """
    social_score = followers + following
    failures = []

    if public_repos < GITHUB_MIN_PUBLIC_REPOS:
        failures.append(f"public_repos={public_repos} < minimum={GITHUB_MIN_PUBLIC_REPOS}")

    if GITHUB_MIN_SOCIAL_SCORE > 0 and social_score < GITHUB_MIN_SOCIAL_SCORE:
        failures.append(
            f"social_score={social_score} < minimum={GITHUB_MIN_SOCIAL_SCORE}"
        )

    if failures:
        return CheckResult(
            passed=False,
            flag_type=FlagType.GITHUB_ACTIVITY,
            severity=FlagSeverity.HARD if GITHUB_ACTIVITY_HARD_BLOCK else FlagSeverity.SOFT,
            details={
                "public_repos": public_repos,
                "followers": followers,
                "following": following,
                "social_score": social_score,
                "failures": failures,
            },
            message="GitHub account appears inactive: " + "; ".join(failures),
        )
    return CheckResult(passed=True, message="GitHub activity check passed")


# ---------------------------------------------------------------------------
# 3. IP clustering heuristics
# ---------------------------------------------------------------------------


def _hash_ip(ip: str) -> str:
    """SHA-256 hash an IP address — we never store the raw IP."""
    return hashlib.sha256(ip.encode()).hexdigest()


async def record_ip(user_id: str, ip: str) -> None:
    """Upsert (ip_hash, user_id) into ip_account_map."""
    ip_hash = _hash_ip(ip)
    async with get_db_session() as session:
        existing = await session.execute(
            select(IpAccountMapTable).where(
                IpAccountMapTable.ip_hash == ip_hash,
                IpAccountMapTable.user_id == user_id,
            )
        )
        if existing.scalars().first() is None:
            session.add(IpAccountMapTable(id=str(uuid.uuid4()), ip_hash=ip_hash, user_id=user_id))
            await session.commit()


async def check_ip_cluster(user_id: str, ip: str) -> CheckResult:
    """Flag (soft) if too many distinct accounts share the same IP.

    This is always a soft flag — IP sharing is common (NAT, shared wifi).
    """
    ip_hash = _hash_ip(ip)
    async with get_db_session() as session:
        count_result = await session.execute(
            select(func.count(IpAccountMapTable.id)).where(
                IpAccountMapTable.ip_hash == ip_hash,
                IpAccountMapTable.user_id != user_id,
            )
        )
        other_accounts = count_result.scalar() or 0

    if other_accounts >= IP_FLAG_THRESHOLD:
        return CheckResult(
            passed=False,
            flag_type=FlagType.IP_CLUSTER,
            severity=FlagSeverity.SOFT,  # always soft — never hard-block
            details={
                "ip_hash": ip_hash,
                "other_accounts_from_ip": other_accounts,
                "threshold": IP_FLAG_THRESHOLD,
            },
            message=f"IP shared with {other_accounts} other accounts (threshold: {IP_FLAG_THRESHOLD})",
        )
    return CheckResult(passed=True, message="IP cluster check passed")


# ---------------------------------------------------------------------------
# 4. Wallet clustering
# ---------------------------------------------------------------------------


async def record_wallet_funding(
    user_id: str,
    wallet: str,
    funding_source: Optional[str],
) -> None:
    """Upsert the wallet → funding_source mapping."""
    async with get_db_session() as session:
        existing = await session.execute(
            select(WalletFundingMapTable).where(WalletFundingMapTable.wallet == wallet)
        )
        row = existing.scalars().first()
        if row is None:
            session.add(
                WalletFundingMapTable(
                    id=str(uuid.uuid4()),
                    wallet=wallet,
                    funding_source=funding_source,
                    user_id=user_id,
                )
            )
            await session.commit()


async def check_wallet_cluster(user_id: str, wallet: str) -> CheckResult:
    """Flag if the wallet's funding source is shared with other accounts."""
    async with get_db_session() as session:
        row_result = await session.execute(
            select(WalletFundingMapTable).where(WalletFundingMapTable.wallet == wallet)
        )
        row = row_result.scalars().first()
        if row is None or not row.funding_source:
            return CheckResult(passed=True, message="Wallet cluster check passed (no funding source recorded)")

        cluster_result = await session.execute(
            select(func.count(WalletFundingMapTable.id)).where(
                WalletFundingMapTable.funding_source == row.funding_source,
                WalletFundingMapTable.user_id != user_id,
            )
        )
        others = cluster_result.scalar() or 0

    if others >= WALLET_CLUSTER_FLAG_THRESHOLD:
        return CheckResult(
            passed=False,
            flag_type=FlagType.WALLET_CLUSTER,
            severity=FlagSeverity.HARD,
            details={
                "wallet": wallet,
                "funding_source": row.funding_source,
                "other_accounts_with_same_funder": others,
                "threshold": WALLET_CLUSTER_FLAG_THRESHOLD,
            },
            message=f"Wallet funded from same source as {others} other accounts",
        )
    return CheckResult(passed=True, message="Wallet cluster check passed")


# ---------------------------------------------------------------------------
# 5. Active claim rate limiting
# ---------------------------------------------------------------------------


async def check_active_claims(user_id: str) -> CheckResult:
    """Fail if the contributor already has too many active claims.

    An "active claim" is a submission with status pending or under_review
    (i.e. the bounty work is in progress).
    """
    active_statuses = {"pending", "under_review"}
    async with get_db_session() as session:
        count_result = await session.execute(
            select(func.count(BountySubmissionTable.id)).where(
                BountySubmissionTable.submitted_by == user_id,
                BountySubmissionTable.status.in_(active_statuses),
            )
        )
        active_count = count_result.scalar() or 0

    if active_count >= MAX_ACTIVE_CLAIMS:
        return CheckResult(
            passed=False,
            flag_type=FlagType.CLAIM_RATE,
            severity=FlagSeverity.HARD if CLAIMS_HARD_BLOCK else FlagSeverity.SOFT,
            details={
                "active_claims": active_count,
                "max_allowed": MAX_ACTIVE_CLAIMS,
            },
            message=f"Too many active claims: {active_count}/{MAX_ACTIVE_CLAIMS}",
        )
    return CheckResult(passed=True, message="Active claim check passed")


# ---------------------------------------------------------------------------
# 6. T1 farming cooldown
# ---------------------------------------------------------------------------


async def check_t1_cooldown(user_id: str) -> CheckResult:
    """Fail if a T1 completion was recorded within the cooldown window.

    Queries the reputation_history table for the most recent T1 completion.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=T1_COOLDOWN_HOURS)
    async with get_db_session() as session:
        recent_result = await session.execute(
            select(ReputationHistoryTable.created_at)
            .where(
                ReputationHistoryTable.contributor_id == user_id,
                ReputationHistoryTable.bounty_tier == 1,
                ReputationHistoryTable.created_at >= cutoff,
            )
            .order_by(ReputationHistoryTable.created_at.desc())
            .limit(1)
        )
        recent = recent_result.scalars().first()

    if recent is not None:
        hours_since = (datetime.now(timezone.utc) - recent).total_seconds() / 3600
        remaining = T1_COOLDOWN_HOURS - hours_since
        return CheckResult(
            passed=False,
            flag_type=FlagType.T1_FARMING,
            severity=FlagSeverity.HARD if T1_COOLDOWN_HARD_BLOCK else FlagSeverity.SOFT,
            details={
                "last_t1_completion": recent.isoformat() if hasattr(recent, "isoformat") else str(recent),
                "cooldown_hours": T1_COOLDOWN_HOURS,
                "hours_remaining": round(remaining, 1),
            },
            message=f"T1 cooldown active: {round(remaining, 1)}h remaining",
        )
    return CheckResult(passed=True, message="T1 cooldown check passed")


# ---------------------------------------------------------------------------
# Aggregate runner
# ---------------------------------------------------------------------------


async def run_registration_checks(
    user_id: str,
    ip: str,
    github_created_at: str | datetime,
    public_repos: int,
    followers: int = 0,
    following: int = 0,
) -> list[CheckResult]:
    """Run all registration-time checks (GitHub age, activity, IP cluster).

    Flags are persisted for non-passing checks.  Returns all results.
    """
    results: list[CheckResult] = []

    age_result = check_github_age(user_id, github_created_at)
    results.append(age_result)
    if not age_result.passed and age_result.flag_type:
        await flag_user(user_id, age_result.flag_type, age_result.severity, age_result.details)  # type: ignore[arg-type]

    activity_result = check_github_activity(user_id, public_repos, followers, following)
    results.append(activity_result)
    if not activity_result.passed and activity_result.flag_type:
        await flag_user(user_id, activity_result.flag_type, activity_result.severity, activity_result.details)  # type: ignore[arg-type]

    # Record the IP regardless; check afterward
    await record_ip(user_id, ip)
    ip_result = await check_ip_cluster(user_id, ip)
    results.append(ip_result)
    if not ip_result.passed and ip_result.flag_type:
        await flag_user(user_id, ip_result.flag_type, ip_result.severity, ip_result.details)  # type: ignore[arg-type]

    return results


async def run_claim_checks(
    user_id: str,
    bounty_tier: int,
) -> list[CheckResult]:
    """Run claim-time checks (active claim rate, T1 cooldown).

    Returns all results; flags are persisted for failures.
    """
    results: list[CheckResult] = []

    claims_result = await check_active_claims(user_id)
    results.append(claims_result)
    if not claims_result.passed and claims_result.flag_type:
        await flag_user(user_id, claims_result.flag_type, claims_result.severity, claims_result.details)  # type: ignore[arg-type]

    if bounty_tier == 1:
        cooldown_result = await check_t1_cooldown(user_id)
        results.append(cooldown_result)
        if not cooldown_result.passed and cooldown_result.flag_type:
            await flag_user(user_id, cooldown_result.flag_type, cooldown_result.severity, cooldown_result.details)  # type: ignore[arg-type]

    return results


def has_hard_block(results: list[CheckResult]) -> Optional[CheckResult]:
    """Return the first HARD-severity failed check, or None."""
    for r in results:
        if not r.passed and r.severity == FlagSeverity.HARD:
            return r
    return None


# ---------------------------------------------------------------------------
# Appeal helpers
# ---------------------------------------------------------------------------


async def create_appeal(
    user_id: str,
    flag_id: str,
    reason: str,
) -> SybilAppealTable:
    """Create an appeal record for a sybil flag."""
    async with get_db_session() as session:
        # Verify the flag exists and belongs to this user
        flag_result = await session.execute(
            select(SybilFlagTable).where(
                SybilFlagTable.id == flag_id,
                SybilFlagTable.user_id == user_id,
            )
        )
        flag = flag_result.scalars().first()
        if flag is None:
            raise ValueError(f"Flag {flag_id} not found for user {user_id}")

        appeal = SybilAppealTable(
            id=str(uuid.uuid4()),
            user_id=user_id,
            flag_id=flag_id,
            reason=reason,
            status=AppealStatus.PENDING,
        )
        session.add(appeal)
        await session.commit()
        await session.refresh(appeal)

    await audit_event(
        "sybil_appeal_created",
        user_id=user_id,
        appeal_id=str(appeal.id),
        flag_id=flag_id,
    )
    return appeal


async def resolve_appeal(
    appeal_id: str,
    reviewer_id: str,
    status: AppealStatus,
    note: str,
) -> SybilAppealTable:
    """Admin resolves an appeal (approve or reject)."""
    async with get_db_session() as session:
        result = await session.execute(
            select(SybilAppealTable).where(SybilAppealTable.id == appeal_id)
        )
        appeal = result.scalars().first()
        if appeal is None:
            raise ValueError(f"Appeal {appeal_id} not found")

        appeal.status = status
        appeal.reviewer_note = note
        appeal.reviewed_by = reviewer_id
        appeal.resolved_at = now_utc()

        if status == AppealStatus.APPROVED:
            # Resolve the underlying flag
            flag_result = await session.execute(
                select(SybilFlagTable).where(SybilFlagTable.id == str(appeal.flag_id))
            )
            flag = flag_result.scalars().first()
            if flag:
                flag.resolved = True
                flag.resolved_by = reviewer_id
                flag.resolved_note = f"Appeal approved: {note}"
                flag.resolved_at = now_utc()

        await session.commit()
        await session.refresh(appeal)

    await audit_event(
        "sybil_appeal_resolved",
        appeal_id=appeal_id,
        reviewer_id=reviewer_id,
        new_status=status.value,
    )
    return appeal


async def resolve_flag(
    flag_id: str,
    resolver_id: str,
    note: str,
) -> SybilFlagTable:
    """Admin manually resolves a sybil flag (false positive)."""
    async with get_db_session() as session:
        result = await session.execute(
            select(SybilFlagTable).where(SybilFlagTable.id == flag_id)
        )
        flag = result.scalars().first()
        if flag is None:
            raise ValueError(f"Flag {flag_id} not found")

        flag.resolved = True
        flag.resolved_by = resolver_id
        flag.resolved_note = note
        flag.resolved_at = now_utc()
        await session.commit()
        await session.refresh(flag)

    await audit_event(
        "sybil_flag_resolved",
        flag_id=flag_id,
        resolver_id=resolver_id,
        note=note,
    )
    return flag
