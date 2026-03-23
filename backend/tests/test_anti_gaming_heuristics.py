"""Unit tests for anti-gaming heuristic functions (no DB / network)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.anti_gaming_settings import AntiGamingSettings, reset_anti_gaming_settings_cache
from app.services.anti_gaming_heuristics import (
    evaluate_active_claim_limit,
    evaluate_github_account_age,
    evaluate_github_commit_total,
    evaluate_github_nonempty_account,
    evaluate_github_public_repos,
    evaluate_shared_ip_accounts,
    evaluate_t1_completion_cooldown,
    evaluate_wallet_cluster_concentration,
)


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    reset_anti_gaming_settings_cache()
    yield
    reset_anti_gaming_settings_cache()


def _settings(**kwargs) -> AntiGamingSettings:
    base = dict(
        enabled=True,
        github_min_account_age_days=30,
        github_min_public_repos=1,
        github_min_commit_total=5,
        github_min_followers=0,
        github_reject_empty_profile=True,
        max_active_claims_per_user=3,
        t1_completion_cooldown_hours=24.0,
        ip_flag_account_threshold=3,
        wallet_cluster_flag_user_threshold=2,
        wallet_clustering_enabled=True,
        wallet_funder_probe_max_signatures=25,
        github_skip_commits_if_unavailable=False,
    )
    base.update(kwargs)
    return AntiGamingSettings(**base)


def test_github_account_age_passes():
    now = datetime(2026, 3, 1, tzinfo=timezone.utc)
    created = now - timedelta(days=40)
    r = evaluate_github_account_age(
        github_created_at=created, now=now, settings=_settings()
    )
    assert r.passed and r.code == "github_account_age"


def test_github_account_age_fails_too_new():
    now = datetime(2026, 3, 1, tzinfo=timezone.utc)
    created = now - timedelta(days=5)
    r = evaluate_github_account_age(
        github_created_at=created, now=now, settings=_settings()
    )
    assert not r.passed and r.code == "github_account_too_new"


def test_github_account_age_unknown():
    now = datetime(2026, 3, 1, tzinfo=timezone.utc)
    r = evaluate_github_account_age(
        github_created_at=None, now=now, settings=_settings()
    )
    assert not r.passed and r.code == "github_age_unknown"


def test_github_public_repos():
    assert evaluate_github_public_repos(
        public_repos=2, settings=_settings(github_min_public_repos=1)
    ).passed
    assert not evaluate_github_public_repos(
        public_repos=0, settings=_settings(github_min_public_repos=1)
    ).passed


def test_github_commits():
    assert evaluate_github_commit_total(
        commit_total=10, settings=_settings(github_min_commit_total=5)
    ).passed
    assert not evaluate_github_commit_total(
        commit_total=1, settings=_settings(github_min_commit_total=5)
    ).passed
    assert not evaluate_github_commit_total(
        commit_total=None, settings=_settings()
    ).passed


def test_github_nonempty():
    assert evaluate_github_nonempty_account(
        public_repos=1, followers=0, settings=_settings()
    ).passed
    assert not evaluate_github_nonempty_account(
        public_repos=0, followers=0, settings=_settings(github_min_followers=0)
    ).passed
    assert evaluate_github_nonempty_account(
        public_repos=0,
        followers=10,
        settings=_settings(github_min_followers=0),
    ).passed
    assert evaluate_github_nonempty_account(
        public_repos=0,
        followers=5,
        settings=_settings(github_min_followers=5),
    ).passed
    assert not evaluate_github_nonempty_account(
        public_repos=0,
        followers=4,
        settings=_settings(github_min_followers=5),
    ).passed
    assert evaluate_github_nonempty_account(
        public_repos=0,
        followers=0,
        settings=_settings(github_reject_empty_profile=False),
    ).passed


def test_active_claim_limit():
    s = _settings(max_active_claims_per_user=3)
    assert evaluate_active_claim_limit(active_claim_count=0, settings=s).passed
    assert evaluate_active_claim_limit(active_claim_count=2, settings=s).passed
    assert not evaluate_active_claim_limit(active_claim_count=3, settings=s).passed


def test_t1_cooldown():
    now = datetime(2026, 3, 2, tzinfo=timezone.utc)
    last = datetime(2026, 3, 1, tzinfo=timezone.utc)
    assert evaluate_t1_completion_cooldown(
        last_completion_at=last,
        now=now,
        settings=_settings(t1_completion_cooldown_hours=12.0),
    ).passed
    assert not evaluate_t1_completion_cooldown(
        last_completion_at=last,
        now=now,
        settings=_settings(t1_completion_cooldown_hours=48.0),
    ).passed
    assert evaluate_t1_completion_cooldown(
        last_completion_at=None, now=now, settings=_settings()
    ).passed


def test_shared_ip_never_blocks_but_flags():
    s = _settings(ip_flag_account_threshold=3)
    low = evaluate_shared_ip_accounts(distinct_accounts_on_ip=2, settings=s)
    assert low.passed and not low.details["suspicious"]
    high = evaluate_shared_ip_accounts(distinct_accounts_on_ip=3, settings=s)
    assert high.passed and high.details["suspicious"]


def test_wallet_cluster_never_blocks_but_flags():
    s = _settings(wallet_cluster_flag_user_threshold=2)
    ok = evaluate_wallet_cluster_concentration(
        users_sharing_funding_source=1, settings=s
    )
    assert ok.passed and not ok.details["suspicious"]
    bad = evaluate_wallet_cluster_concentration(
        users_sharing_funding_source=2, settings=s
    )
    assert bad.passed and bad.details["suspicious"]
