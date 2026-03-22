"""Terminal output formatting for the SolFoundry CLI.

Provides colored table rendering and JSON output for bounty data.
Uses ANSI escape codes for terminal colors with graceful fallback
when running in non-TTY environments or on Windows without ANSI support.

Color scheme follows the SolFoundry brand:
- Purple (#9945FF) for headers and emphasis.
- Green (#14F195) for success and open status.
- Yellow for warnings and in-progress status.
- Red for errors and closed/paid status.
"""

import json
import os
import sys
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence

# ---------------------------------------------------------------------------
# ANSI color codes
# ---------------------------------------------------------------------------

_NO_COLOR = os.getenv("NO_COLOR") is not None or not sys.stdout.isatty()


def _ansi(code: str) -> str:
    """Return an ANSI escape sequence, or empty string when color is disabled.

    Args:
        code: ANSI code without the escape prefix.

    Returns:
        str: The full escape sequence or empty string.
    """
    if _NO_COLOR:
        return ""
    return f"\033[{code}m"


# Named styles
BOLD = _ansi("1")
DIM = _ansi("2")
RESET = _ansi("0")
GREEN = _ansi("32")
YELLOW = _ansi("33")
RED = _ansi("31")
CYAN = _ansi("36")
MAGENTA = _ansi("35")
WHITE = _ansi("37")


# ---------------------------------------------------------------------------
# Status color mapping
# ---------------------------------------------------------------------------

_STATUS_COLORS: Dict[str, str] = {
    "open": GREEN,
    "in_progress": YELLOW,
    "completed": CYAN,
    "paid": RED,
}


def colorize_status(status: str) -> str:
    """Return the status string wrapped in the appropriate ANSI color.

    Args:
        status: Bounty status value (open, in_progress, completed, paid).

    Returns:
        str: Colored status string.
    """
    color = _STATUS_COLORS.get(status, WHITE)
    return f"{color}{status}{RESET}"


# ---------------------------------------------------------------------------
# Tier formatting
# ---------------------------------------------------------------------------

_TIER_LABELS: Dict[int, str] = {
    1: f"{GREEN}T1{RESET}",
    2: f"{YELLOW}T2{RESET}",
    3: f"{RED}T3{RESET}",
}


def format_tier(tier: int) -> str:
    """Return a colored tier label.

    Args:
        tier: Tier number (1, 2, or 3).

    Returns:
        str: Colored tier label like ``T1``, ``T2``, or ``T3``.
    """
    return _TIER_LABELS.get(tier, f"T{tier}")


# ---------------------------------------------------------------------------
# Reward formatting
# ---------------------------------------------------------------------------


def format_reward(amount: float) -> str:
    """Format a reward amount with thousands separators and $FNDRY suffix.

    Args:
        amount: The reward amount as a float.

    Returns:
        str: Formatted string like ``500,000 $FNDRY``.
    """
    # Use Decimal for exact representation
    decimal_amount = Decimal(str(amount))
    if decimal_amount == decimal_amount.to_integral_value():
        formatted = f"{int(decimal_amount):,}"
    else:
        formatted = f"{decimal_amount:,.2f}"
    return f"{BOLD}{formatted} $FNDRY{RESET}"


# ---------------------------------------------------------------------------
# Date formatting
# ---------------------------------------------------------------------------


def format_datetime(iso_string: Optional[str]) -> str:
    """Format an ISO datetime string for terminal display.

    Args:
        iso_string: ISO-8601 datetime string, or ``None``.

    Returns:
        str: Human-friendly datetime or ``-`` if input is ``None``.
    """
    if not iso_string:
        return f"{DIM}-{RESET}"
    try:
        parsed = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
        return parsed.strftime("%Y-%m-%d %H:%M")
    except (ValueError, AttributeError):
        return iso_string


# ---------------------------------------------------------------------------
# Table rendering
# ---------------------------------------------------------------------------


