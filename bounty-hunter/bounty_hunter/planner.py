"""Planner — analyzes bounty requirements and generates implementation plan."""

import logging
import json
from dataclasses import dataclass, field
from typing import Optional

log = logging.getLogger(__name__)


@dataclass
class SolutionPlan:
    """A detailed plan for implementing a bounty solution."""
    bounty_number: int
    bounty_title: str
    description: str
    files_to_create: list[dict] = field(default_factory=list)
    files_to_modify: list[dict] = field(default_factory=list)
    test_strategy: str = ""
    dependencies: list[str] = field(default_factory=list)
    estimated_complexity: str = "medium"  # low, medium, high
    risk_points: list[str] = field(default_factory=list)
    llm_analysis: list[str] = field(default_factory=list)


class Planner:
    """Plans bounty solutions using local analysis and multi-LLM signals."""

    def __init__(self, llm_api_key: str = "", llm_endpoint: str = ""):
        self.llm_api_key = llm_api_key
        self.llm_endpoint = llm_endpoint

    def analyze_bounty(self, bounty_body: str, repo_context: Optional[str] = None) -> SolutionPlan:
        """Analyze a bounty issue and produce a solution plan."""
        return self._local_analyze(bounty_body, repo_context)

    def _local_analyze(self, body: str, repo_context: Optional[str] = None) -> SolutionPlan:
        """Analyze locally using rule-based parsing."""
        import re

        # Extract acceptance criteria
        ac_section = self._extract_section(body, [
            r"(?:acceptance\s*criteria|ac|requirements|definition\s*of\s*done)\s*:?\s*\n*(.*?)(?:\n#{1,3}\s|\n---|\n##\s|$)",
        ])

        # Extract technologies
        techs = re.findall(r'(?:Python|TypeScript|Rust|React|Node\.js|FastAPI|Next\.js|Docker|Solana|Anchor)', body, re.IGNORECASE)

        # Identify files to create/modify from issue body
        files_to_create = []
        files_to_modify = []

        file_patterns = re.findall(r'(?:create|add|new)\s+(?:file\s+)?`([^`]+)`', body, re.IGNORECASE)
        for f in file_patterns:
            files_to_create.append({"path": f, "purpose": "implementation"})

        modify_patterns = re.findall(r'(?:modify|update|edit|change)\s+(?:file\s+)?`([^`]+)`', body, re.IGNORECASE)
        for f in modify_patterns:
            files_to_modify.append({"path": f, "purpose": "modification"})

        # Detect complexity
        complexity = "low"
        word_count = len(body.split())
        if word_count > 500:
            complexity = "high"
        elif word_count > 200:
            complexity = "medium"

        return SolutionPlan(
            bounty_number=0,
            bounty_title="",
            description=ac_section or "Implement per acceptance criteria",
            files_to_create=files_to_create,
            files_to_modify=files_to_modify,
            test_strategy="Create unit tests for new functionality, run existing test suite",
            dependencies=list(set(techs)),
            estimated_complexity=complexity,
            risk_points=[],
            llm_analysis=["Local analysis complete"],
        )

    def generate_task_list(self, plan: SolutionPlan) -> list[str]:
        """Convert a solution plan into an ordered task list."""
        tasks = [
            f"1. Understand bounty #{plan.bounty_number}: {plan.bounty_title}",
        ]

        for fc in plan.files_to_create:
            tasks.append(f"2. Create {fc['path']} ({fc['purpose']})")

        for fm in plan.files_to_modify:
            tasks.append(f"3. Modify {fm['path']} ({fm['purpose']})")

        if not plan.files_to_create and not plan.files_to_modify:
            tasks.append("2. Implement solution per acceptance criteria")

        tasks.append(f"4. Add/update tests ({plan.test_strategy})")
        tasks.append("5. Run existing test suite to verify no regressions")
        tasks.append("6. Commit and push changes")
        tasks.append("7. Submit PR with Closes #N and wallet address")

        return tasks

    @staticmethod
    def _extract_section(text: str, patterns: list[str]) -> str:
        """Extract a section from markdown text."""
        import re
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match and match.group(1).strip():
                content = match.group(1).strip()
                if len(content) > 20:  # meaningful content
                    return content[:2000]
        return text[:500] if text else ""
