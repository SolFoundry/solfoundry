"""Task planning module — decomposes bounties into agent assignments.

Supports template-based and LLM-enhanced planning with dependency graphs,
parallelization hints, and competitive strategy analysis.
"""

import json
import logging
import subprocess
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum

logger = logging.getLogger("bounty_agent.planner")


class Department(Enum):
    SECURITY = "security"
    RESEARCH = "research"
    CODE = "code"
    KNOWLEDGE = "knowledge"
    OPS = "ops"


class TaskPriority(Enum):
    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4


class PlanStatus(Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class SubTask:
    task_id: int
    title: str
    department: Department
    description: str
    priority: TaskPriority = TaskPriority.MEDIUM
    dependencies: List[int] = field(default_factory=list)
    estimated_hours: float = 1.0
    assigned_agent: Optional[str] = None
    status: str = "pending"
    output: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_ready(self) -> bool:
        return self.status == "pending"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "title": self.title,
            "department": self.department.value,
            "priority": self.priority.name,
            "dependencies": self.dependencies,
            "estimated_hours": self.estimated_hours,
            "status": self.status,
        }


@dataclass
class BountyPlan:
    bounty_title: str
    bounty_url: str
    subtasks: List[SubTask]
    estimated_hours: float = 8.0
    status: PlanStatus = PlanStatus.DRAFT
    risk_level: str = "medium"
    required_skills: List[str] = field(default_factory=list)
    competitive_strategy: str = ""

    @property
    def total_subtasks(self) -> int:
        return len(self.subtasks)

    def get_parallel_groups(self) -> List[List[int]]:
        groups: List[List[int]] = []
        completed: set = set()
        remaining = list(self.subtasks)
        while remaining:
            ready = [t for t in remaining if all(d in completed for d in t.dependencies)]
            if not ready:
                break
            groups.append([t.task_id for t in ready])
            for t in ready:
                completed.add(t.task_id)
                remaining.remove(t)
        return groups

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bounty_title": self.bounty_title,
            "bounty_url": self.bounty_url,
            "status": self.status.value,
            "total_subtasks": self.total_subtasks,
            "estimated_hours": self.estimated_hours,
            "risk_level": self.risk_level,
            "required_skills": self.required_skills,
            "competitive_strategy": self.competitive_strategy,
            "subtasks": [t.to_dict() for t in self.subtasks],
            "parallel_groups": self.get_parallel_groups(),
        }


TEMPLATES = {
    "feature": [
        ("Analyze requirements & edge cases", Department.RESEARCH, TaskPriority.CRITICAL),
        ("Design solution architecture", Department.RESEARCH, TaskPriority.HIGH),
        ("Implement core solution", Department.CODE, TaskPriority.CRITICAL),
        ("Write comprehensive tests", Department.CODE, TaskPriority.HIGH),
        ("Security review & audit", Department.SECURITY, TaskPriority.HIGH),
        ("Document approach & submit PR", Department.KNOWLEDGE, TaskPriority.MEDIUM),
    ],
    "security": [
        ("Identify attack surface", Department.SECURITY, TaskPriority.CRITICAL),
        ("Analyze vulnerability patterns", Department.SECURITY, TaskPriority.CRITICAL),
        ("Develop exploit PoC", Department.SECURITY, TaskPriority.HIGH),
        ("Write mitigation / fix", Department.CODE, TaskPriority.CRITICAL),
        ("Verify fix with tests", Department.CODE, TaskPriority.HIGH),
        ("Document findings & submit", Department.KNOWLEDGE, TaskPriority.MEDIUM),
    ],
    "documentation": [
        ("Audit existing docs", Department.KNOWLEDGE, TaskPriority.HIGH),
        ("Research best practices", Department.RESEARCH, TaskPriority.MEDIUM),
        ("Write documentation", Department.KNOWLEDGE, TaskPriority.CRITICAL),
        ("Add code examples", Department.CODE, TaskPriority.MEDIUM),
        ("Review & submit", Department.KNOWLEDGE, TaskPriority.LOW),
    ],
    "integration": [
        ("Analyze API / SDK interface", Department.RESEARCH, TaskPriority.CRITICAL),
        ("Design integration architecture", Department.RESEARCH, TaskPriority.HIGH),
        ("Implement adapter / client", Department.CODE, TaskPriority.CRITICAL),
        ("Write integration tests", Department.CODE, TaskPriority.HIGH),
        ("Security review", Department.SECURITY, TaskPriority.MEDIUM),
        ("Document & submit PR", Department.KNOWLEDGE, TaskPriority.MEDIUM),
    ],
}


