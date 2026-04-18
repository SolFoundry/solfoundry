"""Reviewer Agent — Validates changes and submits PRs."""
import json
import subprocess
from dataclasses import dataclass

import httpx

from app.config import config
from app.agents.discovery import Bounty
from app.agents.planner import Plan


@dataclass
class ReviewResult:
    """Result of reviewing an implementation."""
    passed: bool
    issues: list[str]
    suggestions: list[str]
    pr_url: str = ""


class ReviewerAgent:
    """Reviews implementations, runs tests, validates, and submits PRs."""

    SYSTEM_PROMPT = """You are an expert code reviewer. Given code changes for a bounty, 
review them for:
1. Correctness — does it satisfy the acceptance criteria?
2. Code quality — clean, documented, no obvious bugs
3. Security — no secrets, no injection vulnerabilities
4. Testing — adequate test coverage

Output valid JSON:
{
  "passed": true/false,
  "issues": ["list of problems found"],
  "suggestions": ["improvement suggestions"]
}"""

    def __init__(self, token: str | None = None, model: str | None = None, base_url: str | None = None):
        self.token = token or config.GITHUB_TOKEN
        self.model = model or config.LLM_MODEL
        self.base_url = base_url or config.LLM_BASE_URL
        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json",
        }

    async def review(self, bounty: Bounty, plan: Plan, diff: str, test_results: dict) -> ReviewResult:
        """Review an implementation against its bounty requirements."""
        prompt = f"""## Review Request for Bounty #{bounty.number}: {bounty.title}

### Acceptance Criteria:
{bounty.body}

### Implementation Plan:
{plan.approach}

### Code Changes (diff):
```
{diff[:4000]}
```

### Test Results:
```json
{json.dumps(test_results, indent=2)[:2000]}
```

Review the implementation against the acceptance criteria."""

        async with httpx.AsyncClient(timeout=60) as client:
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
            review_text = data["choices"][0]["message"]["content"]

        try:
            cleaned = review_text.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
            review_data = json.loads(cleaned)
        except json.JSONDecodeError:
            review_data = {"passed": False, "issues": ["Failed to parse review"], "suggestions": []}

        return ReviewResult(
            passed=review_data.get("passed", False) and test_results.get("passed", False),
            issues=review_data.get("issues", []),
            suggestions=review_data.get("suggestions", []),
        )

    async def submit_pr(
        self,
        bounty: Bounty,
        branch_name: str,
        repo: str,
        pr_body: str,
        fork_repo: str | None = None,
    ) -> dict:
        """Submit a pull request for the implementation."""
        if config.DRY_RUN:
            return {"status": "dry_run", "message": f"Would submit PR for bounty #{bounty.number} on branch {branch_name}"}

        head = f"{fork_repo or config.GITHUB_TOKEN.split(':')[0]}:{branch_name}" if ":" in config.GITHUB_TOKEN else branch_name

        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            resp = await client.post(
                f"https://api.github.com/repos/{repo}/pulls",
                json={
                    "title": f"feat: {bounty.title} (Bounty #{bounty.number})",
                    "body": pr_body,
                    "head": head,
                    "base": "main",
                },
            )
            resp.raise_for_status()
            pr_data = resp.json()
            return {"status": "submitted", "pr_url": pr_data.get("html_url", ""), "pr_number": pr_data.get("number")}

    def format_pr_body(self, bounty: Bounty, plan: Plan, review: ReviewResult, test_results: dict) -> str:
        """Format a PR body with bounty details, plan, and review results."""
        test_status = "✅ Passed" if test_results.get("passed") else "❌ Failed"
        steps_text = "\n".join(f"- {s.description}" for s in plan.steps)

        return f"""## Bounty #{bounty.number}: {bounty.title}

**Tier:** {bounty.tier} | **Reward:** {bounty.reward}

### Implementation Summary
{plan.summary}

### Approach
{plan.approach}

### Changes
{steps_text}

### Testing
{test_status}

### Review
{"✅ Passed" if review.passed else "⚠️ Issues found"}
{chr(10).join(f"- Issue: {i}" for i in review.issues) if review.issues else ""}

---
Closes #{bounty.number}"""

    def get_git_diff(self, repo_path: str) -> str:
        """Get the git diff of staged changes."""
        try:
            result = subprocess.run(
                ["git", "diff", "--staged"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.stdout[-4000:] if result.stdout else ""
        except Exception as e:
            return f"Error getting diff: {e}"