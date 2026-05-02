"""Unit tests for TeamOrchestrator — orchestration module."""
from bounty_agent.orchestrator import TeamOrchestrator, AgentNode, Gateway
from bounty_agent.planner import Department, BountyPlan, SubTask


class TestTeamOrchestrator:
    def setup_method(self):
        self.orch = TeamOrchestrator()

    def test_initializes_51_agents(self):
        assert len(self.orch.agents) == 51

    def test_initializes_7_gateways(self):
        assert len(self.orch.gateways) == 7

    def test_assign_task_finds_idle_agent(self):
        agent = self.orch.assign_task(Department.SECURITY)
        assert agent is not None
        assert agent.department == Department.SECURITY
        assert agent.status == "busy"

    def test_assign_task_no_idle_agents(self):
        # Mark all security agents as busy
        for a in self.orch.agents.values():
            if a.department == Department.SECURITY:
                a.status = "busy"
        agent = self.orch.assign_task(Department.SECURITY)
        assert agent is None

    def test_complete_task(self):
        agent = self.orch.assign_task(Department.CODE)
        assert agent.status == "busy"
        self.orch.complete_task(agent.agent_id)
        assert agent.status == "idle"
        assert agent.tasks_completed == 1

    def test_get_team_status(self):
        status = self.orch.get_team_status()
        assert status["total_agents"] == 51
        assert status["gateways"] == 7
        assert status["idle"] + status["busy"] == 51

    def test_execute_plan(self):
        plan = BountyPlan("Test", "http://test", [
            SubTask("Analyze", Department.RESEARCH, "desc", 1),
            SubTask("Code", Department.CODE, "desc", 2, [0]),
        ])
        results = self.orch.execute_plan(plan)
        assert len(results) == 2
        assert results[0]["status"] == "completed"
        assert results[1]["status"] == "completed"

    def test_gateway_ports(self):
        assert self.orch.GATEWAY_PORTS[1] == 18789
        assert self.orch.GATEWAY_PORTS[7] == 18795


class TestGateway:
    def test_capacity_zero_when_empty(self):
        gw = Gateway(gw_id=1, port=18789)
        assert gw.capacity == 0.0

    def test_active_agents_count(self):
        gw = Gateway(gw_id=1, port=18789)
        gw.agents = [
            AgentNode("a1", Department.CODE, "glm-5.1", 1, "busy"),
            AgentNode("a2", Department.CODE, "glm-5.1", 1, "idle"),
        ]
        assert gw.active_agents == 1
