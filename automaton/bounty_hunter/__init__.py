"""
SolFoundry Autonomous Bounty Hunter Agent

An autonomous multi-agent system that:
1. Scans for open bounties on GitHub
2. Analyzes requirements and codebase
3. Plans implementation approach
4. Implements solutions
5. Runs tests
6. Submits PRs
"""

from .agent import BountyHunterAgent, AgentState
from .github_client import GitHubClient
from .planner import Planner
from .coder import Coder
from .tester import Tester

__all__ = [
    "BountyHunterAgent",
    "AgentState", 
    "GitHubClient",
    "Planner",
    "Coder",
    "Tester",
]

__version__ = "0.1.0"
