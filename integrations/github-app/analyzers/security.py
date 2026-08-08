"""Security pattern detection for code review."""
import re
from typing import Optional
from ..models import DiffFile, Finding, Severity


class SecurityAnalyzer:
    """Detects security anti-patterns in code diffs."""

    PATTERNS = [
        ("hardcoded_secret", Severity.CRITICAL,
         r"(?i)(api[_-]?key|secret|password|passwd|token|private[_-]?key)\s*[=:]\s*[\"']([A-Za-z0-9_\-]{12,})[\"']",
         "Potential hardcoded credential detected. Use environment variables or a secrets manager."),
        ("sql_injection", Severity.CRITICAL,
         r"(?i)(execute|exec|query|raw)\s*\(\s*f[\"']|SELECT.*\+.*WHERE|\bconcat\(.*(SELECT|WHERE)",
         "Possible SQL injection - string interpolation in SQL query. Use parameterized queries."),
        ("eval_usage", Severity.HIGH,
         r"\beval\s*\(|\bexec\s*\(\s*f[\"']|\bexec\s*\(\s*str\(|Function\s*\(\s*[\"']",
         "Use of eval()/exec() with dynamic input. Can lead to code injection."),
        ("unsafe_deserialize", Severity.HIGH,
         r"pickle\.loads?\s*\(|yaml\.load\s*\(|json\.loads?\s*\(\s*request|node-serialize|unserialize\(",
         "Unsafe deserialization detected. Use safe loaders (e.g., yaml.safe_load)."),
        ("http_url", Severity.MEDIUM,
         r"https?://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^\s\"'`]*\bhttp://",
         "Plain HTTP URL detected. Use HTTPS to prevent man-in-the-middle attacks."),
        ("debug_enabled", Severity.LOW,
         r"(?i)(debug\s*=\s*True|DEBUG\s*=\s*True|app\.debug\s*=\s*True|NODE_ENV\s*=\s*['\"]development)",
         "Debug mode enabled. Ensure this is disabled in production."),
        ("command_injection", Severity.HIGH,
         r"os\.system\s*\(\s*f[\"']|subprocess\.(run|call|Popen)\s*\(\s*f[\"']|child_process.*exec\s*\(\s*f[\"']",
         "Command execution with f-string interpolation. Use shell=False and argument lists."),
    ]

    def analyze(self, files: list[DiffFile]) -> list[Finding]:
        findings: list[Finding] = []
        for df in files:
            if not df.patch:
                continue
            for name, severity, pattern, message in self.PATTERNS:
                for match in re.finditer(pattern, df.patch):
                    line = self._patch_line_from_match(df.patch, match.start())
                    findings.append(Finding(
                        severity=severity,
                        category="security",
                        message=message,
                        file=df.filename,
                        line=line,
                        suggestion=self._suggestion(name),
                    ))
        return findings

    @staticmethod
    def _patch_line_from_match(patch: str, pos: int) -> Optional[int]:
        line = 1
        current = 0
        for piece in patch.splitlines():
            if current >= pos:
                break
            if piece.startswith("@@"):
                m = re.search(r"\+([0-9]+)(?:,[0-9]+)?", piece)
                if m:
                    line = int(m.group(1))
            elif piece and not piece.startswith(("-", "\\")):
                line += 1
            current += len(piece) + 1
        return line

    @staticmethod
    def _suggestion(name: str) -> str:
        hints = {
            "hardcoded_secret": "Move secrets to environment variables or a vault.",
            "sql_injection": "Use parameterized queries / prepared statements.",
            "eval_usage": "Replace eval/exec with a safe parser or constrained AST evaluation.",
            "unsafe_deserialize": "Use yaml.safe_load or a schema-validated deserializer.",
            "command_injection": "Pass arguments as a list to subprocess and keep shell=False.",
            "http_url": "Use https:// URLs and HSTS headers.",
            "debug_enabled": "Gate debug mode behind an env flag and disable in production.",
        }
        return hints.get(name, "")