def _truncate(text: str, max_width: int) -> str:
    """Truncate text to a maximum width, appending ellipsis if needed.

    Args:
        text: The text to truncate.
        max_width: Maximum character width.

    Returns:
        str: Truncated text.
    """
    if len(text) <= max_width:
        return text
    return text[: max_width - 1] + "\u2026"


def render_bounty_table(bounties: List[Dict[str, Any]]) -> str:
    """Render a list of bounties as a formatted terminal table.

    Columns: ID (short), Title, Tier, Reward, Status, Skills, Deadline.

    Args:
        bounties: List of bounty dictionaries from the API.

    Returns:
        str: Multi-line table string ready for printing.
    """
    if not bounties:
        return f"{DIM}No bounties found.{RESET}"

    # Build rows
    rows: List[List[str]] = []
    for bounty in bounties:
        bounty_id = bounty.get("id", "")[:8]
        title = _truncate(bounty.get("title", ""), 40)
        tier = bounty.get("tier", 0)
        reward = bounty.get("reward_amount", 0)
        status = bounty.get("status", "")
        skills = ", ".join(bounty.get("required_skills", [])[:3])
        if len(bounty.get("required_skills", [])) > 3:
            skills += "..."
        deadline = format_datetime(bounty.get("deadline"))
        subs = str(bounty.get("submission_count", 0))

        rows.append([bounty_id, title, str(tier), str(reward), status, skills, deadline, subs])

    # Headers
    headers = ["ID", "Title", "Tier", "Reward", "Status", "Skills", "Deadline", "Subs"]

    # Calculate column widths
    col_widths = [len(h) for h in headers]
    for row in rows:
        for idx, cell in enumerate(row):
            col_widths[idx] = max(col_widths[idx], len(cell))

    # Build formatted output
    lines: List[str] = []

    # Header line
    header_parts = []
    for idx, header in enumerate(headers):
        header_parts.append(f"{BOLD}{MAGENTA}{header:<{col_widths[idx]}}{RESET}")
    lines.append("  ".join(header_parts))

    # Separator
    sep_parts = ["\u2500" * w for w in col_widths]
    lines.append(f"{DIM}{'  '.join(sep_parts)}{RESET}")

    # Data rows
    for row in rows:
        parts = []
        for idx, cell in enumerate(row):
            if idx == 2:  # Tier column
                parts.append(f"{format_tier(int(cell)):<{col_widths[idx] + len(format_tier(int(cell))) - len(cell)}}")
            elif idx == 3:  # Reward column
                parts.append(f"{format_reward(float(cell))}")
            elif idx == 4:  # Status column
                parts.append(f"{colorize_status(cell):<{col_widths[idx] + len(colorize_status(cell)) - len(cell)}}")
            else:
                parts.append(f"{cell:<{col_widths[idx]}}")
        lines.append("  ".join(parts))

    return "\n".join(lines)


