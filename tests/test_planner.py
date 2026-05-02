"""Unit tests for BountyPlanner (planner module)."""

import unittest
from unittest.mock import MagicMock
from bounty_agent.planner import BountyPlanner, Department, BountyPlan, SubTask


class TestBountyPlanner(unittest.TestCase):
    def setUp(self):
        self.planner = BountyPlanner()

    def test_plan_returns_bounty_plan(self):
        bounty = MagicMock()
        bounty.title = "Full Autonomous Bounty-Hunting Agent"
        bounty.difficulty = "medium"
        plan = self.planner.plan(bounty)
        self.assertIsInstance(plan, BountyPlan)
        self.assertGreater(len(plan.subtasks), 0)

    def test_plan_subtasks_structure(self):
        bounty = MagicMock()
        bounty.title = "Build something cool"
        bounty.difficulty = "hard"
        plan = self.planner.plan(bounty)
        # Should have 6 subtasks
        self.assertEqual(len(plan.subtasks), 6)
        for st in plan.subtasks:
            self.assertIsInstance(st, SubTask)
            self.assertIsInstance(st.department, Department)

    def test_classify_department(self):
        # Test keyword → department mapping
        self.assertEqual(self.planner.classify_department("security"), Department.SECURITY)
        self.assertEqual(self.planner.classify_department("code"), Department.CODE)
        self.assertEqual(self.planner.classify_department("docs"), Department.KNOWLEDGE)
        self.assertEqual(self.planner.classify_department("infra"), Department.OPS)
        self.assertEqual(self.planner.classify_department("agent"), Department.RESEARCH)

    def test_plan_estimated_hours(self):
        bounty = MagicMock()
        bounty.title = "Hard task"
        bounty.difficulty = "hard"
        plan = self.planner.plan(bounty)
        # Hard difficulty weight=5.0, 6 subtasks → estimated=30.0
        self.assertGreater(plan.estimated_hours, 0)

    def test_plan_difficulty_easy(self):
        bounty = MagicMock()
        bounty.title = "Easy task"
        bounty.difficulty = "easy"
        plan = self.planner.plan(bounty)
        # Easy weight=1.0, 6 subtasks → estimated=6.0
        self.assertEqual(plan.estimated_hours, 6.0)

    def test_subtask_priorities(self):
        bounty = MagicMock()
        bounty.title = "Test"
        bounty.difficulty = "medium"
        plan = self.planner.plan(bounty)
        priorities = [st.priority for st in plan.subtasks]
        self.assertEqual(priorities, sorted(priorities))


if __name__ == "__main__":
    unittest.main()
