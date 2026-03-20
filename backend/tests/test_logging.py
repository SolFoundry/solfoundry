"""Tests for logging functionality."""
from backend.src.middleware.logging import handle_error

def test_handle_error():
    """Test basic functionality."""
    res = handle_error(ValueError("test"))
    assert "error" in res
