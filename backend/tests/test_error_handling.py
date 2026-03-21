"""Tests for error handling middleware and structured logging."""

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field

from app.core.errors import (
    ErrorCode,
    ErrorResponse,
    AppException,
    NotFoundException,
    ValidationException,
    ConflictException,
    UnauthorizedException,
    ErrorDetail,
)
from app.core.middleware import (
    CorrelationIdMiddleware,
    ErrorHandlingMiddleware,
)
from app.core.logging_config import (
    setup_logging,
    get_logger,
    get_correlation_id,
    set_correlation_id,
    clear_correlation_id,
    cleanup_old_logs,
    get_log_retention_days,
    get_access_logger,
    get_error_logger,
    get_audit_logger,
)
from app.core.audit import AuditLogger, AuditAction, audit_log


# Initialize logging for tests
setup_logging()


class TestErrorCodes:
    """Test error code definitions."""

    def test_error_code_values(self):
        """Verify error codes are defined correctly."""
        assert ErrorCode.INTERNAL_ERROR.value == "INTERNAL_ERROR"
        assert ErrorCode.VALIDATION_ERROR.value == "VALIDATION_ERROR"
        assert ErrorCode.NOT_FOUND.value == "NOT_FOUND"
        assert ErrorCode.BOUNTY_NOT_FOUND.value == "BOUNTY_NOT_FOUND"
        assert ErrorCode.WEBHOOK_SIGNATURE_INVALID.value == "WEBHOOK_SIGNATURE_INVALID"

    def test_error_response_model(self):
        """Verify error response model serializes correctly."""
        response = ErrorResponse(
            error=ErrorCode.NOT_FOUND,
            message="Bounty not found",
            correlation_id="test-123",
            path="/api/bounties/test-id",
        )

        data = response.model_dump()

        assert data["error"] == "NOT_FOUND"
        assert data["message"] == "Bounty not found"
        assert data["correlation_id"] == "test-123"
        assert data["path"] == "/api/bounties/test-id"
        assert "timestamp" in data


class TestExceptions:
    """Test exception classes."""

    def test_app_exception_creation(self):
        """Verify AppException can be created with all fields."""
        exc = AppException(
            error_code=ErrorCode.INTERNAL_ERROR,
            message="Test error",
            status_code=500,
        )

        assert exc.error_code == ErrorCode.INTERNAL_ERROR
        assert exc.message == "Test error"
        assert exc.status_code == 500

    def test_not_found_exception(self):
        """Verify NotFoundException formats message correctly."""
        exc = NotFoundException("Bounty", "bounty-123")

        assert exc.error_code == ErrorCode.NOT_FOUND
        assert exc.status_code == 404
        assert "Bounty" in exc.message
        assert "bounty-123" in exc.message

    def test_validation_exception(self):
        """Verify ValidationException has correct status code."""
        exc = ValidationException("Invalid input")

        assert exc.error_code == ErrorCode.VALIDATION_ERROR
        assert exc.status_code == 422

    def test_validation_exception_with_details(self):
        """Verify ValidationException can include details."""
        details = [
            ErrorDetail(field="tier", message="Must be 1-3", code="invalid_range")
        ]
        exc = ValidationException("Validation failed", details=details)

        assert exc.details is not None
        assert len(exc.details) == 1
        assert exc.details[0].field == "tier"

    def test_conflict_exception(self):
        """Verify ConflictException has correct status code."""
        exc = ConflictException("Already exists")

        assert exc.error_code == ErrorCode.CONFLICT
        assert exc.status_code == 409

    def test_unauthorized_exception(self):
        """Verify UnauthorizedException has correct headers."""
        exc = UnauthorizedException()

        assert exc.error_code == ErrorCode.UNAUTHORIZED
        assert exc.status_code == 401
        assert "WWW-Authenticate" in (exc.headers or {})

    def test_exception_to_response(self):
        """Verify exception can be converted to ErrorResponse."""
        exc = NotFoundException("Bounty", "test-id")
        response = exc.to_response(
            correlation_id="corr-123", path="/api/bounties/test-id"
        )

        assert isinstance(response, ErrorResponse)
        assert response.correlation_id == "corr-123"
        assert response.path == "/api/bounties/test-id"


