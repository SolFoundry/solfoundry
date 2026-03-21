"""Tests for logging functionality."""
import os
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.responses import JSONResponse
from src.middleware.logging import StructuredLoggingMiddleware, handle_error, setup_logging, _validate_correlation_id

app = FastAPI()
app.add_middleware(StructuredLoggingMiddleware)

# Mock endpoint to trigger tests
@app.get("/test")
async def basic_endpoint():
    return {"status": "ok"}
    
@app.get("/crash")
async def crash_endpoint():
    raise ValueError("System failure test")
    
@app.get("/notfound")
async def notfound_endpoint():
    raise HTTPException(status_code=404, detail="Item not found")

@app.post("/api/payout/execute")
async def payout_endpoint():
    return {"status": "payout initiated"}

# Add exception handler to FastApi to match real app behavior so 404 HTTPExceptions translate cleanly
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    return JSONResponse(
        status_code=500,
        headers={"X-Correlation-ID": correlation_id},
        content={
            "error": "Internal Server Error", 
            "correlation_id": correlation_id,
            "message": "An unexpected error occurred. Please contact support with the correlation ID."
        }
    )

client = TestClient(app, raise_server_exceptions=False)

def test_setup_logging_creates_dirs(tmp_path):
    log_dir = str(tmp_path / "custom_logs")
    setup_logging(log_dir=log_dir)
    assert os.path.exists(log_dir)
    assert os.path.exists(os.path.join(log_dir, "access.log"))
    assert os.path.exists(os.path.join(log_dir, "app.log"))
    assert os.path.exists(os.path.join(log_dir, "error.log"))
    assert os.path.exists(os.path.join(log_dir, "audit.log"))

def test_success_logging():
    response = client.get("/test")
    assert response.status_code == 200
    assert "X-Correlation-ID" in response.headers

import pytest

@pytest.mark.asyncio
async def test_client_none_logging():
    # Provide a fake scope without client
    scope = {"type": "http", "method": "GET", "path": "/test", "headers": [], "query_string": b""}
    async def receive():
        return {"type": "http.request"}
    async def send(message):
        pass
    await app(scope, receive, send)

def test_exception_handler_masks_details():
    response = client.get("/crash")
    assert response.status_code == 500
    data = response.json()
    assert data["error"] == "Internal Server Error"
    assert "correlation_id" in data
    # Ensure stack trace isn't leaked to client
    assert "ValueError" not in str(data)
    assert "stack_trace" not in data

def test_httpexception_passthrough():
    response = client.get("/notfound")
    assert response.status_code == 404
    assert response.json()["detail"] == "Item not found"

def test_audit_trigger():
    response = client.post("/api/payout/execute")
    assert response.status_code == 200
    assert "X-Correlation-ID" in response.headers

def test_validate_correlation_id():
    valid = "a1b2c3d4e5-f6g7"
    assert _validate_correlation_id(valid) == valid
    assert _validate_correlation_id("") != ""
    assert _validate_correlation_id("short") != "short"
    assert _validate_correlation_id("invalid_chars@#$%") != "invalid_chars@#$%"

def test_legacy_handler():
    assert handle_error(ValueError("Legacy error"))["error"] == "Legacy error"
