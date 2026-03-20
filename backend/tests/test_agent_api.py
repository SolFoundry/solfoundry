"""Tests for Agent API endpoints."""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4, UUID
from datetime import datetime, timezone

from app.models.agent import (
    AgentDB,
    AgentRole,
    AgentStatus,
    AgentCreate,
    AgentPerformanceStats,
)


# Test data
TEST_AGENT_ID = str(uuid4())
TEST_WALLET = "TestWalletAddress123456789"

MOCK_AGENT = {
    "id": TEST_AGENT_ID,
    "name": "test-agent",
    "display_name": "Test Agent",
    "avatar_url": None,
    "role": AgentRole.BACKEND,
    "status": AgentStatus.AVAILABLE,
    "bio": "A test agent for unit tests",
    "capabilities": ["Python", "Testing"],
    "specializations": ["Unit Tests"],
    "pricing_hourly": 100.0,
    "pricing_fixed": 500.0,
    "bounties_completed": 10,
    "bounties_in_progress": 0,
    "success_rate": 0.95,
    "avg_completion_time_hours": 5.0,
    "total_earnings": 5000.0,
    "reputation_score": 100,
    "past_work_links": [],
    "owner_wallet": TEST_WALLET,
    "sdk_version": "1.0.0",
    "created_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "last_active_at": None,
}


def create_mock_agent(**kwargs):
    """Create a mock AgentDB instance."""
    agent = MagicMock(spec=AgentDB)
    agent.id = UUID(kwargs.get("id", TEST_AGENT_ID))
    agent.name = kwargs.get("name", "test-agent")
    agent.display_name = kwargs.get("display_name", "Test Agent")
    agent.avatar_url = kwargs.get("avatar_url")
    agent.role = kwargs.get("role", AgentRole.BACKEND)
    agent.status = kwargs.get("status", AgentStatus.AVAILABLE)
    agent.bio = kwargs.get("bio", "A test agent")
    agent.capabilities = kwargs.get("capabilities", ["Python"])
    agent.specializations = kwargs.get("specializations", [])
    agent.pricing_hourly = kwargs.get("pricing_hourly", 100.0)
    agent.pricing_fixed = kwargs.get("pricing_fixed", 500.0)
    agent.bounties_completed = kwargs.get("bounties_completed", 10)
    agent.bounties_in_progress = kwargs.get("bounties_in_progress", 0)
    agent.success_rate = kwargs.get("success_rate", 0.95)
    agent.avg_completion_time_hours = kwargs.get("avg_completion_time_hours", 5.0)
    agent.total_earnings = kwargs.get("total_earnings", 5000.0)
    agent.reputation_score = kwargs.get("reputation_score", 100)
    agent.past_work_links = kwargs.get("past_work_links", [])
    agent.owner_wallet = kwargs.get("owner_wallet", TEST_WALLET)
    agent.sdk_version = kwargs.get("sdk_version", "1.0.0")
    agent.created_at = kwargs.get("created_at", datetime.now(timezone.utc))
    agent.updated_at = kwargs.get("updated_at", datetime.now(timezone.utc))
    agent.last_active_at = kwargs.get("last_active_at")
    return agent


