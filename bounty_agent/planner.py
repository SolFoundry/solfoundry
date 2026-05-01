"""Task planning module — decomposes bounties into agent assignments."""

from dataclasses import dataclass, field
from typing import List
from enum import Enum


class Department(Enum):
    SECURITY = "security"
    RESEARCH = "research"
    CODE = "code"
    KNOWLEDGE = "knowledge"
    OPS = "ops"


@dataclass
class SubTask:
    title: str
    department: Department
    description: str
    priority: int = 1
    dependencies: List[int] = field(default_factory=list)


@dataclass
class BountyPlan:
    bounty_title: str
    bounty_url: str
    subtasks: List[SubTask]
    estimated_hours: float = 8.0


class BountyPlanner:
    """Decomposes bounty requirements into multi-department subtasks."""

    DEPT_MAP = {
        "security": Department.SECURITY,
        "audit": Department.SECURITY,
        "code": Department.CODE,
        "frontend": Department.CODE,
        "backend": Department.CODE,
        "docs": Department.KNOWLEDGE,
        "documentation": Department.KNOWLEDGE,
        "agent": Department.RESEARCH,
        "integration": Department.CODE,
        "infra": Department.OPS,
        "deployment": Department.OPS,
    }

    DIFFICULTY_WEIGHTS = {"easy": 1.0, "medium": 2.5, "hard": 5.0}

    def plan(self, bounty) -> BountyPlan:
        """Generate a structured execution plan for a bounty."""
        difficulty = getattr(bounty, "difficulty", "medium")
        weight = self.DIFFICULTY_WEIGHTS.get(difficulty, 2.5)

        subtasks = [
            SubTask(
                "Analyze requirements & constraints",
                Department.RESEARCH,
                f"Deep analysis of {bounty.title}: acceptance criteria, edge cases, dependencies",
                priority=1,
            ),
            SubTask(
                "Design solution architecture",
                Department.RESEARCH,
                "Map out module interfaces, data flow, error handling strategy",
                priority=2,
                dependencies=[0],
            ),
            SubTask(
                "Implement core solution",
                Department.CODE,
                "Write the implementation following the architecture from step 2",
                priority=3,
                dependencies=[1],
            ),
            SubTask(
                "Write unit & integration tests",
                Department.CODE,
                "Cover happy path, edge cases, error conditions",
                priority=4,
                dependencies=[2],
            ),
            SubTask(
                "Security review & audit",
                Department.SECURITY,
                "Check for injection risks, credential exposure, permission boundaries",
                priority=5,
                dependencies=[3],
            ),
            SubTask(
                "Document approach & submit PR",
                Department.KNOWLEDGE,
                "Write PR description, architecture diagram, deployment guide",
                priority=6,
                dependencies=[4],
            ),
        ]

        estimated = len(subtasks) * weight
        return BountyPlan(
            bounty_title=bounty.title,
            bounty_url=bounty.url,
            subtasks=subtasks,
            estimated_hours=estimated,
        )

    def classify_department(self, label: str) -> Department:
        """Classify a bounty label into a department."""
        key = label.lower().strip()
        return self.DEPT_MAP.get(key, Department.RESEARCH)
