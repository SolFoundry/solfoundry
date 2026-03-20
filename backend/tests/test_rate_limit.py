"""Tests for rate limiting."""
from backend.src.middleware.rate_limit import rate_limit_middleware

def test_rate_limit_middleware():
    """Test basic functionality."""
    assert rate_limit_middleware({}) is True
