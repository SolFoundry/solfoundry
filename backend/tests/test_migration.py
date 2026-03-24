"""Comprehensive tests for off-chain to on-chain migration (Issue #505).

Tests cover all acceptance criteria:
    - Migration script reads database state and writes to on-chain PDAs
    - Handles reputation scores, bounty records, and tier levels
    - Batch processing (batches of 10)
    - Idempotent: safe to re-run (checks PDA existence)
    - Dry-run mode: simulates without sending transactions
    - Progress reporting: shows N/total migrated
    - Rollback plan: can revert to off-chain if issues
    - Verification step: compares on-chain state to database
    - Logging: full audit trail
    - Tests with local validator (mocked RPC)

Test categories:
    - TestMigrationModels: Pydantic schema validation
    - TestOnchainClient: PDA derivation and RPC operations
    - TestMigrationService: Core migration service operations
    - TestMigrationAPI: API endpoint integration tests
    - TestMigrationSpecRequirements: Named after spec requirements
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.api.migration import router as migration_router, ADMIN_USER_IDS
from app.auth import get_current_user_id
from app.database import Base, engine, async_session_factory
from app.models.bounty import BountyCreate, BountyDB, BountyStatus
from app.models.migration import (
    MigrationEntityType,
    MigrationJobCreate,
    MigrationJobStatus,
    MigrationJobTable,
    MigrationRecordStatus,
    MigrationRecordTable,
    RollbackRequest,
    VerificationResult,
)
from app.services import bounty_service, contributor_service
from app.services.migration_service import (
    _extract_bounty_records,
    _extract_reputation_records,
    _extract_tier_records,
    start_migration_job,
    get_migration_job,
    get_migration_progress,
    list_migration_jobs,
    rollback_migration,
    verify_migration,
)
from app.services.onchain_client import (
    OnchainClientError,
    derive_pda_address,
    simulate_write,
)


# ---------------------------------------------------------------------------
# Test app setup
# ---------------------------------------------------------------------------

ADMIN_USER_ID = "00000000-0000-0000-0000-000000000001"
NON_ADMIN_USER_ID = "00000000-0000-0000-0000-000000000099"

# Ensure test admin is in the admin list
os.environ["ADMIN_USER_IDS"] = ADMIN_USER_ID

from contextlib import asynccontextmanager


async def _create_migration_tables() -> None:
    """Create only the migration tables in SQLite (avoids JSONB errors from bounties)."""
    async with engine.begin() as conn:
        await conn.run_sync(
            MigrationJobTable.__table__.create, checkfirst=True
        )
        await conn.run_sync(
            MigrationRecordTable.__table__.create, checkfirst=True
        )


@asynccontextmanager
async def _test_lifespan(app: FastAPI):
    """Test app lifespan: creates migration tables on startup."""
    await _create_migration_tables()
    yield


_test_app = FastAPI(lifespan=_test_lifespan)
_test_app.include_router(migration_router)


async def _override_auth_admin():
    """Override auth to return admin user ID for testing."""
    return ADMIN_USER_ID


async def _override_auth_non_admin():
    """Override auth to return non-admin user ID for testing."""
    return NON_ADMIN_USER_ID


_test_app.dependency_overrides[get_current_user_id] = _override_auth_admin
client = TestClient(_test_app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def clear_stores():
    """Ensure each test starts with clean in-memory stores."""
    bounty_service._bounty_store.clear()
    contributor_service._store.clear()
    yield
    bounty_service._bounty_store.clear()
    contributor_service._store.clear()


@pytest.fixture(autouse=True)
def set_admin_env(monkeypatch):
    """Ensure admin user IDs are set for each test."""
    monkeypatch.setenv("ADMIN_USER_IDS", ADMIN_USER_ID)
    # Reload the ADMIN_USER_IDS set in the migration module
    import app.api.migration as migration_mod
    migration_mod.ADMIN_USER_IDS.clear()
    migration_mod.ADMIN_USER_IDS.add(ADMIN_USER_ID)


@pytest.fixture
def sample_contributors():
    """Create sample contributors in the in-memory store.

    Returns:
        List of contributor IDs that were created.
    """
    from app.models.contributor import ContributorDB
    ids = []
    for i in range(5):
        cid = str(uuid.uuid4())
        contributor_service._store[cid] = ContributorDB(
            id=uuid.UUID(cid),
            username=f"contributor_{i}",
            display_name=f"Contributor {i}",
            email=f"contributor_{i}@example.com",
            skills=["python", "rust"] if i % 2 == 0 else ["typescript"],
            badges=[f"tier-{min(i + 1, 3)}"],
            total_contributions=i * 3,
            total_bounties_completed=i * 2,
            total_earnings=float(i * 1000),
            reputation_score=i * 100,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        ids.append(cid)
    return ids


@pytest.fixture
def sample_bounties():
    """Create sample bounties in the in-memory store with various statuses.

    Returns:
        List of bounty IDs that were created.
    """
    ids = []
    statuses = [
        BountyStatus.OPEN,
        BountyStatus.IN_PROGRESS,
        BountyStatus.COMPLETED,
        BountyStatus.PAID,
        BountyStatus.COMPLETED,
    ]
    for i, status in enumerate(statuses):
        bid = str(uuid.uuid4())
        bounty_service._bounty_store[bid] = BountyDB(
            id=bid,
            title=f"Bounty {i}",
            description=f"Description for bounty {i}",
            tier=min(i + 1, 3),
            reward_amount=float((i + 1) * 100),
            status=status,
            created_by=f"user_{i}",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        ids.append(bid)
    return ids


# ===========================================================================
# MODEL TESTS
# ===========================================================================


class TestMigrationModels:
    """Test Pydantic model validation for migration schemas."""

    def test_spec_requirement_entity_types_exist(self):
        """Spec: handles reputation scores, bounty records, tier levels."""
        assert MigrationEntityType.REPUTATION.value == "reputation"
        assert MigrationEntityType.BOUNTY_RECORD.value == "bounty_record"
        assert MigrationEntityType.TIER_LEVEL.value == "tier_level"

    def test_job_create_defaults(self):
        """Default job creation uses dry_run=True and batch_size=10."""
        job = MigrationJobCreate(entity_type=MigrationEntityType.REPUTATION)
        assert job.dry_run is True
        assert job.batch_size == 10

    def test_spec_requirement_batch_size_configurable(self):
        """Spec: batch processing (configurable batch size)."""
        job = MigrationJobCreate(
            entity_type=MigrationEntityType.REPUTATION,
            batch_size=5,
        )
        assert job.batch_size == 5

    def test_batch_size_validation_minimum(self):
        """Batch size must be at least 1."""
        with pytest.raises(Exception):
            MigrationJobCreate(
                entity_type=MigrationEntityType.REPUTATION,
                batch_size=0,
            )

    def test_batch_size_validation_maximum(self):
        """Batch size must not exceed 50."""
        with pytest.raises(Exception):
            MigrationJobCreate(
                entity_type=MigrationEntityType.REPUTATION,
                batch_size=51,
            )

    def test_job_status_lifecycle(self):
        """All migration job statuses are defined."""
        assert MigrationJobStatus.PENDING.value == "pending"
        assert MigrationJobStatus.RUNNING.value == "running"
        assert MigrationJobStatus.COMPLETED.value == "completed"
        assert MigrationJobStatus.FAILED.value == "failed"
        assert MigrationJobStatus.ROLLED_BACK.value == "rolled_back"
        assert MigrationJobStatus.DRY_RUN_COMPLETE.value == "dry_run_complete"

    def test_record_status_lifecycle(self):
        """All migration record statuses are defined."""
        assert MigrationRecordStatus.PENDING.value == "pending"
        assert MigrationRecordStatus.MIGRATED.value == "migrated"
        assert MigrationRecordStatus.SKIPPED.value == "skipped"
        assert MigrationRecordStatus.FAILED.value == "failed"
        assert MigrationRecordStatus.VERIFIED.value == "verified"
        assert MigrationRecordStatus.ROLLED_BACK.value == "rolled_back"

    def test_rollback_request_requires_reason(self):
        """Rollback requires a reason for audit trail."""
        with pytest.raises(Exception):
            RollbackRequest(reason="")

    def test_rollback_request_minimum_length(self):
        """Rollback reason must be at least 5 characters."""
        with pytest.raises(Exception):
            RollbackRequest(reason="abc")


# ===========================================================================
# ONCHAIN CLIENT TESTS
# ===========================================================================


class TestOnchainClient:
    """Test PDA derivation and simulated on-chain operations."""

    def test_spec_requirement_pda_derivation_deterministic(self):
        """PDA addresses are deterministic for idempotency."""
        addr1 = derive_pda_address("reputation", "user-123")
        addr2 = derive_pda_address("reputation", "user-123")
        assert addr1 == addr2

    def test_pda_derivation_different_entities(self):
        """Different entity types produce different PDA addresses."""
        addr_rep = derive_pda_address("reputation", "user-123")
        addr_bounty = derive_pda_address("bounty_record", "user-123")
        assert addr_rep != addr_bounty

    def test_pda_derivation_different_ids(self):
        """Different entity IDs produce different PDA addresses."""
        addr1 = derive_pda_address("reputation", "user-1")
        addr2 = derive_pda_address("reputation", "user-2")
        assert addr1 != addr2

    def test_pda_derivation_empty_entity_type_raises(self):
        """Empty entity type raises ValueError (fail-closed)."""
        with pytest.raises(ValueError, match="must not be empty"):
            derive_pda_address("", "user-123")

    def test_pda_derivation_empty_entity_id_raises(self):
        """Empty entity ID raises ValueError (fail-closed)."""
        with pytest.raises(ValueError, match="must not be empty"):
            derive_pda_address("reputation", "")

    @pytest.mark.asyncio
    async def test_spec_requirement_dry_run_simulation(self):
        """Spec: dry-run mode simulates without sending transactions."""
        result = await simulate_write(
            pda_address="test_address",
            entity_type="reputation",
            entity_id="user-123",
            data={"reputation_score": 100},
        )
        assert result["action"] == "simulate_write"
        assert result["pda_address"] == "test_address"
        assert result["data_size_bytes"] > 0
        assert result["estimated_rent_lamports"] > 0

    def test_onchain_error_has_tx_signature(self):
        """OnchainClientError can carry a transaction signature."""
        error = OnchainClientError("test error", tx_signature="abc123")
        assert str(error) == "test error"
        assert error.tx_signature == "abc123"

    def test_onchain_error_without_tx_signature(self):
        """OnchainClientError works without a transaction signature."""
        error = OnchainClientError("test error")
        assert error.tx_signature is None


# ===========================================================================
# DATA EXTRACTION TESTS
# ===========================================================================


class TestDataExtraction:
    """Test that off-chain data is correctly extracted for migration."""

    def test_spec_requirement_extract_reputation_scores(self, sample_contributors):
        """Spec: handles user reputation scores."""
        records = _extract_reputation_records()
        assert len(records) == 5
        for record in records:
            assert "entity_id" in record
            assert "username" in record
            assert "reputation_score" in record
            assert "total_contributions" in record

    def test_spec_requirement_extract_bounty_records(self, sample_bounties):
        """Spec: handles completed bounty records."""
        records = _extract_bounty_records()
        # Only completed/paid bounties should be extracted
        assert len(records) == 3  # 2 completed + 1 paid
        for record in records:
            assert "entity_id" in record
            assert "title" in record
            assert "reward_amount" in record
            assert record["status"] in ("completed", "paid")

    def test_spec_requirement_extract_tier_levels(self, sample_contributors):
        """Spec: handles tier levels."""
        records = _extract_tier_records()
        assert len(records) == 5
        for record in records:
            assert "entity_id" in record
            assert "tier_level" in record
            assert record["tier_level"] in (1, 2, 3)
            assert "bounties_completed" in record

    def test_tier_calculation_logic(self):
        """Verify tier level assignment logic matches SolFoundry rules."""
        from app.models.contributor import ContributorDB

        # T1: 0-3 bounties
        cid1 = str(uuid.uuid4())
        contributor_service._store[cid1] = ContributorDB(
            id=uuid.UUID(cid1), username="newbie", display_name="Newbie",
            total_bounties_completed=2, created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        # T2: 4-6 bounties
        cid2 = str(uuid.uuid4())
        contributor_service._store[cid2] = ContributorDB(
            id=uuid.UUID(cid2), username="veteran", display_name="Veteran",
            total_bounties_completed=5, created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        # T3: 7+ bounties
        cid3 = str(uuid.uuid4())
        contributor_service._store[cid3] = ContributorDB(
            id=uuid.UUID(cid3), username="expert", display_name="Expert",
            total_bounties_completed=10, created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        records = _extract_tier_records()
        tier_map = {r["username"]: r["tier_level"] for r in records}
        assert tier_map["newbie"] == 1
        assert tier_map["veteran"] == 2
        assert tier_map["expert"] == 3

    def test_empty_stores_return_empty_lists(self):
        """Empty stores produce empty extraction results."""
        assert _extract_reputation_records() == []
        assert _extract_bounty_records() == []
        assert _extract_tier_records() == []


# ===========================================================================
# MIGRATION SERVICE TESTS
# ===========================================================================


class TestMigrationService:
    """Test core migration service operations with mocked on-chain client."""

    @pytest.mark.asyncio
    async def test_spec_requirement_dry_run_mode(self, sample_contributors):
        """Spec: dry-run mode simulates without sending transactions."""
        await _create_migration_tables()

        request = MigrationJobCreate(
            entity_type=MigrationEntityType.REPUTATION,
            dry_run=True,
            batch_size=10,
        )

        async with async_session_factory() as session:
            result = await start_migration_job(
                session=session, request=request, started_by=ADMIN_USER_ID,
            )

        assert result.status == MigrationJobStatus.DRY_RUN_COMPLETE.value
        assert result.dry_run is True
        assert result.total_records == 5
        assert result.migrated_count == 5
        assert result.failed_count == 0

    @pytest.mark.asyncio
    async def test_spec_requirement_batch_processing(self, sample_contributors):
        """Spec: batch processing with batches of 10 (testing batch of 2)."""
        await _create_migration_tables()

        request = MigrationJobCreate(
            entity_type=MigrationEntityType.REPUTATION,
            dry_run=True,
            batch_size=2,
        )

        async with async_session_factory() as session:
            result = await start_migration_job(
                session=session, request=request, started_by=ADMIN_USER_ID,
            )

        # 5 records in batches of 2 = 3 batches (2+2+1)
        assert result.total_records == 5
        assert result.migrated_count == 5
        assert len(result.records) == 5

    @pytest.mark.asyncio
    async def test_spec_requirement_progress_reporting(self, sample_contributors):
        """Spec: progress reporting shows N/total migrated."""
        await _create_migration_tables()

        request = MigrationJobCreate(
            entity_type=MigrationEntityType.REPUTATION,
            dry_run=True,
            batch_size=10,
        )

        async with async_session_factory() as session:
            result = await start_migration_job(
                session=session, request=request, started_by=ADMIN_USER_ID,
            )
            progress = await get_migration_progress(session, result.id)

        assert progress is not None
        assert progress.total_records == 5
        assert progress.migrated_count == 5
        assert progress.progress_percent == 100.0

    @pytest.mark.asyncio
    async def test_spec_requirement_logging_audit_trail(self, sample_contributors):
        """Spec: full audit trail of what was migrated."""
        await _create_migration_tables()

        request = MigrationJobCreate(
            entity_type=MigrationEntityType.REPUTATION,
            dry_run=True,
        )

        async with async_session_factory() as session:
            result = await start_migration_job(
                session=session, request=request, started_by=ADMIN_USER_ID,
            )

        # Every record has off-chain data snapshot
        for record in result.records:
            assert record.off_chain_data is not None
            assert record.entity_id is not None
            assert record.entity_type == "reputation"
            assert record.pda_address is not None
            assert record.status in (
                MigrationRecordStatus.MIGRATED.value,
                MigrationRecordStatus.SKIPPED.value,
            )

    @pytest.mark.asyncio
    async def test_spec_requirement_rollback_plan(self, sample_contributors):
        """Spec: rollback plan documented (can revert to off-chain if issues)."""
        await _create_migration_tables()

        # Run migration
        request = MigrationJobCreate(
            entity_type=MigrationEntityType.REPUTATION,
            dry_run=True,
        )

        async with async_session_factory() as session:
            result = await start_migration_job(
                session=session, request=request, started_by=ADMIN_USER_ID,
            )

            # Rollback the job
            # Note: dry_run_complete is not eligible for rollback by design.
            # For testing rollback, we need a completed (non-dry-run) job.
            # Test that rollback on dry-run raises appropriate error.
            with pytest.raises(ValueError, match="not eligible"):
                await rollback_migration(
                    session=session, job_id=result.id,
                    reason="Testing rollback on dry-run job",
                )

    @pytest.mark.asyncio
    async def test_migration_job_retrieval(self, sample_contributors):
        """Migration jobs can be retrieved by ID after creation."""
        await _create_migration_tables()

        request = MigrationJobCreate(
            entity_type=MigrationEntityType.REPUTATION,
            dry_run=True,
        )

        async with async_session_factory() as session:
            result = await start_migration_job(
                session=session, request=request, started_by=ADMIN_USER_ID,
            )
            retrieved = await get_migration_job(session, result.id)

        assert retrieved is not None
        assert retrieved.id == result.id
        assert retrieved.entity_type == "reputation"

    @pytest.mark.asyncio
    async def test_migration_job_listing(self, sample_contributors):
        """Migration jobs can be listed with pagination."""
        await _create_migration_tables()

        async with async_session_factory() as session:
            # Create two jobs
            for entity_type in [MigrationEntityType.REPUTATION, MigrationEntityType.TIER_LEVEL]:
                request = MigrationJobCreate(entity_type=entity_type, dry_run=True)
                await start_migration_job(
                    session=session, request=request, started_by=ADMIN_USER_ID,
                )

            listing = await list_migration_jobs(session)

        assert listing.total >= 2
        assert len(listing.items) >= 2

    @pytest.mark.asyncio
    async def test_migration_bounty_records(self, sample_bounties):
        """Migration works for bounty records entity type."""
        await _create_migration_tables()

        request = MigrationJobCreate(
            entity_type=MigrationEntityType.BOUNTY_RECORD,
            dry_run=True,
        )

        async with async_session_factory() as session:
            result = await start_migration_job(
                session=session, request=request, started_by=ADMIN_USER_ID,
            )

        # Only completed/paid bounties should be migrated
        assert result.total_records == 3
        assert result.migrated_count == 3

    @pytest.mark.asyncio
    async def test_migration_tier_levels(self, sample_contributors):
        """Migration works for tier level entity type."""
        await _create_migration_tables()

        request = MigrationJobCreate(
            entity_type=MigrationEntityType.TIER_LEVEL,
            dry_run=True,
        )

        async with async_session_factory() as session:
            result = await start_migration_job(
                session=session, request=request, started_by=ADMIN_USER_ID,
            )

        assert result.total_records == 5
        assert result.migrated_count == 5

    @pytest.mark.asyncio
    async def test_migration_nonexistent_job(self):
        """Getting a nonexistent job returns None."""
        await _create_migration_tables()
        async with async_session_factory() as session:
            result = await get_migration_job(session, str(uuid.uuid4()))
        assert result is None

    @pytest.mark.asyncio
    async def test_migration_invalid_job_id(self):
        """Getting a job with invalid UUID returns None."""
        await _create_migration_tables()
        async with async_session_factory() as session:
            result = await get_migration_job(session, "not-a-uuid")
        assert result is None

    @pytest.mark.asyncio
    async def test_migration_empty_source_data(self):
        """Migration with empty source data creates a job with 0 records."""
        await _create_migration_tables()

        request = MigrationJobCreate(
            entity_type=MigrationEntityType.REPUTATION,
            dry_run=True,
        )

        async with async_session_factory() as session:
            result = await start_migration_job(
                session=session, request=request, started_by=ADMIN_USER_ID,
            )

        assert result.total_records == 0
        assert result.migrated_count == 0
        assert result.status == MigrationJobStatus.DRY_RUN_COMPLETE.value

    @pytest.mark.asyncio
    async def test_rollback_completed_job(self, sample_contributors):
        """Rollback a completed (non-dry-run) job marks records as rolled_back."""
        await _create_migration_tables()

        # Create a mock completed job by patching on-chain writes
        with patch(
            "app.services.migration_service.check_pda_exists",
            new_callable=AsyncMock,
            return_value=False,
        ), patch(
            "app.services.migration_service.write_pda_data",
            new_callable=AsyncMock,
            return_value="mock_tx_signature_123",
        ):
            request = MigrationJobCreate(
                entity_type=MigrationEntityType.REPUTATION,
                dry_run=False,
                batch_size=10,
            )
            async with async_session_factory() as session:
                result = await start_migration_job(
                    session=session, request=request, started_by=ADMIN_USER_ID,
                )
                assert result.status == MigrationJobStatus.COMPLETED.value
                assert result.migrated_count == 5

                # Now rollback
                rollback_result = await rollback_migration(
                    session=session, job_id=result.id,
                    reason="Found data integrity issue during verification",
                )

            assert rollback_result.status == MigrationJobStatus.ROLLED_BACK.value
            assert rollback_result.rolled_back_count == 5
            assert "integrity issue" in rollback_result.reason

    @pytest.mark.asyncio
    async def test_rollback_nonexistent_job(self):
        """Rollback of a nonexistent job raises ValueError."""
        await _create_migration_tables()
        async with async_session_factory() as session:
            with pytest.raises(ValueError, match="not found"):
                await rollback_migration(
                    session=session, job_id=str(uuid.uuid4()),
                    reason="Testing nonexistent job rollback",
                )

    @pytest.mark.asyncio
    async def test_spec_idempotent_live_skips_existing(self, sample_contributors):
        """Idempotent: live migration skips records where PDA already exists."""
        await _create_migration_tables()

        with patch(
            "app.services.migration_service.check_pda_exists",
            new_callable=AsyncMock,
            return_value=True,  # All PDAs "already exist"
        ):
            request = MigrationJobCreate(
                entity_type=MigrationEntityType.REPUTATION,
                dry_run=False,
                batch_size=10,
            )
            async with async_session_factory() as session:
                result = await start_migration_job(
                    session=session, request=request, started_by=ADMIN_USER_ID,
                )

        assert result.skipped_count == 5
        assert result.migrated_count == 0
        for record in result.records:
            assert record.status == MigrationRecordStatus.SKIPPED.value


# ===========================================================================
# API ENDPOINT TESTS
# ===========================================================================


class TestMigrationAPI:
    """Integration tests for the migration API endpoints."""

    def test_spec_requirement_create_dry_run_job(self, sample_contributors):
        """Spec: dry-run mode via API simulates without transactions."""
        resp = client.post(
            "/api/migration/jobs",
            json={
                "entity_type": "reputation",
                "dry_run": True,
                "batch_size": 10,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["entity_type"] == "reputation"
        assert body["dry_run"] is True
        assert body["status"] == "dry_run_complete"
        assert body["total_records"] == 5
        assert body["migrated_count"] == 5

    def test_spec_requirement_create_bounty_migration(self, sample_bounties):
        """Spec: handles completed bounty records via API."""
        resp = client.post(
            "/api/migration/jobs",
            json={
                "entity_type": "bounty_record",
                "dry_run": True,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["entity_type"] == "bounty_record"
        assert body["total_records"] == 3  # Only completed/paid

    def test_spec_requirement_create_tier_migration(self, sample_contributors):
        """Spec: handles tier levels via API."""
        resp = client.post(
            "/api/migration/jobs",
            json={
                "entity_type": "tier_level",
                "dry_run": True,
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["entity_type"] == "tier_level"
        assert body["total_records"] == 5

    def test_list_migration_jobs(self, sample_contributors):
        """List endpoint returns paginated job results."""
        # Create a job first
        client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        resp = client.get("/api/migration/jobs")
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert body["total"] >= 1

    def test_get_migration_job_detail(self, sample_contributors):
        """Get single job endpoint returns full details with records."""
        create_resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        job_id = create_resp.json()["id"]

        resp = client.get(f"/api/migration/jobs/{job_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == job_id
        assert "records" in body

    def test_get_migration_job_not_found(self):
        """Get endpoint returns 404 for nonexistent job."""
        fake_id = str(uuid.uuid4())
        resp = client.get(f"/api/migration/jobs/{fake_id}")
        assert resp.status_code == 404

    def test_spec_requirement_progress_reporting_api(self, sample_contributors):
        """Spec: progress reporting shows N/total migrated via API."""
        create_resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        job_id = create_resp.json()["id"]

        resp = client.get(f"/api/migration/jobs/{job_id}/progress")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_records"] == 5
        assert body["migrated_count"] == 5
        assert body["progress_percent"] == 100.0

    def test_progress_not_found(self):
        """Progress endpoint returns 404 for nonexistent job."""
        fake_id = str(uuid.uuid4())
        resp = client.get(f"/api/migration/jobs/{fake_id}/progress")
        assert resp.status_code == 404

    def test_spec_requirement_verification_api(self, sample_contributors):
        """Spec: verification step compares on-chain state to database via API."""
        create_resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        job_id = create_resp.json()["id"]

        resp = client.post(f"/api/migration/jobs/{job_id}/verify")
        assert resp.status_code == 200
        body = resp.json()
        assert body["job_id"] == job_id
        assert "total_checked" in body
        assert "matched_count" in body
        assert "mismatched_count" in body
        assert "missing_on_chain_count" in body
        assert "results" in body

    def test_verification_not_found(self):
        """Verification endpoint returns 404 for nonexistent job."""
        fake_id = str(uuid.uuid4())
        resp = client.post(f"/api/migration/jobs/{fake_id}/verify")
        assert resp.status_code == 404

    def test_invalid_entity_type(self):
        """Invalid entity type returns 422 validation error."""
        resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "invalid_type", "dry_run": True},
        )
        assert resp.status_code == 422

    def test_batch_size_too_large(self):
        """Batch size exceeding maximum returns 422."""
        resp = client.post(
            "/api/migration/jobs",
            json={
                "entity_type": "reputation",
                "dry_run": True,
                "batch_size": 100,
            },
        )
        assert resp.status_code == 422

    def test_filter_jobs_by_entity_type(self, sample_contributors):
        """List endpoint filters by entity type."""
        client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        resp = client.get("/api/migration/jobs?entity_type=reputation")
        assert resp.status_code == 200
        body = resp.json()
        for item in body["items"]:
            assert item["entity_type"] == "reputation"


# ===========================================================================
# AUTHORIZATION TESTS
# ===========================================================================


class TestMigrationAuthorization:
    """Test that migration endpoints enforce admin-only authorization."""

    def test_spec_requirement_admin_only_create(self, sample_contributors):
        """Mutation endpoints require admin authorization, not just authentication."""
        # Create a non-admin test app
        non_admin_app = FastAPI()
        non_admin_app.include_router(migration_router)
        non_admin_app.dependency_overrides[get_current_user_id] = _override_auth_non_admin
        non_admin_client = TestClient(non_admin_app)

        resp = non_admin_client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        assert resp.status_code == 403
        assert "admin" in resp.json()["detail"].lower()

    def test_spec_requirement_admin_only_verify(self):
        """Verification requires admin authorization."""
        non_admin_app = FastAPI()
        non_admin_app.include_router(migration_router)
        non_admin_app.dependency_overrides[get_current_user_id] = _override_auth_non_admin
        non_admin_client = TestClient(non_admin_app)

        fake_id = str(uuid.uuid4())
        resp = non_admin_client.post(f"/api/migration/jobs/{fake_id}/verify")
        assert resp.status_code == 403

    def test_spec_requirement_admin_only_rollback(self):
        """Rollback requires admin authorization."""
        non_admin_app = FastAPI()
        non_admin_app.include_router(migration_router)
        non_admin_app.dependency_overrides[get_current_user_id] = _override_auth_non_admin
        non_admin_client = TestClient(non_admin_app)

        fake_id = str(uuid.uuid4())
        resp = non_admin_client.post(
            f"/api/migration/jobs/{fake_id}/rollback",
            json={"reason": "Testing rollback auth"},
        )
        assert resp.status_code == 403

    def test_read_endpoints_allow_non_admin(self, sample_contributors):
        """Read-only endpoints (list, get, progress) allow non-admin users."""
        # First create a job as admin
        create_resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        job_id = create_resp.json()["id"]

        # Access as non-admin
        non_admin_app = FastAPI()
        non_admin_app.include_router(migration_router)
        non_admin_app.dependency_overrides[get_current_user_id] = _override_auth_non_admin
        non_admin_client = TestClient(non_admin_app)

        # List should work
        assert non_admin_client.get("/api/migration/jobs").status_code == 200
        # Get should work
        assert non_admin_client.get(f"/api/migration/jobs/{job_id}").status_code == 200
        # Progress should work
        assert non_admin_client.get(f"/api/migration/jobs/{job_id}/progress").status_code == 200

    def test_fail_closed_no_admin_configured(self, monkeypatch):
        """If no admin IDs configured, ALL mutation requests are rejected (fail-closed)."""
        import app.api.migration as migration_mod
        migration_mod.ADMIN_USER_IDS.clear()

        resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        assert resp.status_code == 403
        assert "no admin users are configured" in resp.json()["detail"].lower()

        # Restore admin
        migration_mod.ADMIN_USER_IDS.add(ADMIN_USER_ID)


# ===========================================================================
# SPEC REQUIREMENT COMPREHENSIVE TESTS
# ===========================================================================


class TestMigrationSpecRequirements:
    """Tests explicitly named after each acceptance criterion in the spec."""

    def test_spec_migration_script_reads_database_writes_pdas(self, sample_contributors):
        """AC: Migration script reads current database state, writes to on-chain PDAs.

        Verifies that the migration reads from the contributor store
        and creates records with PDA addresses.
        """
        resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["total_records"] > 0
        for record in body["records"]:
            assert record["pda_address"] is not None
            assert record["off_chain_data"] is not None

    def test_spec_handles_reputation_scores(self, sample_contributors):
        """AC: Handles user reputation scores."""
        resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        body = resp.json()
        for record in body["records"]:
            assert "reputation_score" in record["off_chain_data"]

    def test_spec_handles_completed_bounty_records(self, sample_bounties):
        """AC: Handles completed bounty records."""
        resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "bounty_record", "dry_run": True},
        )
        body = resp.json()
        for record in body["records"]:
            assert record["off_chain_data"]["status"] in ("completed", "paid")

    def test_spec_handles_tier_levels(self, sample_contributors):
        """AC: Handles tier levels."""
        resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "tier_level", "dry_run": True},
        )
        body = resp.json()
        for record in body["records"]:
            assert "tier_level" in record["off_chain_data"]
            assert record["off_chain_data"]["tier_level"] in (1, 2, 3)

    def test_spec_batch_processing_default_10(self, sample_contributors):
        """AC: Batch processing (default batches of 10)."""
        resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        body = resp.json()
        assert body["batch_size"] == 10

    def test_spec_idempotent_safe_to_rerun(self, sample_contributors):
        """AC: Idempotent — safe to re-run.

        Running the same migration twice should succeed. The second
        run's PDA addresses match the first (deterministic derivation).
        """
        # Run migration twice
        resp1 = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        resp2 = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        assert resp1.status_code == 201
        assert resp2.status_code == 201

        # Both should have the same PDA addresses (deterministic)
        pdas1 = {r["entity_id"]: r["pda_address"] for r in resp1.json()["records"]}
        pdas2 = {r["entity_id"]: r["pda_address"] for r in resp2.json()["records"]}
        for entity_id in pdas1:
            if entity_id in pdas2:
                assert pdas1[entity_id] == pdas2[entity_id]

    def test_spec_dry_run_no_transactions(self, sample_contributors):
        """AC: Dry-run mode simulates without sending transactions.

        In dry-run, no tx_signature should be set on records.
        """
        resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        body = resp.json()
        assert body["dry_run"] is True
        for record in body["records"]:
            assert record["tx_signature"] is None

    def test_spec_progress_n_of_total(self, sample_contributors):
        """AC: Progress reporting shows N/total migrated."""
        create_resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        job_id = create_resp.json()["id"]

        progress_resp = client.get(f"/api/migration/jobs/{job_id}/progress")
        body = progress_resp.json()
        assert body["total_records"] == 5
        assert body["migrated_count"] == 5
        assert body["progress_percent"] == 100.0
        assert body["skipped_count"] == 0
        assert body["failed_count"] == 0

    def test_spec_verification_compares_onchain_to_db(self, sample_contributors):
        """AC: Verification step compares on-chain state to database after migration."""
        create_resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        job_id = create_resp.json()["id"]

        verify_resp = client.post(f"/api/migration/jobs/{job_id}/verify")
        assert verify_resp.status_code == 200
        body = verify_resp.json()
        assert "total_checked" in body
        assert "matched_count" in body
        assert "results" in body

    def test_spec_logging_full_audit_trail(self, sample_contributors):
        """AC: Logging — full audit trail of what was migrated.

        Each migration record stores: entity_id, entity_type,
        pda_address, status, off_chain_data snapshot, created_at.
        """
        resp = client.post(
            "/api/migration/jobs",
            json={"entity_type": "reputation", "dry_run": True},
        )
        body = resp.json()

        # Job has audit fields
        assert body["started_by"] is not None
        assert body["started_at"] is not None

        # Records have full audit trail
        for record in body["records"]:
            assert record["entity_id"] is not None
            assert record["entity_type"] == "reputation"
            assert record["pda_address"] is not None
            assert record["status"] is not None
            assert record["off_chain_data"] is not None
            assert record["created_at"] is not None

    def test_spec_rollback_endpoint_exists(self, sample_contributors):
        """AC: Rollback plan documented (rollback API endpoint exists).

        Tests that the rollback endpoint exists and validates input.
        """
        fake_id = str(uuid.uuid4())
        resp = client.post(
            f"/api/migration/jobs/{fake_id}/rollback",
            json={"reason": "Testing rollback endpoint existence"},
        )
        # Should return 404 (job not found), not 405 (method not allowed)
        assert resp.status_code == 404


# ===========================================================================
# CLI SCRIPT TESTS
# ===========================================================================


class TestMigrationCLIScript:
    """Test the CLI migration script argument parsing and validation."""

    def test_cli_parser_builds_successfully(self):
        """CLI parser builds without errors."""
        from scripts.migrate_to_chain import build_parser
        parser = build_parser()
        assert parser is not None

    def test_cli_parser_entity_type_choices(self):
        """CLI parser accepts valid entity type choices."""
        from scripts.migrate_to_chain import build_parser
        parser = build_parser()
        args = parser.parse_args(["--entity-type", "reputation", "--dry-run"])
        assert args.entity_type == "reputation"

    def test_cli_parser_batch_size_default(self):
        """CLI parser defaults batch size to 10."""
        from scripts.migrate_to_chain import build_parser
        parser = build_parser()
        args = parser.parse_args(["--entity-type", "reputation"])
        assert args.batch_size == 10

    def test_cli_parser_all_flag(self):
        """CLI parser supports --all flag for migrating all entity types."""
        from scripts.migrate_to_chain import build_parser
        parser = build_parser()
        args = parser.parse_args(["--all"])
        assert args.migrate_all is True

    def test_cli_parser_live_mode(self):
        """CLI parser supports --live flag to disable dry-run."""
        from scripts.migrate_to_chain import build_parser
        parser = build_parser()
        args = parser.parse_args(["--entity-type", "reputation", "--live"])
        assert args.live is True

    def test_cli_parser_verify_flag(self):
        """CLI parser supports --verify with job ID."""
        from scripts.migrate_to_chain import build_parser
        parser = build_parser()
        args = parser.parse_args(["--verify", "some-job-id"])
        assert args.verify == "some-job-id"

    def test_cli_parser_rollback_with_reason(self):
        """CLI parser supports --rollback with --reason."""
        from scripts.migrate_to_chain import build_parser
        parser = build_parser()
        args = parser.parse_args([
            "--rollback", "some-job-id",
            "--reason", "Found data mismatch",
        ])
        assert args.rollback == "some-job-id"
        assert args.reason == "Found data mismatch"

    def test_cli_parser_history_flag(self):
        """CLI parser supports --history flag."""
        from scripts.migrate_to_chain import build_parser
        parser = build_parser()
        args = parser.parse_args(["--history"])
        assert args.history is True

    def test_cli_parser_verbose_flag(self):
        """CLI parser supports --verbose/-v flag for debug logging."""
        from scripts.migrate_to_chain import build_parser
        parser = build_parser()
        args = parser.parse_args(["--entity-type", "reputation", "-v"])
        assert args.verbose is True
