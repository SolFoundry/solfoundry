"""Anti-sybil orchestration: persistence, GitHub enrichment, alerts, and hooks."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import httpx
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.anti_gaming_settings import AntiGamingSettings
from app.core.audit import audit_event
from app.models.anti_gaming_tables import (
    AntiGamingAppealTable,
    AntiGamingAuditTable,
    SybilAlertTable,
    T1CompletionLogTable,
    WalletClusterMembershipTable,
)
from app.models.bounty import BountyStatus
from app.models.user import User
from app.services import bounty_service
from app.services.anti_gaming_heuristics import (
    HeuristicResult,
    evaluate_active_claim_limit,
    evaluate_github_account_age,
    evaluate_github_commit_total,
    evaluate_github_nonempty_account,
    evaluate_github_public_repos,
    evaluate_shared_ip_accounts,
    evaluate_t1_completion_cooldown,
    evaluate_wallet_cluster_concentration,
)

logger = logging.getLogger(__name__)


class AntiGamingSignupRejected(Exception):
    """New GitHub signup failed automated quality checks."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def is_wallet_synthetic_github_user(github_id: str) -> bool:
    """Wallet-native accounts use a synthetic ``github_id`` prefix."""
    return github_id.startswith("wallet_")


def submission_actor_key(sub: Any) -> str:
    """Stable key for cooldowns: prefer wallet, else GitHub login."""
    w = (getattr(sub, "contributor_wallet", None) or "").strip().lower()
    if w:
        return f"wallet:{w}"
    sb = (getattr(sub, "submitted_by", None) or "").strip().lower()
    return f"gh:{sb}" if sb else "unknown"


def count_active_claims_for_user(claimer_id: str) -> int:
    """Bounties claimed by this user that are still in flight."""
    n = 0
    for b in bounty_service._bounty_store.values():
        if b.claimed_by != claimer_id:
            continue
        if b.status in (BountyStatus.IN_PROGRESS, BountyStatus.UNDER_REVIEW):
            n += 1
    return n


async def fetch_github_commit_total(
    client: httpx.AsyncClient, token: str, login: str
) -> Optional[int]:
    """Return GitHub search ``total_count`` for commits by author, or None on failure."""
    try:
        r = await client.get(
            "https://api.github.com/search/commits",
            params={"q": f"author:{login}"},
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=20.0,
        )
        if r.status_code != 200:
            return None
        data = r.json()
        return int(data.get("total_count", 0))
    except Exception as exc:
        logger.debug("github commit search failed: %s", exc)
        return None


