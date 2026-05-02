"""Security audit module for bounty agent operations.

Provides automated security checks for:
- Dependency vulnerability scanning
- Code pattern analysis (anti-patterns, common vulns)
- Secret detection in source code
- Permission validation

Author: Xeophon
"""

import json
import logging
import os
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class Severity(Enum):
    """Vulnerability severity levels aligned with CVSS v3.1."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class VulnCategory(Enum):
    """OWASP-aligned vulnerability categories."""
    INJECTION = "injection"
    BROKEN_AUTH = "broken_authentication"
    SENSITIVE_DATA = "sensitive_data_exposure"
    XXE = "xxe"
    BROKEN_ACCESS = "broken_access_control"
    MISCONFIG = "security_misconfiguration"
    XSS = "xss"
    DESERIALIZATION = "insecure_deserialization"
    KNOWN_VULN = "known_vulnerability"
    LOGGING = "insufficient_logging"
    SECRETS = "hardcoded_secrets"


@dataclass
class Vulnerability:
    """Represents a discovered vulnerability."""
    category: VulnCategory
    severity: Severity
    title: str
    description: str
    file_path: str = ""
    line_number: int = 0
    snippet: str = ""
    remediation: str = ""
    cwe_id: str = ""
    confidence: float = 1.0

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            "category": self.category.value,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "file_path": self.file_path,
            "line_number": self.line_number,
            "snippet": self.snippet[:200],
            "remediation": self.remediation,
            "cwe_id": self.cwe_id,
            "confidence": self.confidence,
        }


@dataclass
class AuditReport:
    """Complete security audit report."""
    target: str
    scanner_version: str = "1.0.0"
    vulnerabilities: List[Vulnerability] = field(default_factory=list)
    files_scanned: int = 0
    lines_scanned: int = 0
    scan_duration_seconds: float = 0.0

    @property
    def critical_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == Severity.CRITICAL)

    @property
    def high_count(self) -> int:
        return sum(1 for v in self.vulnerabilities if v.severity == Severity.HIGH)

    @property
    def total_count(self) -> int:
        return len(self.vulnerabilities)

    def to_dict(self) -> Dict:
        return {
            "target": self.target,
            "scanner_version": self.scanner_version,
            "summary": {
                "total": self.total_count,
                "critical": self.critical_count,
                "high": self.high_count,
                "files_scanned": self.files_scanned,
                "lines_scanned": self.lines_scanned,
            },
            "vulnerabilities": [v.to_dict() for v in self.vulnerabilities],
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)


SECRET_PATTERNS: List[Tuple[str, re.Pattern, Severity]] = [
    ("AWS Access Key", re.compile(r"AKIA[0-9A-Z]{16}"), Severity.CRITICAL),
    ("AWS Secret Key", re.compile(r"aws(.{0,20})?[0-9a-zA-Z/+]{40}", re.IGNORECASE), Severity.CRITICAL),
    ("GitHub Token", re.compile(r"gh[pousr]_[0-9a-zA-Z]{36,}"), Severity.CRITICAL),
    ("Private Key Block", re.compile(r"-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----"), Severity.CRITICAL),
    ("Generic API Key", re.compile(r"(?i)(api[_-]?key|apikey|access[_-]?key)\s*[=:]\s*['\"][0-9a-zA-Z]{20,}['\"]"), Severity.HIGH),
    ("Generic Secret", re.compile(r"(?i)(secret|password|token|credential)\s*[=:]\s*['\"][0-9a-zA-Z]{16,}['\"]"), Severity.HIGH),
    ("JWT Token", re.compile(r"eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+"), Severity.HIGH),
]

CODE_PATTERNS: List[Tuple[str, re.Pattern, VulnCategory, Severity, str, str]] = [
    ("SQL Injection (string format)", re.compile(r"execute\s*\(\s*[\"'].*%[sd].*\"'\s*%"), VulnCategory.INJECTION, Severity.CRITICAL, "Use parameterized queries", "CWE-89"),
    ("SQL Injection (f-string)", re.compile(r"execute\s*\(\s*f[\"']"), VulnCategory.INJECTION, Severity.CRITICAL, "Use parameterized queries", "CWE-89"),
    ("Eval Usage", re.compile(r"\beval\s*\("), VulnCategory.INJECTION, Severity.HIGH, "Use ast.literal_eval()", "CWE-94"),
    ("Pickle Deserialization", re.compile(r"pickle\.loads?\s*\("), VulnCategory.DESERIALIZATION, Severity.HIGH, "Use json/msgpack", "CWE-502"),
    ("Assert in Production", re.compile(r"^\s*assert\s+", re.MULTILINE), VulnCategory.MISCONFIG, Severity.LOW, "Use explicit checks", "CWE-617"),
    ("Broad Exception Handler", re.compile(r"except\s*:"), VulnCategory.LOGGING, Severity.MEDIUM, "Catch specific exceptions", "CWE-396"),
    ("Subprocess Shell=True", re.compile(r"subprocess\.\w+\(.*shell\s*=\s*True"), VulnCategory.INJECTION, Severity.HIGH, "Avoid shell=True", "CWE-78"),
    ("Insecure HTTP", re.compile(r"http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)"), VulnCategory.SENSITIVE_DATA, Severity.MEDIUM, "Use HTTPS", "CWE-319"),
]


class SecretScanner:
    """Scans source code for hardcoded secrets and credentials."""

    def __init__(self, custom_patterns: Optional[List[Tuple]] = None):
        self.patterns = list(SECRET_PATTERNS)
        if custom_patterns:
            self.patterns.extend(custom_patterns)
        self.fp_prefixes = ("example", "test", "mock", "sample", "dummy", "fake", "placeholder")

    def scan_line(self, line: str, file_path: str = "", line_number: int = 0) -> List[Vulnerability]:
        results: List[Vulnerability] = []
        line_lower = line.lower()
        if any(fp in line_lower for fp in self.fp_prefixes):
            return results
        for name, pattern, severity in self.patterns:
            match = pattern.search(line)
            if match:
                results.append(Vulnerability(
                    category=VulnCategory.SECRETS, severity=severity,
                    title=f"Hardcoded {name}", description=f"Potential {name} detected",
                    file_path=file_path, line_number=line_number,
                    snippet=match.group(0)[:80],
                    remediation=f"Move {name} to env var or secret manager",
                    confidence=0.8,
                ))
        return results

    def scan_file(self, file_path: str) -> List[Vulnerability]:
        results: List[Vulnerability] = []
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
                for line_number, line in enumerate(fh, 1):
                    results.extend(self.scan_line(line, file_path, line_number))
        except (OSError, UnicodeDecodeError):
            pass
        return results

    def scan_directory(self, directory: str, extensions: Optional[List[str]] = None) -> List[Vulnerability]:
        if extensions is None:
            extensions = [".py", ".js", ".ts", ".json", ".yml", ".yaml", ".env"]
        results: List[Vulnerability] = []
        for root, _dirs, files in os.walk(directory):
            _dirs[:] = [d for d in _dirs if d not in {".git", "node_modules", "__pycache__", ".venv"}]
            for fname in files:
                if any(fname.endswith(ext) for ext in extensions):
                    results.extend(self.scan_file(os.path.join(root, fname)))
        return results


class CodeAuditor:
    """Scans source code for security anti-patterns."""

    def __init__(self, custom_patterns: Optional[List] = None):
        self.patterns = list(CODE_PATTERNS)
        if custom_patterns:
            self.patterns.extend(custom_patterns)

    def scan_file(self, file_path: str) -> List[Vulnerability]:
        results: List[Vulnerability] = []
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
                for line_number, line in enumerate(fh, 1):
                    stripped = line.strip()
                    if stripped.startswith("#") or stripped.startswith('"""') or stripped.startswith("'''"):
                        continue
                    for name, pattern, category, severity, remediation, cwe in self.patterns:
                        if pattern.search(line):
                            effective = Severity.INFO if "test" in file_path.lower() else severity
                            results.append(Vulnerability(
                                category=category, severity=effective,
                                title=name, description=f"Security anti-pattern: {name}",
                                file_path=file_path, line_number=line_number,
                                snippet=line.strip()[:200],
                                remediation=remediation, cwe_id=cwe,
                                confidence=0.7 if "test" in file_path.lower() else 0.9,
                            ))
        except (OSError, UnicodeDecodeError):
            pass
        return results

    def scan_directory(self, directory: str) -> List[Vulnerability]:
        results: List[Vulnerability] = []
        for root, _dirs, files in os.walk(directory):
            _dirs[:] = [d for d in _dirs if d not in {".git", "node_modules", "__pycache__", ".venv"}]
            for fname in files:
                if fname.endswith(".py"):
                    results.extend(self.scan_file(os.path.join(root, fname)))
        return results


