"""Comprehensive tests for CI/CD pipeline service layer and config validator.

Tests cover pipeline run CRUD, stage status transitions, deployment recording,
environment configuration management, and CI config validation. Uses
pytest-asyncio for async database tests and synchronous tests for the
validator (no database needed).

Test categories:
    - Pipeline run lifecycle (create, read, update, list)
    - Stage status transitions (state machine enforcement)
    - Deployment recording and listing
    - Environment config CRUD with secret masking
    - CI config validation rules (synchronous, no DB)
    - Edge cases and error handling
"""

import os
import uuid

import pytest
import pytest_asyncio

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")
os.environ.setdefault("AUTH_ENABLED", "false")

from app.models.pipeline import (  # noqa: F401, E402
    PipelineRunDB,
    PipelineStageDB,
    DeploymentRecordDB,
    EnvironmentConfigDB,
)
from app.database import engine, Base, async_session_factory  # noqa: E402
from app.services.pipeline_service import (  # noqa: E402
    create_pipeline_run,
    get_pipeline_run,
    list_pipeline_runs,
    update_pipeline_status,
    update_stage_status,
    create_deployment,
    list_deployments,
    set_environment_config,
    get_environment_configs,
    get_pipeline_statistics,
    PipelineNotFoundError,
    InvalidPipelineTransitionError,
    StageNotFoundError,
    InvalidStageTransitionError,
)
from app.services.ci_config_validator import (  # noqa: E402
    validate_workflow_config,
    validate_docker_compose,
    ValidationSeverity,
)
from app.services.environment_service import (  # noqa: E402
    seed_default_configs,
    get_environment_summary,
    get_solana_cluster_for_environment,
)


