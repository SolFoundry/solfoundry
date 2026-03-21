"""
Unit tests for Bounty Stats API Endpoint - COMPLETE SOLUTION
This is the test solution for GitHub Bounty Issue #344

File: backend/tests/test_stats_api.py
========================================
Copy this entire content to: backend/tests/test_stats_api.py
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.stats import override_get_stats_service


# Override the dependency for testing
app.dependency_overrides[app.api.stats.get_stats_service] = override_get_stats_service

client = TestClient(app)


def test_stats_endpoint_returns_200():
    """Test that /api/stats returns 200 OK"""
    response = client.get("/api/stats")
    assert response.status_code == 200


def test_stats_endpoint_returns_json():
    """Test that /api/stats returns JSON"""
    response = client.get("/api/stats")
    assert response.headers["content-type"] == "application/json"


def test_stats_endpoint_structure():
    """Test that /api/stats returns correct structure"""
    response = client.get("/api/stats")
    data = response.json()
    
    # Check all required fields are present
    required_fields = [
        "total_bounties_created",
        "total_bounties_completed", 
        "total_bounties_open",
        "total_contributors",
        "total_fndry_paid",
        "total_prs_reviewed",
        "bounties_by_tier",
        "top_contributor"
    ]
    
    for field in required_fields:
        assert field in data, f"Missing field: {field}"
    
    # Check data types
    assert isinstance(data["total_bounties_created"], int)
    assert isinstance(data["total_bounties_completed"], int)
    assert isinstance(data["total_bounties_open"], int)
    assert isinstance(data["total_contributors"], int)
    assert isinstance(data["total_fndry_paid"], int)
    assert isinstance(data["total_prs_reviewed"], int)
    assert isinstance(data["bounties_by_tier"], dict)
    assert isinstance(data["top_contributor"], dict)
    
    # Check nested structures
    assert "tier-1" in data["bounties_by_tier"]
    assert "open" in data["bounties_by_tier"]["tier-1"]
    assert "completed" in data["bounties_by_tier"]["tier-1"]


def test_stats_endpoint_values():
    """Test that /api/stats returns correct values"""
    response = client.get("/api/stats")
    data = response.json()
    
    # Check specific values from mocked data
    assert data["total_bounties_created"] == 50
    assert data["total_bounties_completed"] == 35
    assert data["total_bounties_open"] == 12
    assert data["total_contributors"] == 25
    assert data["total_fndry_paid"] == 5000000
    assert data["total_prs_reviewed"] == 200
    
    # Check nested values
    assert data["bounties_by_tier"]["tier-1"]["open"] == 5
    assert data["bounties_by_tier"]["tier-1"]["completed"] == 25
    
    assert data["top_contributor"]["username"] == "HuiNeng6"
    assert data["top_contributor"]["bounties_completed"] == 17


def test_stats_endpoint_cache_header():
    """Test that /api/stats includes cache control headers"""
    response = client.get("/api/stats")
    
    # Check for cache-related headers
    assert "cache-control" in response.headers
    cache_control = response.headers["cache-control"]
    
    # Should include max-age or similar caching directives
    assert "max-age" in cache_control or "s-maxage" in cache_control


def test_stats_endpoint_data_consistency():
    """Test that the data returned is internally consistent"""
    response = client.get("/api/stats")
    data = response.json()
    
    # Check that total created >= completed + open
    total_created = data["total_bounties_created"]
    total_completed = data["total_bounties_completed"]
    total_open = data["total_bounties_open"]
    
    assert total_created >= total_completed + total_open
    
    # Check that bounties by tier totals match overall totals
    tier_totals = {
        tier: tier_data["open"] + tier_data["completed"]
        for tier, tier_data in data["bounties_by_tier"].items()
    }
    
    total_from_tiers = sum(tier_totals.values())
    assert total_created >= total_from_tiers
    
    # Check that top contributor's bounty count <= total completed
    top_contributor_bounties = data["top_contributor"]["bounties_completed"]
    assert top_contributor_bounties <= total_completed


def test_stats_endpoint_tier_structure():
    """Test that all tiers have correct structure"""
    response = client.get("/api/stats")
    data = response.json()
    
    # Check all tiers
    for tier in ["tier-1", "tier-2", "tier-3"]:
        assert tier in data["bounties_by_tier"]
        tier_data = data["bounties_by_tier"][tier]
        
        assert "open" in tier_data
        assert "completed" in tier_data
        
        assert isinstance(tier_data["open"], int)
        assert isinstance(tier_data["completed"], int)
        
        # Values should be non-negative
        assert tier_data["open"] >= 0
        assert tier_data["completed"] >= 0


def test_stats_endpoint_performance():
    """Test performance of the endpoint (basic check)"""
    import time
    
    start_time = time.time()
    response = client.get("/stats")
    end_time = time.time()
    
    # Response should be fast (< 1 second for mocked data)
    response_time = end_time - start_time
    assert response_time < 1.0, f"Response too slow: {response_time:.3f}s"
    
    # Status should be 200
    assert response.status_code == 200
