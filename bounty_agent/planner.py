"""Task planning module — decomposes bounties into agent assignments."""
from dataclasses import dataclass, field
from typing import List
from enum import Enum

class Department(Enum):
    SECURITY = "铁卫"
    RESEARCH = "天机"
    CODE = "玄码"
    KNOWLEDGE = "博典"
    OPS = "运维"

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
    DEPT_MAP = {"security": Department.SECURITY, "audit": Department.SECURITY,
                "code": Department.CODE, "frontend": Department.CODE, "backend": Department.CODE,
                "docs": Department.KNOWLEDGE, "agent": Department.RESEARCH, "integration": Department.CODE}

    def plan(self, bounty) -> BountyPlan:
        subtasks = [
            SubTask("Analyze requirements", Department.RESEARCH, f"Analyze {bounty.title}", 1),
            SubTask("Implement solution", Department.CODE, "Code the solution", 2, [0]),
            SubTask("Security review", Department.SECURITY, "Review for vulnerabilities", 3, [1]),
            SubTask("Write docs & PR", Department.KNOWLEDGE, "Document approach", 4, [2]),
        ]
        return BountyPlan(bounty.title, bounty.url, subtasks, len(subtasks)*2)