class TestCorrelationIdMiddleware:
    """Test correlation ID middleware."""

    @pytest.fixture
    def app(self):
        """Create a test FastAPI application."""
        app = FastAPI()
        app.add_middleware(CorrelationIdMiddleware)

        @app.get("/ok")
        async def ok_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, app):
        """Create a test client."""
        return TestClient(app, raise_server_exceptions=False)

    def test_ok_endpoint(self, client):
        """Verify normal endpoints work."""
        response = client.get("/ok")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_correlation_id_added(self, client):
        """Verify correlation ID is added to response headers."""
        response = client.get("/ok")

        assert "X-Correlation-ID" in response.headers

    def test_correlation_id_preserved(self, client):
        """Verify provided correlation ID is preserved."""
        response = client.get("/ok", headers={"X-Correlation-ID": "my-corr-id"})

        assert response.headers["X-Correlation-ID"] == "my-corr-id"

    def test_different_requests_have_different_correlation_ids(self, client):
        """Verify each request gets a unique correlation ID."""
        response1 = client.get("/ok")
        response2 = client.get("/ok")

        # Different correlation IDs
        assert (
            response1.headers["X-Correlation-ID"]
            != response2.headers["X-Correlation-ID"]
        )


class TestLogging:
    """Test structured logging functionality."""

    def test_setup_logging(self):
        """Verify logging can be initialized."""
        logger = get_logger(__name__)

        # Should not raise
        logger.info("Test message")

    def test_correlation_id_context(self):
        """Verify correlation ID context works."""
        # Initially None
        assert get_correlation_id() is None

        # Set and retrieve
        set_correlation_id("test-123")
        assert get_correlation_id() == "test-123"

        # Clear
        clear_correlation_id()
        assert get_correlation_id() is None


class TestAuditLogger:
    """Test audit logging functionality."""

    def test_audit_action_values(self):
        """Verify audit actions are defined correctly."""
        assert AuditAction.AUTH_LOGIN.value == "auth.login"
        assert AuditAction.PAYOUT_RELEASED.value == "payout.released"
        assert AuditAction.BOUNTY_CLAIMED.value == "bounty.claimed"

    def test_audit_log_function(self):
        """Verify audit_log function works."""
        # Should not raise
        audit_log(
            action=AuditAction.BOUNTY_CLAIMED,
            actor="user-123",
            resource="bounty",
            resource_id="bounty-456",
        )

    def test_audit_logger_methods(self):
        """Verify AuditLogger convenience methods work."""
        logger = AuditLogger()

        # These should not raise
        logger.log_auth_event(
            action=AuditAction.AUTH_LOGIN,
            actor="user-123",
        )

        logger.log_payout_event(
            action=AuditAction.PAYOUT_RELEASED,
            actor="user-123",
            bounty_id="bounty-456",
            amount=100.0,
            token="FNDRY",
            wallet_address="wallet-addr",
        )

        logger.log_bounty_event(
            action=AuditAction.BOUNTY_CLAIMED,
            actor="user-123",
            bounty_id="bounty-456",
        )


class TestHealthEndpoints:
    """Test health check endpoints."""

    @pytest.fixture
    def health_app(self):
        """Create app with health endpoints."""
        from fastapi import FastAPI
        from app.core.health import router as health_router
        from app.core.middleware import CorrelationIdMiddleware

        app = FastAPI()
        app.add_middleware(CorrelationIdMiddleware)
        app.include_router(health_router)

        return app

    @pytest.fixture
    def health_client(self, health_app):
        """Create test client for health endpoints."""
        return TestClient(health_app, raise_server_exceptions=False)

    def test_basic_health_check(self, health_client):
        """Verify basic health endpoint returns 200."""
        response = health_client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_detailed_health_check(self, health_client):
        """Verify detailed health endpoint includes dependencies."""
        response = health_client.get("/health/detailed")

        # May be 503 if database not available, but structure should be correct
        data = response.json()
        assert "status" in data
        assert "dependencies" in data

    def test_liveness_check(self, health_client):
        """Verify liveness endpoint returns 200."""
        response = health_client.get("/health/live")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_readiness_check(self, health_client):
        """Verify readiness endpoint checks dependencies."""
        response = health_client.get("/health/ready")

        # Check structure
        data = response.json()
        assert "status" in data
        assert "uptime_seconds" in data