class BountyPlanner:
    """Decomposes bounty requirements into multi-department subtasks."""

    DEPT_MAP = {
        "security": Department.SECURITY, "audit": Department.SECURITY,
        "code": Department.CODE, "frontend": Department.CODE,
        "backend": Department.CODE, "docs": Department.KNOWLEDGE,
        "documentation": Department.KNOWLEDGE, "agent": Department.RESEARCH,
        "integration": Department.CODE, "infra": Department.OPS,
        "deployment": Department.OPS, "testing": Department.CODE,
    }

    DIFFICULTY_WEIGHTS = {"easy": 1.0, "medium": 2.5, "hard": 5.0, "T1": 5.0, "T2": 2.5, "T3": 1.0}

    def plan(self, bounty, template: str = "feature") -> BountyPlan:
        difficulty = getattr(bounty, "difficulty", "medium")
        tier = getattr(bounty, "tier", None)
        if tier:
            difficulty = tier.value if hasattr(tier, "value") else str(tier)
        weight = self.DIFFICULTY_WEIGHTS.get(difficulty, 2.5)
        task_template = TEMPLATES.get(template, TEMPLATES["feature"])
        subtasks = []
        for i, (title, dept, priority) in enumerate(task_template):
            deps = [i - 1] if i > 0 else []
            if i >= 3 and dept == Department.SECURITY:
                deps = [2]
            subtasks.append(SubTask(
                task_id=i, title=title, department=dept,
                description=f"{title} for {getattr(bounty, 'title', 'the bounty')}",
                priority=priority, dependencies=deps, estimated_hours=weight,
            ))
        labels = getattr(bounty, "labels", [])
        existing_prs = getattr(bounty, "existing_prs", 0)
        risk = "high" if difficulty in ("hard", "T1") else ("medium" if difficulty in ("medium", "T2") else "low")
        return BountyPlan(
            bounty_title=getattr(bounty, "title", "Unknown Bounty"),
            bounty_url=getattr(bounty, "url", ""),
            subtasks=subtasks, estimated_hours=len(subtasks) * weight,
            risk_level=risk, required_skills=self._infer_skills_from_labels(labels),
            competitive_strategy=self._generate_strategy(existing_prs, difficulty),
        )

    def plan_with_llm(self, bounty, api_key: str = "", model: str = "glm-5.1",
                      api_base: str = "https://integrate.api.nvidia.com/v1") -> BountyPlan:
        """Generate an LLM-enhanced execution plan."""
        base_plan = self.plan(bounty)
        if not api_key:
            return base_plan
        try:
            prompt = f"Analyze bounty: {getattr(bounty, 'title', '')} | Refine plan: {json.dumps(base_plan.to_dict())}"
            payload = json.dumps({
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            })
            cmd = ["curl", "-s", "-X", "POST", f"{api_base}/chat/completions",
                   "-H", f"Authorization: Bearer {api_key}",
                   "-H", "Content-Type: application/json",
                   "-d", payload, "--max-time", "30"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=35)
            if result.returncode == 0:
                data = json.loads(result.stdout)
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                if content:
                    refined = self._parse_llm_response(content, base_plan)
                    if refined:
                        return refined
        except Exception as exc:
            logger.error("LLM planning failed: %s", exc)
        return base_plan

    def classify_department(self, label: str) -> Department:
        return self.DEPT_MAP.get(label.lower().strip(), Department.RESEARCH)

    def detect_template(self, labels: List[str], title: str) -> str:
        label_set = {lbl.lower() for lbl in labels}
        title_lower = title.lower()
        if "security" in label_set or "audit" in label_set or "vulnerability" in title_lower:
            return "security"
        if "documentation" in label_set or "docs" in label_set or "tutorial" in title_lower:
            return "documentation"
        if "integration" in label_set or "api" in label_set or "sdk" in title_lower:
            return "integration"
        return "feature"

    @staticmethod
    def _infer_skills_from_labels(labels: List[str]) -> List[str]:
        skill_map = {
            "python": "Python", "typescript": "TypeScript",
            "security": "Security Auditing", "frontend": "React/Frontend",
            "backend": "Backend/API", "agent": "AI Agent Design",
            "solana": "Solana/Web3", "documentation": "Technical Writing",
        }
        skills: List[str] = []
        for label in labels:
            for key, skill in skill_map.items():
                if key in label.lower() and skill not in skills:
                    skills.append(skill)
        return skills

    @staticmethod
    def _generate_strategy(existing_prs: int, difficulty: str) -> str:
        if existing_prs == 0:
            return "First-mover: submit quickly with solid foundation and tests"
        if existing_prs <= 2:
            return "Differentiator: add unique value (architecture docs, security audit)"
        if existing_prs <= 5:
            return "Quality play: focus on code quality, comprehensive testing, unique features"
        return "Niche angle: find underserved aspect (i18n, accessibility, performance)"

    @staticmethod
    def _parse_llm_response(response: str, base_plan: BountyPlan) -> Optional[BountyPlan]:
        try:
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0]
            data = json.loads(json_str.strip())
            if "refined_subtasks" in data:
                tasks = [
                    SubTask(
                        task_id=i,
                        title=st.get("title", f"Task {i}"),
                        department=Department(st.get("department", "research")),
                        description=st.get("description", ""),
                        priority=TaskPriority[st.get("priority", "MEDIUM")],
                        dependencies=st.get("dependencies", []),
                        estimated_hours=st.get("estimated_hours", 2.0),
                    )
                    for i, st in enumerate(data["refined_subtasks"])
                ]
                base_plan.subtasks = tasks
                base_plan.status = PlanStatus.APPROVED
                return base_plan
        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            logger.warning("Failed to parse LLM response: %s", exc)
        return None
