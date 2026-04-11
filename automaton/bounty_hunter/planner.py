"""
Planning module for the Bounty Hunter Agent.
Uses an LLM to analyze bounties and generate implementation plans.
"""

import os
import json
import urllib.request
from dataclasses import dataclass
from typing import Optional


@dataclass
class ImplementationStep:
    """A single step in the implementation plan."""
    order: int
    description: str
    files_to_modify: list[str]
    files_to_create: list[str]
    notes: str = ""


@dataclass
class ImplementationPlan:
    """A complete implementation plan for a bounty."""
    bounty_number: int
    title: str
    summary: str
    steps: list[ImplementationStep]
    tech_stack: list[str]
    estimated_complexity: str  # "low", "medium", "high"
    testing_approach: str


class Planner:
    """
    LLM-powered planning module.
    Uses GPT-4 or compatible API to generate implementation plans.
    """

    def __init__(
        self,
        model: str = "gpt-4",
        api_key: str = None,
        api_base: str = None
    ):
        self.model = model or os.environ.get("LLM_MODEL", "gpt-4")
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.api_base = api_base or os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1")

    def _call_llm(self, messages: list[dict], temperature: float = 0.3) -> str:
        """Make an LLM API call."""
        if not self.api_key:
            # Fallback to a simple heuristic planner if no API key
            return self._fallback_plan(messages)

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        
        req = urllib.request.Request(
            f"{self.api_base.rstrip('/')}/chat/completions",
            data=json.dumps(payload).encode(),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
            return result["choices"][0]["message"]["content"]

    def _fallback_plan(self, messages: list[dict]) -> str:
        """
        Fallback planner when no LLM API key is available.
        Uses the issue body and title to create a basic plan.
        """
        # Extract the last user message (the planning request)
        user_msg = messages[-1]["content"] if messages else ""
        return json.dumps({
            "summary": "Basic implementation plan generated (no LLM API key)",
            "steps": [
                {"order": 1, "description": "Analyze codebase structure", "files_to_modify": [], "files_to_create": []},
                {"order": 2, "description": "Implement core functionality", "files_to_modify": [], "files_to_create": []},
                {"order": 3, "description": "Add tests", "files_to_modify": [], "files_to_create": []},
            ],
            "tech_stack": ["python"],
            "estimated_complexity": "medium",
            "testing_approach": "Unit tests with pytest"
        })

    def create_plan(
        self,
        bounty_body: str,
        bounty_title: str,
        bounty_number: int,
        codebase_structure: str = None,
        relevant_files: dict[str, str] = None
    ) -> ImplementationPlan:
        """
        Create an implementation plan for a bounty.
        
        Args:
            bounty_body: The full body/description of the bounty issue
            bounty_title: The title of the bounty issue  
            bounty_number: The GitHub issue number
            codebase_structure: Optional overview of the codebase
            relevant_files: Optional dict of {filepath: content} for context files
        """
        
        context_parts = [f"## Bounty Issue #{bounty_number}: {bounty_title}\n\n{bounty_body}"]
        
        if codebase_structure:
            context_parts.append(f"\n## Codebase Structure:\n{codebase_structure}")
        
        if relevant_files:
            context_parts.append("\n## Relevant Code Files:")
            for path, content in list(relevant_files.items())[:5]:  # Limit to 5 files
                context_parts.append(f"\n### {path}:\n```\n{content[:2000]}\n```")
        
        planning_prompt = f"""
You are a senior software engineer planning an implementation for a GitHub bounty issue.

Analyze the bounty requirements and create a detailed implementation plan.

{chr(10).join(context_parts)}

Generate a JSON implementation plan with this exact structure:
{{
  "summary": "Brief summary of what will be built (1-2 sentences)",
  "steps": [
    {{
      "order": 1,
      "description": "What this step does",
      "files_to_modify": ["path/to/file1.py", "path/to/file2.ts"],
      "files_to_create": ["path/to/new_file.py"],
      "notes": "Any important considerations"
    }}
  ],
  "tech_stack": ["python", "fastapi", "react"],
  "estimated_complexity": "low|medium|high",
  "testing_approach": "How to test this feature"
}}

Respond ONLY with valid JSON. No markdown, no explanation.
"""

        messages = [
            {"role": "system", "content": "You are an expert software architect. Create clear, actionable implementation plans in JSON format."},
            {"role": "user", "content": planning_prompt}
        ]

        try:
            response = self._call_llm(messages)
            # Extract JSON from response
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                plan_data = json.loads(response[json_start:json_end])
            else:
                plan_data = json.loads(response)
        except Exception as e:
            # Fallback
            plan_data = json.loads(self._fallback_plan(messages))

        steps = [
            ImplementationStep(
                order=s["order"],
                description=s["description"],
                files_to_modify=s.get("files_to_modify", []),
                files_to_create=s.get("files_to_create", []),
                notes=s.get("notes", "")
            )
            for s in plan_data.get("steps", [])
        ]

        return ImplementationPlan(
            bounty_number=bounty_number,
            title=bounty_title,
            summary=plan_data.get("summary", ""),
            steps=steps,
            tech_stack=plan_data.get("tech_stack", []),
            estimated_complexity=plan_data.get("estimated_complexity", "medium"),
            testing_approach=plan_data.get("testing_approach", "Unit tests")
        )

    def generate_code(
        self,
        plan: ImplementationPlan,
        codebase_context: str,
        step: ImplementationStep
    ) -> dict[str, str]:
        """
        Generate code for a specific implementation step.
        Returns dict of {filepath: code_content}.
        """
        prompt = f"""
You are implementing step {step.order} of a bounty hunter agent.

## Plan Summary
{plan.summary}

## Current Step
{step.description}

Files to modify: {step.files_to_modify}
Files to create: {step.files_to_create}
Notes: {step.notes}

## Codebase Context
{codebase_context[:8000]}

Generate the code for this step. Output as JSON dict:
{{"filepath1": "full file content", "filepath2": "full file content"}}

Use proper language syntax. Include docstrings. Write complete, production-ready code.
Respond ONLY with valid JSON.
"""
        
        messages = [
            {"role": "system", "content": "You are an expert coder. Output ONLY valid JSON mapping file paths to their full code content."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self._call_llm(messages, temperature=0.4)
            json_start = response.find("{")
            json_end = response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                return json.loads(response[json_start:json_end])
            return json.loads(response)
        except Exception:
            return {}
