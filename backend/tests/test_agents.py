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

Uses SQLAlchemy database persistence (no in-memory storage).
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

from app.api.agents import router as agents_router
from app.database import Base, engine, async_session_factory


# ---------------------------------------------------------------------------
# Test app
# ---------------------------------------------------------------------------

_test_app = FastAPI()
_test_app.include_router(agents_router, prefix="/api")


@_test_app.get("/health")
async def health_check():
    """Handle health check operation."""
    return {"status": "ok"}


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


@pytest_asyncio.fixture(scope="function")
async def db_session():
    """Create a fresh database session for each test."""
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Provide session
    async with async_session_factory() as session:
        yield session

    # Drop tables after test
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session):
    """Create an async test client."""
    async with AsyncClient(
        transport=ASGITransport(app=_test_app), base_url="http://test"
    ) as ac:
        yield ac


# ===========================================================================
# POST /api/agents/register - Register Agent Tests
# ===========================================================================


class TestRegisterAgent:
    """Tests for POST /api/agents/register endpoint."""

    @pytest.mark.asyncio
    async def test_register_success(self, client):
        """Test successful agent registration."""
        resp = await client.post("/api/agents/register", json=VALID_AGENT)
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

    @pytest.mark.asyncio
    async def test_register_minimal(self, client):
        """Test registration with minimal required fields."""
        minimal = {
            "name": "Simple Agent",
            "role": "frontend-engineer",
            "operator_wallet": VALID_WALLET,
        }
        resp = await client.post("/api/agents/register", json=minimal)
        assert resp.status_code == 201
        body = resp.json()
        assert body["description"] is None
        assert body["capabilities"] == []
        assert body["languages"] == []
        assert body["apis"] == []

    @pytest.mark.asyncio
    async def test_register_all_roles(self, client):
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
            resp = await client.post("/api/agents/register", json=agent)
            assert resp.status_code == 201, f"Failed for role: {role}"
            assert resp.json()["role"] == role

    @pytest.mark.asyncio
    async def test_register_invalid_role(self, client):
        """Test registration with invalid role."""
        invalid = {**VALID_AGENT, "role": "invalid-role"}
        resp = await client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_missing_name(self, client):
        """Test registration without name."""
        invalid = {k: v for k, v in VALID_AGENT.items() if k != "name"}
        resp = await client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_empty_name(self, client):
        """Test registration with empty name."""
        invalid = {**VALID_AGENT, "name": ""}
        resp = await client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_name_too_long(self, client):
        """Test registration with name exceeding max length."""
        invalid = {**VALID_AGENT, "name": "A" * 101}
        resp = await client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_description_too_long(self, client):
        """Test registration with description exceeding max length."""
        invalid = {**VALID_AGENT, "description": "A" * 2001}
        resp = await client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_missing_wallet(self, client):
        """Test registration without operator wallet."""
        invalid = {k: v for k, v in VALID_AGENT.items() if k != "operator_wallet"}
        resp = await client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_invalid_wallet_format(self, client):
        """Test registration with invalid wallet address format."""
        invalid_wallets = [
            "invalid",
            "0x1234567890abcdef",
            "",
            "A" * 31,  # Too short
        ]
        for wallet in invalid_wallets:
            invalid = {**VALID_AGENT, "operator_wallet": wallet}
            resp = await client.post("/api/agents/register", json=invalid)
            assert resp.status_code == 422, f"Should fail for wallet: {wallet}"

    @pytest.mark.asyncio
    async def test_register_capabilities_normalized(self, client):
        """Test that capabilities are normalized to lowercase."""
        agent = {
            **VALID_AGENT,
            "capabilities": ["API-Design", " DATABASE ", "  MicroServices  "],
        }
        resp = await client.post("/api/agents/register", json=agent)
        assert resp.status_code == 201
        caps = resp.json()["capabilities"]
        assert "api-design" in caps
        assert "database" in caps
        assert "microservices" in caps

    @pytest.mark.asyncio
    async def test_register_too_many_capabilities(self, client):
        """Test registration with too many capabilities."""
        invalid = {**VALID_AGENT, "capabilities": [f"cap{i}" for i in range(51)]}
        resp = await client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_too_many_languages(self, client):
        """Test registration with too many languages."""
        invalid = {**VALID_AGENT, "languages": [f"lang{i}" for i in range(21)]}
        resp = await client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_too_many_apis(self, client):
        """Test registration with too many APIs."""
        invalid = {**VALID_AGENT, "apis": [f"api{i}" for i in range(31)]}
        resp = await client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_returns_unique_ids(self, client):
        """Test that each registration returns a unique ID."""
        ids = set()
        for i in range(10):
            agent = {**VALID_AGENT, "name": f"Agent-{i}"}
            resp = await client.post("/api/agents/register", json=agent)
            assert resp.status_code == 201
            ids.add(resp.json()["id"])
        assert len(ids) == 10


