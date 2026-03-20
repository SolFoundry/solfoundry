"""Tests for email service."""
import pytest
import asyncio
from backend.src.services.email import send_email, EmailService

def test_send_email_sync():
    assert send_email("test@example.com", "Subject", "Body") is True

@pytest.mark.asyncio
async def test_send_email_async():
    mailer = EmailService()
    assert await mailer.send_email_async("user@domain.com", "Test", "Msg") is True

def test_template_render():
    assert "Welcome to SolFoundry, AI!" in EmailService().render_template("welcome", {"name": "AI"})