class TestFastAPIValidationErrors:
    """Test FastAPI RequestValidationError handling."""

    @pytest.fixture
    def validation_app(self):
        """Create app with endpoints that trigger FastAPI validation."""
        from fastapi import FastAPI
        from fastapi.exceptions import RequestValidationError
        from fastapi.responses import JSONResponse
        from app.core.middleware import CorrelationIdMiddleware
        from app.core.errors import ValidationException, ErrorDetail

        app = FastAPI()
        app.add_middleware(CorrelationIdMiddleware)

        class ItemModel(BaseModel):
            name: str = Field(..., min_length=1, max_length=100)
            value: int = Field(..., ge=0, le=100)
            tier: int = Field(..., ge=1, le=3)

        @app.post("/items/")
        async def create_item(item: ItemModel):
            return {"item": item.model_dump()}

        @app.get("/items/{item_id}")
        async def get_item(item_id: int):
            return {"item_id": item_id}

        # Add exception handler for RequestValidationError
        @app.exception_handler(RequestValidationError)
        async def validation_exception_handler(request, exc):
            details = [
                ErrorDetail(
                    field=".".join(str(loc) for loc in error["loc"]),
                    message=error["msg"],
                    code=error["type"],
                )
                for error in exc.errors()
            ]
            validation_exc = ValidationException(
                message="Validation failed",
                details=details,
            )
            response = validation_exc.to_response(
                correlation_id=get_correlation_id(),
                path=request.url.path,
            )
            # Note: X-Correlation-ID header will be added by CorrelationIdMiddleware
            return JSONResponse(
                status_code=422,
                content=response.model_dump(mode="json", exclude_none=True),
            )

        return app

    @pytest.fixture
    def validation_client(self, validation_app):
        """Create test client for validation testing."""
        return TestClient(validation_app, raise_server_exceptions=False)

    def test_fastapi_validation_error_missing_field(self, validation_client):
        """Verify FastAPI validation errors return ErrorResponse format."""
        response = validation_client.post("/items/", json={})

        assert response.status_code == 422
        data = response.json()
        # Should have ErrorResponse format
        assert "error" in data
        assert "message" in data
        assert "correlation_id" in data
        assert "timestamp" in data
        assert data["error"] == "VALIDATION_ERROR"

    def test_fastapi_validation_error_invalid_value(self, validation_client):
        """Verify invalid values produce validation errors in ErrorResponse format."""
        response = validation_client.post(
            "/items/",
            json={
                "name": "test",
                "value": 200,  # exceeds max
                "tier": 5,  # exceeds max
            },
        )

        assert response.status_code == 422
        data = response.json()
        # Should have ErrorResponse format
        assert "error" in data
        assert "message" in data
        assert data["error"] == "VALIDATION_ERROR"

    def test_fastapi_path_validation_error(self, validation_client):
        """Verify path parameter validation errors are handled."""
        response = validation_client.get("/items/not-an-int")

        assert response.status_code == 422
        data = response.json()
        # Should have ErrorResponse format
        assert "error" in data
        assert "message" in data

    def test_validation_error_has_correlation_id(self, validation_client):
        """Verify validation errors include correlation ID."""
        response = validation_client.post("/items/", json={})

        assert "X-Correlation-ID" in response.headers


class TestLogRetention:
    """Test log retention and cleanup functionality."""

    def test_get_log_retention_days_default(self):
        """Verify default retention period."""
        # Default is 30 days
        assert get_log_retention_days() == 30

    def test_cleanup_old_logs(self, tmp_path):
        """Verify cleanup removes old log files."""
        import time

        # Create some test log files (matching our log patterns)
        old_file = tmp_path / "application.log.1"  # Rotated log file
        new_file = tmp_path / "application.log"

        old_file.write_text("old log content")
        new_file.write_text("new log content")

        # Set old file's mtime to 60 days ago
        old_time = time.time() - (60 * 24 * 60 * 60)
        import os

        os.utime(old_file, (old_time, old_time))

        # Run cleanup with 30 days retention
        removed = cleanup_old_logs(log_dir=tmp_path, retention_days=30)

        # Old file should be removed
        assert removed == 1
        assert not old_file.exists()
        # New file should remain
        assert new_file.exists()

    def test_cleanup_preserves_non_log_files(self, tmp_path):
        """Verify cleanup doesn't remove non-log files."""
        # Create a non-log file
        other_file = tmp_path / "data.json"
        other_file.write_text('{"data": "test"}')

        # Run cleanup
        removed = cleanup_old_logs(log_dir=tmp_path, retention_days=1)

        # Should not remove non-log files
        assert removed == 0
        assert other_file.exists()


