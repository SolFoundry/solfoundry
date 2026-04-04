from __future__ import annotations

from bounty_agent.models import ExecutionReport


def summarize_report(report: ExecutionReport) -> str:
    status = "succeeded" if report.succeeded else "failed"
    return (
        f"Bounty {report.bounty.id} {status} | score={report.score:.2f} | "
        f"selected={report.selected} | errors={len(report.errors)}"
    )


def detailed_report(report: ExecutionReport) -> str:
    lines = [
        summarize_report(report),
        f"Success prediction: {report.analysis.success_prediction:.2f}" if report.analysis else "Success prediction: n/a",
        "Timeline:",
    ]
    lines.extend(
        f"- {task.name}: {task.status.value} ({task.owner.value})"
        for task in report.timeline
    )
    if report.errors:
        lines.append("Recovery:")
        lines.extend(f"- {item}" for item in report.bounty.metadata.get("recovery_plan", []))
    return "\n".join(lines)
