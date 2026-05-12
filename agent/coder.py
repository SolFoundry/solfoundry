"""
Coder Agent — Implements solutions based on the analyst's plan.

Responsibilities:
- Create feature branch from main
- Read and modify files according to the implementation plan
- Create new files as specified
- Run linters and tests
- Commit with proper messages
"""

import subprocess
from pathlib import Path
from typing import Optional

from openai import OpenAI

from agent.analyst import ImplementationPlan


class CoderAgent:
    """Implements bounty solutions based on structured plans."""

    def __init__(self, config: dict):
        self.config = config
        llm_config = config.get("llm", {}).get("coder", {})
        self.model = llm_config.get("model", "gpt-4o")
        self.temperature = llm_config.get("temperature", 0.1)
        self.max_tokens = llm_config.get("max_tokens", 16384)
        self.impl_config = config.get("implementation", {})
        self.client = OpenAI()
        self.github_token = config.get("github", {}).get("token", "")

    def create_branch(self, repo_path: Path, branch_name: str) -> bool:
        """Create a feature branch from main."""
        try:
            subprocess.run(
                ["git", "checkout", "main"],
                cwd=repo_path, check=True, capture_output=True,
            )
            subprocess.run(
                ["git", "pull", "origin", "main"],
                cwd=repo_path, check=True, capture_output=True,
            )
            # Delete existing branch if it exists
            subprocess.run(
                ["git", "branch", "-D", branch_name],
                cwd=repo_path, capture_output=True,
            )
            subprocess.run(
                ["git", "checkout", "-b", branch_name],
                cwd=repo_path, check=True, capture_output=True,
            )
            return True
        except subprocess.CalledProcessError:
            return False

    def read_file(self, repo_path: Path, filepath: str) -> Optional[str]:
        """Read a file from the repo."""
        full_path = repo_path / filepath
        if full_path.exists():
            return full_path.read_text()
        return None

    def write_file(self, repo_path: Path, filepath: str, content: str) -> bool:
        """Write content to a file in the repo."""
        full_path = repo_path / filepath
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content)
        return True

    def implement_step(
        self,
        repo_path: Path,
        plan: ImplementationPlan,
        step_index: int,
    ) -> bool:
        """Implement a single step from the plan using LLM."""
        step = plan.steps[step_index]

        # Gather context from files to modify
        file_contents = {}
        for filepath in plan.files_to_modify:
            content = self.read_file(repo_path, filepath)
            if content:
                file_contents[filepath] = content

        prompt = f"""You are an expert software engineer implementing a bounty solution.

## Bounty #{plan.bounty_id}
## Plan Summary: {plan.summary}

## Current Step ({step_index + 1}/{len(plan.steps)}): {step}

## Files to Modify
"""
        for filepath, content in file_contents.items():
            prompt += f"\n### {filepath}\n```\n{content}\n```\n"

        prompt += f"""

## Files to Create: {plan.files_to_create}

## Task
For the current step, provide the exact file changes needed.
Respond as JSON:
```json
{{
  "changes": [
    {{
      "action": "modify",
      "file": "path/to/file.tsx",
      "content": "complete new file content"
    }},
    {{
      "action": "create",
      "file": "path/to/new-file.tsx",
      "content": "complete file content"
    }}
  ]
}}
```

IMPORTANT: For "modify" actions, provide the COMPLETE new file content, not just diffs.
Respond with ONLY the JSON."""

        response = self.client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        import json
        try:
            result = json.loads(response.choices[0].message.content)
            for change in result.get("changes", []):
                if change["action"] == "create":
                    self.write_file(repo_path, change["file"], change["content"])
                elif change["action"] == "modify":
                    self.write_file(repo_path, change["file"], change["content"])
            return True
        except (json.JSONDecodeError, KeyError, IndexError):
            return False

    def run_lint(self, repo_path: Path) -> tuple[bool, str]:
        """Run linting on the codebase."""
        lint_cmd = self.impl_config.get("lint_command", "cd frontend && npx eslint src/")
        try:
            result = subprocess.run(
                lint_cmd, shell=True,
                cwd=repo_path, capture_output=True, text=True, timeout=60,
            )
            return result.returncode == 0, result.stdout + result.stderr
        except subprocess.TimeoutExpired:
            return False, "Lint timed out"

    def run_tests(self, repo_path: Path) -> tuple[bool, str]:
        """Run the test suite."""
        test_cmd = self.impl_config.get("test_command", "cd frontend && npm test -- --watchAll=false")
        try:
            result = subprocess.run(
                test_cmd, shell=True,
                cwd=repo_path, capture_output=True, text=True, timeout=120,
            )
            return result.returncode == 0, result.stdout + result.stderr
        except subprocess.TimeoutExpired:
            return False, "Tests timed out"

    def commit(self, repo_path: Path, plan: ImplementationPlan) -> bool:
        """Stage and commit all changes."""
        try:
            subprocess.run(
                ["git", "add", "-A"],
                cwd=repo_path, check=True, capture_output=True,
            )
            msg_template = self.impl_config.get(
                "commit_message_template",
                "feat: {title} (Closes #{issue_number})",
            )
            message = msg_template.format(
                title=plan.summary[:72],
                issue_number=plan.bounty_id,
            )
            subprocess.run(
                ["git", "commit", "-m", message],
                cwd=repo_path, check=True, capture_output=True,
            )
            return True
        except subprocess.CalledProcessError:
            return False

    def implement(self, repo_path: Path, plan: ImplementationPlan) -> bool:
        """Execute the full implementation plan."""
        # Create branch
        if not self.create_branch(repo_path, plan.branch_name):
            return False

        # Implement each step
        for i in range(len(plan.steps)):
            if not self.implement_step(repo_path, plan, i):
                return False

        # Run quality checks
        if self.impl_config.get("run_lint", True):
            lint_ok, lint_output = self.run_lint(repo_path)
            if not lint_ok:
                # Attempt to fix lint errors with LLM
                pass  # Future: auto-fix lint errors

        if self.impl_config.get("run_tests", True):
            test_ok, test_output = self.run_tests(repo_path)
            if not test_ok:
                # Attempt to fix test failures with LLM
                pass  # Future: auto-fix test failures

        # Commit
        return self.commit(repo_path, plan)
