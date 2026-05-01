"""Unit tests for team orchestrator module."""
import pytest
from bounty_agent.orchestrator import TeamOrchestrator, AgentNode, Gateway
from bounty_agent.planner import Department, SubTask, BountyPlan


class TestAgentNode:
    """Tests for AgentNode dataclass."""

    def test_creation(self):
        agent = AgentNode(
            agent_id="agent-001", department=Department.SECURITY,
            model="glm-5.1", gateway=1
        )
        assert agent.status == "idle"
        assert agent.tasks_completed == 0


class TestGateway:
    """Tests for Gateway dataclass."""

    def test_capacity(self):
        gw = Gateway(gw_id=1, port=18789, max_concurrent=20)
        gw.agents = [
            AgentNode("a1", Department.OPS, "glm-5.1", 1, "busy"),
            AgentNode("a2", Department.OPS, "glm-5.1", 1, "idle"),
            AgentNode("a3", Department.OPS, "glm-5.1", 1, "busy"),
        ]
        assert gw.active_agents == 2
        assert abs(gw.capacity - 0.1) < 0.01


class TestTeamOrchestrator:
    """Tests for TeamOrchestrator."""

    def setup_method(self):
        self.orch = TeamOrchestrator()

    def test_team_initialized(self):
        status = self.orch.get_team_status()
        assert status["total_agents"] == 51
        assert status["gateways"] == 7

    def test_assign_task(self):
        agent = self.orch.assign_task(Department.SECURITY)
        assert agent is not None
        assert agent.department == Department.SECURITY
        assert agent.status == "busy"

    def test_assign_task_no_available(self):
        # Exhaust all agents in a department
        dept = Department.SECURITY
        while True:
            agent = self.orch.assign_task(dept)
            if agent is None:
                break
        # Next assignment should return None
        assert self.orch.assign_task(dept) is None

    def test_complete_task(self):
        agent = self.orch.assign_task(Department.RESEARCH)
        assert agent is not None
        agent_id = agent.agent_id
        self.orch.complete_task(agent_id)
        assert self.orch.agents[agent_id].status == "idle"
        assert self.orch.agents[agent_id].tasks_completed == 1

    def test_execute_plan(self):
        plan = BountyPlan(
            bounty_title="Test Bounty",
            bounty_url="https://github.com/test/repo/issues/1",
            subtasks=[
                SubTask("Research", Department.RESEARCH, "Do research", 1),
                SubTask("Code", Department.CODE, "Write code", 2, [0]),
            ]
        )
        results = self.orch.execute_plan(plan)
        assert len(results) == 2
        assert results[0]["status"] == "completed"
        assert results[1]["status"] == "completed"

    def test_gateway_ports(self):
        assert self.orch.GATEWAY_PORTS[1] == 18789
        assert self.orch.GATEWAY_PORTS[7] == 18795

    def test_department_models(self):
        assert "glm-5.1" in self.orch.DEPARTMENT_MODELS[Department.SECURITY]
        assert "deepseek-v4-pro" in self.orch.DEPARTMENT_MODELS[Department.SECURITY]

    def test_get_team_status_structure(self):
        status = self.orch.get_team_status()
        assert "total_agents" in status
        assert "gateways" in status
        assert "idle" in status
        assert "busy" in status
        assert "total_completed" in status
