"""Comprehensive tests for Agent Registration API (Issue #203).

Covers:
- POST /api/agents/register - Register a new agent
- GET /api/agents/{agent_id} - Get agent by ID
- GET /api/agents - List agents with pagination and filters
- PATCH /api/agents/{agent_id} - Update agent
- DELETE /api/agents/{agent_id} - Deactivate agent

Test coverage:
- Happy path scenarios
- Validation errors
- Authentication/authorization
- Pagination
- Filtering
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.agents import router as agents_router
from app.models.agent import AgentRole
from app.services import agent_service


# ---------------------------------------------------------------------------
# Test app & client
# ---------------------------------------------------------------------------

_test_app = FastAPI()
_test_app.include_router(agents_router)


@_test_app.get("/health")
async def health_check():
    return {"status": "ok"}


client = TestClient(_test_app)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VALID_WALLET = "Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7"
ANOTHER_WALLET = "9WzDXwBbmkg8ZTbNMqUxHcCQYx5LN9CsDeKwjLzRJmHX"

VALID_AGENT = {
    "name": "CodeMaster AI",
    "description": "An expert backend engineer agent",
    "role": "backend-engineer",
    "capabilities": ["api-design", "database-optimization", "microservices"],
    "languages": ["python", "rust", "typescript"],
    "apis": ["rest", "graphql", "grpc"],
    "operator_wallet": VALID_WALLET,
}


@pytest.fixture(autouse=True)
def clear_store():
    """Ensure each test starts and ends with an empty agent store."""
    agent_service.clear_store()
    yield
    agent_service.clear_store()


def _create_agent(**overrides) -> dict:
    """Helper: create an agent via the service and return its dict."""
    from app.models.agent import AgentCreate

    payload = {**VALID_AGENT, **overrides}
    return agent_service.create_agent(AgentCreate(**payload)).model_dump()


# ===========================================================================
# POST /api/agents/register - Register Agent Tests
# ===========================================================================


class TestRegisterAgent:
    """Tests for POST /api/agents/register endpoint."""

    def test_register_success(self):
        """Test successful agent registration."""
        resp = client.post("/api/agents/register", json=VALID_AGENT)
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == VALID_AGENT["name"]
        assert body["role"] == "backend-engineer"
        assert body["is_active"] is True
        assert body["availability"] == "available"
        assert set(body["capabilities"]) == {
            "api-design",
            "database-optimization",
            "microservices",
        }
        assert set(body["languages"]) == {"python", "rust", "typescript"}
        assert body["operator_wallet"] == VALID_WALLET
        assert "id" in body
        assert "created_at" in body
        assert "updated_at" in body

    def test_register_minimal(self):
        """Test registration with minimal required fields."""
        minimal = {
            "name": "Simple Agent",
            "role": "frontend-engineer",
            "operator_wallet": VALID_WALLET,
        }
        resp = client.post("/api/agents/register", json=minimal)
        assert resp.status_code == 201
        body = resp.json()
        assert body["description"] is None
        assert body["capabilities"] == []
        assert body["languages"] == []
        assert body["apis"] == []

    def test_register_all_roles(self):
        """Test registration with each valid role."""
        roles = [
            "backend-engineer",
            "frontend-engineer",
            "scraping-engineer",
            "bot-engineer",
            "ai-engineer",
            "security-analyst",
            "systems-engineer",
            "devops-engineer",
            "smart-contract-engineer",
        ]
        for role in roles:
            agent = {**VALID_AGENT, "name": f"Agent-{role}", "role": role}
            resp = client.post("/api/agents/register", json=agent)
            assert resp.status_code == 201, f"Failed for role: {role}"
            assert resp.json()["role"] == role

    def test_register_invalid_role(self):
        """Test registration with invalid role."""
        invalid = {**VALID_AGENT, "role": "invalid-role"}
        resp = client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    def test_register_missing_name(self):
        """Test registration without name."""
        invalid = {k: v for k, v in VALID_AGENT.items() if k != "name"}
        resp = client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    def test_register_empty_name(self):
        """Test registration with empty name."""
        invalid = {**VALID_AGENT, "name": ""}
        resp = client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    def test_register_name_too_long(self):
        """Test registration with name exceeding max length."""
        invalid = {**VALID_AGENT, "name": "A" * 101}
        resp = client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    def test_register_description_too_long(self):
        """Test registration with description exceeding max length."""
        invalid = {**VALID_AGENT, "description": "A" * 2001}
        resp = client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    def test_register_missing_wallet(self):
        """Test registration without operator wallet."""
        invalid = {k: v for k, v in VALID_AGENT.items() if k != "operator_wallet"}
        resp = client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    def test_register_invalid_wallet_format(self):
        """Test registration with invalid wallet address format."""
        invalid_wallets = [
            "invalid",
            "0x1234567890abcdef",
            "",
            "A" * 31,  # Too short
        ]
        for wallet in invalid_wallets:
            invalid = {**VALID_AGENT, "operator_wallet": wallet}
            resp = client.post("/api/agents/register", json=invalid)
            assert resp.status_code == 422, f"Should fail for wallet: {wallet}"

    def test_register_capabilities_normalized(self):
        """Test that capabilities are normalized to lowercase."""
        agent = {
            **VALID_AGENT,
            "capabilities": ["API-Design", " DATABASE ", "  MicroServices  "],
        }
        resp = client.post("/api/agents/register", json=agent)
        assert resp.status_code == 201
        caps = resp.json()["capabilities"]
        assert "api-design" in caps
        assert "database" in caps
        assert "microservices" in caps

    def test_register_too_many_capabilities(self):
        """Test registration with too many capabilities."""
        invalid = {**VALID_AGENT, "capabilities": [f"cap{i}" for i in range(51)]}
        resp = client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    def test_register_too_many_languages(self):
        """Test registration with too many languages."""
        invalid = {**VALID_AGENT, "languages": [f"lang{i}" for i in range(21)]}
        resp = client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    def test_register_too_many_apis(self):
        """Test registration with too many APIs."""
        invalid = {**VALID_AGENT, "apis": [f"api{i}" for i in range(31)]}
        resp = client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    def test_register_returns_unique_ids(self):
        """Test that each registration returns a unique ID."""
        ids = set()
        for i in range(10):
            agent = {**VALID_AGENT, "name": f"Agent-{i}"}
            resp = client.post("/api/agents/register", json=agent)
            assert resp.status_code == 201
            ids.add(resp.json()["id"])
        assert len(ids) == 10


# ===========================================================================
# GET /api/agents/{agent_id} - Get Agent Tests
# ===========================================================================


class TestGetAgent:
    """Tests for GET /api/agents/{agent_id} endpoint."""

    def test_get_success(self):
        """Test successful agent retrieval."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.get(f"/api/agents/{agent_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == agent_id
        assert body["name"] == VALID_AGENT["name"]
        assert body["role"] == "backend-engineer"

    def test_get_not_found(self):
        """Test getting a non-existent agent."""
        resp = client.get("/api/agents/nonexistent-id")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_get_response_shape(self):
        """Test that response contains all expected fields."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.get(f"/api/agents/{agent_id}")
        body = resp.json()

        expected_keys = {
            "id",
            "name",
            "description",
            "role",
            "capabilities",
            "languages",
            "apis",
            "operator_wallet",
            "is_active",
            "availability",
            "created_at",
            "updated_at",
        }
        assert set(body.keys()) == expected_keys


# ===========================================================================
# GET /api/agents - List Agents Tests
# ===========================================================================


class TestListAgents:
    """Tests for GET /api/agents endpoint."""

    def test_list_empty(self):
        """Test listing when no agents exist."""
        resp = client.get("/api/agents")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["items"] == []
        assert body["page"] == 1
        assert body["limit"] == 20

    def test_list_with_data(self):
        """Test listing with multiple agents."""
        _create_agent(name="Agent 1")
        _create_agent(name="Agent 2")
        _create_agent(name="Agent 3")

        resp = client.get("/api/agents")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 3
        assert len(body["items"]) == 3

    def test_list_pagination(self):
        """Test pagination of agent list."""
        for i in range(25):
            _create_agent(name=f"Agent-{i}")

        # First page
        resp = client.get("/api/agents?page=1&limit=10")
        body = resp.json()
        assert body["total"] == 25
        assert len(body["items"]) == 10
        assert body["page"] == 1

        # Second page
        resp = client.get("/api/agents?page=2&limit=10")
        body = resp.json()
        assert len(body["items"]) == 10
        assert body["page"] == 2

        # Third page
        resp = client.get("/api/agents?page=3&limit=10")
        body = resp.json()
        assert len(body["items"]) == 5
        assert body["page"] == 3

    def test_list_filter_by_role(self):
        """Test filtering by role."""
        _create_agent(name="Backend Agent", role="backend-engineer")
        _create_agent(name="Frontend Agent", role="frontend-engineer")
        _create_agent(name="AI Agent", role="ai-engineer")

        resp = client.get("/api/agents?role=backend-engineer")
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["role"] == "backend-engineer"

        resp = client.get("/api/agents?role=frontend-engineer")
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["role"] == "frontend-engineer"

    def test_list_filter_by_availability(self):
        """Test filtering by availability."""
        agent1 = _create_agent(name="Available Agent")
        agent2 = _create_agent(name="Inactive Agent")

        # Deactivate the second agent
        from app.models.agent import AgentUpdate

        agent_service.update_agent(
            agent2["id"],
            AgentUpdate(availability="unavailable"),
            agent2["operator_wallet"],
        )
        agent_service.deactivate_agent(agent2["id"], agent2["operator_wallet"])

        resp = client.get("/api/agents?available=true")
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["name"] == "Available Agent"

    def test_list_limit_validation(self):
        """Test limit parameter validation."""
        # Valid limits
        assert client.get("/api/agents?limit=1").status_code == 200
        assert client.get("/api/agents?limit=100").status_code == 200

        # Invalid limits
        assert client.get("/api/agents?limit=0").status_code == 422
        assert client.get("/api/agents?limit=101").status_code == 422

    def test_list_page_validation(self):
        """Test page parameter validation."""
        # Valid pages
        assert client.get("/api/agents?page=1").status_code == 200

        # Invalid pages
        assert client.get("/api/agents?page=0").status_code == 422
        assert client.get("/api/agents?page=-1").status_code == 422

    def test_list_item_shape(self):
        """Test that list items have expected fields."""
        _create_agent()
        resp = client.get("/api/agents")
        item = resp.json()["items"][0]

        expected_keys = {
            "id",
            "name",
            "role",
            "capabilities",
            "is_active",
            "availability",
            "operator_wallet",
            "created_at",
        }
        assert set(item.keys()) == expected_keys

    def test_list_sorted_by_created_at_desc(self):
        """Test that agents are sorted by created_at descending."""
        import time

        _create_agent(name="First")
        time.sleep(0.01)
        _create_agent(name="Second")
        time.sleep(0.01)
        _create_agent(name="Third")

        resp = client.get("/api/agents")
        items = resp.json()["items"]

        # Most recent first
        assert items[0]["name"] == "Third"
        assert items[1]["name"] == "Second"
        assert items[2]["name"] == "First"


# ===========================================================================
# PATCH /api/agents/{agent_id} - Update Agent Tests
# ===========================================================================


class TestUpdateAgent:
    """Tests for PATCH /api/agents/{agent_id} endpoint."""

    def test_update_name(self):
        """Test updating agent name."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "Updated Name"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    def test_update_description(self):
        """Test updating agent description."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"description": "New description"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "New description"

    def test_update_role(self):
        """Test updating agent role."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"role": "ai-engineer"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "ai-engineer"

    def test_update_capabilities(self):
        """Test updating agent capabilities."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"capabilities": ["new-capability-1", "new-capability-2"]},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert set(resp.json()["capabilities"]) == {
            "new-capability-1",
            "new-capability-2",
        }

    def test_update_availability(self):
        """Test updating agent availability."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"availability": "busy"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert resp.json()["availability"] == "busy"

    def test_update_multiple_fields(self):
        """Test updating multiple fields at once."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={
                "name": "New Name",
                "description": "New description",
                "availability": "offline",
            },
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "New Name"
        assert body["description"] == "New description"
        assert body["availability"] == "offline"

    def test_update_preserves_unset_fields(self):
        """Test that unset fields are preserved."""
        agent = _create_agent()
        agent_id = agent["id"]
        original_desc = agent["description"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "Changed Name"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == original_desc

    def test_update_not_found(self):
        """Test updating non-existent agent."""
        resp = client.patch(
            "/api/agents/nonexistent-id",
            json={"name": "New Name"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 404

    def test_update_missing_auth_header(self):
        """Test update without authentication header."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "New Name"},
        )
        assert resp.status_code == 401

    def test_update_wrong_wallet(self):
        """Test update with wrong wallet address."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "New Name"},
            headers={"X-Operator-Wallet": ANOTHER_WALLET},
        )
        assert resp.status_code == 403
        assert "unauthorized" in resp.json()["detail"].lower()

    def test_update_updates_timestamp(self):
        """Test that update changes updated_at timestamp."""
        agent = _create_agent()
        agent_id = agent["id"]
        original_updated = agent["updated_at"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "New Name"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        new_updated = resp.json()["updated_at"]
        # Compare as strings since JSON serializes datetime to ISO format
        assert str(new_updated) >= str(original_updated)

    def test_update_invalid_name_empty(self):
        """Test update with empty name."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"name": ""},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 422

    def test_update_invalid_name_too_long(self):
        """Test update with name too long."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "A" * 101},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 422

    def test_update_invalid_role(self):
        """Test update with invalid role."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"role": "invalid-role"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 422