class TestAgentAPI:
    """Test suite for Agent API endpoints."""

    @pytest.mark.asyncio
    async def test_list_agents_success(self):
        """Test successful agent listing."""
        from app.main import app
        from app.services.agent_service import AgentService
        
        mock_agents = [
            create_mock_agent(name="agent-1", display_name="Agent 1"),
            create_mock_agent(name="agent-2", display_name="Agent 2"),
        ]
        
        with patch.object(
            AgentService, 
            "list_agents", 
            new_callable=AsyncMock,
            return_value=(mock_agents, 2)
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.get("/api/agents")
                
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] == 2

    @pytest.mark.asyncio
    async def test_list_agents_with_filters(self):
        """Test agent listing with filters."""
        from app.main import app
        from app.services.agent_service import AgentService
        
        mock_agents = [
            create_mock_agent(name="backend-agent", role=AgentRole.BACKEND),
        ]
        
        with patch.object(
            AgentService, 
            "list_agents", 
            new_callable=AsyncMock,
            return_value=(mock_agents, 1)
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.get(
                    "/api/agents",
                    params={
                        "role": "backend",
                        "status": "available",
                        "min_success_rate": 0.9,
                    }
                )
                
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_list_agents_with_search(self):
        """Test agent listing with search query."""
        from app.main import app
        from app.services.agent_service import AgentService
        
        mock_agents = [
            create_mock_agent(name="python-expert", display_name="Python Expert"),
        ]
        
        with patch.object(
            AgentService, 
            "list_agents", 
            new_callable=AsyncMock,
            return_value=(mock_agents, 1)
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.get(
                    "/api/agents",
                    params={"search": "python"}
                )
                
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_agent_by_id_success(self):
        """Test getting a specific agent by ID."""
        from app.main import app
        from app.services.agent_service import AgentService
        
        agent_id = uuid4()
        mock_agent = create_mock_agent(id=str(agent_id), name="test-agent")
        
        with patch.object(
            AgentService, 
            "get_agent_by_id", 
            new_callable=AsyncMock,
            return_value=mock_agent
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.get(f"/api/agents/{agent_id}")
                
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(agent_id)
        assert data["name"] == "test-agent"

    @pytest.mark.asyncio
    async def test_get_agent_by_id_not_found(self):
        """Test getting a non-existent agent."""
        from app.main import app
        from app.services.agent_service import AgentService
        
        agent_id = uuid4()
        
        with patch.object(
            AgentService, 
            "get_agent_by_id", 
            new_callable=AsyncMock,
            return_value=None
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.get(f"/api/agents/{agent_id}")
                
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_agent_invalid_id_format(self):
        """Test getting an agent with invalid ID format."""
        from app.main import app
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/agents/invalid-uuid")
            
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_create_agent_success(self):
        """Test successful agent creation with authentication."""
        from app.main import app
        from app.services.agent_service import AgentService
        
        mock_agent = create_mock_agent(name="new-agent", owner_wallet=TEST_WALLET)
        
        with patch.object(
            AgentService, 
            "get_agent_by_name", 
            new_callable=AsyncMock,
            return_value=None
        ), patch.object(
            AgentService, 
            "create_agent", 
            new_callable=AsyncMock,
            return_value=mock_agent
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    "/api/agents",
                    json={
                        "name": "new-agent",
                        "display_name": "New Agent",
                        "role": "backend",
                        "capabilities": ["Python"],
                    },
                    headers={"Authorization": f"Bearer {TEST_WALLET}"}
                )
                
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "new-agent"

    @pytest.mark.asyncio
    async def test_create_agent_requires_auth(self):
        """Test that agent creation requires authentication."""
        from app.main import app
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/agents",
                json={
                    "name": "new-agent",
                    "display_name": "New Agent",
                    "role": "backend",
                }
            )
            
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_create_agent_duplicate_name(self):
        """Test creating an agent with duplicate name."""
        from app.main import app
        from app.services.agent_service import AgentService
        
        existing_agent = create_mock_agent(name="existing-agent")
        
        with patch.object(
            AgentService, 
            "get_agent_by_name", 
            new_callable=AsyncMock,
            return_value=existing_agent
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    "/api/agents",
                    json={
                        "name": "existing-agent",
                        "display_name": "Existing Agent",
                        "role": "backend",
                    },
                    headers={"Authorization": f"Bearer {TEST_WALLET}"}
                )
                
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_compare_agents_success(self):
        """Test comparing multiple agents."""
        from app.main import app
        from app.services.agent_service import AgentService
        
        agent_id_1 = uuid4()
        agent_id_2 = uuid4()
        mock_agents = [
            create_mock_agent(id=str(agent_id_1), name="agent-1"),
            create_mock_agent(id=str(agent_id_2), name="agent-2"),
        ]
        
        with patch.object(
            AgentService, 
            "compare_agents", 
            new_callable=AsyncMock,
            return_value=mock_agents
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.get(
                    "/api/agents/compare",
                    params={"agent_ids": f"{agent_id_1},{agent_id_2}"}
                )
                
        assert response.status_code == 200
        data = response.json()
        assert "agents" in data
        assert len(data["agents"]) == 2

    @pytest.mark.asyncio
    async def test_compare_agents_invalid_count(self):
        """Test comparing with invalid number of agents."""
        from app.main import app
        
        agent_id = uuid4()
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Only one agent
            response = await client.get(
                "/api/agents/compare",
                params={"agent_ids": str(agent_id)}
            )
            
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_hire_agent_success(self):
        """Test successfully hiring an agent."""
        from app.main import app
        from app.services.agent_service import AgentService
        from app.models.agent import HireAgentResponse
        
        agent_id = str(uuid4())
        bounty_id = str(uuid4())
        
        with patch.object(
            AgentService, 
            "hire_agent_for_bounty", 
            new_callable=AsyncMock,
            return_value=HireAgentResponse(
                success=True,
                message=f"Agent {agent_id} hired successfully",
                assignment_id=f"assignment-{agent_id}-{bounty_id}"
            )
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    "/api/agents/hire",
                    json={
                        "agent_id": agent_id,
                        "bounty_id": bounty_id,
                    },
                    headers={"Authorization": f"Bearer {TEST_WALLET}"}
                )
                
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    @pytest.mark.asyncio
    async def test_hire_agent_requires_auth(self):
        """Test that hiring requires authentication."""
        from app.main import app
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/agents/hire",
                json={
                    "agent_id": str(uuid4()),
                    "bounty_id": str(uuid4()),
                }
            )
            
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_hire_agent_not_available(self):
        """Test hiring an unavailable agent."""
        from app.main import app
        from app.services.agent_service import AgentService
        from app.models.agent import HireAgentResponse
        
        agent_id = str(uuid4())
        
        with patch.object(
            AgentService, 
            "hire_agent_for_bounty", 
            new_callable=AsyncMock,
            return_value=HireAgentResponse(
                success=False,
                message="Agent is already working on another bounty"
            )
        ):
            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    "/api/agents/hire",
                    json={
                        "agent_id": agent_id,
                        "bounty_id": str(uuid4()),
                    },
                    headers={"Authorization": f"Bearer {TEST_WALLET}"}
                )
                
        assert response.status_code == 400


class TestAgentServiceSecurity:
    """Test suite for Agent Service security features."""

    def test_escape_like_pattern(self):
        """Test SQL injection prevention in LIKE patterns."""
        from app.services.agent_service import AgentService
        
        # Test special characters
        assert AgentService._escape_like_pattern("test%value") == "test\\%value"
        assert AgentService._escape_like_pattern("test_value") == "test\\_value"
        assert AgentService._escape_like_pattern("test\\value") == "test\\\\value"
        assert AgentService._escape_like_pattern("test%_\\all") == "test\\%\\_\\\\all"
        
        # Test normal string
        assert AgentService._escape_like_pattern("normal") == "normal"

    @pytest.mark.asyncio
    async def test_search_sql_injection_prevention(self):
        """Test that search queries prevent SQL injection."""
        from app.services.agent_service import AgentService
        from app.database import get_db
        
        # This is a conceptual test - in real scenario you'd verify
        # the query doesn't allow injection
        malicious_search = "test'; DROP TABLE agents; --"
        escaped = AgentService._escape_like_pattern(malicious_search)
        
        # The escaped string should not contain unescaped special chars
        # that could cause SQL injection
        assert "'" not in escaped or "\\%" in escaped or "\\_" in escaped