"""Implementer Agent — Generates code changes based on plans."""
import json
import os
import subprocess
from pathlib import Path

import httpx

from app.config import config
from app.agents.planner import Plan, TaskStep


class ImplementerAgent:
    """Generates and applies code changes based on implementation plans."""

    SYSTEM_PROMPT = """You are an expert software implementer. Given a task step and context, 
generate production-quality code. Your output MUST be valid JSON:

{
  "content": "the complete file content to write",
  "language": "python|javascript|typescript|etc"
}

Write clean, well-documented, production code. Include proper error handling, 
type hints, and docstrings. Follow existing code style from the repository."""

    def __init__(self, model: str | None = None, base_url: str | None = None, workspace: Path | None = None):
        self.model = model or config.LLM_MODEL
        self.base_url = base_url or config.LLM_BASE_URL
        self.workspace = workspace or config.WORKSPACE_ROOT

    async def implement(self, plan: Plan, repo_path: Path | None = None) -> list[dict]:
        """Execute all steps in the plan, generating and writing code."""
        results = []
        for step in plan.steps:
            result = await self._execute_step(step, plan, repo_path)
            results.append(result)
        return results

    async def _execute_step(self, step: TaskStep, plan: Plan, repo_path: Path | None = None) -> dict:
        """Execute a single implementation step."""
        # Read existing file if modifying
        existing_code = ""
        if step.action == "modify" and repo_path:
            target = repo_path / step.target
            if target.exists():
                existing_code = target.read_text()

        # Gather context from nearby files
        context = self._gather_context(step, repo_path)

        prompt = f"""## Implementation Task

**Bounty:** #{plan.bounty.number} - {plan.bounty.title}
**Step:** {step.step} - {step.description}
**Action:** {step.action}
**Target file:** {step.target}

### Task Details:
{step.details}

### Existing Code (if modifying):
```
{existing_code[:3000]}
```

### Nearby Files Context:
{context}

Generate the complete file content for `{step.target}`."""

        response = await self._call_llm(prompt)
        return self._apply_change(step, response, repo_path)

    async def _call_llm(self, prompt: str) -> str:
        """Call the LLM API."""
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    def _gather_context(self, step: TaskStep, repo_path: Path | None = None) -> str:
        """Gather context from nearby files in the repo."""
        if not repo_path:
            return "No repository context available."

        target_dir = (repo_path / step.target).parent
        context_parts = []
        for f in sorted(target_dir.glob("*.py"))[:5]:
            if f.name != Path(step.target).name:
                try:
                    content = f.read_text()[:500]
                    context_parts.append(f"### {f.relative_to(repo_path)}:\n```\n{content}\n```")
                except Exception:
                    pass

        return "\n\n".join(context_parts) if context_parts else "No context files found."

    def _apply_change(self, step: TaskStep, llm_response: str, repo_path: Path | None = None) -> dict:
        """Apply the generated code change to the repository."""
        try:
            data = json.loads(llm_response.strip().removeprefix("```json").removesuffix("```").strip())
            content = data.get("content", "")
        except json.JSONDecodeError:
            # If LLM didn't return JSON, treat the whole response as content
            content = llm_response
            # Try to extract code from markdown blocks
            if "```" in content:
                parts = content.split("```")
                for i, part in enumerate(parts):
                    if i % 2 == 1:  # Inside code block
                        lines = part.split("\n", 1)
                        content = lines[1] if len(lines) > 1 else lines[0]
                        break

        if not content or not repo_path:
            return {"step": step.step, "status": "skipped", "reason": "No content or repo path"}

        target = repo_path / step.target
        target.parent.mkdir(parents=True, exist_ok=True)

        if step.action == "create":
            target.write_text(content)
        elif step.action == "modify":
            target.write_text(content)
        elif step.action == "delete":
            if target.exists():
                target.unlink()

        return {"step": step.step, "status": "applied", "file": step.target, "action": step.action}

    def run_tests(self, repo_path: Path) -> dict:
        """Run tests in the repository."""
        try:
            result = subprocess.run(
                ["python", "-m", "pytest", "tests/", "-v", "--tb=short"],
                cwd=str(repo_path),
                capture_output=True,
                text=True,
                timeout=120,
            )
            return {
                "passed": result.returncode == 0,
                "stdout": result.stdout[-2000:] if result.stdout else "",
                "stderr": result.stderr[-2000:] if result.stderr else "",
            }
        except subprocess.TimeoutExpired:
            return {"passed": False, "error": "Test execution timed out"}
        except Exception as e:
            return {"passed": False, "error": str(e)}