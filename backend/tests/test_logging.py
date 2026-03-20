"""Tests for logging functionality."""
import json
import pytest
import os
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from backend.src.middleware.logging import StructuredLoggingMiddleware, handle_error

app = FastAPI()
app.add_middleware(StructuredLoggingMiddleware)

@app.get("/test")
async def basic_endpoint():
    return {"status": "ok"}
    
@app.get("/crash")
async def crash_endpoint():
    raise ValueError("System failure test")

@app.post("/api/payout")
async def payout_endpoint():
    return {"status": "payout initiated"}

client = TestClient(app)

def test_success_logging():
    response = client.get("/test")
    assert response.status_code == 200
    assert "X-Correlation-ID" in response.headers

def test_exception_handler_masks_details():
    response = client.get("/crash")
    assert response.status_code == 500
    data = response.json()
    assert data["error"] == "Internal Server Error"
    assert "correlation_id" in data
    # Ensure stack trace isn't leaked to client
    assert "ValueError" not in str(data)
    assert "stack_trace" not in data

def test_audit_trigger():
    response = client.post("/api/payout")
    assert response.status_code == 200
    assert "X-Correlation-ID" in response.headers

def test_legacy_handler():
    assert handle_error(ValueError("Legacy error"))["error"] == "Legacy error"
