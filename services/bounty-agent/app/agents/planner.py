"""Planner Agent — Analyzes bounties and creates implementation plans."""
import json
import httpx
from dataclasses import dataclass, field

from app.config import config
from app.agents.discovery import Bounty


@dataclass
class TaskStep:
    """A single step in the implementation plan."""
    step: int
    action: str  # create, modify, delete
    target: str  # file path
    description: str
    details: str = ""


@dataclass
class Plan:
    """Implementation plan for a bounty."""
    bounty: Bounty
    summary: str
    approach: str
    steps: list[TaskStep] = field(default_factory=list)
    test_strategy: str = ""
    estimated_files: int = 0


class PlannerAgent:
    """Analyzes bounty requirements and creates implementation plans using LLM."""

    SYSTEM_PROMPT = """You are an expert software planner. Given a bounty description from a GitHub issue, 
create a detailed implementation plan. Your output MUST be valid JSON matching this schema:

{
  "summary": "Brief description of what will be implemented",
  "approach": "Technical approach and key design decisions",
  "steps": [
    {
      "step": 1,
      "action": "create|modify|delete",
      "target": "path/to/file",
      "description": "What this step does",
      "details": "Implementation details"
    }
  ],
  "test_strategy": "How to test the implementation",
  "estimated_files": 5
}

Be specific about file paths and implementation details. Focus on minimal, clean implementations 
that satisfy the acceptance criteria exactly."""

    def __init__(self, model: str | None = None, base_url: str | None = None):
        self.model = model or config.LLM_MODEL
        self.base_url = base_url or config.LLM_BASE_URL

    async def plan(self, bounty: Bounty, repo_context: str = "") -> Plan:
        """Generate an implementation plan for a bounty."""
        prompt = f"""## Bounty #{bounty.number}: {bounty.title}

**Repo:** {bounty.repo}
**Tier:** {bounty.tier}
**Reward:** {bounty.reward}

### Description:
{bounty.body}

### Repository Context:
{repo_context or 'No additional context available.'}

Create a detailed implementation plan as valid JSON."""

        response = await self._call_llm(prompt)
        return self._parse_plan(bounty, response)

    async def _call_llm(self, prompt: str) -> str:
        """Call the LLM API."""
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    def _parse_plan(self, bounty: Bounty, raw: str) -> Plan:
        """Parse LLM response into a Plan object."""
        try:
            # Strip markdown code blocks if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("```", 1)[0]
            data = json.loads(cleaned)
        except (json.JSONDecodeError, IndexError):
            return Plan(
                bounty=bounty,
                summary="Failed to parse LLM plan",
                approach=raw[:500],
            )

        steps = [
            TaskStep(
                step=s.get("step", i + 1),
                action=s.get("action", "create"),
                target=s.get("target", ""),
                description=s.get("description", ""),
                details=s.get("details", ""),
            )
            for i, s in enumerate(data.get("steps", []))
        ]

        return Plan(
            bounty=bounty,
            summary=data.get("summary", ""),
            approach=data.get("approach", ""),
            steps=steps,
            test_strategy=data.get("test_strategy", ""),
            estimated_files=data.get("estimated_files", 0),
        )