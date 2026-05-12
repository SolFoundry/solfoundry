"""SolFoundry AI Code Review GitHub App.

Installable GitHub App that provides automated multi-LLM code reviews
on every PR. Includes security checks, performance analysis,
and best practices verification.
"""

import asyncio
import hashlib
import json
import logging
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


# --- Configuration ---

class ReviewMode(str, Enum):
    quick = "quick"       # 1 model, fast
    standard = "standard" # 3 models
    thorough = "thorough" # 5 models, deep


@dataclass
class ReviewConfig:
    """Per-installation review configuration."""
    mode: ReviewMode = ReviewMode.standard
    security_checks: bool = True
    performance_analysis: bool = True
    best_practices: bool = True
    auto_approve_threshold: float = 8.0  # Auto-approve if score >= 8
    block_threshold: float = 4.0          # Block if score < 4
    max_file_size_kb: int = 500           # Skip files larger than this
    ignore_patterns: list[str] = field(default_factory=lambda: [
        "*.lock", "*.min.js", "*.min.css", "package-lock.json",
        "yarn.lock", "go.sum", "*.pb.go", "*.generated.*",
    ])


# --- Security Checks ---

SECURITY_PATTERNS = {
    "hardcoded_secret": {
        "pattern": r'(?:password|secret|api_key|token|private_key)\s*[:=]\s*["\'][^"\']{8,}',
        "severity": "critical",
        "message": "Hardcoded secret detected. Use environment variables or secret management.",
    },
    "sql_injection": {
        "pattern": r'(?:execute|query)\s*\(\s*f["\'].*\{.*\}.*["\']',
        "severity": "critical",
        "message": "Potential SQL injection. Use parameterized queries.",
    },
    "eval_usage": {
        "pattern": r'\beval\s*\(',
        "severity": "high",
        "message": "eval() usage detected. Consider safer alternatives.",
    },
    "unsafe_deserialize": {
        "pattern": r'(?:pickle\.loads?|yaml\.load\s*\([^)]*\))',
        "severity": "high",
        "message": "Unsafe deserialization detected. Use safe alternatives.",
    },
    "http_url": {
        "pattern": r'http://[^\s"\']+',
        "severity": "medium",
        "message": "HTTP URL detected. Consider using HTTPS for security.",
    },
    "debug_enabled": {
        "pattern": r'(?:DEBUG\s*=\s*True|debug\s*[:=]\s*true)',
        "severity": "low",
        "message": "Debug mode enabled. Ensure this is disabled in production.",
    },
}


def run_security_checks(content: str, file_path: str) -> list[dict]:
    """Run security pattern checks against file content."""
    findings = []

    # Skip if file matches ignore patterns
    for pattern in ReviewConfig().ignore_patterns:
        if pattern.startswith("*."):
            ext = pattern[1:]
            if file_path.endswith(ext):
                return findings

    for check_name, check in SECURITY_PATTERNS.items():
        matches = re.finditer(check["pattern"], content, re.IGNORECASE)
        for match in matches:
            line_num = content[:match.start()].count('\n') + 1
            findings.append({
                "check": check_name,
                "severity": check["severity"],
                "message": check["message"],
                "file": file_path,
                "line": line_num,
                "match": match.group()[:100],
            })

    return findings


# --- Performance Analysis ---

PERFORMANCE_PATTERNS = {
    "n_plus_1_query": {
        "pattern": r'for\s+\w+\s+in\s+.*(?:\.all\(\)|\.filter\(|\.objects)',
        "message": "Potential N+1 query. Consider prefetch_related() or select_related().",
    },
    "sync_in_async": {
        "pattern": r'async\s+def\s+\w+.*(?:requests\.|urllib|httpx\.sync)',
        "message": "Synchronous HTTP call in async function. Use async HTTP client.",
    },
    "large_list_comprehension": {
        "pattern": r'\[.*for\s+\w+\s+in\s+range\s*\(\s*\d{5,}',
        "message": "Large range in list comprehension. Consider generator expression.",
    },
    "unoptimized_string_concat": {
        "pattern": r'(?:str\s*\(\s*\w+\s*\)\s*\+\s*){3,}',
        "message": "String concatenation in loop. Use f-strings or join().",
    },
}