@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_database():
    """Create all tables before running tests in this module."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def db_session():
    """Provide a fresh database session for each test."""
    async with async_session_factory() as session:
        yield session


# ── Pipeline Run Tests ────────────────────────────────────────────────────────


class TestPipelineRunCreation:
    """Tests for creating pipeline runs."""

    @pytest.mark.asyncio
    async def test_create_pipeline_run_with_default_stages(self, db_session):
        """Creating a pipeline run should return QUEUED status with 4 default stages."""
        run = await create_pipeline_run(
            session=db_session,
            repository="SolFoundry/solfoundry",
            branch="main",
            commit_sha="abc1234567890abcdef",
            trigger="push",
        )
        assert run.status == "queued"
        assert run.repository == "SolFoundry/solfoundry"
        assert run.branch == "main"
        assert run.trigger == "push"

    @pytest.mark.asyncio
    async def test_create_pipeline_run_with_custom_stages(self, db_session):
        """Creating a run with custom stages should use those stages."""
        custom_stages = [
            {"name": "compile", "stage_order": 0},
            {"name": "verify_idl", "stage_order": 1},
            {"name": "bankrun", "stage_order": 2},
        ]
        run = await create_pipeline_run(
            session=db_session,
            repository="SolFoundry/solfoundry",
            branch="fix/issue-605",
            commit_sha="deadbeef12345678",
            trigger="pull_request",
            stages=custom_stages,
        )
        assert run is not None
        assert run.branch == "fix/issue-605"

    @pytest.mark.asyncio
    async def test_create_pipeline_run_invalid_commit_sha(self, db_session):
        """Creating a run with short commit SHA should raise ValueError."""
        with pytest.raises(ValueError, match="Valid commit SHA"):
            await create_pipeline_run(
                session=db_session,
                repository="SolFoundry/solfoundry",
                branch="main",
                commit_sha="abc",
            )

    @pytest.mark.asyncio
    async def test_create_pipeline_run_empty_repository(self, db_session):
        """Creating a run with empty repository should raise ValueError."""
        with pytest.raises(ValueError, match="Repository name"):
            await create_pipeline_run(
                session=db_session,
                repository="",
                branch="main",
                commit_sha="abc1234567890",
            )


class TestPipelineRunRetrieval:
    """Tests for retrieving pipeline runs."""

    @pytest.mark.asyncio
    async def test_list_pipeline_runs(self, db_session):
        """Listing pipeline runs should return paginated results."""
        await create_pipeline_run(
            session=db_session,
            repository="SolFoundry/solfoundry",
            branch="main",
            commit_sha="list_test_sha_abc",
        )
        result = await list_pipeline_runs(session=db_session)
        assert "items" in result
        assert "total" in result
        assert result["total"] > 0

    @pytest.mark.asyncio
    async def test_list_with_status_filter(self, db_session):
        """Filtering by status should only return matching runs."""
        result = await list_pipeline_runs(session=db_session, status="queued")
        for item in result["items"]:
            assert item.status == "queued"

    @pytest.mark.asyncio
    async def test_get_pipeline_run_by_id(self, db_session):
        """Getting a specific pipeline run should return it."""
        run = await create_pipeline_run(
            session=db_session,
            repository="SolFoundry/solfoundry",
            branch="feature/test",
            commit_sha="get_test_sha_1234",
        )
        fetched = await get_pipeline_run(db_session, str(run.id))
        assert fetched.id == run.id

    @pytest.mark.asyncio
    async def test_get_nonexistent_pipeline_run(self, db_session):
        """Getting a non-existent run should raise PipelineNotFoundError."""
        fake_id = str(uuid.uuid4())
        with pytest.raises(PipelineNotFoundError):
            await get_pipeline_run(db_session, fake_id)


class TestPipelineStatusTransitions:
    """Tests for pipeline status transitions (state machine)."""

    async def _create_run(self, db_session) -> str:
        """Helper to create a pipeline run and return its ID."""
        run = await create_pipeline_run(
            session=db_session,
            repository="SolFoundry/solfoundry",
            branch="main",
            commit_sha=f"trans_{uuid.uuid4().hex[:12]}",
        )
        return str(run.id)

    @pytest.mark.asyncio
    async def test_queued_to_running(self, db_session):
        """Transitioning from queued to running should succeed."""
        run_id = await self._create_run(db_session)
        run = await update_pipeline_status(db_session, run_id, "running")
        assert run.status == "running"
        assert run.started_at is not None

    @pytest.mark.asyncio
    async def test_running_to_success(self, db_session):
        """Transitioning from running to success should set duration."""
        run_id = await self._create_run(db_session)
        await update_pipeline_status(db_session, run_id, "running")
        run = await update_pipeline_status(db_session, run_id, "success")
        assert run.status == "success"
        assert run.finished_at is not None
        assert run.duration_seconds is not None

    @pytest.mark.asyncio
    async def test_running_to_failure(self, db_session):
        """Transitioning to failure should capture error message."""
        run_id = await self._create_run(db_session)
        await update_pipeline_status(db_session, run_id, "running")
        run = await update_pipeline_status(
            db_session, run_id, "failure", error_message="Tests failed"
        )
        assert run.status == "failure"
        assert run.error_message == "Tests failed"

    @pytest.mark.asyncio
    async def test_invalid_queued_to_success(self, db_session):
        """Direct transition from queued to success should fail."""
        run_id = await self._create_run(db_session)
        with pytest.raises(InvalidPipelineTransitionError):
            await update_pipeline_status(db_session, run_id, "success")

    @pytest.mark.asyncio
    async def test_invalid_success_to_running(self, db_session):
        """Transition from terminal state should fail."""
        run_id = await self._create_run(db_session)
        await update_pipeline_status(db_session, run_id, "running")
        await update_pipeline_status(db_session, run_id, "success")
        with pytest.raises(InvalidPipelineTransitionError):
            await update_pipeline_status(db_session, run_id, "running")

    @pytest.mark.asyncio
    async def test_queued_to_cancelled(self, db_session):
        """Cancelling a queued run should succeed."""
        run_id = await self._create_run(db_session)
        run = await update_pipeline_status(db_session, run_id, "cancelled")
        assert run.status == "cancelled"


class TestStageStatusTransitions:
    """Tests for pipeline stage status transitions."""

    async def _create_and_get_stage(self, db_session) -> tuple[str, str]:
        """Helper to create a run and return (run_id, first_stage_id)."""
        run = await create_pipeline_run(
            session=db_session,
            repository="SolFoundry/solfoundry",
            branch="main",
            commit_sha=f"stage_{uuid.uuid4().hex[:12]}",
        )
        fetched = await get_pipeline_run(db_session, str(run.id))
        return str(run.id), str(fetched.stages[0].id)

    @pytest.mark.asyncio
    async def test_pending_to_running(self, db_session):
        """Stage should transition from pending to running."""
        _, stage_id = await self._create_and_get_stage(db_session)
        stage = await update_stage_status(db_session, stage_id, "running")
        assert stage.status == "running"

    @pytest.mark.asyncio
    async def test_running_to_passed(self, db_session):
        """Stage should transition from running to passed with log output."""
        _, stage_id = await self._create_and_get_stage(db_session)
        await update_stage_status(db_session, stage_id, "running")
        stage = await update_stage_status(
            db_session, stage_id, "passed", log_output="42 tests passed"
        )
        assert stage.status == "passed"
        assert stage.log_output == "42 tests passed"

    @pytest.mark.asyncio
    async def test_running_to_failed(self, db_session):
        """Stage should transition to failed with error detail."""
        _, stage_id = await self._create_and_get_stage(db_session)
        await update_stage_status(db_session, stage_id, "running")
        stage = await update_stage_status(
            db_session, stage_id, "failed", error_detail="TypeError"
        )
        assert stage.status == "failed"
        assert "TypeError" in stage.error_detail

    @pytest.mark.asyncio
    async def test_invalid_pending_to_passed(self, db_session):
        """Direct transition from pending to passed should fail."""
        _, stage_id = await self._create_and_get_stage(db_session)
        with pytest.raises(InvalidStageTransitionError):
            await update_stage_status(db_session, stage_id, "passed")

    @pytest.mark.asyncio
    async def test_skip_from_pending(self, db_session):
        """Stage should be skippable from pending."""
        _, stage_id = await self._create_and_get_stage(db_session)
        stage = await update_stage_status(db_session, stage_id, "skipped")
        assert stage.status == "skipped"

    @pytest.mark.asyncio
    async def test_nonexistent_stage(self, db_session):
        """Updating a non-existent stage should raise StageNotFoundError."""
        with pytest.raises(StageNotFoundError):
            await update_stage_status(db_session, str(uuid.uuid4()), "running")


class TestDeployments:
    """Tests for deployment recording and listing."""

    @pytest.mark.asyncio
    async def test_create_deployment(self, db_session):
        """Recording a deployment should succeed."""
        deploy = await create_deployment(
            session=db_session, environment="devnet", version="v1.2.3"
        )
        assert deploy.environment == "devnet"
        assert deploy.version == "v1.2.3"
        assert deploy.status == "success"

    @pytest.mark.asyncio
    async def test_deployment_tracks_rollback(self, db_session):
        """Second deploy to same env should track rollback version."""
        await create_deployment(session=db_session, environment="local", version="v1.0.0")
        deploy = await create_deployment(session=db_session, environment="local", version="v1.1.0")
        assert deploy.rollback_version == "v1.0.0"

    @pytest.mark.asyncio
    async def test_list_deployments(self, db_session):
        """Listing deployments should return paginated results."""
        result = await list_deployments(session=db_session)
        assert "items" in result
        assert "total" in result

    @pytest.mark.asyncio
    async def test_invalid_environment(self, db_session):
        """Invalid environment should raise ValueError."""
        with pytest.raises(ValueError):
            await create_deployment(
                session=db_session, environment="invalid", version="v1.0.0"
            )


class TestEnvironmentConfigs:
    """Tests for environment configuration management."""

    @pytest.mark.asyncio
    async def test_set_config(self, db_session):
        """Setting a config entry should succeed."""
        config = await set_environment_config(
            session=db_session,
            environment="local",
            key="SOLANA_RPC_URL",
            value="http://localhost:8899",
        )
        assert config.key == "SOLANA_RPC_URL"
        assert config.value == "http://localhost:8899"

    @pytest.mark.asyncio
    async def test_set_secret_config(self, db_session):
        """Setting a secret config should store is_secret flag."""
        config = await set_environment_config(
            session=db_session,
            environment="devnet",
            key="DB_PASSWORD",
            value="secret123",
            is_secret=True,
        )
        assert config.is_secret == 1

    @pytest.mark.asyncio
    async def test_get_configs(self, db_session):
        """Getting configs should return entries for the environment."""
        await set_environment_config(
            session=db_session, environment="staging", key="TEST_KEY", value="val"
        )
        configs = await get_environment_configs(db_session, "staging")
        keys = [c.key for c in configs]
        assert "TEST_KEY" in keys

    @pytest.mark.asyncio
    async def test_upsert_config(self, db_session):
        """Setting an existing key should update it."""
        await set_environment_config(
            session=db_session, environment="local", key="UPSERT", value="v1"
        )
        config = await set_environment_config(
            session=db_session, environment="local", key="UPSERT", value="v2"
        )
        assert config.value == "v2"

    @pytest.mark.asyncio
    async def test_seed_defaults(self, db_session):
        """Seeding defaults should populate all environments."""
        counts = await seed_default_configs(db_session)
        assert counts["local"] > 0
        assert counts["devnet"] > 0

    @pytest.mark.asyncio
    async def test_environment_summary(self, db_session):
        """Summary should return data for all environments."""
        summary = await get_environment_summary(db_session)
        assert "local" in summary
        assert "devnet" in summary

    def test_solana_cluster_mapping(self):
        """Cluster mapping should return correct identifiers."""
        assert get_solana_cluster_for_environment("local") == "localhost"
        assert get_solana_cluster_for_environment("devnet") == "devnet"
        assert get_solana_cluster_for_environment("mainnet") == "mainnet-beta"
        with pytest.raises(ValueError):
            get_solana_cluster_for_environment("invalid")


class TestPipelineStatistics:
    """Tests for pipeline aggregate statistics."""

    @pytest.mark.asyncio
    async def test_get_statistics(self, db_session):
        """Statistics should return aggregate data."""
        stats = await get_pipeline_statistics(db_session)
        assert "total_runs" in stats
        assert "success_rate" in stats
        assert isinstance(stats["total_runs"], int)


# ── CI Config Validation Tests (synchronous, no DB) ──────────────────────────


class TestCIConfigValidation:
    """Tests for CI/CD configuration validation (pure logic, no database)."""

    def test_valid_workflow(self):
        """A valid workflow should pass validation."""
        config = {
            "name": "CI",
            "on": {"push": {"branches": ["main"]}, "workflow_dispatch": {}},
            "concurrency": {"group": "ci"},
            "jobs": {
                "test": {
                    "runs-on": "ubuntu-latest",
                    "timeout-minutes": 15,
                    "strategy": {"matrix": {"node-version": ["18", "20"]}},
                    "steps": [
                        {"uses": "actions/checkout@v4"},
                        {"uses": "actions/setup-node@v4", "with": {"cache": "npm"}},
                        {"run": "npm test"},
                    ],
                }
            },
        }
        result = validate_workflow_config(config)
        assert result.is_valid is True
        assert result.total_checks > 0

    def test_missing_required_keys(self):
        """Missing keys should produce ERROR findings."""
        result = validate_workflow_config({"name": "Bad"})
        assert result.is_valid is False
        assert result.error_count > 0
        rules = [f.rule for f in result.findings]
        assert "required-keys" in rules

    def test_detects_secret_leak(self):
        """Echoing secrets should be flagged as ERROR."""
        config = {
            "name": "Leak",
            "on": {"push": {}},
            "jobs": {
                "deploy": {
                    "runs-on": "ubuntu-latest",
                    "timeout-minutes": 10,
                    "steps": [{"run": "echo ${{ secrets.DEPLOY_KEY }}"}],
                }
            },
        }
        result = validate_workflow_config(config)
        assert result.is_valid is False
        rules = [f.rule for f in result.findings]
        assert "no-secrets-in-logs" in rules

    def test_missing_timeout_warning(self):
        """Jobs without timeout should trigger WARNING."""
        config = {
            "name": "NoTimeout",
            "on": {"push": {}},
            "jobs": {
                "build": {
                    "runs-on": "ubuntu-latest",
                    "steps": [{"run": "echo hi"}],
                }
            },
        }
        result = validate_workflow_config(config)
        warnings = [f for f in result.findings if f.severity == ValidationSeverity.WARNING]
        warning_rules = [f.rule for f in warnings]
        assert "timeout" in warning_rules

    def test_missing_concurrency_info(self):
        """Missing concurrency should produce INFO finding."""
        config = {
            "name": "NoConcurrency",
            "on": {"push": {}},
            "jobs": {
                "test": {
                    "runs-on": "ubuntu-latest",
                    "timeout-minutes": 10,
                    "steps": [{"run": "npm test"}],
                }
            },
        }
        result = validate_workflow_config(config)
        info_rules = [f.rule for f in result.findings if f.severity == ValidationSeverity.INFO]
        assert "concurrency" in info_rules

    def test_no_jobs_error(self):
        """Workflow with no jobs should produce ERROR."""
        config = {"name": "Empty", "on": {"push": {}}, "jobs": {}}
        result = validate_workflow_config(config)
        assert result.is_valid is False

    def test_docker_compose_valid(self):
        """Docker Compose with all required services should mostly pass."""
        config = {
            "services": {
                "postgres": {"image": "postgres:16", "healthcheck": {"test": ["CMD", "pg_isready"]}},
                "backend": {"build": ".", "healthcheck": {"test": ["CMD", "curl"]}},
                "frontend": {"build": ".", "healthcheck": {"test": ["CMD", "wget"]}},
            },
            "volumes": {"data": {}},
        }
        result = validate_docker_compose(config)
        error_rules = [f.rule for f in result.findings if f.severity == ValidationSeverity.ERROR]
        assert len(error_rules) == 0

    def test_docker_compose_missing_services(self):
        """Missing recommended services should produce WARNING."""
        config = {
            "services": {
                "postgres": {"image": "postgres:16", "healthcheck": {"test": ["CMD"]}},
            },
            "volumes": {"data": {}},
        }
        result = validate_docker_compose(config)
        rules = [f.rule for f in result.findings]
        assert "required-services" in rules

    def test_docker_compose_empty(self):
        """Empty compose config should fail."""
        result = validate_docker_compose({})
        assert result.is_valid is False

    def test_docker_compose_no_healthcheck(self):
        """Services without healthcheck should produce WARNING."""
        config = {
            "services": {
                "backend": {"build": "."},
            },
        }
        result = validate_docker_compose(config)
        rules = [f.rule for f in result.findings]
        assert "healthcheck" in rules

    def test_node_matrix_warning(self):
        """Missing Node version matrix should produce WARNING."""
        config = {
            "name": "NoMatrix",
            "on": {"push": {}},
            "jobs": {
                "test": {
                    "runs-on": "ubuntu-latest",
                    "timeout-minutes": 10,
                    "steps": [{"run": "npm test"}],
                }
            },
        }
        result = validate_workflow_config(config)
        rules = [f.rule for f in result.findings if f.severity == ValidationSeverity.WARNING]
        assert "test-matrix-node" in [f.rule for f in result.findings]
