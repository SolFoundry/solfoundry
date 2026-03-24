"""Unit tests for the anti-sybil and anti-gaming system.

Covers:
- check_github_age: young/old account scenarios
- check_github_activity: empty/active account scenarios
- check_ip_cluster: under/over threshold
- check_wallet_cluster: shared funding source
- check_active_claims: under/over limit
- check_t1_cooldown: inside/outside cooldown window
- run_registration_checks / run_claim_checks aggregation
- has_hard_block helper
- API endpoints: appeals, my-flags, admin flags, admin appeals
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import app.core.anti_sybil_config as cfg
from app.models.anti_sybil import (
    AppealStatus,
    CheckResult,
    FlagSeverity,
    FlagType,
)
from app.services import anti_sybil_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _uid() -> str:
    return str(uuid.uuid4())


def _iso(days_ago: int = 0) -> str:
    """Return an ISO-8601 date string for N days ago."""
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago)
    return dt.isoformat()


# ---------------------------------------------------------------------------
# 1. GitHub age check (pure / synchronous)
# ---------------------------------------------------------------------------


class TestCheckGithubAge:
    def test_passes_old_account(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_AGE_DAYS", 30)
        result = anti_sybil_service.check_github_age(_uid(), _iso(60))
        assert result.passed is True

    def test_fails_young_account(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_AGE_DAYS", 30)
        result = anti_sybil_service.check_github_age(_uid(), _iso(5))
        assert result.passed is False
        assert result.flag_type == FlagType.GITHUB_AGE
        assert "5" in result.message

    def test_hard_severity_when_configured(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_AGE_DAYS", 30)
        monkeypatch.setattr(cfg, "GITHUB_AGE_HARD_BLOCK", True)
        result = anti_sybil_service.check_github_age(_uid(), _iso(1))
        assert result.severity == FlagSeverity.HARD

    def test_soft_severity_when_configured(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_AGE_DAYS", 30)
        monkeypatch.setattr(cfg, "GITHUB_AGE_HARD_BLOCK", False)
        result = anti_sybil_service.check_github_age(_uid(), _iso(1))
        assert result.severity == FlagSeverity.SOFT

    def test_exactly_at_minimum_passes(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_AGE_DAYS", 30)
        result = anti_sybil_service.check_github_age(_uid(), _iso(30))
        assert result.passed is True

    def test_accepts_datetime_object(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_AGE_DAYS", 30)
        dt = datetime.now(timezone.utc) - timedelta(days=60)
        result = anti_sybil_service.check_github_age(_uid(), dt)
        assert result.passed is True


# ---------------------------------------------------------------------------
# 2. GitHub activity check (pure / synchronous)
# ---------------------------------------------------------------------------


class TestCheckGithubActivity:
    def test_passes_active_account(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_PUBLIC_REPOS", 1)
        monkeypatch.setattr(cfg, "GITHUB_MIN_SOCIAL_SCORE", 0)
        result = anti_sybil_service.check_github_activity(_uid(), public_repos=5, followers=3)
        assert result.passed is True

    def test_fails_zero_repos(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_PUBLIC_REPOS", 1)
        monkeypatch.setattr(cfg, "GITHUB_MIN_SOCIAL_SCORE", 0)
        result = anti_sybil_service.check_github_activity(_uid(), public_repos=0)
        assert result.passed is False
        assert result.flag_type == FlagType.GITHUB_ACTIVITY
        assert "public_repos" in result.message

    def test_fails_low_social_score(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_PUBLIC_REPOS", 0)
        monkeypatch.setattr(cfg, "GITHUB_MIN_SOCIAL_SCORE", 10)
        result = anti_sybil_service.check_github_activity(
            _uid(), public_repos=5, followers=2, following=3
        )
        assert result.passed is False
        assert "social_score" in result.message

    def test_social_score_skipped_when_threshold_zero(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_PUBLIC_REPOS", 1)
        monkeypatch.setattr(cfg, "GITHUB_MIN_SOCIAL_SCORE", 0)
        result = anti_sybil_service.check_github_activity(
            _uid(), public_repos=2, followers=0, following=0
        )
        assert result.passed is True

    def test_hard_block_severity(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_PUBLIC_REPOS", 5)
        monkeypatch.setattr(cfg, "GITHUB_MIN_SOCIAL_SCORE", 0)
        monkeypatch.setattr(cfg, "GITHUB_ACTIVITY_HARD_BLOCK", True)
        result = anti_sybil_service.check_github_activity(_uid(), public_repos=0)
        assert result.severity == FlagSeverity.HARD


# ---------------------------------------------------------------------------
# 3. has_hard_block helper
# ---------------------------------------------------------------------------


class TestHasHardBlock:
    def test_returns_none_when_all_pass(self):
        results = [
            CheckResult(passed=True, message="ok"),
            CheckResult(passed=True, message="ok"),
        ]
        assert anti_sybil_service.has_hard_block(results) is None

    def test_returns_none_when_soft_fail_only(self):
        results = [
            CheckResult(
                passed=False,
                flag_type=FlagType.IP_CLUSTER,
                severity=FlagSeverity.SOFT,
                message="soft flag",
            )
        ]
        assert anti_sybil_service.has_hard_block(results) is None

    def test_returns_first_hard_fail(self):
        soft = CheckResult(
            passed=False,
            flag_type=FlagType.IP_CLUSTER,
            severity=FlagSeverity.SOFT,
            message="soft",
        )
        hard = CheckResult(
            passed=False,
            flag_type=FlagType.GITHUB_AGE,
            severity=FlagSeverity.HARD,
            message="hard",
        )
        assert anti_sybil_service.has_hard_block([soft, hard]) is hard

    def test_returns_none_for_empty_list(self):
        assert anti_sybil_service.has_hard_block([]) is None


# ---------------------------------------------------------------------------
# 4. IP cluster check (async, mocked DB)
# ---------------------------------------------------------------------------


class TestCheckIpCluster:
    @pytest.mark.asyncio
    async def test_passes_below_threshold(self, monkeypatch):
        monkeypatch.setattr(cfg, "IP_FLAG_THRESHOLD", 3)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 1  # 1 other account
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_ip_cluster(_uid(), "1.2.3.4")

        assert result.passed is True

    @pytest.mark.asyncio
    async def test_fails_at_threshold(self, monkeypatch):
        monkeypatch.setattr(cfg, "IP_FLAG_THRESHOLD", 3)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 3  # exactly at threshold
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_ip_cluster(_uid(), "1.2.3.4")

        assert result.passed is False
        assert result.flag_type == FlagType.IP_CLUSTER
        assert result.severity == FlagSeverity.SOFT  # always soft

    @pytest.mark.asyncio
    async def test_always_soft_severity(self, monkeypatch):
        monkeypatch.setattr(cfg, "IP_FLAG_THRESHOLD", 1)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 10
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_ip_cluster(_uid(), "10.0.0.1")

        assert result.severity == FlagSeverity.SOFT


# ---------------------------------------------------------------------------
# 5. Wallet cluster check (async, mocked DB)
# ---------------------------------------------------------------------------


class TestCheckWalletCluster:
    @pytest.mark.asyncio
    async def test_passes_no_funding_source(self):
        row = MagicMock()
        row.funding_source = None

        mock_scalars = MagicMock()
        mock_scalars.first.return_value = row

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_wallet_cluster(_uid(), "wallet1")

        assert result.passed is True

    @pytest.mark.asyncio
    async def test_passes_below_threshold(self, monkeypatch):
        monkeypatch.setattr(cfg, "WALLET_CLUSTER_FLAG_THRESHOLD", 2)

        row = MagicMock()
        row.funding_source = "funder_abc"

        mock_scalars = MagicMock()
        mock_scalars.first.return_value = row

        count_result = MagicMock()
        count_result.scalar.return_value = 1

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(side_effect=[
            MagicMock(scalars=MagicMock(return_value=mock_scalars)),
            count_result,
        ])

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_wallet_cluster(_uid(), "wallet1")

        assert result.passed is True

    @pytest.mark.asyncio
    async def test_fails_at_threshold(self, monkeypatch):
        monkeypatch.setattr(cfg, "WALLET_CLUSTER_FLAG_THRESHOLD", 2)

        row = MagicMock()
        row.funding_source = "funder_abc"

        mock_scalars = MagicMock()
        mock_scalars.first.return_value = row

        count_result = MagicMock()
        count_result.scalar.return_value = 2

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(side_effect=[
            MagicMock(scalars=MagicMock(return_value=mock_scalars)),
            count_result,
        ])

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_wallet_cluster(_uid(), "wallet1")

        assert result.passed is False
        assert result.flag_type == FlagType.WALLET_CLUSTER
        assert result.severity == FlagSeverity.HARD


# ---------------------------------------------------------------------------
# 6. Active claims check (async, mocked DB)
# ---------------------------------------------------------------------------


class TestCheckActiveClaims:
    @pytest.mark.asyncio
    async def test_passes_under_limit(self, monkeypatch):
        monkeypatch.setattr(cfg, "MAX_ACTIVE_CLAIMS", 3)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 2
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_active_claims(_uid())

        assert result.passed is True

    @pytest.mark.asyncio
    async def test_fails_at_limit(self, monkeypatch):
        monkeypatch.setattr(cfg, "MAX_ACTIVE_CLAIMS", 3)
        monkeypatch.setattr(cfg, "CLAIMS_HARD_BLOCK", True)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 3
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_active_claims(_uid())

        assert result.passed is False
        assert result.flag_type == FlagType.CLAIM_RATE
        assert result.severity == FlagSeverity.HARD

    @pytest.mark.asyncio
    async def test_soft_block_when_configured(self, monkeypatch):
        monkeypatch.setattr(cfg, "MAX_ACTIVE_CLAIMS", 3)
        monkeypatch.setattr(cfg, "CLAIMS_HARD_BLOCK", False)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar.return_value = 5
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_active_claims(_uid())

        assert result.severity == FlagSeverity.SOFT


# ---------------------------------------------------------------------------
# 7. T1 cooldown check (async, mocked DB)
# ---------------------------------------------------------------------------


class TestCheckT1Cooldown:
    @pytest.mark.asyncio
    async def test_passes_no_recent_t1(self):
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_t1_cooldown(_uid())

        assert result.passed is True

    @pytest.mark.asyncio
    async def test_fails_within_cooldown(self, monkeypatch):
        monkeypatch.setattr(cfg, "T1_COOLDOWN_HOURS", 24)
        monkeypatch.setattr(cfg, "T1_COOLDOWN_HARD_BLOCK", False)

        # Recent T1 completion 2 hours ago
        recent_ts = datetime.now(timezone.utc) - timedelta(hours=2)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = recent_ts
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_t1_cooldown(_uid())

        assert result.passed is False
        assert result.flag_type == FlagType.T1_FARMING
        assert "remaining" in result.message

    @pytest.mark.asyncio
    async def test_hard_block_severity_when_configured(self, monkeypatch):
        monkeypatch.setattr(cfg, "T1_COOLDOWN_HOURS", 24)
        monkeypatch.setattr(cfg, "T1_COOLDOWN_HARD_BLOCK", True)

        recent_ts = datetime.now(timezone.utc) - timedelta(hours=1)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = recent_ts
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_ctx = MagicMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_session)
        mock_ctx.__aexit__ = AsyncMock(return_value=None)

        with patch("app.services.anti_sybil_service.get_db_session", return_value=mock_ctx):
            result = await anti_sybil_service.check_t1_cooldown(_uid())

        assert result.severity == FlagSeverity.HARD


# ---------------------------------------------------------------------------
# 8. run_registration_checks aggregation
# ---------------------------------------------------------------------------


class TestRunRegistrationChecks:
    @pytest.mark.asyncio
    async def test_returns_three_results(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_AGE_DAYS", 30)
        monkeypatch.setattr(cfg, "GITHUB_MIN_PUBLIC_REPOS", 1)
        monkeypatch.setattr(cfg, "GITHUB_MIN_SOCIAL_SCORE", 0)
        monkeypatch.setattr(cfg, "IP_FLAG_THRESHOLD", 3)

        # Mock all DB/flag operations
        with (
            patch.object(anti_sybil_service, "flag_user", new=AsyncMock()),
            patch.object(anti_sybil_service, "record_ip", new=AsyncMock()),
            patch.object(anti_sybil_service, "check_ip_cluster", new=AsyncMock(
                return_value=CheckResult(passed=True, message="ok")
            )),
        ):
            results = await anti_sybil_service.run_registration_checks(
                user_id=_uid(),
                ip="192.168.1.1",
                github_created_at=_iso(60),  # old enough
                public_repos=5,
                followers=10,
                following=5,
            )

        # age + activity + ip_cluster
        assert len(results) == 3
        assert all(r.passed for r in results)

    @pytest.mark.asyncio
    async def test_flags_persisted_on_failure(self, monkeypatch):
        monkeypatch.setattr(cfg, "GITHUB_MIN_AGE_DAYS", 30)
        monkeypatch.setattr(cfg, "GITHUB_MIN_PUBLIC_REPOS", 1)
        monkeypatch.setattr(cfg, "GITHUB_MIN_SOCIAL_SCORE", 0)
        monkeypatch.setattr(cfg, "IP_FLAG_THRESHOLD", 3)
        monkeypatch.setattr(cfg, "GITHUB_AGE_HARD_BLOCK", True)

        mock_flag_user = AsyncMock()

        with (
            patch.object(anti_sybil_service, "flag_user", new=mock_flag_user),
            patch.object(anti_sybil_service, "record_ip", new=AsyncMock()),
            patch.object(anti_sybil_service, "check_ip_cluster", new=AsyncMock(
                return_value=CheckResult(passed=True, message="ok")
            )),
        ):
            results = await anti_sybil_service.run_registration_checks(
                user_id=_uid(),
                ip="10.0.0.1",
                github_created_at=_iso(1),  # too young
                public_repos=5,
            )

        # flag_user should have been called for the age failure
        assert mock_flag_user.call_count >= 1
        age_result = next(r for r in results if r.flag_type == FlagType.GITHUB_AGE)
        assert age_result.passed is False


# ---------------------------------------------------------------------------
# 9. run_claim_checks aggregation
# ---------------------------------------------------------------------------


class TestRunClaimChecks:
    @pytest.mark.asyncio
    async def test_tier1_runs_both_checks(self, monkeypatch):
        mock_active = AsyncMock(return_value=CheckResult(passed=True, message="ok"))
        mock_cooldown = AsyncMock(return_value=CheckResult(passed=True, message="ok"))

        with (
            patch.object(anti_sybil_service, "check_active_claims", new=mock_active),
            patch.object(anti_sybil_service, "check_t1_cooldown", new=mock_cooldown),
            patch.object(anti_sybil_service, "flag_user", new=AsyncMock()),
        ):
            results = await anti_sybil_service.run_claim_checks(_uid(), bounty_tier=1)

        assert len(results) == 2
        mock_active.assert_called_once()
        mock_cooldown.assert_called_once()

    @pytest.mark.asyncio
    async def test_non_t1_skips_cooldown(self):
        mock_active = AsyncMock(return_value=CheckResult(passed=True, message="ok"))
        mock_cooldown = AsyncMock(return_value=CheckResult(passed=True, message="ok"))

        with (
            patch.object(anti_sybil_service, "check_active_claims", new=mock_active),
            patch.object(anti_sybil_service, "check_t1_cooldown", new=mock_cooldown),
            patch.object(anti_sybil_service, "flag_user", new=AsyncMock()),
        ):
            results = await anti_sybil_service.run_claim_checks(_uid(), bounty_tier=2)

        assert len(results) == 1
        mock_cooldown.assert_not_called()

    @pytest.mark.asyncio
    async def test_hard_block_detected_in_results(self, monkeypatch):
        monkeypatch.setattr(cfg, "CLAIMS_HARD_BLOCK", True)

        fail_result = CheckResult(
            passed=False,
            flag_type=FlagType.CLAIM_RATE,
            severity=FlagSeverity.HARD,
            message="too many claims",
        )
        mock_active = AsyncMock(return_value=fail_result)

        with (
            patch.object(anti_sybil_service, "check_active_claims", new=mock_active),
            patch.object(anti_sybil_service, "flag_user", new=AsyncMock()),
        ):
            results = await anti_sybil_service.run_claim_checks(_uid(), bounty_tier=2)

        blocker = anti_sybil_service.has_hard_block(results)
        assert blocker is not None
        assert blocker.flag_type == FlagType.CLAIM_RATE


# ---------------------------------------------------------------------------
# 10. API endpoints (in-memory SQLite via TestClient)
# ---------------------------------------------------------------------------


class TestAntiSybilApi:
    """Integration tests for the anti-sybil REST endpoints."""

    @pytest.fixture()
    def app_client(self):
        """Create a minimal FastAPI app with the anti-sybil router."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from app.api.anti_sybil import router

        test_app = FastAPI()
        test_app.include_router(router)
        return TestClient(test_app, raise_server_exceptions=False)

    def test_my_flags_requires_auth(self, app_client):
        """GET /anti-sybil/my-flags returns 401/403 without token."""
        resp = app_client.get("/anti-sybil/my-flags")
        assert resp.status_code in (401, 403, 422)

    def test_submit_appeal_requires_auth(self, app_client):
        resp = app_client.post(
            "/anti-sybil/appeal",
            json={"flag_id": str(uuid.uuid4()), "reason": "a" * 25},
        )
        assert resp.status_code in (401, 403, 422)

    def test_admin_flags_requires_auth(self, app_client):
        resp = app_client.get("/admin/sybil/flags")
        assert resp.status_code in (401, 403, 422)

    def test_admin_appeals_requires_auth(self, app_client):
        resp = app_client.get("/admin/sybil/appeals")
        assert resp.status_code in (401, 403, 422)

    def test_admin_resolve_flag_requires_auth(self, app_client):
        resp = app_client.post(
            f"/admin/sybil/flags/{uuid.uuid4()}/resolve",
            json={"resolved_note": "false positive confirmed"},
        )
        assert resp.status_code in (401, 403, 422)

    def test_admin_resolve_appeal_requires_auth(self, app_client):
        resp = app_client.post(
            f"/admin/sybil/appeals/{uuid.uuid4()}/resolve",
            json={"status": "approved", "reviewer_note": "looks good"},
        )
        assert resp.status_code in (401, 403, 422)

    def test_my_flags_with_valid_token(self, app_client, monkeypatch):
        """Authenticated user gets empty list when no flags exist."""
        from app.api.anti_sybil import router
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        import app.api.auth as auth_module

        test_app = FastAPI()

        async def _fake_get_db():
            from app.database import async_session_factory
            async with async_session_factory() as session:
                yield session

        test_app.include_router(router)

        # Patch get_current_user_id to return a fixed user_id
        with patch("app.api.anti_sybil.get_current_user_id", return_value="user-123"), \
             patch("app.api.anti_sybil.get_db", _fake_get_db):
            # We need an in-memory DB with the tables created
            async def _init():
                from app.database import engine, Base
                from app.models.anti_sybil import SybilFlagTable, SybilAppealTable, IpAccountMapTable, WalletFundingMapTable  # noqa
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
            asyncio.get_event_loop().run_until_complete(_init())

            client = TestClient(test_app, raise_server_exceptions=True)
            resp = client.get("/anti-sybil/my-flags", headers={"Authorization": "Bearer token"})
            assert resp.status_code == 200
            assert resp.json() == []

    def test_appeal_reason_too_short_rejected(self, app_client):
        """Appeal reason shorter than 20 chars should return 422."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from app.api.anti_sybil import router

        test_app = FastAPI()
        test_app.include_router(router)

        with patch("app.api.anti_sybil.get_current_user_id", return_value="user-123"):
            client = TestClient(test_app, raise_server_exceptions=False)
            resp = client.post(
                "/anti-sybil/appeal",
                json={"flag_id": str(uuid.uuid4()), "reason": "too short"},
                headers={"Authorization": "Bearer token"},
            )
        assert resp.status_code == 422

    def test_admin_resolve_appeal_invalid_status(self):
        """admin resolve appeal with bad status returns 400."""
        import app.api.admin as admin_module
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from app.api.anti_sybil import router

        TEST_KEY = "test-admin-key"
        test_app = FastAPI()
        test_app.include_router(router)

        with patch.object(admin_module, "_ADMIN_API_KEY", TEST_KEY):
            client = TestClient(test_app, raise_server_exceptions=False)
            resp = client.post(
                f"/admin/sybil/appeals/{uuid.uuid4()}/resolve",
                json={"status": "pending", "reviewer_note": "reviewing"},
                headers={"Authorization": f"Bearer {TEST_KEY}"},
            )
        assert resp.status_code == 400
