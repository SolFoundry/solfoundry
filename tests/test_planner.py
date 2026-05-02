"""Unit tests for bounty planner module."""
import unittest
from bounty_agent.planner import BountyPlanner, BountyPlan, Department
from bounty_agent.discovery import BountyIssue


class TestBountyPlanner(unittest.TestCase):
    def setUp(self):
        self.planner = BountyPlanner()

    def test_plan_creates_subtasks(self):
        bounty = BountyIssue(platform="github", repo="test/repo", issue_number=1, title="Test", reward="100")
        plan = self.planner.plan(bounty)
        self.assertIsInstance(plan, BountyPlan)
        self.assertGreaterEqual(len(plan.subtasks), 3)

    def test_classify_department(self):
        self.assertEqual(self.planner.classify_department("security"), Department.SECURITY)

    def test_detect_template(self):
        self.assertEqual(self.planner.detect_template(["security"], ""), "security")

    def test_estimated_hours(self):
        bounty = BountyIssue("p", "r", 1, "t", "100")
        plan = self.planner.plan(bounty)
        self.assertGreater(plan.estimated_hours, 0)


if __name__ == "__main__":
    unittest.main()
