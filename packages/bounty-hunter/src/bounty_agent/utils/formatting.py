from __future__ import annotations

import re

from bounty_agent.models import AnalysisResult, Bounty, ImplementationArtifact, TestResult


def sanitize_branch_name(value: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9/_-]+", "-", value.strip().lower())
    sanitized = re.sub(r"-{2,}", "-", sanitized)
    return sanitized.strip("-")


def format_pr_body(
    *,
    bounty: Bounty,
    analysis: AnalysisResult,
    implementation: ImplementationArtifact,
    testing: TestResult,
    checklist: list[str],
) -> str:
    requirements = "\n".join(f"- {item}" for item in analysis.requirements)
    risks = "\n".join(f"- {item}" for item in analysis.risks)
    notes = "\n".join(f"- {item}" for item in implementation.notes)
    checks = "\n".join(f"- [x] {item}" for item in checklist)
    return f"""## Summary
Autonomous bounty workflow for `{bounty.title}`.

## Requirements
{requirements}

## Implementation
{implementation.summary}

## Validation
{testing.summary}

## Risks
{risks}

## Notes
{notes}

## Checklist
{checks}
"""
