"""Best practices and code-quality checks."""
import re
from ..models import DiffFile, Finding, Severity


class BestPracticesAnalyzer:
    """Detects common best-practice violations."""

    def analyze(self, files: list[DiffFile]) -> list[Finding]:
        findings: list[Finding] = []
        for df in files:
            if not df.patch:
                continue
            ext = df.extension
            if ext == "py" and self._has_missing_type_hints(df.patch):
                findings.append(Finding(
                    severity=Severity.LOW,
                    category="best-practice:type hints",
                    message="Function definitions missing type annotations.",
                    file=df.filename,
                ))
            if ext in ("ts", "tsx", "js", "jsx") and re.search(r"console\.(log|debug)\s*\(", df.patch):
                findings.append(Finding(
                    severity=Severity.LOW,
                    category="best-practice:console.log",
                    message="console.log left in code. Remove or replace with a logger.",
                    file=df.filename,
                ))
            if re.search(r"(?i)\b(TODO|FIXME|HACK|XXX):?\s", df.patch):
                findings.append(Finding(
                    severity=Severity.INFO,
                    category="best-practice:TODO/FIXME",
                    message="TODO/FIXME marker found. Consider resolving before merge.",
                    file=df.filename,
                ))
            if re.search(r"[\s=(](-?[0-9]{3,})(?!\s*[%\\*/+ -])\b", df.patch) and ext in ("ts", "tsx", "py", "go", "java", "rs"):
                findings.append(Finding(
                    severity=Severity.INFO,
                    category="best-practice:magic number",
                    message="Magic number detected. Extract to a named constant.",
                    file=df.filename,
                ))
            if ext == "py" and re.search(r"except\s*:", df.patch):
                findings.append(Finding(
                    severity=Severity.LOW,
                    category="best-practice:bare except",
                    message="Bare except clause. Catch specific exceptions.",
                    file=df.filename,
                ))
        return findings

    @staticmethod
    def _has_missing_type_hints(patch: str) -> bool:
        return bool(re.search(r"def\s+\w+\s*\([^)]*\b\w+\s*(,|\))", patch)) and not bool(
            re.search(r"def\s+\w+\s*\([^)]*:\s*[\w\[\]]+", patch)
        )