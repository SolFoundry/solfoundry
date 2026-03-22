import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.email_service import can_send_email, increment_email_count, _render_template, send_notification_email

@pytest.mark.asyncio
async def test_can_send_email_limit():
    with patch("app.services.email_service.get_redis", new_callable=AsyncMock) as mock_get_redis:
        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis
        
        # Scenario 1: No count yet
        mock_redis.get.return_value = None
        assert await can_send_email("user123") is True
        
        # Scenario 2: Under limit
        mock_redis.get.return_value = "5"
        assert await can_send_email("user123") is True
        
        # Scenario 3: At limit
        mock_redis.get.return_value = "10"
        assert await can_send_email("user123") is False

@pytest.mark.asyncio
async def test_increment_email_count():
    with patch("app.services.email_service.get_redis", new_callable=AsyncMock) as mock_get_redis:
        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis
        
        # Scenario 1: First increment
        mock_redis.incr.return_value = 1
        await increment_email_count("user123")
        mock_redis.expire.assert_called_with("email_rate_limit:user123", 3600)
        
        # Scenario 2: Subsequent increment
        mock_redis.incr.return_value = 2
        mock_redis.expire.reset_mock()
        await increment_email_count("user123")
        mock_redis.expire.assert_not_called()

def test_render_template_basic():
    context = {"title": "Test Title", "message": "Test Message"}
    rendered = _render_template("notification", context)
    assert "Test Title" in rendered
    assert "Test Message" in rendered
    assert "SolFoundry" in rendered
    assert "/unsubscribe" in rendered

@pytest.mark.asyncio
async def test_send_notification_email_disabled():
    with patch("app.services.email_service.config.EMAIL_NOTIFICATIONS_ENABLED", False):
        success = await send_notification_email("test@example.com", "Subject", "template", {})
        assert success is False
