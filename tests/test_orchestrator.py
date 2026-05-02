"""Unit tests for TeamOrchestrator — orchestration module."""

import pytest
from bounty_agent.orchestrator import (
    TeamOrchestrator,
    AgentNode,
    AgentStatus,
    Gateway,
    MissionStage,
    MissionState,
)
from bounty_agent.planner import Department, BountyPlan, SubTask


class TestTeamOrchestrator:
    def setup_method(self):
        self.orch = TeamOrchestrator()

    def test_initializes_agents(self):
        assert len(self.orch.agents) > 0
        # 4 security + 5 research + 4 code + 3 knowledge + 3 ops = 19
        assert len(self.orch.agents) == 19

    def test_initializes_gateway(self):
        assert 1 in self.orch.gateways
        assert len(self.orch.gateways[1].agents) == 19

    def test_assign_task_finds_idle_agent(self):
        agent = self.orch.assign_task(Department.SECURITY)
        assert agent is not None
        assert agent.department == Department.SECURITY
        assert agent.status == AgentStatus.RUNNING

    def test_assign_task_no_idle_agents(self):
        # Mark all security agents as running
        for a in self.orch.agents.values():
            if a.department == Department.SECURITY:
                a.status = AgentStatus.RUNNING
        agent = self.orch.assign_task(Department.SECURITY)
        assert agent is None

    def test_complete_task(self):
        agent = self.orch.assign_task(Department.CODE)
        assert agent.status == AgentStatus.RUNNING
        self.orch.complete_task(agent.agent_id)
        assert agent.status == AgentStatus.COMPLETED
        assert agent.tasks_completed == 1

    def test_get_team_status(self):
        status = self.orch.get_team_status()
        assert status["total_agents"] == 19
        assert "by_department" in status
        assert status["idle"] + status["busy"] == 19

    def test_start_mission(self):
        state = self.orch.start_mission("861")
        assert state.is_active
        assert state.bounty_id == "861"
        assert state.current_stage == MissionStage.DISCOVER

    def test_mission_state_dict(self):
        state = self.orch.start_mission("861")
        d = state.to_dict()
        assert d["bounty_id"] == "861"
        assert d["current_stage"] == "discover"


class TestAgentNode:
    def test_mark_busy(self):
        agent = AgentNode(agent_id="test-1", department=Department.CODE, role="coder")
        agent.mark_busy()
        assert agent.status == AgentStatus.RUNNING
        assert agent.last_activity is not None

    def test_mark_completed(self):
        agent = AgentNode(agent_id="test-1", department=Department.CODE, role="coder")
        agent.mark_completed()
        assert agent.status == AgentStatus.COMPLETED
        assert agent.tasks_completed == 1

    def test_mark_failed(self):
        agent = AgentNode(agent_id="test-1", department=Department.CODE, role="coder")
        agent.mark_failed()
        assert agent.status == AgentStatus.FAILED
        assert agent.tasks_failed == 1

    def test_reset(self):
        agent = AgentNode(agent_id="test-1", department=Department.CODE, role="coder")
        agent.mark_failed()
        agent.reset()
        assert agent.status == AgentStatus.IDLE


class TestGateway:
    def test_capacity_zero_when_empty(self):
        gw = Gateway(gw_id=1)
        assert gw.capacity == 0.0

    def test_active_agents_count(self):
        gw = Gateway(gw_id=1)
        gw.agents = [
            AgentNode(agent_id="a1", department=Department.CODE, role="coder"),
            AgentNode(agent_id="a2", department=Department.CODE, role="coder"),
        ]
        gw.agents[0].mark_busy()
        assert gw.active_agents == 1
        assert gw.idle_agents == 1
