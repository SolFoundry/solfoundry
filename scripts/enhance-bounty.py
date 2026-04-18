#!/usr/bin/env python3
"""AI Bounty Description Enhancer — Analyze and improve bounty descriptions.

Uses multi-LLM analysis to transform vague bounty descriptions into clear,
actionable specifications with explicit acceptance criteria, examples, and
structured requirements.

Usage:
    # Enhance a bounty from a GitHub issue URL
    python3 scripts/enhance-bounty.py --issue https://github.com/org/repo/issues/123

    # Enhance from a raw description file
    python3 scripts/enhance-bounty.py --file bounty-draft.txt

    # Enhance from stdin
    echo "Build a dashboard for tracking bounties" | python3 scripts/enhance-bounty.py --stdin

    # Output as JSON (for programmatic consumption)
    python3 scripts/enhance-bounty.py --issue URL --json

    # Dry-run: show the enhanced version without saving
    python3 scripts/enhance-bounty.py --file draft.txt --dry-run

    # Generate a diff against an existing issue body
    python3 scripts/enhance-bounty.py --issue URL --diff

Exit codes:
    0 — enhancement generated successfully
    1 — LLM analysis or processing error
    2 — input error (missing file, bad URL, etc.)

Environment variables:
    OPENAI_API_KEY       — OpenAI API key (or compatible provider)
    OPENAI_BASE_URL      — Base URL for OpenAI-compatible API (default: https://api.openai.com/v1)
    ANTHROPIC_API_KEY    — Anthropic API key for Claude models
    GITHUB_TOKEN         — GitHub PAT for fetching issue content

Multiple providers can be configured simultaneously. The tool queries all
available providers in parallel and merges their suggestions using a
consensus-based scoring system.
"""

import argparse
import json
import os
import sys
import re
import textwrap
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class Severity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"

@dataclass
class IssueFinding:
    """A single issue found in the original description."""
    severity: Severity
    category: str  # e.g. "missing_criteria", "vague_language", "no_examples"
    message: str
    suggestion: Optional[str] = None

@dataclass
class EnhancedSection:
    """An enhanced section of the bounty description."""
    original: str
    enhanced: str
    changes: list[str] = field(default_factory=list)

@dataclass
class EnhancementResult:
    """Complete result of bounty description enhancement."""
    original_title: str
    original_description: str
    enhanced_title: str
    enhanced_description: str
    findings: list[IssueFinding] = field(default_factory=list)
    sections: dict[str, EnhancedSection] = field(default_factory=dict)
    confidence_score: float = 0.0  # 0-1, consensus among LLMs
    providers_used: list[str] = field(default_factory=list)
    raw_responses: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        # Convert enums to strings
        for f in d.get("findings", []):
            if isinstance(f.get("severity"), Severity):
                f["severity"] = f["severity"].value
        return d

# ---------------------------------------------------------------------------
# LLM Provider abstraction
# ---------------------------------------------------------------------------

class LLMProvider:
    """Base class for LLM providers."""

    def __init__(self, name: str, api_key: str, base_url: str, model: str):
        self.name = name
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    def enhance(self, title: str, description: str) -> str:
        """Send bounty description for enhancement. Returns raw text response."""
        raise NotImplementedError


class OpenAICompatibleProvider(LLMProvider):
    """Provider for OpenAI-compatible APIs (OpenAI, MiMo, local models, etc.)."""

    def enhance(self, title: str, description: str) -> str:
        import urllib.request

        prompt = _build_enhancement_prompt(title, description)
        url = f"{self.base_url}/chat/completions"

        payload = json.dumps({
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 4096,
        }).encode()

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
        )

        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())

        return data["choices"][0]["message"]["content"]


