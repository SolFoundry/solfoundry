"""Unit tests for BountyPlanner — planning module."""
import pytest
from bounty_agent.planner import BountyPlanner, BountyPlan, SubTask, Department


class TestBountyPlanner:
    def setup_method(self):
        self.planner = BountyPlanner()

    def test_plan_returns_bounty_plan(self):
        bounty = type("Bounty", (), {"title": "Test Bounty", "url": "https://github.com/test/1"})()
        plan = self.planner.plan(bounty)
        assert isinstance(plan, BountyPlan)
        assert plan.bounty_title == "Test Bounty"
        assert plan.bounty_url == "https://github.com/test/1"

    def test_plan_has_four_subtasks(self):
        bounty = type("Bounty", (), {"title": "Test", "url": "http://test"})()
        plan = self.planner.plan(bounty)
        assert len(plan.subtasks) == 4

    def test_subtask_dependencies(self):
        bounty = type("Bounty", (), {"title": "Test", "url": "http://test"})()
        plan = self.planner.plan(bounty)
        # First task has no dependencies
        assert plan.subtasks[0].dependencies == []
        # Later tasks depend on earlier ones
        assert len(plan.subtasks[1].dependencies) > 0

    def test_department_enum_values(self):
        assert Department.SECURITY.value == "铁卫"
        assert Department.RESEARCH.value == "天机"
        assert Department.CODE.value == "玄码"
        assert Department.KNOWLEDGE.value == "博典"
        assert Department.OPS.value == "运维"

    def test_dept_map_coverage(self):
        for key in ["security", "audit", "code", "frontend", "backend", "docs", "agent"]:
            assert key in self.planner.DEPT_MAP


class TestSubTask:
    def test_default_priority(self):
        task = SubTask("Test", Department.CODE, "desc")
        assert task.priority == 1

    def test_default_dependencies(self):
        task = SubTask("Test", Department.CODE, "desc")
        assert task.dependencies == []
