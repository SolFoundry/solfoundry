"""Pytest fixtures — env must be set before ``app.main`` is imported."""

from __future__ import annotations

import os

# Configure before importing the FastAPI app (settings are resolved at import).
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci-only-32chars!!")
os.environ.setdefault("GITHUB_CLIENT_ID", "test_github_client_id")
os.environ.setdefault("GITHUB_CLIENT_SECRET", "test_github_client_secret")
os.environ.setdefault(
    "OAUTH_REDIRECT_URI",
    "http://localhost:5173/auth/github/callback",
)
os.environ.setdefault(
    "CORS_ORIGINS",
    "http://localhost:5173,http://test",
)

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


@pytest.fixture
def client() -> TestClient:
    get_settings.cache_clear()
    with TestClient(app) as c:
        yield c
    get_settings.cache_clear()
