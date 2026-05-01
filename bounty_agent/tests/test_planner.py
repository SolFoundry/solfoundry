"""Unit tests for bounty planner module."""
import pytest
from bounty_agent.planner import BountyPlanner, BountyPlan, SubTask, Department


class TestDepartment:
    """Tests for Department enum."""

    def test_departments_exist(self):
        assert Department.SECURITY.value == "铁卫"
        assert Department.RESEARCH.value == "天机"
        assert Department.CODE.value == "玄码"
        assert Department.KNOWLEDGE.value == "博典"
        assert Department.OPS.value == "运维"


class TestSubTask:
    """Tests for SubTask dataclass."""

    def test_creation(self):
        task = SubTask(
            title="Analyze requirements",
            department=Department.RESEARCH,
            description="Analyze bounty requirements",
            priority=1
        )
        assert task.title == "Analyze requirements"
        assert task.department == Department.RESEARCH
        assert task.dependencies == []

    def test_with_dependencies(self):
        task = SubTask(
            title="Write tests",
            department=Department.CODE,
            description="Write unit tests",
            priority=2,
            dependencies=[0]
        )
        assert task.dependencies == [0]


class TestBountyPlanner:
    """Tests for BountyPlanner."""

    def setup_method(self):
        self.planner = BountyPlanner()

    def test_plan_creates_subtasks(self):
        from bounty_agent.discovery import BountyIssue
        bounty = BountyIssue(
            platform="github", repo="SolFoundry/solfoundry",
            issue_number=855, title="GitHub Action for External Repos",
            reward="500K", url="https://github.com/SolFoundry/solfoundry/issues/855"
        )
        plan = self.planner.plan(bounty)
        assert isinstance(plan, BountyPlan)
        assert len(plan.subtasks) >= 3
        assert plan.bounty_title == bounty.title

    def test_plan_department_mapping(self):
        assert self.planner.DEPT_MAP["security"] == Department.SECURITY
        assert self.planner.DEPT_MAP["code"] == Department.CODE
        assert self.planner.DEPT_MAP["agent"] == Department.RESEARCH
        assert self.planner.DEPT_MAP["docs"] == Department.KNOWLEDGE

    def test_plan_subtask_ordering(self):
        from bounty_agent.discovery import BountyIssue
        bounty = BountyIssue(
            platform="github", repo="test/repo",
            issue_number=1, title="Test bounty", reward="100K"
        )
        plan = self.planner.plan(bounty)
        # Research should come before code
        departments = [s.department for s in plan.subtasks]
        research_idx = next(i for i, d in enumerate(departments) if d == Department.RESEARCH)
        code_idx = next(i for i, d in enumerate(departments) if d == Department.CODE)
        assert research_idx < code_idx

    def test_plan_estimated_hours(self):
        from bounty_agent.discovery import BountyIssue
        bounty = BountyIssue(
            platform="github", repo="test/repo",
            issue_number=1, title="Test", reward="100"
        )
        plan = self.planner.plan(bounty)
        assert plan.estimated_hours > 0