def _parse_github_datetime(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw.replace("Z", "+00:00")
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


async def persist_audit_entry(
    session: AsyncSession,
    *,
    decision: str,
    rule_name: str,
    outcome: str,
    subject_user_id: Optional[str],
    subject_key: Optional[str],
    details: dict[str, Any],
) -> None:
    row = AntiGamingAuditTable(
        decision=decision,
        rule_name=rule_name,
        outcome=outcome,
        subject_user_id=subject_user_id,
        subject_key=subject_key,
        details=details,
    )
    session.add(row)
    await session.flush()
    audit_event(
        "anti_gaming_decision",
        decision=decision,
        rule_name=rule_name,
        outcome=outcome,
        subject_user_id=subject_user_id,
        subject_key=subject_key,
        **{k: v for k, v in details.items() if isinstance(v, (str, int, float, bool))},
    )


async def create_sybil_alert(
    session: AsyncSession,
    *,
    alert_type: str,
    severity: str,
    summary: str,
    details: dict[str, Any],
) -> SybilAlertTable:
    row = SybilAlertTable(
        alert_type=alert_type,
        severity=severity,
        summary=summary,
        details=details,
    )
    session.add(row)
    await session.flush()
    audit_event("sybil_alert_created", alert_type=alert_type, summary=summary)
    return row


async def count_distinct_users_for_ip(session: AsyncSession, ip: str) -> int:
    if not ip:
        return 0
    q = select(func.count()).select_from(User).where(User.registration_ip == ip)
    r = await session.execute(q)
    return int(r.scalar_one() or 0)


async def validate_new_github_signup(
    session: AsyncSession,
    *,
    github_user: dict[str, Any],
    access_token: str,
    settings: AntiGamingSettings,
) -> None:
    """Raise ``GitHubOAuthError`` if a *new* GitHub-backed user fails heuristics.

    Sets ``github_user["_sf_commit_total"]`` to the search API count (or ``None``).
    """
    if not settings.enabled:
        return
    login = github_user.get("login") or ""
    now = datetime.now(timezone.utc)
    created_at = _parse_github_datetime(github_user.get("created_at"))
    public_repos = github_user.get("public_repos")
    followers = github_user.get("followers")

    checks: list[tuple[str, HeuristicResult]] = []

    checks.append(
        (
            "github_account_age",
            evaluate_github_account_age(
                github_created_at=created_at,
                now=now,
                settings=settings,
            ),
        )
    )
    checks.append(
        (
            "github_public_repos",
            evaluate_github_public_repos(
                public_repos=public_repos,
                settings=settings,
            ),
        )
    )
    checks.append(
        (
            "github_nonempty",
            evaluate_github_nonempty_account(
                public_repos=public_repos,
                followers=followers,
                settings=settings,
            ),
        )
    )

    commit_total: Optional[int] = None
    async with httpx.AsyncClient(timeout=30.0) as client:
        commit_total = await fetch_github_commit_total(client, access_token, login)
    github_user["_sf_commit_total"] = commit_total

    if commit_total is not None or not settings.github_skip_commits_if_unavailable:
        checks.append(
            (
                "github_commits",
                evaluate_github_commit_total(
                    commit_total=commit_total,
                    settings=settings,
                ),
            )
        )

    for rule, result in checks:
        await persist_audit_entry(
            session,
            decision="deny" if not result.passed else "allow",
            rule_name=rule,
            outcome=result.code,
            subject_user_id=None,
            subject_key=login,
            details=result.details | {"message": result.message},
        )
        if not result.passed:
            await session.commit()
            raise AntiGamingSignupRejected(
                f"Account does not meet platform requirements: {result.message} ({result.code})"
            )


async def apply_github_profile_to_user(
    user: User, github_user: dict[str, Any], commit_total: Optional[int]
) -> None:
    user.github_account_created_at = _parse_github_datetime(
        github_user.get("created_at")
    )
    pr = github_user.get("public_repos")
    user.github_public_repos = int(pr) if pr is not None else None
    if commit_total is not None:
        user.github_commit_count_snapshot = commit_total


async def record_login_ip_and_maybe_alert(
    session: AsyncSession,
    *,
    user: User,
    client_ip: Optional[str],
    settings: AntiGamingSettings,
) -> None:
    if not client_ip or not settings.enabled:
        return
    is_first = user.registration_ip is None
    if is_first:
        user.registration_ip = client_ip
        await session.flush()
    user.last_seen_ip = client_ip

    if not is_first:
        return

    count = await count_distinct_users_for_ip(session, client_ip)
    result = evaluate_shared_ip_accounts(
        distinct_accounts_on_ip=count,
        settings=settings,
    )
    await persist_audit_entry(
        session,
        decision="flag",
        rule_name="shared_registration_ip",
        outcome=result.code,
        subject_user_id=str(user.id),
        subject_key=client_ip,
        details=result.details | {"message": result.message},
    )
    if result.details.get("suspicious"):
        await create_sybil_alert(
            session,
            alert_type="shared_ip",
            severity="warning",
            summary=f"{count} accounts share registration IP {client_ip}",
            details={
                "ip": client_ip,
                "user_id": str(user.id),
                "login": user.username,
            },
        )


async def get_last_t1_completion_time(
    session: AsyncSession, actor_key: str
) -> Optional[datetime]:
    q = (
        select(T1CompletionLogTable.completed_at)
        .where(T1CompletionLogTable.actor_key == actor_key)
        .order_by(desc(T1CompletionLogTable.completed_at))
        .limit(1)
    )
    r = await session.execute(q)
    row = r.scalar_one_or_none()
    return row


async def record_t1_completion(
    session: AsyncSession, *, actor_key: str, bounty_id: str
) -> None:
    session.add(T1CompletionLogTable(actor_key=actor_key, bounty_id=bounty_id))


async def assert_claim_allowed(
    session: AsyncSession,
    *,
    claimer_id: str,
    settings: AntiGamingSettings,
) -> None:
    if not settings.enabled:
        return
    n = count_active_claims_for_user(claimer_id)
    result = evaluate_active_claim_limit(active_claim_count=n, settings=settings)
    await persist_audit_entry(
        session,
        decision="deny" if not result.passed else "allow",
        rule_name="active_claim_limit",
        outcome=result.code,
        subject_user_id=None,
        subject_key=claimer_id,
        details=result.details | {"message": result.message},
    )
    if not result.passed:
        await session.commit()
        from app.services.bounty_lifecycle_service import LifecycleError

        raise LifecycleError(result.message, code="CLAIM_LIMIT_EXCEEDED")


async def assert_t1_cooldown_ok(
    session: AsyncSession,
    *,
    actor_key: str,
    settings: AntiGamingSettings,
) -> None:
    if not settings.enabled:
        return
    last = await get_last_t1_completion_time(session, actor_key)
    now = datetime.now(timezone.utc)
    result = evaluate_t1_completion_cooldown(
        last_completion_at=last,
        now=now,
        settings=settings,
    )
    await persist_audit_entry(
        session,
        decision="deny" if not result.passed else "allow",
        rule_name="t1_completion_cooldown",
        outcome=result.code,
        subject_user_id=None,
        subject_key=actor_key,
        details=result.details | {"message": result.message},
    )
    if not result.passed:
        await session.commit()
        from app.services.bounty_lifecycle_service import LifecycleError

        raise LifecycleError(result.message, code="T1_COOLDOWN")


async def on_wallet_linked_clustering(
    session: AsyncSession,
    *,
    user_id: str,
    wallet: str,
    settings: AntiGamingSettings,
) -> None:
    if not settings.enabled or not settings.wallet_clustering_enabled:
        return
    from app.services.wallet_funding_probe import infer_wallet_funding_cluster_key

    cluster = await infer_wallet_funding_cluster_key(
        wallet,
        max_signatures=settings.wallet_funder_probe_max_signatures,
    )
    if not cluster:
        await persist_audit_entry(
            session,
            decision="allow",
            rule_name="wallet_cluster_probe",
            outcome="funder_unknown",
            subject_user_id=user_id,
            subject_key=wallet,
            details={"message": "Could not infer funding fingerprint"},
        )
        return

    res = await session.execute(
        select(WalletClusterMembershipTable).where(
            WalletClusterMembershipTable.user_id == user_id
        )
    )
    row = res.scalar_one_or_none()
    if row:
        row.cluster_key = cluster
    else:
        session.add(WalletClusterMembershipTable(user_id=user_id, cluster_key=cluster))
    await session.flush()

    q = (
        select(func.count())
        .select_from(WalletClusterMembershipTable)
        .where(WalletClusterMembershipTable.cluster_key == cluster)
    )
    cnt = int((await session.execute(q)).scalar_one() or 0)
    conc = evaluate_wallet_cluster_concentration(
        users_sharing_funding_source=cnt,
        settings=settings,
    )
    await persist_audit_entry(
        session,
        decision="flag",
        rule_name="wallet_funding_cluster",
        outcome=conc.code,
        subject_user_id=user_id,
        subject_key=cluster,
        details=conc.details | {"message": conc.message, "wallet": wallet},
    )
    if conc.details.get("suspicious"):
        await create_sybil_alert(
            session,
            alert_type="wallet_cluster",
            severity="warning",
            summary=f"{cnt} accounts share inferred funding source",
            details={
                "cluster_key": cluster,
                "wallet": wallet,
                "user_id": user_id,
            },
        )


async def create_appeal(
    session: AsyncSession,
    *,
    user_id: str,
    message: str,
    related_audit_id: Optional[UUID] = None,
) -> AntiGamingAppealTable:
    row = AntiGamingAppealTable(
        user_id=user_id,
        message=message,
        related_audit_id=related_audit_id,
    )
    session.add(row)
    await session.flush()
    audit_event("anti_gaming_appeal_submitted", user_id=user_id)
    return row