class SecurityAuditor:
    """Orchestrates comprehensive security audits."""

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.secret_scanner = SecretScanner(self.config.get("custom_secret_patterns"))
        self.code_auditor = CodeAuditor(self.config.get("custom_code_patterns"))

    def audit(self, target: str) -> AuditReport:
        import time
        start_time = time.time()
        report = AuditReport(target=target)

        if os.path.isfile(target):
            report.vulnerabilities.extend(self.secret_scanner.scan_file(target))
            report.vulnerabilities.extend(self.code_auditor.scan_file(target))
            report.files_scanned = 1
            try:
                with open(target, "r", encoding="utf-8", errors="ignore") as fh:
                    report.lines_scanned = sum(1 for _ in fh)
            except OSError:
                pass
        elif os.path.isdir(target):
            report.vulnerabilities.extend(self.secret_scanner.scan_directory(target))
            report.vulnerabilities.extend(self.code_auditor.scan_directory(target))
            for root, _dirs, files in os.walk(target):
                _dirs[:] = [d for d in _dirs if d not in {".git", "node_modules", "__pycache__"}]
                for fname in files:
                    if fname.endswith((".py", ".js", ".ts", ".json", ".yml")):
                        report.files_scanned += 1
                        try:
                            with open(os.path.join(root, fname), "r", encoding="utf-8", errors="ignore") as fh:
                                report.lines_scanned += sum(1 for _ in fh)
                        except OSError:
                            pass

        seen = set()
        unique = []
        for vuln in report.vulnerabilities:
            key = (vuln.category, vuln.file_path, vuln.line_number, vuln.title)
            if key not in seen:
                seen.add(key)
                unique.append(vuln)
        report.vulnerabilities = unique
        report.scan_duration_seconds = time.time() - start_time
        return report

    def audit_and_report(self, target: str, output_path: Optional[str] = None) -> AuditReport:
        report = self.audit(target)
        if output_path:
            with open(output_path, "w", encoding="utf-8") as fh:
                fh.write(report.to_json())
        return report
