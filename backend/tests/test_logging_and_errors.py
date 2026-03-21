"""Module test_logging_and_errors."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
import os
import json

client = TestClient(app)

def test_request_id_in_header():
    """Verify that X-Request-ID is present in response headers."""
    response = client.get("/health")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
    request_id = response.headers["X-Request-ID"]
    assert len(request_id) > 0

def test_structured_error_404():
    """Verify 404 error follows structured JSON format."""
    response = client.get("/non-existent-path")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert "request_id" in data
    assert "code" in data
    assert data["code"] == "HTTP_404"

def test_structured_error_401_auth_error():
    """Verify AuthError follows structured JSON format."""
    # We can trigger an AuthError by calling a protected endpoint without proper token
    # or a mock endpoint that raises AuthError.
    # For now, let's assume we can trigger one or we mock it.
    from app.services.auth_service import AuthError
    
    @app.get("/test-auth-error")
    async def trigger_auth_error():
        """The trigger_auth_error function."""
        raise AuthError("Unauthorized specifically")
    
    response = client.get("/test-auth-error")
    assert response.status_code == 401
    data = response.json()
    assert data["error"] == "Unauthorized specifically"
    assert data["code"] == "AUTH_ERROR"

def test_structured_error_400_value_error():
    """Verify ValueError follows structured JSON format."""
    @app.get("/test-value-error")
    async def trigger_value_error():
        """The trigger_value_error function."""
        raise ValueError("Invalid input data")
    
    response = client.get("/test-value-error")
    assert response.status_code == 400
    data = response.json()
    assert data["error"] == "Invalid input data"
    assert data["code"] == "VALIDATION_ERROR"

def test_health_check_format():
    """Verify /health returns enhanced status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "degraded"]
    assert "database" in data
    assert "version" in data

def test_audit_log_creation():
    """Verify that audit logs are written for sensitive operations."""
    # Trigger a payout creation (will log to audit.log)
    # We need to mock the DB or use the in-memory store if possible.
    from app.services.payout_service import create_payout
    from app.models.payout import PayoutCreate
    
    data = PayoutCreate(
        recipient="test-user",
        recipient_wallet="C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS",  # Valid base58 address
        amount=100.0,
        token="FNDRY",
        bounty_id="b1",
        bounty_title="Test Bounty"
    )
    
    # Just call the service method
    create_payout(data)
    
    # Check if logs/audit.log exists and has the entry
    audit_log_path = "logs/audit.log"
    assert os.path.exists(audit_log_path)
    
    with open(audit_log_path, "r") as f:
        lines = f.readlines()
        last_line = json.loads(lines[-1])
        assert last_line["event"] == "payout_created"
        assert last_line["recipient"] == "test-user"
        assert last_line["amount"] == 100.0
