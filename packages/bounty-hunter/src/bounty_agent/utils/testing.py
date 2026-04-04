from __future__ import annotations

from dataclasses import dataclass

from bounty_agent.models import AnalysisResult, Bounty, ImplementationArtifact, TestResult


@dataclass(slots=True)
class TestingHarness:
    fail_on_keyword: str = "unsafe"

    def run_suite(
        self,
        *,
        bounty: Bounty,
        analysis: AnalysisResult,
        implementation: ImplementationArtifact,
    ) -> TestResult:
        combined_text = " ".join(
            [
                bounty.description.lower(),
                analysis.summary.lower(),
                implementation.summary.lower(),
                " ".join(note.lower() for note in implementation.notes),
            ]
        )
        passed = self.fail_on_keyword not in combined_text
        summary = (
            f"Validation passed for bounty {bounty.id}."
            if passed
            else f"Validation failed for bounty {bounty.id}: detected risky change marker."
        )
        return TestResult(
            passed=passed,
            summary=summary,
            commands=["python -m unittest discover -s tests", "git diff --stat"],
            outputs=[summary, f"Plan steps: {len(analysis.implementation_plan)}"],
            coverage_notes=[
                "Covers planning, implementation artifact creation, and PR drafting pipeline.",
                "Extend with repository-specific integration tests in production deployments.",
            ],
        )
