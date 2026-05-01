"""Unit tests for BountyPlanner (planner module)."""
import unittest
from bounty_agent.planner import BountyPlanner

class TestBountyPlanner(unittest.TestCase):
    def setUp(self):
        self.planner = BountyPlanner()
    
    def test_decompose_returns_subtasks(self):
        bounty = {
            "number": 861,
            "title": "Full Autonomous Bounty-Hunting Agent",
            "body": "Build an autonomous agent that discovers, analyzes, implements, and submits bounties",
            "labels": [{"name": "tier-3"}]
        }
        plan = self.planner.decompose(bounty)
        self.assertIsInstance(plan, list)
        self.assertGreater(len(plan), 0)
    
    def test_assign_department(self):
        subtask = {"title": "Scan GitHub issues", "skill": "discovery"}
        dept = self.planner.assign_department(subtask)
        self.assertIn(dept, ["discovery", "planning", "implementation", "submission", "review"])
    
    def test_estimate_effort(self):
        bounty = {"labels": [{"name": "tier-3"}]}
        effort = self.planner.estimate_effort(bounty)
        self.assertGreater(effort, 0)

if __name__ == "__main__":
    unittest.main()