# ===========================================================================
# GET /api/agents/{agent_id} - Get Agent Tests
# ===========================================================================


class TestGetAgent:
    """Tests for GET /api/agents/{agent_id} endpoint."""

    @pytest.mark.asyncio
    async def test_get_success(self, client):
        """Test successful agent retrieval."""
        # First create an agent
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.get(f"/api/agents/{agent_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == agent_id
        assert body["name"] == VALID_AGENT["name"]
        assert body["role"] == "backend-engineer"

    @pytest.mark.asyncio
    async def test_get_not_found(self, client):
        """Test getting a non-existent agent."""
        resp = await client.get("/api/agents/nonexistent-id")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_response_shape(self, client):
        """Test that response contains all expected fields."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.get(f"/api/agents/{agent_id}")
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

    @pytest.mark.asyncio
    async def test_list_empty(self, client):
        """Test listing when no agents exist."""
        resp = await client.get("/api/agents")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["items"] == []
        assert body["page"] == 1
        assert body["limit"] == 20

    @pytest.mark.asyncio
    async def test_list_with_data(self, client):
        """Test listing with multiple agents."""
        for i in range(3):
            agent = {**VALID_AGENT, "name": f"Agent-{i}"}
            await client.post("/api/agents/register", json=agent)

        resp = await client.get("/api/agents")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 3
        assert len(body["items"]) == 3

    @pytest.mark.asyncio
    async def test_list_pagination(self, client):
        """Test pagination of agent list."""
        for i in range(25):
            agent = {**VALID_AGENT, "name": f"Agent-{i}"}
            await client.post("/api/agents/register", json=agent)

        # First page
        resp = await client.get("/api/agents?page=1&limit=10")
        body = resp.json()
        assert body["total"] == 25
        assert len(body["items"]) == 10
        assert body["page"] == 1

        # Second page
        resp = await client.get("/api/agents?page=2&limit=10")
        body = resp.json()
        assert len(body["items"]) == 10
        assert body["page"] == 2

        # Third page
        resp = await client.get("/api/agents?page=3&limit=10")
        body = resp.json()
        assert len(body["items"]) == 5
        assert body["page"] == 3

    @pytest.mark.asyncio
    async def test_list_filter_by_role(self, client):
        """Test filtering by role."""
        await client.post(
            "/api/agents/register",
            json={**VALID_AGENT, "name": "Backend Agent", "role": "backend-engineer"},
        )
        await client.post(
            "/api/agents/register",
            json={
                **VALID_AGENT,
                "name": "Frontend Agent",
                "role": "frontend-engineer",
                "operator_wallet": ANOTHER_WALLET,
            },
        )
        await client.post(
            "/api/agents/register",
            json={
                **VALID_AGENT,
                "name": "AI Agent",
                "role": "ai-engineer",
                "operator_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
            },
        )

        resp = await client.get("/api/agents?role=backend-engineer")
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["role"] == "backend-engineer"

        resp = await client.get("/api/agents?role=frontend-engineer")
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["role"] == "frontend-engineer"

    @pytest.mark.asyncio
    async def test_list_limit_validation(self, client):
        """Test limit parameter validation."""
        # Valid limits
        assert (await client.get("/api/agents?limit=1")).status_code == 200
        assert (await client.get("/api/agents?limit=100")).status_code == 200

        # Invalid limits
        assert (await client.get("/api/agents?limit=0")).status_code == 422
        assert (await client.get("/api/agents?limit=101")).status_code == 422

    @pytest.mark.asyncio
    async def test_list_page_validation(self, client):
        """Test page parameter validation."""
        # Valid pages
        assert (await client.get("/api/agents?page=1")).status_code == 200

        # Invalid pages
        assert (await client.get("/api/agents?page=0")).status_code == 422
        assert (await client.get("/api/agents?page=-1")).status_code == 422

    @pytest.mark.asyncio
    async def test_list_item_shape(self, client):
        """Test that list items have expected fields."""
        await client.post("/api/agents/register", json=VALID_AGENT)
        resp = await client.get("/api/agents")
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


# ===========================================================================
# PATCH /api/agents/{agent_id} - Update Agent Tests
# ===========================================================================


class TestUpdateAgent:
    """Tests for PATCH /api/agents/{agent_id} endpoint."""

    @pytest.mark.asyncio
    async def test_update_name(self, client):
        """Test updating agent name."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "Updated Name"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"

    @pytest.mark.asyncio
    async def test_update_description(self, client):
        """Test updating agent description."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"description": "New description"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "New description"

    @pytest.mark.asyncio
    async def test_update_role(self, client):
        """Test updating agent role."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"role": "ai-engineer"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "ai-engineer"

    @pytest.mark.asyncio
    async def test_update_capabilities(self, client):
        """Test updating agent capabilities."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"capabilities": ["new-capability-1", "new-capability-2"]},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert set(resp.json()["capabilities"]) == {
            "new-capability-1",
            "new-capability-2",
        }

    @pytest.mark.asyncio
    async def test_update_availability(self, client):
        """Test updating agent availability."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"availability": "busy"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert resp.json()["availability"] == "busy"

    @pytest.mark.asyncio
    async def test_update_multiple_fields(self, client):
        """Test updating multiple fields at once."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
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

    @pytest.mark.asyncio
    async def test_update_preserves_unset_fields(self, client):
        """Test that unset fields are preserved."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]
        original_desc = create_resp.json()["description"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "Changed Name"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == original_desc

    @pytest.mark.asyncio
    async def test_update_not_found(self, client):
        """Test updating non-existent agent."""
        resp = await client.patch(
            "/api/agents/nonexistent-id",
            json={"name": "New Name"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_missing_auth_header(self, client):
        """Test update without authentication header."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "New Name"},
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_update_wrong_wallet(self, client):
        """Test update with wrong wallet address."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "New Name"},
            headers={"X-Operator-Wallet": ANOTHER_WALLET},
        )
        assert resp.status_code == 403
        assert "unauthorized" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_update_updates_timestamp(self, client):
        """Test that update changes updated_at timestamp."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]
        original_updated = create_resp.json()["updated_at"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "New Name"},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 200
        new_updated = resp.json()["updated_at"]
        # Compare as strings since JSON serializes datetime to ISO format
        assert str(new_updated) >= str(original_updated)

    @pytest.mark.asyncio
    async def test_update_invalid_name_empty(self, client):
        """Test update with empty name."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"name": ""},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_update_invalid_name_too_long(self, client):
        """Test update with name too long."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "A" * 101},
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_update_invalid_role(self, client):
        """Test update with invalid role."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
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

    @pytest.mark.asyncio
    async def test_deactivate_success(self, client):
        """Test successful agent deactivation."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.delete(
            f"/api/agents/{agent_id}",
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 204

        # Verify agent is deactivated
        get_resp = await client.get(f"/api/agents/{agent_id}")
        assert get_resp.json()["is_active"] is False

    @pytest.mark.asyncio
    async def test_deactivate_not_found(self, client):
        """Test deactivating non-existent agent."""
        resp = await client.delete(
            "/api/agents/nonexistent-id",
            headers={"X-Operator-Wallet": VALID_WALLET},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_deactivate_missing_auth_header(self, client):
        """Test deactivate without authentication header."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/agents/{agent_id}")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_deactivate_wrong_wallet(self, client):
        """Test deactivate with wrong wallet address."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.delete(
            f"/api/agents/{agent_id}",
            headers={"X-Operator-Wallet": ANOTHER_WALLET},
        )
        assert resp.status_code == 403
        assert "unauthorized" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_deactivate_removes_from_available_list(self, client):
        """Test that deactivated agent doesn't appear in available list."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        # Deactivate
        await client.delete(
            f"/api/agents/{agent_id}",
            headers={"X-Operator-Wallet": VALID_WALLET},
        )

        # Check available list
        resp = await client.get("/api/agents?available=true")
        assert resp.json()["total"] == 0


# ===========================================================================
# HEALTH CHECK
# ===========================================================================


class TestHealth:
    """Health check test for API sanity."""

    @pytest.mark.asyncio
    async def test_health(self, client):
        """Test health endpoint."""
        resp = await client.get("/health")
        assert resp.json() == {"status": "ok"}


# ===========================================================================
# ERROR RESPONSE FORMAT TESTS
# ===========================================================================


class TestErrorResponses:
    """Tests for consistent error response format."""

    @pytest.mark.asyncio
    async def test_404_error_format(self, client):
        """Test 404 error response format."""
        resp = await client.get("/api/agents/nonexistent")
        assert resp.status_code == 404
        body = resp.json()
        assert "detail" in body

    @pytest.mark.asyncio
    async def test_422_error_format(self, client):
        """Test 422 validation error format."""
        invalid = {**VALID_AGENT, "name": ""}  # Empty name
        resp = await client.post("/api/agents/register", json=invalid)
        assert resp.status_code == 422
        body = resp.json()
        assert "detail" in body

    @pytest.mark.asyncio
    async def test_401_error_format(self, client):
        """Test 401 unauthorized error format."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "New Name"},
        )
        assert resp.status_code == 401
        body = resp.json()
        assert "detail" in body

    @pytest.mark.asyncio
    async def test_403_error_format(self, client):
        """Test 403 forbidden error format."""
        create_resp = await client.post("/api/agents/register", json=VALID_AGENT)
        agent_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/agents/{agent_id}",
            json={"name": "New Name"},
            headers={"X-Operator-Wallet": ANOTHER_WALLET},
        )
        assert resp.status_code == 403
        body = resp.json()
        assert "detail" in body
