"""Tests for error handling middleware and structured logging."""

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field, field_validator

from app.core.errors import (
    ErrorCode,
    ErrorResponse,
    AppException,
    NotFoundException,
    ValidationException,
    ConflictException,
    UnauthorizedException,
    InternalServerException,
)
from app.core.middleware import (
    ErrorHandlingMiddleware,
    CorrelationIdMiddleware,
)
from app.core.logging_config import (
    setup_logging,
    get_logger,
    get_correlation_id,
    set_correlation_id,
    clear_correlation_id,
)
from app.core.audit import AuditLogger, AuditAction, audit_log


# Initialize logging for tests
setup_logging()


# Test fixtures
@pytest.fixture
def app():
    """Create a test FastAPI application."""
    from fastapi import APIRouter
    
    app = FastAPI()
    
    # Add middleware (order matters - last added runs first)
    app.add_middleware(CorrelationIdMiddleware)
    app.add_middleware(ErrorHandlingMiddleware)
    
    # Test routes
    router = APIRouter()
    
    @router.get("/ok")
    async def ok_endpoint():
        return {"status": "ok"}
    
    @router.get("/not-found")
    async def not_found_endpoint():
        raise NotFoundException("Bounty", "test-123")
    
    @router.get("/validation-error")
    async def validation_error_endpoint():
        raise ValidationException("Invalid input")
    
    @router.get("/conflict")
    async def conflict_endpoint():
        raise ConflictException("Resource already exists")
    
    @router.get("/unauthorized")
    async def unauthorized_endpoint():
        raise UnauthorizedException("Token expired")
    
    @router.get("/internal-error")
    async def internal_error_endpoint():
        raise InternalServerException("Something went wrong")
    
    @router.get("/unexpected-error")
    async def unexpected_error_endpoint():
        raise RuntimeError("Unexpected error")
    
    @router.get("/http-exception")
    async def http_exception_endpoint():
        raise HTTPException(status_code=404, detail="Not found")
    
    app.include_router(router)
    
    return app


@pytest.fixture
def client(app):
    """Create a test client."""
    return TestClient(app, raise_server_exceptions=False)


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
        response = exc.to_response(correlation_id="corr-123", path="/api/bounties/test-id")
        
        assert isinstance(response, ErrorResponse)
        assert response.correlation_id == "corr-123"
        assert response.path == "/api/bounties/test-id"


class TestMiddleware:
    """Test error handling middleware."""
    
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
    
    def test_not_found_error(self, client):
        """Verify NotFoundException is handled correctly."""
        response = client.get("/not-found")
        
        assert response.status_code == 404
        data = response.json()
        assert data["error"] == "NOT_FOUND"
        assert "not found" in data["message"].lower()
    
    def test_validation_error(self, client):
        """Verify ValidationException is handled correctly."""
        response = client.get("/validation-error")
        
        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "VALIDATION_ERROR"
    
    def test_conflict_error(self, client):
        """Verify ConflictException is handled correctly."""
        response = client.get("/conflict")
        
        assert response.status_code == 409
        data = response.json()
        assert data["error"] == "CONFLICT"
    
    def test_unauthorized_error(self, client):
        """Verify UnauthorizedException is handled correctly."""
        response = client.get("/unauthorized")
        
        assert response.status_code == 401
        data = response.json()
        assert data["error"] == "UNAUTHORIZED"
        assert "WWW-Authenticate" in response.headers
    
    def test_internal_error(self, client):
        """Verify InternalServerException is handled correctly."""
        response = client.get("/internal-error")
        
        assert response.status_code == 500
        data = response.json()
        assert data["error"] == "INTERNAL_ERROR"
    
    def test_unexpected_error(self, client):
        """Verify unexpected exceptions are converted to 500."""
        response = client.get("/unexpected-error")
        
        assert response.status_code == 500
        data = response.json()
        assert data["error"] == "INTERNAL_ERROR"
    
    def test_error_response_structure(self, client):
        """Verify error response has all required fields."""
        response = client.get("/not-found")
        
        data = response.json()
        
        # Required fields
        assert "error" in data
        assert "message" in data
        assert "timestamp" in data
        
        # Optional fields that should be present
        assert "correlation_id" in data
        assert "path" in data


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