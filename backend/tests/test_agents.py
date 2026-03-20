"""Tests for agent registration and management API."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import agent_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_store():
    agent_service._store.clear()
    yield
    agent_service._store.clear()


def _make_payload(**overrides):
    defaults = {
        "name": "TestAgent",
        "role": "ai-engineer",
        "capabilities": ["nlp", "code-generation"],
        "languages": ["python", "typescript"],
        "apis": ["openai", "anthropic"],
        "operator_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    }
    defaults.update(overrides)
    return defaults


def _register(**overrides):
    resp = client.post("/api/agents/register", json=_make_payload(**overrides))
    assert resp.status_code == 201
    return resp.json()


# ── Create ───────────────────────────────────────────────────────────────────

def test_register_success():
    resp = client.post("/api/agents/register", json=_make_payload())
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "TestAgent"
    assert data["role"] == "ai-engineer"
    assert data["is_available"] is True
    assert data["is_active"] is True
    assert data["bounties_completed"] == 0


def test_register_all_roles():
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
    for i, role in enumerate(roles):
        resp = client.post(
            "/api/agents/register",
            json=_make_payload(name=f"Agent{i}", role=role),
        )
        assert resp.status_code == 201, f"Failed for role: {role}"


def test_register_missing_required_field():
    payload = _make_payload()
    del payload["operator_wallet"]
    resp = client.post("/api/agents/register", json=payload)
    assert resp.status_code == 422


# ── Get by ID ─────────────────────────────────────────────────────────────────

def test_get_agent_by_id():
    agent = _register()
    resp = client.get(f"/api/agents/{agent['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == agent["id"]


def test_get_agent_not_found():
    resp = client.get("/api/agents/nonexistent-id")
    assert resp.status_code == 404


# ── List ──────────────────────────────────────────────────────────────────────

def test_list_empty():
    resp = client.get("/api/agents")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_list_with_agents():
    _register(name="Agent1")
    _register(name="Agent2")
    resp = client.get("/api/agents")
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


def test_list_filter_by_role():
    _register(name="AIAgent", role="ai-engineer")
    _register(name="BackendAgent", role="backend-engineer")
    _register(name="AIAgent2", role="ai-engineer")
    resp = client.get("/api/agents?role=ai-engineer")
    data = resp.json()
    assert data["total"] == 2
    for item in data["items"]:
        assert item["role"] == "ai-engineer"


def test_list_filter_by_available():
    agent1 = _register(name="Agent1")
    _register(name="Agent2")
    # Mark agent1 as unavailable
    client.patch(f"/api/agents/{agent1['id']}", json={"is_available": False})
    resp = client.get("/api/agents?available=true")
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Agent2"


def test_list_pagination():
    for i in range(5):
        _register(name=f"Agent{i}")
    resp = client.get("/api/agents?page=1&limit=2")
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["page"] == 1
    assert data["limit"] == 2


def test_list_pagination_page2():
    for i in range(5):
        _register(name=f"Agent{i}")
    resp = client.get("/api/agents?page=2&limit=3")
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2  # 5 total, page 2 of 3 = 2 remaining


# ── Update ────────────────────────────────────────────────────────────────────

def test_update_capabilities():
    agent = _register()
    resp = client.patch(
        f"/api/agents/{agent['id']}",
        json={"capabilities": ["vision", "reasoning"]},
    )
    assert resp.status_code == 200
    assert resp.json()["capabilities"] == ["vision", "reasoning"]


def test_update_availability():
    agent = _register()
    resp = client.patch(f"/api/agents/{agent['id']}", json={"is_available": False})
    assert resp.status_code == 200
    assert resp.json()["is_available"] is False


def test_update_not_found():
    resp = client.patch("/api/agents/nonexistent", json={"bio": "test"})
    assert resp.status_code == 404


# ── Delete (soft) ─────────────────────────────────────────────────────────────

def test_delete_agent():
    agent = _register()
    resp = client.delete(f"/api/agents/{agent['id']}")
    assert resp.status_code == 204


def test_delete_agent_hides_from_list():
    agent = _register()
    client.delete(f"/api/agents/{agent['id']}")
    resp = client.get("/api/agents")
    assert resp.json()["total"] == 0


def test_delete_agent_hides_from_get():
    agent = _register()
    client.delete(f"/api/agents/{agent['id']}")
    resp = client.get(f"/api/agents/{agent['id']}")
    assert resp.status_code == 404


def test_delete_not_found():
    resp = client.delete("/api/agents/nonexistent")
    assert resp.status_code == 404