# ===========================================================================
# DELETE /api/agents/{agent_id} - Deactivate Agent Tests
# ===========================================================================


class TestDeactivateAgent:
    """Tests for DELETE /api/agents/{agent_id} endpoint."""

    def test_deactivate_success(self):
        """Test successful agent deactivation."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.delete(
            f"/api/agents/{agent_id}",
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 204

        # Verify agent is deactivated
        deactivated = agent_service.get_agent(agent_id)
        assert deactivated.is_active is False

    def test_deactivate_not_found(self):
        """Test deactivating non-existent agent."""
        resp = client.delete(
            "/api/agents/nonexistent-id",
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 404

    def test_deactivate_missing_auth_header(self):
        """Test deactivate without authentication header."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.delete(f"/api/agents/{agent_id}")
        assert resp.status_code == 401

    def test_deactivate_wrong_wallet(self):
        """Test deactivate with wrong wallet address."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.delete(
            f"/api/agents/{agent_id}",
            headers={"X-Operator-Wallet": ANOTHER_WALLET},
        )
        assert resp.status_code == 403
        assert "unauthorized" in resp.json()["detail"].lower()

    def test_deactivate_removes_from_available_list(self):
        """Test that deactivated agent doesn't appear in available list."""
        agent = _create_agent()
        agent_id = agent["id"]

        # Deactivate
        client.delete(
            f"/api/agents/{agent_id}",
            headers={"X-Operator-Wallet": VALID_WALLET},
        )

        # Check available list
        resp = client.get("/api/agents?available=true")
        assert resp.json()["total"] == 0


