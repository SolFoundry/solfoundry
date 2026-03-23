"""Module test_logging_and_errors."""

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
    # Error responses use "message" key (not "error") per the global exception handler
    assert "message" in data
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
        """Trigger auth error."""
        raise AuthError("Unauthorized specifically")

    response = client.get("/test-auth-error")
    assert response.status_code == 401
    data = response.json()
    # AuthError handler returns "message" key per the global exception handler
    assert data["message"] == "Unauthorized specifically"
    assert data["code"] == "AUTH_ERROR"


def test_structured_error_400_value_error():
    """Verify ValueError follows structured JSON format."""

    @app.get("/test-value-error")
    async def trigger_value_error():
        """Trigger value error."""
        raise ValueError("Invalid input data")

    response = client.get("/test-value-error")
    assert response.status_code == 400
    data = response.json()
    # ValueError handler returns "message" key per the global exception handler
    assert data["message"] == "Invalid input data"
    assert data["code"] == "VALIDATION_ERROR"


def test_health_check_format():
    """Verify /health returns enhanced status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded", "unavailable"]
    assert "services" in data
    assert "database" in data["services"]
    assert "version" in data


def test_audit_log_creation():
    """Verify that audit logs are written for sensitive operations."""
    import asyncio
    from app.services.payout_service import create_payout
    from app.models.payout import PayoutCreate

    payload = PayoutCreate(
        recipient="test-user-audit",
        recipient_wallet="C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS",  # Valid base58 address
        amount=100.0,
        token="FNDRY",
        bounty_id="b1",
        bounty_title="Test Bounty",
    )

    # create_payout is async — run it in a fresh event loop
    asyncio.run(create_payout(payload))

    # Check if logs/audit.log exists and has the payout_created entry
    audit_log_path = "logs/audit.log"
    assert os.path.exists(audit_log_path), f"Audit log not found at {audit_log_path}"

    payout_entry = None
    with open(audit_log_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                # Find the payout_created event for our test recipient
                if (
                    entry.get("event") == "payout_created"
                    and entry.get("recipient") == "test-user-audit"
                ):
                    payout_entry = entry
            except json.JSONDecodeError:
                continue

    assert payout_entry is not None, "payout_created audit event not found in log"
    assert payout_entry["recipient"] == "test-user-audit"
    assert payout_entry["amount"] == 100.0
