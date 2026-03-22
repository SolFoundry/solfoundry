"""Anti-gaming and sybil protection detection service.

Implements configurable heuristics to detect and prevent sybil attacks,
account farming, and reputation gaming on the SolFoundry platform.

Detection heuristics:
    1. GitHub account age — blocks accounts younger than threshold.
    2. GitHub activity — flags accounts with minimal repos/commits.
    3. Wallet clustering — detects multiple wallets funded by the same source.
    4. Claim rate limiting — enforces max concurrent bounty claims per user.
    5. T1 cooldown — prevents rapid farming of easy bounties.
    6. IP heuristics — flags (not blocks) multiple accounts from same IP.

All thresholds are configurable via environment variables. Every decision
is recorded in the sybil_audit_logs table via PostgreSQL.

PostgreSQL schema:
    - sybil_audit_logs: Immutable decision log (see models/sybil.py).
    - sybil_alerts: Admin alerts for suspicious patterns.
    - sybil_appeals: User false-positive recovery requests.
"""

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_event
from app.database import get_db_session
from app.models.sybil import (
    AlertResponse,
    AlertSeverity,
    AlertStatus,
    AppealResponse,
    AppealStatus,
    SybilAlertDB,
    SybilAppealDB,
    SybilAuditLogDB,
    SybilAuditLogResponse,
    SybilCheckResult,
    SybilCheckType,
    SybilConfigResponse,
    SybilDecision,
    SybilEvaluationResponse,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configurable thresholds (environment variables with sensible defaults)
# ---------------------------------------------------------------------------

GITHUB_MIN_ACCOUNT_AGE_DAYS: int = int(
    os.getenv("SYBIL_GITHUB_MIN_AGE_DAYS", "30")
)
GITHUB_MIN_PUBLIC_REPOS: int = int(
    os.getenv("SYBIL_GITHUB_MIN_REPOS", "3")
)
GITHUB_MIN_TOTAL_COMMITS: int = int(
    os.getenv("SYBIL_GITHUB_MIN_COMMITS", "10")
)
MAX_ACTIVE_CLAIMS_PER_USER: int = int(
    os.getenv("SYBIL_MAX_ACTIVE_CLAIMS", "3")
)
T1_COOLDOWN_HOURS: int = int(
    os.getenv("SYBIL_T1_COOLDOWN_HOURS", "24")
)
IP_MAX_ACCOUNTS: int = int(
    os.getenv("SYBIL_IP_MAX_ACCOUNTS", "3")
)
WALLET_CLUSTER_THRESHOLD: int = int(
    os.getenv("SYBIL_WALLET_CLUSTER_THRESHOLD", "3")
)


def get_sybil_config() -> SybilConfigResponse:
    """Return the current anti-gaming configuration thresholds.

    All values are read from environment variables at module load time
    and returned as a structured response for the admin config endpoint.

    Returns:
        SybilConfigResponse: Current threshold values for all heuristics.
    """
    return SybilConfigResponse(
        github_min_account_age_days=GITHUB_MIN_ACCOUNT_AGE_DAYS,
        github_min_public_repos=GITHUB_MIN_PUBLIC_REPOS,
        github_min_total_commits=GITHUB_MIN_TOTAL_COMMITS,
        max_active_claims_per_user=MAX_ACTIVE_CLAIMS_PER_USER,
        t1_cooldown_hours=T1_COOLDOWN_HOURS,
        ip_max_accounts=IP_MAX_ACCOUNTS,
        wallet_cluster_threshold=WALLET_CLUSTER_THRESHOLD,
    )


# ---------------------------------------------------------------------------
# Audit log persistence
# ---------------------------------------------------------------------------


async def _record_audit_log(
    session: AsyncSession,
    user_id: str,
    check_type: SybilCheckType,
    decision: SybilDecision,
    reason: str,
    details: Dict[str, Any],
    ip_address: Optional[str] = None,
) -> SybilAuditLogDB:
    """Persist an anti-gaming decision to the audit log.

    Every evaluation result — whether allow, flag, or block — is
    recorded so that administrators have a complete audit trail.

    Args:
        session: The active database session.
        user_id: Identifier of the evaluated user.
        check_type: Which detection heuristic produced this result.
        decision: The enforcement outcome.
        reason: Human-readable explanation of the decision.
        details: Structured metadata (thresholds, actual values, etc.).
        ip_address: Client IP at the time of evaluation, if available.

    Returns:
        SybilAuditLogDB: The persisted audit log record.
    """
    record = SybilAuditLogDB(
        id=uuid.uuid4(),
        user_id=user_id,
        check_type=check_type.value,
        decision=decision.value,
        reason=reason,
        details=details,
        ip_address=ip_address,
    )
    session.add(record)
    await session.flush()

    audit_event(
        "sybil_check",
        user_id=user_id,
        check_type=check_type.value,
        decision=decision.value,
        reason=reason,
    )

    return record


# ---------------------------------------------------------------------------
# Alert management
# ---------------------------------------------------------------------------


async def _create_alert(
    session: AsyncSession,
    user_id: str,
    alert_type: str,
    severity: AlertSeverity,
    title: str,
    description: str,
    details: Dict[str, Any],
) -> SybilAlertDB:
    """Create an admin alert for suspicious activity.

    Alerts are generated automatically by detection heuristics when
    a pattern warrants admin attention. Severity determines triage priority.

    Args:
        session: The active database session.
        user_id: The user exhibiting suspicious behaviour.
        alert_type: Category of the alert (maps to check type).
        severity: Priority level for admin triage.
        title: Short summary for the alert dashboard.
        description: Detailed explanation of the suspicious pattern.
        details: Structured metadata for the alert.

    Returns:
        SybilAlertDB: The persisted alert record.
    """
    alert = SybilAlertDB(
        id=uuid.uuid4(),
        user_id=user_id,
        alert_type=alert_type,
        severity=severity.value,
        status=AlertStatus.OPEN.value,
        title=title,
        description=description,
        details=details,
    )
    session.add(alert)
    await session.flush()

    audit_event(
        "sybil_alert_created",
        user_id=user_id,
        alert_type=alert_type,
        severity=severity.value,
    )

    logger.warning(
        "Sybil alert created: [%s] %s for user %s",
        severity.value.upper(),
        title,
        user_id,
    )

    return alert


# ---------------------------------------------------------------------------
# Individual detection heuristics
# ---------------------------------------------------------------------------


async def check_github_account_age(
    session: AsyncSession,
    user_id: str,
    github_created_at: Optional[datetime],
    ip_address: Optional[str] = None,
) -> SybilCheckResult:
    """Check if a GitHub account meets the minimum age requirement.

    Accounts younger than GITHUB_MIN_ACCOUNT_AGE_DAYS are blocked from
    claiming bounties, as new throwaway accounts are a primary sybil vector.

    Args:
        session: The active database session for audit logging.
        user_id: Identifier of the user being checked.
        github_created_at: When the GitHub account was created. If None,
            the check fails conservatively (blocks the user).
        ip_address: Client IP for audit logging.

    Returns:
        SybilCheckResult: The outcome including pass/fail, decision, and reason.
    """
    if github_created_at is None:
        decision = SybilDecision.BLOCK
        reason = "GitHub account creation date unavailable — cannot verify age"
        details = {"threshold_days": GITHUB_MIN_ACCOUNT_AGE_DAYS}
        await _record_audit_log(
            session, user_id, SybilCheckType.GITHUB_ACCOUNT_AGE,
            decision, reason, details, ip_address,
        )
        return SybilCheckResult(
            check_type=SybilCheckType.GITHUB_ACCOUNT_AGE,
            passed=False,
            decision=decision,
            reason=reason,
            details=details,
        )

    now = datetime.now(timezone.utc)
    account_age_days = (now - github_created_at).days
    passed = account_age_days >= GITHUB_MIN_ACCOUNT_AGE_DAYS

    if passed:
        decision = SybilDecision.ALLOW
        reason = (
            f"GitHub account is {account_age_days} days old "
            f"(minimum: {GITHUB_MIN_ACCOUNT_AGE_DAYS})"
        )
    else:
        decision = SybilDecision.BLOCK
        reason = (
            f"GitHub account is only {account_age_days} days old "
            f"(minimum: {GITHUB_MIN_ACCOUNT_AGE_DAYS} required)"
        )

    details = {
        "account_age_days": account_age_days,
        "threshold_days": GITHUB_MIN_ACCOUNT_AGE_DAYS,
        "github_created_at": github_created_at.isoformat(),
    }

    await _record_audit_log(
        session, user_id, SybilCheckType.GITHUB_ACCOUNT_AGE,
        decision, reason, details, ip_address,
    )

    return SybilCheckResult(
        check_type=SybilCheckType.GITHUB_ACCOUNT_AGE,
        passed=passed,
        decision=decision,
        reason=reason,
        details=details,
    )


async def check_github_activity(
    session: AsyncSession,
    user_id: str,
    public_repos: int,
    total_commits: int,
    ip_address: Optional[str] = None,
) -> SybilCheckResult:
    """Check if a GitHub account shows genuine developer activity.

    Flags accounts with fewer than the minimum number of public
    repositories or total commits, as empty/inactive accounts
    may indicate sybil identities created solely for bounty farming.

    Args:
        session: The active database session for audit logging.
        user_id: Identifier of the user being checked.
        public_repos: Number of public repositories on the account.
        total_commits: Total commit contributions across all repos.
        ip_address: Client IP for audit logging.

    Returns:
        SybilCheckResult: The outcome of the activity check.
    """
    repos_ok = public_repos >= GITHUB_MIN_PUBLIC_REPOS
    commits_ok = total_commits >= GITHUB_MIN_TOTAL_COMMITS
    passed = repos_ok and commits_ok

    if passed:
        decision = SybilDecision.ALLOW
        reason = (
            f"GitHub activity sufficient: {public_repos} repos "
            f"(min {GITHUB_MIN_PUBLIC_REPOS}), {total_commits} commits "
            f"(min {GITHUB_MIN_TOTAL_COMMITS})"
        )
    else:
        decision = SybilDecision.FLAG
        missing_parts = []
        if not repos_ok:
            missing_parts.append(
                f"repos={public_repos} < {GITHUB_MIN_PUBLIC_REPOS}"
            )
        if not commits_ok:
            missing_parts.append(
                f"commits={total_commits} < {GITHUB_MIN_TOTAL_COMMITS}"
            )
        reason = (
            f"Insufficient GitHub activity: {', '.join(missing_parts)}"
        )

        await _create_alert(
            session,
            user_id=user_id,
            alert_type=SybilCheckType.GITHUB_ACTIVITY.value,
            severity=AlertSeverity.LOW,
            title=f"Low GitHub activity for user {user_id}",
            description=reason,
            details={
                "public_repos": public_repos,
                "total_commits": total_commits,
            },
        )

    details = {
        "public_repos": public_repos,
        "min_repos": GITHUB_MIN_PUBLIC_REPOS,
        "total_commits": total_commits,
        "min_commits": GITHUB_MIN_TOTAL_COMMITS,
    }

    await _record_audit_log(
        session, user_id, SybilCheckType.GITHUB_ACTIVITY,
        decision, reason, details, ip_address,
    )

    return SybilCheckResult(
        check_type=SybilCheckType.GITHUB_ACTIVITY,
        passed=passed,
        decision=decision,
        reason=reason,
        details=details,
    )


async def check_wallet_clustering(
    session: AsyncSession,
    user_id: str,
    wallet_address: str,
    funding_source: Optional[str] = None,
    known_funding_sources: Optional[Dict[str, List[str]]] = None,
    ip_address: Optional[str] = None,
) -> SybilCheckResult:
    """Detect wallet clustering (multiple wallets funded by the same source).

    Compares the wallet's funding source against a registry of known
    funding sources. If the same source funds more wallets than the
    threshold, it is flagged as likely belonging to the same person.

    Args:
        session: The active database session for audit logging.
        user_id: Identifier of the user being checked.
        wallet_address: The Solana wallet address to evaluate.
        funding_source: The address that funded this wallet (from chain data).
        known_funding_sources: Mapping of funding source addresses to the
            list of wallets they have funded. Provided by the caller to
            support both live chain lookups and test injection.
        ip_address: Client IP for audit logging.

    Returns:
        SybilCheckResult: The clustering analysis outcome.
    """
    if funding_source is None:
        decision = SybilDecision.ALLOW
        reason = "No funding source data available — skipping clustering check"
        details = {"wallet_address": wallet_address}
        await _record_audit_log(
            session, user_id, SybilCheckType.WALLET_CLUSTERING,
            decision, reason, details, ip_address,
        )
        return SybilCheckResult(
            check_type=SybilCheckType.WALLET_CLUSTERING,
            passed=True,
            decision=decision,
            reason=reason,
            details=details,
        )

    if known_funding_sources is None:
        known_funding_sources = {}

    wallets_from_source = known_funding_sources.get(funding_source, [])
    if wallet_address not in wallets_from_source:
        wallets_from_source = wallets_from_source + [wallet_address]

    cluster_size = len(wallets_from_source)
    passed = cluster_size < WALLET_CLUSTER_THRESHOLD

    if passed:
        decision = SybilDecision.ALLOW
        reason = (
            f"Wallet cluster size {cluster_size} is below threshold "
            f"({WALLET_CLUSTER_THRESHOLD})"
        )
    else:
        decision = SybilDecision.FLAG
        reason = (
            f"Wallet clustering detected: {cluster_size} wallets funded by "
            f"the same source (threshold: {WALLET_CLUSTER_THRESHOLD})"
        )

        await _create_alert(
            session,
            user_id=user_id,
            alert_type=SybilCheckType.WALLET_CLUSTERING.value,
            severity=AlertSeverity.HIGH,
            title=f"Wallet clustering: {cluster_size} wallets from same source",
            description=reason,
            details={
                "funding_source": funding_source,
                "cluster_size": cluster_size,
                "wallet_addresses": wallets_from_source,
            },
        )

    details = {
        "wallet_address": wallet_address,
        "funding_source": funding_source,
        "cluster_size": cluster_size,
        "threshold": WALLET_CLUSTER_THRESHOLD,
    }

    await _record_audit_log(
        session, user_id, SybilCheckType.WALLET_CLUSTERING,
        decision, reason, details, ip_address,
    )

    return SybilCheckResult(
        check_type=SybilCheckType.WALLET_CLUSTERING,
        passed=passed,
        decision=decision,
        reason=reason,
        details=details,
    )


async def check_claim_rate_limit(
    session: AsyncSession,
    user_id: str,
    active_claims_count: int,
    ip_address: Optional[str] = None,
) -> SybilCheckResult:
    """Enforce maximum concurrent bounty claims per user.

    Prevents users from hoarding bounties by limiting the number of
    simultaneously active claims. This ensures bounties remain available
    to other contributors.

    Args:
        session: The active database session for audit logging.
        user_id: Identifier of the user attempting to claim.
        active_claims_count: Current number of active claims for this user.
        ip_address: Client IP for audit logging.

    Returns:
        SybilCheckResult: Whether the user may claim another bounty.
    """
    passed = active_claims_count < MAX_ACTIVE_CLAIMS_PER_USER

    if passed:
        decision = SybilDecision.ALLOW
        reason = (
            f"User has {active_claims_count} active claims "
            f"(max {MAX_ACTIVE_CLAIMS_PER_USER})"
        )
    else:
        decision = SybilDecision.BLOCK
        reason = (
            f"Claim rate limit exceeded: {active_claims_count} active claims "
            f"(maximum {MAX_ACTIVE_CLAIMS_PER_USER} allowed)"
        )

    details = {
        "active_claims": active_claims_count,
        "max_allowed": MAX_ACTIVE_CLAIMS_PER_USER,
    }

    await _record_audit_log(
        session, user_id, SybilCheckType.CLAIM_RATE_LIMIT,
        decision, reason, details, ip_address,
    )

    return SybilCheckResult(
        check_type=SybilCheckType.CLAIM_RATE_LIMIT,
        passed=passed,
        decision=decision,
        reason=reason,
        details=details,
    )


async def check_t1_cooldown(
    session: AsyncSession,
    user_id: str,
    last_t1_completion: Optional[datetime],
    ip_address: Optional[str] = None,
) -> SybilCheckResult:
    """Enforce a cooldown period between T1 bounty completions.

    Prevents rapid farming of easy T1 bounties by requiring a minimum
    wait time between completions. This encourages contributors to take
    on higher-tier challenges rather than grinding easy tasks.

    Args:
        session: The active database session for audit logging.
        user_id: Identifier of the user being checked.
        last_t1_completion: Timestamp of the user's most recent T1
            bounty completion. None if the user has never completed T1.
        ip_address: Client IP for audit logging.

    Returns:
        SybilCheckResult: Whether the cooldown period has elapsed.
    """
    if last_t1_completion is None:
        decision = SybilDecision.ALLOW
        reason = "No previous T1 completions — cooldown not applicable"
        details = {"cooldown_hours": T1_COOLDOWN_HOURS}
        await _record_audit_log(
            session, user_id, SybilCheckType.T1_COOLDOWN,
            decision, reason, details, ip_address,
        )
        return SybilCheckResult(
            check_type=SybilCheckType.T1_COOLDOWN,
            passed=True,
            decision=decision,
            reason=reason,
            details=details,
        )

    now = datetime.now(timezone.utc)
    cooldown_end = last_t1_completion + timedelta(hours=T1_COOLDOWN_HOURS)
    passed = now >= cooldown_end

    if passed:
        hours_since = (now - last_t1_completion).total_seconds() / 3600
        decision = SybilDecision.ALLOW
        reason = (
            f"T1 cooldown elapsed: {hours_since:.1f}h since last completion "
            f"(required: {T1_COOLDOWN_HOURS}h)"
        )
    else:
        remaining_seconds = (cooldown_end - now).total_seconds()
        remaining_hours = remaining_seconds / 3600
        decision = SybilDecision.BLOCK
        reason = (
            f"T1 cooldown active: {remaining_hours:.1f}h remaining "
            f"(total cooldown: {T1_COOLDOWN_HOURS}h)"
        )

    details = {
        "last_t1_completion": last_t1_completion.isoformat(),
        "cooldown_hours": T1_COOLDOWN_HOURS,
        "cooldown_end": cooldown_end.isoformat(),
    }

    await _record_audit_log(
        session, user_id, SybilCheckType.T1_COOLDOWN,
        decision, reason, details, ip_address,
    )

    return SybilCheckResult(
        check_type=SybilCheckType.T1_COOLDOWN,
        passed=passed,
        decision=decision,
        reason=reason,
        details=details,
    )


async def check_ip_heuristic(
    session: AsyncSession,
    user_id: str,
    ip_address: str,
    accounts_from_ip: int,
) -> SybilCheckResult:
    """Flag (not block) multiple accounts registering from the same IP.

    IP-based detection is intentionally soft (flag, never block) because
    legitimate users may share IP addresses (offices, universities, VPNs).
    High overlap triggers an admin alert for manual review.

    Args:
        session: The active database session for audit logging.
        user_id: Identifier of the user being checked.
        ip_address: The client IP address.
        accounts_from_ip: Number of accounts that have used this IP.

    Returns:
        SybilCheckResult: The IP heuristic evaluation result.
    """
    passed = accounts_from_ip <= IP_MAX_ACCOUNTS

    if passed:
        decision = SybilDecision.ALLOW
        reason = (
            f"IP {ip_address} used by {accounts_from_ip} accounts "
            f"(threshold: {IP_MAX_ACCOUNTS})"
        )
    else:
        decision = SybilDecision.FLAG
        reason = (
            f"Multiple accounts from IP {ip_address}: "
            f"{accounts_from_ip} accounts detected "
            f"(threshold: {IP_MAX_ACCOUNTS})"
        )

        await _create_alert(
            session,
            user_id=user_id,
            alert_type=SybilCheckType.IP_HEURISTIC.value,
            severity=AlertSeverity.MEDIUM,
            title=f"Multiple accounts from IP {ip_address}",
            description=reason,
            details={
                "ip_address": ip_address,
                "account_count": accounts_from_ip,
            },
        )

    details = {
        "ip_address": ip_address,
        "accounts_from_ip": accounts_from_ip,
        "threshold": IP_MAX_ACCOUNTS,
    }

    await _record_audit_log(
        session, user_id, SybilCheckType.IP_HEURISTIC,
        decision, reason, details, ip_address,
    )

    return SybilCheckResult(
        check_type=SybilCheckType.IP_HEURISTIC,
        passed=passed,
        decision=decision,
        reason=reason,
        details=details,
    )


# ---------------------------------------------------------------------------
# Aggregate evaluation
# ---------------------------------------------------------------------------


async def evaluate_user(
    session: AsyncSession,
    user_id: str,
    github_created_at: Optional[datetime] = None,
    public_repos: int = 0,
    total_commits: int = 0,
    wallet_address: Optional[str] = None,
    funding_source: Optional[str] = None,
    known_funding_sources: Optional[Dict[str, List[str]]] = None,
    active_claims_count: int = 0,
    last_t1_completion: Optional[datetime] = None,
    ip_address: Optional[str] = None,
    accounts_from_ip: int = 1,
) -> SybilEvaluationResponse:
    """Run all anti-gaming heuristics against a user and return the aggregate result.

    Executes each detection check in sequence, collects results, and
    determines the overall decision as the most restrictive outcome
    (block > flag > allow).

    Args:
        session: The active database session for audit logging and alerts.
        user_id: Identifier of the user being evaluated.
        github_created_at: GitHub account creation timestamp.
        public_repos: Number of public GitHub repositories.
        total_commits: Total GitHub commit contributions.
        wallet_address: User's Solana wallet address.
        funding_source: Address that funded the user's wallet.
        known_funding_sources: Registry of funding source to wallet mappings.
        active_claims_count: Current number of active bounty claims.
        last_t1_completion: Timestamp of most recent T1 bounty completion.
        ip_address: Client IP address.
        accounts_from_ip: Number of accounts observed from this IP.

    Returns:
        SybilEvaluationResponse: Aggregate result with per-check breakdown.
    """
    checks: List[SybilCheckResult] = []

    # 1. GitHub account age
    age_result = await check_github_account_age(
        session, user_id, github_created_at, ip_address,
    )
    checks.append(age_result)

    # 2. GitHub activity
    activity_result = await check_github_activity(
        session, user_id, public_repos, total_commits, ip_address,
    )
    checks.append(activity_result)

    # 3. Wallet clustering
    if wallet_address:
        clustering_result = await check_wallet_clustering(
            session, user_id, wallet_address, funding_source,
            known_funding_sources, ip_address,
        )
        checks.append(clustering_result)

    # 4. Claim rate limit
    claim_result = await check_claim_rate_limit(
        session, user_id, active_claims_count, ip_address,
    )
    checks.append(claim_result)

    # 5. T1 cooldown
    cooldown_result = await check_t1_cooldown(
        session, user_id, last_t1_completion, ip_address,
    )
    checks.append(cooldown_result)

    # 6. IP heuristic
    if ip_address:
        ip_result = await check_ip_heuristic(
            session, user_id, ip_address, accounts_from_ip,
        )
        checks.append(ip_result)

    # Determine overall decision (most restrictive wins)
    decisions = [check.decision for check in checks]
    if SybilDecision.BLOCK in decisions:
        overall_decision = SybilDecision.BLOCK
    elif SybilDecision.FLAG in decisions:
        overall_decision = SybilDecision.FLAG
    else:
        overall_decision = SybilDecision.ALLOW

    flagged_checks = sum(
        1 for check in checks if check.decision != SybilDecision.ALLOW
    )

    return SybilEvaluationResponse(
        user_id=user_id,
        overall_decision=overall_decision,
        checks=checks,
        flagged_checks=flagged_checks,
    )


# ---------------------------------------------------------------------------
# Audit log queries
# ---------------------------------------------------------------------------


async def get_audit_logs(
    session: AsyncSession,
    user_id: Optional[str] = None,
    check_type: Optional[str] = None,
    decision: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Dict[str, Any]:
    """Query sybil audit logs with optional filters and pagination.

    Supports filtering by user, check type, and decision outcome.
    Results are ordered newest first for admin dashboard display.

    Args:
        session: The active database session.
        user_id: Filter by specific user ID.
        check_type: Filter by detection heuristic type.
        decision: Filter by decision outcome (allow, flag, block).
        page: Page number (1-based).
        per_page: Maximum records per page.

    Returns:
        Dictionary with 'items' (list of audit log records), 'total',
        'page', and 'per_page' for the response model.
    """
    conditions = []
    if user_id:
        conditions.append(SybilAuditLogDB.user_id == user_id)
    if check_type:
        conditions.append(SybilAuditLogDB.check_type == check_type)
    if decision:
        conditions.append(SybilAuditLogDB.decision == decision)

    # Count query
    count_query = select(func.count(SybilAuditLogDB.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    # Data query with pagination
    data_query = (
        select(SybilAuditLogDB)
        .order_by(SybilAuditLogDB.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    if conditions:
        data_query = data_query.where(and_(*conditions))

    result = await session.execute(data_query)
    rows = result.scalars().all()

    items = [
        SybilAuditLogResponse(
            id=str(row.id),
            user_id=row.user_id,
            check_type=row.check_type,
            decision=row.decision,
            reason=row.reason,
            details=row.details or {},
            ip_address=row.ip_address,
            created_at=row.created_at,
        )
        for row in rows
    ]

    return {"items": items, "total": total, "page": page, "per_page": per_page}


# ---------------------------------------------------------------------------
# Alert management queries
# ---------------------------------------------------------------------------


async def get_alerts(
    session: AsyncSession,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    user_id: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Dict[str, Any]:
    """Query admin alerts with optional filters and pagination.

    Results are ordered by severity (critical first) then creation time.

    Args:
        session: The active database session.
        status: Filter by alert status.
        severity: Filter by alert severity.
        user_id: Filter by flagged user.
        page: Page number (1-based).
        per_page: Maximum records per page.

    Returns:
        Dictionary with 'items', 'total', 'page', and 'per_page'.
    """
    conditions = []
    if status:
        conditions.append(SybilAlertDB.status == status)
    if severity:
        conditions.append(SybilAlertDB.severity == severity)
    if user_id:
        conditions.append(SybilAlertDB.user_id == user_id)

    count_query = select(func.count(SybilAlertDB.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    data_query = (
        select(SybilAlertDB)
        .order_by(SybilAlertDB.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    if conditions:
        data_query = data_query.where(and_(*conditions))

    result = await session.execute(data_query)
    rows = result.scalars().all()

    items = [
        AlertResponse(
            id=str(row.id),
            user_id=row.user_id,
            alert_type=row.alert_type,
            severity=row.severity,
            status=row.status,
            title=row.title,
            description=row.description,
            details=row.details or {},
            resolved_by=row.resolved_by,
            resolved_at=row.resolved_at,
            resolution_notes=row.resolution_notes,
            created_at=row.created_at,
        )
        for row in rows
    ]

    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def resolve_alert(
    session: AsyncSession,
    alert_id: str,
    admin_user_id: str,
    status: AlertStatus,
    notes: Optional[str] = None,
) -> Optional[AlertResponse]:
    """Resolve or dismiss an admin alert.

    Updates the alert status and records which admin resolved it and when.
    Only open or acknowledged alerts can be resolved.

    Args:
        session: The active database session.
        alert_id: UUID of the alert to resolve.
        admin_user_id: UUID of the admin performing the resolution.
        status: Target status (resolved or dismissed).
        notes: Optional admin notes on the resolution.

    Returns:
        Updated AlertResponse if the alert was found and updated,
        None if the alert does not exist.

    Raises:
        ValueError: If the alert is already resolved or dismissed.
    """
    query = select(SybilAlertDB).where(
        SybilAlertDB.id == uuid.UUID(alert_id)
    )
    result = await session.execute(query)
    alert = result.scalar_one_or_none()

    if alert is None:
        return None

    if alert.status in (AlertStatus.RESOLVED.value, AlertStatus.DISMISSED.value):
        raise ValueError(
            f"Alert is already {alert.status} and cannot be modified"
        )

    alert.status = status.value
    alert.resolved_by = admin_user_id
    alert.resolved_at = datetime.now(timezone.utc)
    alert.resolution_notes = notes
    await session.flush()

    audit_event(
        "sybil_alert_resolved",
        alert_id=alert_id,
        admin_user_id=admin_user_id,
        status=status.value,
    )

    return AlertResponse(
        id=str(alert.id),
        user_id=alert.user_id,
        alert_type=alert.alert_type,
        severity=alert.severity,
        status=alert.status,
        title=alert.title,
        description=alert.description,
        details=alert.details or {},
        resolved_by=alert.resolved_by,
        resolved_at=alert.resolved_at,
        resolution_notes=alert.resolution_notes,
        created_at=alert.created_at,
    )


# ---------------------------------------------------------------------------
# Appeal management
# ---------------------------------------------------------------------------


async def create_appeal(
    session: AsyncSession,
    user_id: str,
    reason: str,
    audit_log_id: Optional[str] = None,
    evidence: Optional[str] = None,
) -> AppealResponse:
    """Submit a false-positive appeal for a flagged or blocked user.

    Users who believe they were incorrectly penalized can submit an
    appeal with an explanation and optional evidence. The appeal is
    reviewed by an admin through the admin API.

    Args:
        session: The active database session.
        user_id: The user submitting the appeal.
        reason: Explanation of why the detection was a false positive.
        audit_log_id: Optional UUID of the specific audit log entry.
        evidence: Optional supporting evidence.

    Returns:
        AppealResponse: The created appeal record.

    Raises:
        ValueError: If the user has a pending appeal already.
    """
    # Check for existing pending appeal
    existing_query = select(func.count(SybilAppealDB.id)).where(
        and_(
            SybilAppealDB.user_id == user_id,
            SybilAppealDB.status == AppealStatus.PENDING.value,
        )
    )
    existing_result = await session.execute(existing_query)
    pending_count = existing_result.scalar() or 0

    if pending_count > 0:
        raise ValueError(
            "You already have a pending appeal. Please wait for it to be reviewed."
        )

    appeal = SybilAppealDB(
        id=uuid.uuid4(),
        user_id=user_id,
        audit_log_id=uuid.UUID(audit_log_id) if audit_log_id else None,
        reason=reason,
        evidence=evidence,
        status=AppealStatus.PENDING.value,
    )
    session.add(appeal)
    await session.flush()

    audit_event(
        "sybil_appeal_created",
        user_id=user_id,
        appeal_id=str(appeal.id),
    )

    return AppealResponse(
        id=str(appeal.id),
        user_id=appeal.user_id,
        audit_log_id=str(appeal.audit_log_id) if appeal.audit_log_id else None,
        reason=appeal.reason,
        evidence=appeal.evidence,
        status=appeal.status,
        reviewed_by=None,
        reviewed_at=None,
        review_notes=None,
        created_at=appeal.created_at,
    )


async def get_appeals(
    session: AsyncSession,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Dict[str, Any]:
    """Query appeal records with optional filters and pagination.

    Args:
        session: The active database session.
        user_id: Filter by appealing user.
        status: Filter by appeal status.
        page: Page number (1-based).
        per_page: Maximum records per page.

    Returns:
        Dictionary with 'items', 'total', 'page', and 'per_page'.
    """
    conditions = []
    if user_id:
        conditions.append(SybilAppealDB.user_id == user_id)
    if status:
        conditions.append(SybilAppealDB.status == status)

    count_query = select(func.count(SybilAppealDB.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    data_query = (
        select(SybilAppealDB)
        .order_by(SybilAppealDB.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    if conditions:
        data_query = data_query.where(and_(*conditions))

    result = await session.execute(data_query)
    rows = result.scalars().all()

    items = [
        AppealResponse(
            id=str(row.id),
            user_id=row.user_id,
            audit_log_id=str(row.audit_log_id) if row.audit_log_id else None,
            reason=row.reason,
            evidence=row.evidence,
            status=row.status,
            reviewed_by=row.reviewed_by,
            reviewed_at=row.reviewed_at,
            review_notes=row.review_notes,
            created_at=row.created_at,
        )
        for row in rows
    ]

    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def review_appeal(
    session: AsyncSession,
    appeal_id: str,
    admin_user_id: str,
    status: AppealStatus,
    notes: Optional[str] = None,
) -> Optional[AppealResponse]:
    """Admin reviews (approves or rejects) a user appeal.

    Only pending appeals can be reviewed. Approved appeals should
    trigger restriction removal in the calling code.

    Args:
        session: The active database session.
        appeal_id: UUID of the appeal to review.
        admin_user_id: UUID of the reviewing admin.
        status: Target status (approved or rejected).
        notes: Optional admin notes on the decision.

    Returns:
        Updated AppealResponse if the appeal was found,
        None if the appeal does not exist.

    Raises:
        ValueError: If the appeal is not in pending status.
    """
    query = select(SybilAppealDB).where(
        SybilAppealDB.id == uuid.UUID(appeal_id)
    )
    result = await session.execute(query)
    appeal = result.scalar_one_or_none()

    if appeal is None:
        return None

    if appeal.status != AppealStatus.PENDING.value:
        raise ValueError(
            f"Appeal is already {appeal.status} and cannot be reviewed"
        )

    appeal.status = status.value
    appeal.reviewed_by = admin_user_id
    appeal.reviewed_at = datetime.now(timezone.utc)
    appeal.review_notes = notes
    await session.flush()

    audit_event(
        "sybil_appeal_reviewed",
        appeal_id=appeal_id,
        admin_user_id=admin_user_id,
        status=status.value,
    )

    return AppealResponse(
        id=str(appeal.id),
        user_id=appeal.user_id,
        audit_log_id=str(appeal.audit_log_id) if appeal.audit_log_id else None,
        reason=appeal.reason,
        evidence=appeal.evidence,
        status=appeal.status,
        reviewed_by=appeal.reviewed_by,
        reviewed_at=appeal.reviewed_at,
        review_notes=appeal.review_notes,
        created_at=appeal.created_at,
    )