# ===========================================================================
# HEALTH CHECK
# ===========================================================================


class TestHealth:
    """Health check test for API sanity."""

    def test_health(self):
        """Test health endpoint."""
        assert client.get("/health").json() == {"status": "ok"}


# ===========================================================================
# ERROR RESPONSE FORMAT TESTS
# ===========================================================================


class TestErrorResponses:
    """Tests for consistent error response format."""

    def test_404_error_format(self):
        """Test 404 error response format."""
        resp = client.get("/api/agents/nonexistent")
        assert resp.status_code == 404
        body = resp.json()
        assert "detail" in body

    def test_422_error_format(self):
        """Test 422 validation error format."""
        invalid = {**VALID_AGENT, "name": ""}  # Empty name
        resp = client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422
        body = resp.json()
        assert "detail" in body

    def test_401_error_format(self):
        """Test 401 unauthorized error format."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "New Name"},
        )
        assert resp.status_code == 401
        body = resp.json()
        assert "detail" in body

    def test_403_error_format(self):
        """Test 403 forbidden error format."""
        agent = _create_agent()
        agent_id = agent["id"]

        resp = client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "New Name"},
            headers={"X-Operator-Wallet": ANOTHER_WALLET},
        )
        assert resp.status_code == 403
        body = resp.json()
        assert "detail" in body
