#!/usr/bin/env python3
"""
OpenClaw Bounty Agent — Autonomous Multi-Agent Bounty Hunting System.

Addresses: SolFoundry/solfoundry#861

Architecture: 51 agents across 7 gateways with multi-LLM orchestration.
"""
import os
import json
import argparse
from bounty_agent.discovery import BountyScanner
from bounty_agent.planner import BountyPlanner, BountyPlan
from bounty_agent.submitter import PRSubmitter
from bounty_agent.orchestrator import TeamOrchestrator


class AutonomousBountyAgent:
    """Full autonomous bounty-hunting agent orchestration."""

    def __init__(self):
        self.gh_token = os.environ.get("GITHUB_TOKEN", "")
        self.scanner = BountyScanner(self.gh_token)
        self.planner = BountyPlanner()
        self.submitter = PRSubmitter()
        self.orchestrator = TeamOrchestrator()
        self.completed = []
        self.failed = []

    def discover(self, keywords: str = "bounty", limit: int = 20) -> list:
        """Phase 1: Discover bounty opportunities across platforms."""
        print(f"🔍 Scanning for bounties: '{keywords}'")
        bounties = self.scanner.scan_github(keywords, limit)
        prioritized = self.scanner.prioritize(bounties)
        easy_count = sum(1 for b in prioritized if b.is_easy)
        print(f"   Found {len(prioritized)} bounties ({easy_count} easy, {len(prioritized)-easy_count} medium/hard)")
        return prioritized

    def analyze(self, bounties: list) -> list:
        """Phase 2: Analyze and plan each bounty with multi-agent coordination."""
        print(f"📊 Analyzing {len(bounties)} bounties")
        plans = []
        for bounty in bounties[:10]:
            plan = self.planner.plan(bounty)
            plans.append(plan)
            print(f"   {bounty.title[:50]}... → {len(plan.subtasks)} subtasks, ~{plan.estimated_hours}h")
        return plans

    def implement(self, plan: BountyPlan) -> list:
        """Phase 3: Implement solution using 51 specialized agents."""
        print(f"🔧 Executing: {plan.bounty_title}")
        status = self.orchestrator.get_team_status()
        print(f"   Team: {status['idle']} idle / {status['total_agents']} total agents")
        results = self.orchestrator.execute_plan(plan)
        for r in results:
            print(f"   [{r['department']}] {r['subtask']} → {r['agent']} ({r['model']})")
        return results

    def submit(self, repo: str, branch: str, title: str, body: str) -> str:
        """Phase 4: Submit PR with multi-LLM reviewed code."""
        print(f"📤 Submitting PR to {repo}")
        result = self.submitter.submit_pr(repo, branch, title, body)
        if result:
            self.completed.append(result)
            print(f"   ✅ PR created: {result}")
        else:
            self.failed.append(title)
            print("   ❌ PR failed")
        return result or ""

    def run(self, keywords: str = "bounty", limit: int = 20):
        """Full autonomous cycle: discover → analyze → implement → submit."""
        status = self.orchestrator.get_team_status()
        print("=" * 60)
        print("🤖 OpenClaw Bounty Agent — Autonomous Mode")
        print(f"   {status['total_agents']} agents | {status['gateways']} gateways | Multi-LLM")
        print("=" * 60)

        bounties = self.discover(keywords, limit)
        plans = self.analyze(bounties)

        for plan in plans[:3]:
            self.implement(plan)

        print("\n📊 Session Summary:")
        print(f"   Discovered: {len(bounties)} bounties")
        print(f"   Planned: {len(plans)} plans")
        print(f"   Completed: {len(self.completed)}")
        print(f"   Failed: {len(self.failed)}")
        print(f"   Team: {self.orchestrator.get_team_status()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OpenClaw Bounty Agent")
    parser.add_argument("--scan", action="store_true", help="Scan for bounties")
    parser.add_argument("--run", action="store_true", help="Run full autonomous cycle")
    parser.add_argument("--status", action="store_true", help="Show team status")
    parser.add_argument("--keywords", default="bounty", help="Search keywords")
    args = parser.parse_args()

    agent = AutonomousBountyAgent()
    if args.status:
        print(json.dumps(agent.orchestrator.get_team_status(), indent=2))
    elif args.run or args.scan:
        agent.run(keywords=args.keywords)
    else:
        parser.print_help()
