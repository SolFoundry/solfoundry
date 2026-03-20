"""Tests for email service."""
from backend.src.services.email import send_email

def test_send_email():
    """Test basic functionality."""
    assert send_email("test@example.com", "Subject", "Body") is True