class AnthropicProvider(LLMProvider):
    """Provider for Anthropic Claude API."""

    def enhance(self, title: str, description: str) -> str:
        import urllib.request

        prompt = _build_enhancement_prompt(title, description)
        url = f"{self.base_url}/v1/messages"

        payload = json.dumps({
            "model": self.model,
            "max_tokens": 4096,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
        }).encode()

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
            },
        )

        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())

        return data["content"][0]["text"]


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = textwrap.dedent("""\
You are a senior technical project manager and open-source bounty curator.
Your job is to transform vague bounty descriptions into crystal-clear,
actionable specifications that any competent developer can pick up and execute.

You analyze bounty descriptions for:
1. Missing acceptance criteria
2. Vague or ambiguous language
3. Missing technical specifications
4. No examples or references
5. Unclear scope boundaries
6. Missing deliverable definitions

You MUST respond in valid JSON with this exact structure:
{
  "findings": [
    {
      "severity": "error|warning|info",
      "category": "missing_criteria|vague_language|no_examples|unclear_scope|missing_specs",
      "message": "Description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "enhanced_title": "Improved, specific title",
  "enhanced_description": "Full enhanced description in Markdown",
  "sections": {
    "overview": {"original": "...", "enhanced": "...", "changes": ["..."]},
    "acceptance_criteria": {"original": "...", "enhanced": "...", "changes": ["..."]},
    "technical_specs": {"original": "...", "enhanced": "...", "changes": ["..."]},
    "examples": {"original": "...", "enhanced": "...", "changes": ["..."]},
    "scope": {"original": "...", "enhanced": "...", "changes": ["..."]}
  },
  "confidence": 0.0-1.0
}

Rules:
- Be specific, not generic
- Add concrete acceptance criteria as a checklist
- Include example inputs/outputs where relevant
- Define clear scope boundaries (what's IN and what's OUT)
- Specify technical requirements (languages, frameworks, APIs)
- Keep the original intent — don't change the bounty's goal
- Use bullet points and numbered lists for clarity
- The enhanced description must be production-ready Markdown
""")


def _build_enhancement_prompt(title: str, description: str) -> str:
    return textwrap.dedent(f"""\
Please analyze and enhance this bounty description:

## Original Title
{title}

## Original Description
{description}

---

Analyze the description for issues, then produce an enhanced version with:
1. Clear acceptance criteria (checklist format)
2. Specific technical requirements
3. Concrete examples
4. Defined scope boundaries
5. Deliverable specifications

Respond ONLY with the JSON structure specified in your system prompt.
""")


# ---------------------------------------------------------------------------
# GitHub integration
# ---------------------------------------------------------------------------

def fetch_github_issue(url: str, token: Optional[str] = None) -> tuple[str, str]:
    """Fetch issue title and body from a GitHub issue URL.

    Args:
        url: GitHub issue URL (e.g., https://github.com/org/repo/issues/123)
        token: Optional GitHub PAT for private repos / higher rate limits.

    Returns:
        Tuple of (title, body).

    Raises:
        ValueError: If URL is not a valid GitHub issue URL.
        urllib.error.HTTPError: If the API request fails.
    """
    import urllib.request

    # Parse owner/repo/issue_number from URL
    match = re.match(
        r"https?://github\.com/([^/]+)/([^/]+)/issues/(\d+)", url
    )
    if not match:
        raise ValueError(f"Invalid GitHub issue URL: {url}")

    owner, repo, issue_num = match.groups()
    api_url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_num}"

    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "SolFoundry-BountyEnhancer/1.0",
    }
    if token:
        headers["Authorization"] = f"token {token}"

    req = urllib.request.Request(api_url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())

    return data["title"], data["body"] or ""


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def detect_providers() -> list[LLMProvider]:
    """Auto-detect available LLM providers from environment variables."""
    providers = []

    # OpenAI-compatible (covers OpenAI, MiMo, Azure OpenAI, local models, etc.)
    openai_key = os.environ.get("OPENAI_API_KEY") or os.environ.get("XIAOMI_API_KEY")
    if openai_key:
        base_url = (
            os.environ.get("OPENAI_BASE_URL")
            or os.environ.get("XIAOMI_BASE_URL")
            or "https://api.openai.com/v1"
        )
        model = os.environ.get("ENHANCER_MODEL", "gpt-4o-mini")
        providers.append(OpenAICompatibleProvider(
            name="openai-compatible",
            api_key=openai_key,
            base_url=base_url,
            model=model,
        ))

    # Anthropic
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if anthropic_key:
        providers.append(AnthropicProvider(
            name="anthropic",
            api_key=anthropic_key,
            base_url="https://api.anthropic.com",
            model="claude-sonnet-4-20250514",
        ))

    return providers


