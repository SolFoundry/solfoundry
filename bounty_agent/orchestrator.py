"""Multi-agent orchestrator — coordinates 51 agents across 7 gateways."""
import time
import json
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from bounty_agent.planner import Department, BountyPlan


@dataclass
class AgentNode:
    """Represents a single agent in the team."""
    agent_id: str
    department: Department
    model: str
    gateway: int  # 1-7
    status: str = "idle"  # idle, busy, error
    tasks_completed: int = 0


@dataclass
class Gateway:
    """Represents a Gateway instance."""
    gw_id: int
    port: int
    agents: List[AgentNode] = field(default_factory=list)
    max_concurrent: int = 20

    @property
    def active_agents(self) -> int:
        return len([a for a in self.agents if a.status == "busy"])

    @property
    def capacity(self) -> float:
        return self.active_agents / self.max_concurrent


class TeamOrchestrator:
    """Orchestrates 51 agents across 7 gateways for bounty execution."""

    GATEWAY_PORTS = {1: 18789, 2: 18790, 3: 18801, 4: 18792, 5: 18793, 6: 18794, 7: 18795}

    DEPARTMENT_MODELS = {
        Department.SECURITY: ["glm-5.1", "deepseek-v4-pro"],
        Department.RESEARCH: ["glm-5.1", "qwen-3.5-397b"],
        Department.CODE: ["qwen-2.5-coder-32b", "glm-5.1"],
        Department.KNOWLEDGE: ["glm-5.1"],
        Department.OPS: ["glm-5.1"],
    }

    # Gateway assignments: each department → list of gateway IDs
    DEPARTMENT_GATEWAYS = {
        Department.SECURITY: [1, 7],
        Department.RESEARCH: [2, 3],
        Department.CODE: [4, 5],
        Department.KNOWLEDGE: [6],
        Department.OPS: [1, 2],
    }

    def __init__(self):
        self.gateways: Dict[int, Gateway] = {}
        self.agents: Dict[str, AgentNode] = {}
        self._initialize_team()

    def _initialize_team(self):
        """Initialize all 51 agents across 7 gateways."""
        # 51 agents: 5 departments + specialized roles
        agent_configs = {
            Department.SECURITY: 13,   # 铁卫·壹~伍 (5) + 明瞳·壹~捌 (8)
            Department.RESEARCH: 17,   # 天机·壹~拾 (10) + 乾元·壹~柒 (7)
            Department.CODE: 9,        # 玄码·壹~玖
            Department.KNOWLEDGE: 5,   # 博典·壹~伍
            Department.OPS: 7,         # 核心6人 + 调度1
        }
        # Total: 13+17+9+5+7 = 51

        # Initialize all 7 gateways first
        for gw_id in self.GATEWAY_PORTS:
            self.gateways[gw_id] = Gateway(gw_id=gw_id, port=self.GATEWAY_PORTS[gw_id])

        aid = 0
        for dept, count in agent_configs.items():
            gw_list = self.DEPARTMENT_GATEWAYS.get(dept, [1])
            models = self.DEPARTMENT_MODELS.get(dept, ["glm-5.1"])
            for i in range(count):
                aid += 1
                gw = gw_list[i % len(gw_list)]
                agent = AgentNode(
                    agent_id=f"agent-{aid:03d}",
                    department=dept,
                    model=models[i % len(models)],
                    gateway=gw
                )
                self.agents[agent.agent_id] = agent
                self.gateways[gw].agents.append(agent)

    def assign_task(self, department: Department) -> Optional[AgentNode]:
        """Assign a task to an available agent in the department."""
        available = [a for a in self.agents.values()
                     if a.department == department and a.status == "idle"]
        if available:
            agent = available[0]
            agent.status = "busy"
            return agent
        return None

    def complete_task(self, agent_id: str):
        """Mark an agent's task as completed."""
        if agent_id in self.agents:
            self.agents[agent_id].status = "idle"
            self.agents[agent_id].tasks_completed += 1

    def get_team_status(self) -> dict:
        """Get current team status."""
        return {
            "total_agents": len(self.agents),
            "gateways": len(self.gateways),
            "idle": len([a for a in self.agents.values() if a.status == "idle"]),
            "busy": len([a for a in self.agents.values() if a.status == "busy"]),
            "total_completed": sum(a.tasks_completed for a in self.agents.values()),
        }

    def execute_plan(self, plan: BountyPlan) -> List[dict]:
        """Execute a bounty plan by assigning subtasks to agents."""
        results = []
        for subtask in plan.subtasks:
            agent = self.assign_task(subtask.department)
            if agent:
                result = {
                    "subtask": subtask.title,
                    "department": subtask.department.value,
                    "agent": agent.agent_id,
                    "model": agent.model,
                    "gateway": agent.gateway,
                    "status": "assigned"
                }
                results.append(result)
                # In production: dispatch to actual agent
                self.complete_task(agent.agent_id)
                result["status"] = "completed"
        return results
