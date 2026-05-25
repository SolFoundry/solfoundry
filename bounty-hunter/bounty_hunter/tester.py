"""Tester — runs tests and validates solutions."""

import logging
import subprocess
import json
from dataclasses import dataclass, field
from typing import Optional

log = logging.getLogger(__name__)


@dataclass
class TestResult:
    """Result of a test run."""
    passed: bool
    summary: str = ""
    failures: list[str] = field(default_factory=list)
    output: str = ""


class Tester:
    """Runs tests and validates bounty solutions."""

    def __init__(self, repo_path: str):
        self.repo_path = repo_path

    def run_python_tests(self, test_path: Optional[str] = None) -> TestResult:
        """Run Python tests with pytest."""
        cmd = ["python3", "-m", "pytest", "-x", "-q", "--tb=short"]
        if test_path:
            cmd.append(test_path)

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                cwd=self.repo_path, timeout=120,
            )
            output = result.stdout + result.stderr

            if result.returncode == 0:
                return TestResult(passed=True, summary="All tests passed", output=output)
            else:
                failures = self._extract_failures(output)
                return TestResult(
                    passed=False,
                    summary=f"{len(failures)} test(s) failed",
                    failures=failures,
                    output=output,
                )
        except subprocess.TimeoutExpired:
            return TestResult(passed=False, summary="Tests timed out", failures=["Timeout"])
        except FileNotFoundError:
            return TestResult(passed=False, summary="pytest not found", failures=["Missing pytest"])

    def run_typescript_tests(self) -> TestResult:
        """Run TypeScript tests with vitest."""
        try:
            result = subprocess.run(
                ["npx", "vitest", "run", "--reporter=verbose"],
                capture_output=True, text=True,
                cwd=self.repo_path, timeout=120,
            )
            output = result.stdout + result.stderr
            if result.returncode == 0:
                return TestResult(passed=True, summary="All TypeScript tests passed", output=output)
            return TestResult(passed=False, summary="TypeScript tests failed", output=output)
        except subprocess.TimeoutExpired:
            return TestResult(passed=False, summary="TypeScript tests timed out")
        except FileNotFoundError:
            return TestResult(passed=False, summary="vitest not available")

    def validate_code_quality(self, path: str = ".") -> TestResult:
        """Basic code quality checks."""
        issues = []

        # Check for TODO/placeholders that are AI slop
        cmd = [
            "grep", "-rn", r"(TODO|FIXME|HACK|XXX)",
            "--include=*.py", "--include=*.ts", "--include=*.tsx",
            "-l", path,
        ]
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True,
                cwd=self.repo_path, timeout=30,
            )
            if result.stdout.strip():
                todo_files = result.stdout.strip().split("\n")[:5]
                issues.append(f"TODOs in: {', '.join(todo_files)}")
        except subprocess.TimeoutExpired:
            pass

        # Check for print/console.log (debugging leftovers)
        for pattern, ext in [("print\\(", ".py"), ("console\\.log", ".ts")]:
            try:
                result = subprocess.run(
                    ["grep", "-rn", pattern, f"--include=*{ext}", "-l", path],
                    capture_output=True, text=True,
                    cwd=self.repo_path, timeout=15,
                )
                if result.stdout.strip():
                    files = result.stdout.strip().split("\n")[:3]
                    issues.append(f"Debug prints in: {', '.join(files)}")
            except subprocess.TimeoutExpired:
                pass

        if issues:
            return TestResult(passed=False, summary="Quality issues found", failures=issues)
        return TestResult(passed=True, summary="Code quality OK")

    @staticmethod
    def validate_pr_content(pr_body: str) -> TestResult:
        """Validate that a PR body contains required elements."""
        checks = []
        failures = []

        if "Closes #" in pr_body:
            checks.append("✅ Has Closes #N")
        else:
            failures.append("Missing Closes #N")

        if "**Wallet:**" in pr_body or "Wallet:" in pr_body:
            checks.append("✅ Has wallet address")
        else:
            failures.append("Missing Solana wallet address")

        if not failures:
            return TestResult(passed=True, summary="PR body valid | " + " | ".join(checks))
        return TestResult(passed=False, summary="PR body invalid | " + " | ".join(checks), failures=failures)

    @staticmethod
    def _extract_failures(output: str) -> list[str]:
        """Extract failure messages from pytest output."""
        failures = []
        for line in output.split("\n"):
            if line.startswith("FAILED ") or "AssertionError" in line:
                failures.append(line.strip()[:200])
        return failures[:10]