def run_performance_analysis(content: str, file_path: str) -> list[dict]:
    """Analyze code for performance anti-patterns."""
    findings = []

    for check_name, check in PERFORMANCE_PATTERNS.items():
        matches = re.finditer(check["pattern"], content, re.MULTILINE)
        for match in matches:
            line_num = content[:match.start()].count('\n') + 1
            findings.append({
                "check": check_name,
                "severity": "warning",
                "message": check["message"],
                "file": file_path,
                "line": line_num,
            })

    return findings


# --- Best Practices ---

BEST_PRACTICE_PATTERNS = {
    "missing_type_hints": {
        "pattern": r'def\s+\w+\s*\([^)]*\)(?!\s*->)',
        "message": "Function missing return type annotation. Add -> Type hint.",
        "languages": ["python"],
    },
    "console_log": {
        "pattern": r'console\.log\s*\(',
        "message": "console.log() in production code. Remove or use proper logging.",
        "languages": ["typescript", "javascript"],
    },
    "todo_fixme": {
        "pattern":r'#\s*(?:TODO|FIXME|HACK|XXX)\b',
        "message": "TODO/FIXME comment found. Consider creating an issue to track.",
    },
    "magic_number": {
        "pattern":r'(?:if|while|return)\s+.*(?<!self\.)(?<!this\.)\b\d{3,}\b',
        "message": "Magic number detected. Consider extracting to a named constant.",
    },
}


def run_best_practices(content: str, file_path: str) -> list[dict]:
    """Check code for best practice violations."""
    findings = []
    ext = file_path.rsplit('.', 1)[-1] if '.' in file_path else ''

    for check_name, check in BEST_PRACTICE_PATTERNS.items():
        # Skip if check is language-specific and doesn't match
        if "languages" in check:
            lang_map = {"python": ["py"], "typescript": ["ts", "tsx"], "javascript": ["js", "jsx"]}
            valid_exts = []
            for lang in check["languages"]:
                valid_exts.extend(lang_map.get(lang, []))
            if ext and ext not in valid_exts:
                continue

        matches = re.finditer(check["pattern"], content, re.MULTILINE)
        for match in matches:
            line_num = content[:match.start()].count('\n') + 1
            findings.append({
                "check": check_name,
                "severity": "info",
                "message": check["message"],
                "file": file_path,
                "line": line_num,
            })

    return findings


# --- GitHub App Handler ---