class TestLogStreamSeparation:
    """Test log stream separation functionality."""

    def test_get_access_logger(self):
        """Verify access logger is configured correctly."""
        logger = get_access_logger()
        assert logger is not None
        assert logger.name == "access"
        # Access logger should not propagate to root logger
        assert logger.propagate is False

    def test_get_error_logger(self):
        """Verify error logger is configured correctly."""
        logger = get_error_logger()
        assert logger is not None
        assert logger.name == "error"

    def test_get_audit_logger(self):
        """Verify audit logger is configured correctly."""
        logger = get_audit_logger()
        assert logger is not None
        assert logger.name == "audit"

    def test_correlation_id_context_isolation(self):
        """Verify correlation ID context is isolated between operations."""
        # Set a correlation ID
        set_correlation_id("test-123")
        assert get_correlation_id() == "test-123"

        # Clear it
        clear_correlation_id()
        assert get_correlation_id() is None

        # Set a new one
        set_correlation_id("test-456")
        assert get_correlation_id() == "test-456"

        # Clean up
        clear_correlation_id()


class TestHTTPExceptionHandling:
    """Test HTTP exception handling in FastAPI."""

    @pytest.fixture
    def exception_app(self):
        """Create app with various exception endpoints."""
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse
        from app.core.middleware import CorrelationIdMiddleware
        from app.core.errors import ErrorCode, ErrorResponse

        app = FastAPI()
        app.add_middleware(CorrelationIdMiddleware)

        @app.get("/ok")
        async def ok():
            return {"status": "ok"}

        @app.get("/http-403")
        async def http_403():
            raise HTTPException(status_code=403, detail="Forbidden")

        @app.get("/http-500")
        async def http_500():
            raise HTTPException(status_code=500, detail="Internal Error")

        # Add exception handler for HTTPException
        @app.exception_handler(HTTPException)
        async def http_exception_handler(request, exc):
            status_to_error_code = {
                400: ErrorCode.VALIDATION_ERROR,
                401: ErrorCode.UNAUTHORIZED,
                403: ErrorCode.FORBIDDEN,
                404: ErrorCode.NOT_FOUND,
                409: ErrorCode.CONFLICT,
                422: ErrorCode.VALIDATION_ERROR,
                429: ErrorCode.RATE_LIMITED,
                500: ErrorCode.INTERNAL_ERROR,
                503: ErrorCode.SERVICE_UNAVAILABLE,
            }
            error_code = status_to_error_code.get(exc.status_code, ErrorCode.INTERNAL_ERROR)
            
            correlation_id = get_correlation_id() or "unknown"
            
            response = ErrorResponse(
                error=error_code,
                message=str(exc.detail),
                correlation_id=correlation_id,
                path=request.url.path,
            )
            # Note: X-Correlation-ID header will be added by CorrelationIdMiddleware
            headers = {}
            if exc.headers:
                headers.update(exc.headers)
            return JSONResponse(
                status_code=exc.status_code,
                content=response.model_dump(mode="json", exclude_none=True),
                headers=headers if headers else None,
            )

        return app

    @pytest.fixture
    def exception_client(self, exception_app):
        """Create test client for exception testing."""
        return TestClient(exception_app, raise_server_exceptions=False)

    def test_http_exception_403(self, exception_client):
        """Verify HTTPException with 403 returns ErrorResponse format."""
        response = exception_client.get("/http-403")

        assert response.status_code == 403
        data = response.json()
        # Should have ErrorResponse format
        assert "error" in data
        assert "message" in data
        assert data["message"] == "Forbidden"
        assert data["error"] == "FORBIDDEN"

    def test_http_exception_500(self, exception_client):
        """Verify HTTPException with 500 returns ErrorResponse format."""
        response = exception_client.get("/http-500")

        assert response.status_code == 500
        data = response.json()
        # Should have ErrorResponse format
        assert "error" in data
        assert "message" in data

    def test_correlation_id_preserved_on_error(self, exception_client):
        """Verify correlation ID is preserved on error."""
        custom_id = "my-custom-id"
        response = exception_client.get(
            "/http-403", headers={"X-Correlation-ID": custom_id}
        )

        assert response.headers["X-Correlation-ID"] == custom_id
