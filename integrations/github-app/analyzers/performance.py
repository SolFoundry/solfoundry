"""Performance anti-pattern detection."""
import re
from typing import Optional
from ..models import DiffFile, Finding, Severity


class PerformanceAnalyzer:
    """Detects common performance anti-patterns."""

    def analyze(self, files: list[DiffFile]) -> list[Finding]:
        findings: list[Finding] = []
        for df in files:
            if not df.patch:
                continue
            ext = df.extension
            if self._has_n_plus_one(df.patch):
                findings.append(Finding(
                    severity=Severity.MEDIUM,
                    category="performance:N+1 query",
                    message="Possible N+1 query pattern. Use selectinload/joinedload or batch fetching.",
                    file=df.filename,
                    line=self._line_of(df.patch),
                ))
            if self._has_sync_in_async(df.patch):
                findings.append(Finding(
                    severity=Severity.MEDIUM,
                    category="performance:blocking call in async",
                    message="Blocking call inside an async function. Use async clients or offload to a thread.",
                    file=df.filename,
                    line=self._line_of(df.patch),
                ))
            if re.search(r"\[\s*[^\]]+\s+for\s+[^\]]+\s+in\s+range\([1-9][0-9]{4,}\)", df.patch):
                findings.append(Finding(
                    severity=Severity.LOW,
                    category="performance:large list comprehension",
                    message="Building a large list in memory. Consider a generator expression.",
                    file=df.filename,
                ))
            if re.search(r"for .*:\n\s+.*\+=\s*f?[\"']", df.patch):
                findings.append(Finding(
                    severity=Severity.LOW,
                    category="performance:string concat in loop",
                    message="String concatenation in a loop is O(n^2). Use str.join or a list buffer.",
                    file=df.filename,
                ))
        return findings

    @staticmethod
    def _has_n_plus_one(patch: str) -> bool:
        return bool(
            re.search(r"\bfor\b.*\bin\b.*\b(query|select|filter|get)\.(all|one|first)\b", patch)
            or re.search(r"\bfor\b.*\bin\b[^\n]*\n\s*\w+\.(query|objects)\b", patch)
        )

    @staticmethod
    def _has_sync_in_async(patch: str) -> bool:
        return bool(
            re.search(r"async\s+def\s+\w+[^\n]*:\n(?:\s+[^\n]*\n)*?\s+(?:requests|httpx\.Client|time\.sleep|open\(|subprocess\b)\.", patch)
            or re.search(r"async\s+def[^\n]*\n(?:[^\n]*\n){0,10}?\s*requests\.(get|post|put|delete)\b", patch)
        )

    @staticmethod
    def _line_of(patch: str) -> Optional[int]:
        line = 1
        for piece in patch.splitlines():
            if piece.startswith("@@"):
                m = re.search(r"\+([0-9]+)", piece)
                if m:
                    line = int(m.group(1))
            elif piece and not piece.startswith(("-", "\\")):
                line += 1
        return line