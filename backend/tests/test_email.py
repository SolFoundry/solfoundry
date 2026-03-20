"""Tests for email service."""
import pytest
import asyncio
from backend.src.services.email import send_email, EmailService

def test_send_email_sync():
    """Test standard synchronous wrapper."""
    assert send_email("test@example.com", "Subject", "Body") is True

@pytest.mark.asyncio
async def test_send_email_async():
    """Test async mailer functionality."""
    mailer = EmailService()
    res = await mailer.send_email_async("user@domain.com", "Test", "Msg")
    assert res is True

def test_template_render():
    mailer = EmailService()
    doc = mailer.render_template("welcome", {"name": "AI"})
    assert "Welcome to SolFoundry, AI!" in doc
