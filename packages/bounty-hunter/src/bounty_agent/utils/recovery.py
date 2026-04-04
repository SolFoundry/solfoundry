from __future__ import annotations

from bounty_agent.models import ExecutionReport


def build_recovery_plan(report: ExecutionReport) -> list[str]:
    if not report.errors:
        return ["No recovery action required."]

    actions = [
        "Re-run repository inspection and refresh issue constraints.",
        "Narrow the implementation scope to the failing acceptance criterion.",
        "Execute focused regression tests before retrying PR generation.",
    ]
    if report.testing and not report.testing.passed:
        actions.append("Investigate failing validation outputs and update the implementation plan.")
    return actions
