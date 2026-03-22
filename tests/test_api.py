"""Tests for API client."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

from solfoundry_cli.api import APIClient, Bounty, Submission, APIError


@pytest.fixture
def mock_response():
    """Mock API response."""
    return {
        "bounties": [
            {
                "id": 511,
                "title": "Bounty CLI tool",
                "description": "Build a CLI tool",
                "reward": 300000,
                "reward_token": "$FNDRY",
                "tier": "t2",
                "status": "open",
                "category": "backend",
                "created_at": "2026-03-22T08:12:11Z",
                "deadline": None,
                "claimer": None,
                "repository": "solfoundry/solfoundry",
                "issue_url": "https://github.com/solfoundry/solfoundry/issues/511"
            }
        ]
    }


@pytest.fixture
def api_client():
    """Create API client with mocked config."""
    with patch('solfoundry_cli.api.config_manager') as mock_config:
        mock_config.get_api_key.return_value = "test_key"
        mock_config.get_api_url.return_value = "https://test.api.solfoundry.io"
        yield APIClient()


def test_list_bounties(api_client, mock_response):
    """Test listing bounties."""
    with patch.object(api_client.session, 'request') as mock_request:
        mock_request.return_value.json.return_value = mock_response
        mock_request.return_value.raise_for_status = Mock()
        
        bounties = api_client.list_bounties()
        
        assert len(bounties) == 1
        assert bounties[0].id == 511
        assert bounties[0].title == "Bounty CLI tool"
        assert bounties[0].reward == 300000


def test_list_bounties_with_filters(api_client, mock_response):
    """Test listing bounties with filters."""
    with patch.object(api_client.session, 'request') as mock_request:
        mock_request.return_value.json.return_value = mock_response
        mock_request.return_value.raise_for_status = Mock()
        
        bounties = api_client.list_bounties(tier="t2", status="open", category="backend")
        
        # Verify filters were passed
        mock_request.assert_called_once()
        call_args = mock_request.call_args
        assert call_args[1]['params']['tier'] == 't2'
        assert call_args[1]['params']['status'] == 'open'
        assert call_args[1]['params']['category'] == 'backend'


def test_get_bounty(api_client):
    """Test getting a single bounty."""
    bounty_data = {
        "id": 511,
        "title": "Bounty CLI tool",
        "description": "Build a CLI tool",
        "reward": 300000,
        "reward_token": "$FNDRY",
        "tier": "t2",
        "status": "open",
        "category": "backend",
        "created_at": "2026-03-22T08:12:11Z",
        "deadline": None,
        "claimer": None,
        "repository": "solfoundry/solfoundry",
        "issue_url": "https://github.com/solfoundry/solfoundry/issues/511"
    }
    
    with patch.object(api_client.session, 'request') as mock_request:
        mock_request.return_value.json.return_value = bounty_data
        mock_request.return_value.raise_for_status = Mock()
        
        bounty = api_client.get_bounty(511)
        
        assert bounty.id == 511
        assert bounty.title == "Bounty CLI tool"


def test_claim_bounty(api_client):
    """Test claiming a bounty."""
    claim_response = {
        "success": True,
        "transaction_hash": "0x123abc...",
        "message": "Bounty claimed successfully"
    }
    
    with patch.object(api_client.session, 'request') as mock_request:
        mock_request.return_value.json.return_value = claim_response
        mock_request.return_value.raise_for_status = Mock()
        
        result = api_client.claim_bounty(511)
        
        assert result["success"] is True
        assert result["transaction_hash"] == "0x123abc..."
        mock_request.assert_called_with(
            "POST",
            "/v1/bounties/511/claim",
            timeout=30,
            json=None,
            params=None,
            headers=None,
            data=None
        )


def test_submit_bounty(api_client):
    """Test submitting work for a bounty."""
    submit_response = {
        "success": True,
        "submission_id": 123,
        "message": "Submission received"
    }
    
    with patch.object(api_client.session, 'request') as mock_request:
        mock_request.return_value.json.return_value = submit_response
        mock_request.return_value.raise_for_status = Mock()
        
        result = api_client.submit_bounty(511, "https://github.com/repo/pull/123")
        
        assert result["success"] is True
        assert result["submission_id"] == 123


def test_api_error(api_client):
    """Test API error handling."""
    with patch.object(api_client.session, 'request') as mock_request:
        mock_request.side_effect = Exception("Connection error")
        
        with pytest.raises(APIError) as exc_info:
            api_client.list_bounties()
        
        assert "API request failed" in str(exc_info.value)


def test_bounty_model():
    """Test Bounty model validation."""
    bounty = Bounty(
        id=511,
        title="Test Bounty",
        description="Test description",
        reward=100000,
        reward_token="$FNDRY",
        tier="t1",
        status="open",
        category="frontend",
        created_at=datetime(2026, 3, 22, 8, 12, 11),
        repository="test/repo",
        issue_url="https://github.com/test/repo/issues/1"
    )
    
    assert bounty.id == 511
    assert bounty.reward == 100000
    assert bounty.status == "open"