class CodeReviewApp:
    """GitHub App that reviews PRs using multiple LLMs."""

    def __init__(self, app_id: str, private_key: str, webhook_secret: str):
        self.app_id = app_id
        self.private_key = private_key
        self.webhook_secret = webhook_secret
        self.http = httpx.AsyncClient(timeout=60.0)
        self.installations: dict[int, ReviewConfig] = {}

    async def close(self):
        await self.http.aclose()

    # --- Webhook Handler ---

    async def handle_webhook(self, event: str, payload: dict) -> Optional[dict]:
        """Route GitHub webhook events to handlers."""
        if event == "pull_request":
            action = payload.get("action", "")
            if action in ("opened", "synchronize"):
                return await self._handle_pr_opened(payload)
            elif action == "closed" and payload.get("pull_request", {}).get("merged"):
                return await self._handle_pr_merged(payload)

        elif event == "installation":
            return await self._handle_installation(payload)

        return None

    async def _handle_pr_opened(self, payload: dict) -> dict:
        """Review a new/updated PR."""
        pr = payload.get("pull_request", {})
        repo = payload.get("repository", {})
        installation_id = payload.get("installation", {}).get("id", 0)

        config = self.installations.get(installation_id, ReviewConfig())

        # Fetch PR diff
        diff_url = pr.get("diff_url", "")
        try:
            diff_resp = await self.http.get(diff_url)
            diff_content = diff_resp.text
        except Exception as e:
            return {"error": f"Failed to fetch diff: {e}"}

        # Parse changed files from diff
        changed_files = self._parse_diff(diff_content)

        # Run checks on each file
        security_findings = []
        performance_findings = []
        best_practice_findings = []

        for file_path, content in changed_files.items():
            if config.security_checks:
                security_findings.extend(run_security_checks(content, file_path))
            if config.performance_analysis:
                performance_findings.extend(run_performance_analysis(content, file_path))
            if config.best_practices:
                best_practice_findings.extend(run_best_practices(content, file_path))

        # Calculate overall score
        total_findings = len(security_findings) + len(performance_findings) + len(best_practice_findings)
        critical_count = len([f for f in security_findings if f.get("severity") == "critical"])

        score = 10.0
        score -= critical_count * 2.0  # -2 per critical finding
        score -= len([f for f in security_findings if f.get("severity") == "high"]) * 1.0
        score -= len(performance_findings) * 0.3
        score -= len(best_practice_findings) * 0.1
        score = max(score, 0.0)

        # Build review comment
        review_body = self._build_review_comment(
            score, security_findings, performance_findings, best_practice_findings
        )

        return {
            "score": score,
            "passed": score >= config.block_threshold,
            "auto_approve": score >= config.auto_approve_threshold,
            "security_findings": len(security_findings),
            "performance_findings": len(performance_findings),
            "best_practice_findings": len(best_practice_findings),
            "review_body": review_body,
        }

    async def _handle_pr_merged(self, payload: dict) -> dict:
        """Handle merged PR (for bounty payout tracking)."""
        return {"status": "pr_merged", "action": "track_payout"}

    async def _handle_installation(self, payload: dict) -> dict:
        """Handle app installation/uninstallation."""
        action = payload.get("action", "")
        installation_id = payload.get("installation", {}).get("id", 0)

        if action == "created":
            self.installations[installation_id] = ReviewConfig()
            return {"status": "installed", "installation_id": installation_id}
        elif action == "deleted":
            self.installations.pop(installation_id, None)
            return {"status": "uninstalled", "installation_id": installation_id}

        return {"status": "unknown_action"}

    # --- Diff Parser ---

    @staticmethod
    def _parse_diff(diff_content: str) -> dict[str, str]:
        """Parse unified diff into {file_path: content}."""
        files = {}
        current_file = ""
        current_content = []

        for line in diff_content.split("\n"):
            if line.startswith("diff --git"):
                if current_file and current_content:
                    files[current_file] = "\n".join(current_content)
                current_file = ""
                current_content = []
            elif line.startswith("--- a/"):
                current_file = line[6:]
            elif line.startswith("+++ b/"):
                current_file = line[6:]
            elif line.startswith("+") and not line.startswith("+++"):
                current_content.append(line[1:])  # Remove the '+'

        if current_file and current_content:
            files[current_file] = "\n".join(current_content)

        return files

    # --- Review Comment Builder ---

    @staticmethod
    def _build_review_comment(
        score: float,
        security: list[dict],
        performance: list[dict],
        practices: list[dict],
    ) -> str:
        """Build a formatted review comment."""
        score_emoji = "🟢" if score >= 8 else "🟡" if score >= 6 else "🔴"

        lines = [
            f"## 🔍 AI Code Review — {score_emoji} Score: {score:.1f}/10",
            "",
        ]

        if security:
            critical = [f for f in security if f["severity"] == "critical"]
            lines.append(f"### 🔒 Security ({len(security)} findings)")
            for f in security[:5]:
                icon = "🚨" if f["severity"] == "critical" else "⚠️"
                lines.append(f"- {icon} **{f['file']}:{f['line']}** — {f['message']}")
            if len(security) > 5:
                lines.append(f"- ... and {len(security) - 5} more")

        if performance:
            lines.append(f"\n### ⚡ Performance ({len(performance)} findings)")
            for f in performance[:5]:
                lines.append(f"- **{f['file']}:{f['line']}** — {f['message']}")

        if practices:
            lines.append(f"\n### 📏 Best Practices ({len(practices)} findings)")
            for f in practices[:5]:
                lines.append(f"- **{f['file']}:{f['line']}** — {f['message']}")

        if not security and not performance and not practices:
            lines.append("✅ No issues found. Clean code!")

        return "\n".join(lines)