def render_bounty_detail(bounty: Dict[str, Any]) -> str:
    """Render a single bounty as a detailed view.

    Args:
        bounty: Full bounty dictionary from the API.

    Returns:
        str: Multi-line detail string ready for printing.
    """
    lines: List[str] = []
    lines.append(f"{BOLD}{MAGENTA}{'=' * 60}{RESET}")
    lines.append(f"{BOLD}Bounty: {bounty.get('title', 'Unknown')}{RESET}")
    lines.append(f"{MAGENTA}{'=' * 60}{RESET}")
    lines.append("")
    lines.append(f"  {BOLD}ID:{RESET}          {bounty.get('id', '')}")
    lines.append(f"  {BOLD}Tier:{RESET}        {format_tier(bounty.get('tier', 0))}")
    lines.append(f"  {BOLD}Reward:{RESET}      {format_reward(bounty.get('reward_amount', 0))}")
    lines.append(f"  {BOLD}Status:{RESET}      {colorize_status(bounty.get('status', ''))}")
    lines.append(f"  {BOLD}Created by:{RESET}  {bounty.get('created_by', '')}")
    lines.append(f"  {BOLD}Created:{RESET}     {format_datetime(bounty.get('created_at'))}")
    lines.append(f"  {BOLD}Updated:{RESET}     {format_datetime(bounty.get('updated_at'))}")
    lines.append(f"  {BOLD}Deadline:{RESET}    {format_datetime(bounty.get('deadline'))}")

    skills = bounty.get("required_skills", [])
    if skills:
        lines.append(f"  {BOLD}Skills:{RESET}      {', '.join(skills)}")

    github_url = bounty.get("github_issue_url")
    if github_url:
        lines.append(f"  {BOLD}GitHub:{RESET}      {github_url}")

    description = bounty.get("description", "")
    if description:
        lines.append("")
        lines.append(f"  {BOLD}Description:{RESET}")
        # Word-wrap description at 60 chars
        for line in description.split("\n"):
            lines.append(f"    {line}")

    submissions = bounty.get("submissions", [])
    sub_count = bounty.get("submission_count", len(submissions))
    lines.append("")
    lines.append(f"  {BOLD}Submissions:{RESET} {sub_count}")

    if submissions:
        for sub in submissions:
            sub_id = sub.get("id", "")[:8]
            pr_url = sub.get("pr_url", "")
            submitted_by = sub.get("submitted_by", "")
            submitted_at = format_datetime(sub.get("submitted_at"))
            lines.append(f"    {DIM}{sub_id}{RESET}  {pr_url}  by {submitted_by}  {submitted_at}")

    lines.append(f"\n{MAGENTA}{'=' * 60}{RESET}")
    return "\n".join(lines)


def render_submission_detail(submission: Dict[str, Any]) -> str:
    """Render a submission confirmation.

    Args:
        submission: Submission dictionary from the API.

    Returns:
        str: Multi-line submission detail string.
    """
    lines: List[str] = []
    lines.append(f"{GREEN}{BOLD}Submission successful!{RESET}")
    lines.append("")
    lines.append(f"  {BOLD}ID:{RESET}           {submission.get('id', '')}")
    lines.append(f"  {BOLD}Bounty:{RESET}       {submission.get('bounty_id', '')}")
    lines.append(f"  {BOLD}PR:{RESET}           {submission.get('pr_url', '')}")
    lines.append(f"  {BOLD}Submitted by:{RESET} {submission.get('submitted_by', '')}")
    lines.append(f"  {BOLD}Submitted at:{RESET} {format_datetime(submission.get('submitted_at'))}")
    notes = submission.get("notes")
    if notes:
        lines.append(f"  {BOLD}Notes:{RESET}        {notes}")
    return "\n".join(lines)


def render_status_summary(health: Dict[str, Any]) -> str:
    """Render a platform status summary.

    Args:
        health: Health check response from the API.

    Returns:
        str: Multi-line status summary string.
    """
    lines: List[str] = []
    status_value = health.get("status", "unknown")
    status_color = GREEN if status_value == "ok" else RED

    lines.append(f"{BOLD}{MAGENTA}SolFoundry Platform Status{RESET}")
    lines.append(f"{DIM}{'─' * 40}{RESET}")
    lines.append(f"  {BOLD}Status:{RESET}       {status_color}{status_value}{RESET}")
    lines.append(f"  {BOLD}Bounties:{RESET}     {health.get('bounties', 'N/A')}")
    lines.append(f"  {BOLD}Contributors:{RESET} {health.get('contributors', 'N/A')}")
    last_sync = health.get("last_sync")
    lines.append(f"  {BOLD}Last sync:{RESET}    {format_datetime(last_sync)}")
    return "\n".join(lines)


def render_json(data: Any) -> str:
    """Render any data structure as pretty-printed JSON.

    Args:
        data: Any JSON-serializable data.

    Returns:
        str: Indented JSON string.
    """
    return json.dumps(data, indent=2, default=str)