def parse_llm_response(raw: str) -> dict:
    """Extract JSON from an LLM response, handling markdown fences."""
    text = raw.strip()
    # Try to find JSON block inside code fences first
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    # Also strip leading/trailing fences if still present
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\s*\n?```$", "", text)
    return json.loads(text.strip())


def merge_results(results: list[dict]) -> dict:
    """Merge results from multiple LLM providers using consensus.

    Takes the most common enhanced_description (or longest if no consensus),
    aggregates all findings, and computes a confidence score.
    """
    if not results:
        return {}

    if len(results) == 1:
        return results[0]

    # Aggregate findings (deduplicate by category + message)
    all_findings = {}
    for r in results:
        for f in r.get("findings", []):
            key = (f.get("category", ""), f.get("message", ""))
            if key not in all_findings:
                all_findings[key] = f

    # Use the longest enhanced description (usually the most detailed)
    best = max(results, key=lambda r: len(r.get("enhanced_description", "")))

    # Compute confidence as agreement ratio
    enhanced_texts = [r.get("enhanced_description", "") for r in results]
    # Simple heuristic: if all are similar length, high confidence
    if enhanced_texts:
        avg_len = sum(len(t) for t in enhanced_texts) / len(enhanced_texts)
        variance = sum((len(t) - avg_len) ** 2 for t in enhanced_texts) / len(enhanced_texts)
        # Normalize variance to 0-1 confidence
        confidence = max(0.0, 1.0 - (variance / (avg_len ** 2 + 1)))
    else:
        confidence = 0.0

    best["findings"] = list(all_findings.values())
    best["confidence"] = round(confidence, 2)

    return best


def enhance_bounty(
    title: str,
    description: str,
    providers: Optional[list[LLMProvider]] = None,
) -> EnhancementResult:
    """Run multi-LLM enhancement on a bounty description.

    Args:
        title: Original bounty title.
        description: Original bounty description.
        providers: List of LLM providers to use. Auto-detected if None.

    Returns:
        EnhancementResult with enhanced description and analysis.
    """
    if providers is None:
        providers = detect_providers()

    if not providers:
        raise RuntimeError(
            "No LLM providers configured. Set OPENAI_API_KEY, XIAOMI_API_KEY, "
            "or ANTHROPIC_API_KEY environment variable."
        )

    # Run providers in parallel
    raw_results = {}
    parsed_results = []

    with ThreadPoolExecutor(max_workers=len(providers)) as executor:
        futures = {
            executor.submit(p.enhance, title, description): p.name
            for p in providers
        }
        for future in as_completed(futures):
            provider_name = futures[future]
            try:
                raw = future.result()
                raw_results[provider_name] = raw
                parsed = parse_llm_response(raw)
                parsed_results.append(parsed)
            except Exception as e:
                raw_results[provider_name] = f"ERROR: {e}"

    if not parsed_results:
        raise RuntimeError("All LLM providers failed. Check raw_responses for details.")

    # Merge results
    merged = merge_results(parsed_results)

    # Build result
    findings = []
    for f in merged.get("findings", []):
        findings.append(IssueFinding(
            severity=Severity(f.get("severity", "info")),
            category=f.get("category", "unknown"),
            message=f.get("message", ""),
            suggestion=f.get("suggestion"),
        ))

    sections = {}
    for name, sec in merged.get("sections", {}).items():
        sections[name] = EnhancedSection(
            original=sec.get("original", ""),
            enhanced=sec.get("enhanced", ""),
            changes=sec.get("changes", []),
        )

    return EnhancementResult(
        original_title=title,
        original_description=description,
        enhanced_title=merged.get("enhanced_title", title),
        enhanced_description=merged.get("enhanced_description", description),
        findings=findings,
        sections=sections,
        confidence_score=merged.get("confidence", 0.0),
        providers_used=list(raw_results.keys()),
        raw_responses=raw_results,
    )


# ---------------------------------------------------------------------------
# Output formatters
# ---------------------------------------------------------------------------

def format_terminal(result: EnhancementResult, show_diff: bool = False) -> str:
    """Format result for terminal output."""
    lines = []
    lines.append("=" * 70)
    lines.append("  AI BOUNTY DESCRIPTION ENHANCER — RESULTS")
    lines.append("=" * 70)
    lines.append("")

    # Summary
    error_count = sum(1 for f in result.findings if f.severity == Severity.ERROR)
    warn_count = sum(1 for f in result.findings if f.severity == Severity.WARNING)
    lines.append(f"  Providers: {', '.join(result.providers_used)}")
    lines.append(f"  Confidence: {result.confidence_score:.0%}")
    lines.append(f"  Findings: {error_count} errors, {warn_count} warnings")
    lines.append("")

    # Findings
    if result.findings:
        lines.append("-" * 70)
        lines.append("  FINDINGS")
        lines.append("-" * 70)
        for f in result.findings:
            icon = {"error": "✗", "warning": "⚠", "info": "ℹ"}.get(f.severity.value, "?")
            lines.append(f"  {icon} [{f.category}] {f.message}")
            if f.suggestion:
                lines.append(f"    → {f.suggestion}")
        lines.append("")

    # Enhanced title
    lines.append("-" * 70)
    lines.append("  ENHANCED TITLE")
    lines.append("-" * 70)
    lines.append(f"  {result.enhanced_title}")
    lines.append("")

    # Enhanced description
    lines.append("-" * 70)
    lines.append("  ENHANCED DESCRIPTION")
    lines.append("-" * 70)
    for line in result.enhanced_description.split("\n"):
        lines.append(f"  {line}")
    lines.append("")

    # Section changes
    if result.sections:
        lines.append("-" * 70)
        lines.append("  SECTION CHANGES")
        lines.append("-" * 70)
        for name, sec in result.sections.items():
            if sec.changes:
                lines.append(f"  [{name}]")
                for change in sec.changes:
                    lines.append(f"    • {change}")
        lines.append("")

    lines.append("=" * 70)
    return "\n".join(lines)


def format_diff(result: EnhancementResult) -> str:
    """Format as a unified diff between original and enhanced."""
    lines = []
    lines.append(f"--- original: {result.original_title}")
    lines.append(f"+++ enhanced: {result.enhanced_title}")
    lines.append("")

    orig_lines = result.original_description.split("\n")
    enh_lines = result.enhanced_description.split("\n")

    # Simple line-by-line diff (not a real unified diff, but readable)
    max_len = max(len(orig_lines), len(enh_lines))
    for i in range(max_len):
        orig = orig_lines[i] if i < len(orig_lines) else ""
        enh = enh_lines[i] if i < len(enh_lines) else ""
        if orig != enh:
            if orig:
                lines.append(f"- {orig}")
            if enh:
                lines.append(f"+ {enh}")
        else:
            lines.append(f"  {orig}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="AI Bounty Description Enhancer — Analyze and improve bounty descriptions.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              %(prog)s --issue https://github.com/org/repo/issues/123
              %(prog)s --file bounty-draft.txt
              echo "Build a dashboard" | %(prog)s --stdin
              %(prog)s --issue URL --json
              %(prog)s --file draft.txt --diff

            Environment variables:
              OPENAI_API_KEY      OpenAI-compatible API key
              OPENAI_BASE_URL     API base URL (default: https://api.openai.com/v1)
              ANTHROPIC_API_KEY   Anthropic API key
              GITHUB_TOKEN        GitHub PAT for fetching issues
              ENHANCER_MODEL      Model name (default: gpt-4o-mini)
        """),
    )

    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--issue", type=str, metavar="URL",
        help="GitHub issue URL to enhance",
    )
    input_group.add_argument(
        "--file", type=str, metavar="PATH",
        help="File containing bounty description to enhance",
    )
    input_group.add_argument(
        "--stdin", action="store_true",
        help="Read bounty description from stdin",
    )

    parser.add_argument(
        "--json", action="store_true", dest="json_output",
        help="Output as JSON",
    )
    parser.add_argument(
        "--diff", action="store_true",
        help="Show diff between original and enhanced",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Don't write any files, just print output",
    )
    parser.add_argument(
        "--output", type=str, metavar="PATH",
        help="Write enhanced description to file",
    )
    parser.add_argument(
        "--title", type=str, default="Untitled Bounty",
        help="Title for stdin/file input (default: 'Untitled Bounty')",
    )

    args = parser.parse_args()

    # --- Get input ---
    title = args.title
    description = ""

    try:
        if args.issue:
            token = os.environ.get("GITHUB_TOKEN")
            title, description = fetch_github_issue(args.issue, token)
        elif args.file:
            path = Path(args.file)
            if not path.exists():
                print(f"Error: File not found: {args.file}", file=sys.stderr)
                return 2
            description = path.read_text()
        elif args.stdin:
            description = sys.stdin.read()
    except Exception as e:
        print(f"Error reading input: {e}", file=sys.stderr)
        return 2

    if not description.strip():
        print("Error: Empty bounty description.", file=sys.stderr)
        return 2

    # --- Run enhancement ---
    try:
        result = enhance_bounty(title, description)
    except Exception as e:
        print(f"Error during enhancement: {e}", file=sys.stderr)
        return 1

    # --- Output ---
    if args.json_output:
        print(json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    elif args.diff:
        print(format_diff(result))
    else:
        print(format_terminal(result))

    # --- Save to file ---
    if args.output and not args.dry_run:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(result.enhanced_description)
        print(f"\nEnhanced description saved to: {out_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
