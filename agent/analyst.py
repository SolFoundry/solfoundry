"""
Analyst Agent — Reads bounty requirements and generates implementation plans.

Responsibilities:
- Clone the target repository
- Read issue description and acceptance criteria
- Examine codebase structure (file tree, key components)
- Identify files to modify
- Estimate implementation effort
- Generate a step-by-step implementation plan
"""

import json
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from openai import OpenAI

from agent.scout import BountyOpportunity


@dataclass
class ImplementationPlan:
    """Structured plan for implementing a bounty solution."""
    bounty_id: int
    repo: str
    branch_name: str
    summary: str
    files_to_modify: list[str] = field(default_factory=list)
    files_to_create: list[str] = field(default_factory=list)
    steps: list[str] = field(default_factory=list)
    estimated_effort: str = "medium"  # low, medium, high
    test_instructions: list[str] = field(default_factory=list)
    risks: list[str] = field(default_factory=list)


class AnalystAgent:
    """Analyzes bounty requirements and generates implementation plans."""

    def __init__(self, config: dict):
        self.config = config
        llm_config = config.get("llm", {}).get("analyst", {})
        self.model = llm_config.get("model", "gpt-4o")
        self.temperature = llm_config.get("temperature", 0.2)
        self.max_tokens = llm_config.get("max_tokens", 8192)
        self.impl_config = config.get("implementation", {})
        self.repo_base = Path(self.impl_config.get("repo_base_path", "/tmp/solfoundry-bounties"))
        self.client = OpenAI()  # Uses OPENAI_API_KEY from env

    def clone_repo(self, repo: str) -> Path:
        """Clone the target repository for analysis."""
        repo_path = self.repo_base / repo.replace("/", "-")
        if repo_path.exists():
            # Pull latest
            subprocess.run(
                ["git", "pull", "origin", "main"],
                cwd=repo_path, check=True, capture_output=True,
            )
        else:
            repo_path.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(
                ["git", "clone", f"https://github.com/{repo}.git", str(repo_path)],
                check=True, capture_output=True,
            )
        return repo_path

    def get_file_tree(self, repo_path: Path, max_depth: int = 4) -> str:
        """Get a condensed file tree of the repository."""
        result = subprocess.run(
            ["find", str(repo_path), "-type", "f",
             "-not", "-path", "*/node_modules/*",
             "-not", "-path", "*/.git/*",
             "-not", "-path", "*/dist/*",
             "-not", "-path", "*/__pycache__/*"],
            capture_output=True, text=True,
        )
        files = result.stdout.strip().split("\n")
        # Trim base path for readability
        trimmed = [f.replace(str(repo_path) + "/", "") for f in files if f]
        return "\n".join(trimmed[:200])  # Cap at 200 files

    def read_key_files(self, repo_path: Path, filenames: list[str]) -> dict[str, str]:
        """Read specific files from the repo."""
        contents = {}
        for filename in filenames:
            filepath = repo_path / filename
            if filepath.exists() and filepath.is_file():
                try:
                    contents[filename] = filepath.read_text()[:5000]  # Cap per file
                except Exception:
                    pass
        return contents

    def analyze(self, bounty: BountyOpportunity, repo_path: Optional[Path] = None) -> ImplementationPlan:
        """Analyze a bounty and generate an implementation plan."""
        if repo_path is None:
            repo_path = self.clone_repo(bounty.repo)

        # Gather context
        file_tree = self.get_file_tree(repo_path)
        key_files = self.read_key_files(repo_path, [
            "README.md", "package.json", "tsconfig.json",
            "CONTRIBUTING.md", "src/App.tsx",
        ])

        # Build LLM prompt
        prompt = f"""You are an expert software analyst. Analyze this bounty and create an implementation plan.

## Bounty #{bounty.issue_number}: {bounty.title}
**Platform:** {bounty.platform}
**Tier:** {bounty.tier}
**Reward:** {bounty.reward_amount} {bounty.reward_token}
**Competition:** {bounty.competition_level} ({bounty.comment_count} comments)

### Description
{bounty.body}

## Repository Structure
```
{file_tree}
```

## Key Files
"""
        for filename, content in key_files.items():
            prompt += f"\n### {filename}\n```\n{content}\n```\n"

        prompt += """

## Task
Create a detailed implementation plan as JSON:
```json
{
  "summary": "Brief description of the solution",
  "files_to_modify": ["path/to/file1.tsx", "path/to/file2.tsx"],
  "files_to_create": ["path/to/new-file.tsx"],
  "steps": [
    "Step 1: Description of what to do",
    "Step 2: ..."
  ],
  "estimated_effort": "low|medium|high",
  "test_instructions": [
    "How to verify step 1",
    "How to verify step 2"
  ],
  "risks": [
    "Potential issue 1",
    "Potential issue 2"
  ]
}
```

Respond with ONLY the JSON, no other text."""

        # Call LLM
        response = self.client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        # Parse response
        try:
            plan_data = json.loads(response.choices[0].message.content)
        except (json.JSONDecodeError, KeyError):
            plan_data = {
                "summary": f"Implement {bounty.title}",
                "files_to_modify": [],
                "files_to_create": [],
                "steps": ["Read bounty requirements and implement solution"],
                "estimated_effort": "medium",
                "test_instructions": ["Manual verification"],
                "risks": ["LLM analysis parsing failed"],
            }

        branch_prefix = self.impl_config.get("branch_prefix", "feat/bounty-")
        return ImplementationPlan(
            bounty_id=bounty.issue_number,
            repo=bounty.repo,
            branch_name=f"{branch_prefix}{bounty.issue_number}",
            summary=plan_data.get("summary", ""),
            files_to_modify=plan_data.get("files_to_modify", []),
            files_to_create=plan_data.get("files_to_create", []),
            steps=plan_data.get("steps", []),
            estimated_effort=plan_data.get("estimated_effort", "medium"),
            test_instructions=plan_data.get("test_instructions", []),
            risks=plan_data.get("risks", []),
        )
