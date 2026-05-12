"""
SolFoundry Autonomous Bounty-Hunting Agent

Multi-LLM agent orchestration for finding, analyzing, implementing,
testing, and submitting bounty solutions without human intervention.
"""

from agent.scout import ScoutAgent
from agent.analyst import AnalystAgent
from agent.coder import CoderAgent
from agent.submitter import SubmitterAgent
from agent.orchestrator import OrchestratorAgent
from agent.config import load_config

__version__ = "0.1.0"
__all__ = [
    "ScoutAgent",
    "AnalystAgent",
    "CoderAgent",
    "SubmitterAgent",
    "OrchestratorAgent",
    "load_config",
]
