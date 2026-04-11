"""
Tester module for the Bounty Hunter Agent.
Handles test execution and validation.
"""

import os
import re
import subprocess
from dataclasses import dataclass
from typing import Optional


@dataclass
class TestResult:
    """Result of a test run."""
    passed: bool
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    errors: int = 0
    output: str = ""
    duration: float = 0.0

    @property
    def summary(self) -> str:
        return (
            f"passed={self.passed}, total={self.total_tests}, "
            f"passed_tests={self.passed_tests}, failed={self.failed_tests}, errors={self.errors}"
        )


class Tester:
    """
    Test execution module.
    Detects test framework and runs appropriate test commands.
    """

    __test__ = False

    def __init__(self, local_repo_path: str):
        self.local_repo_path = local_repo_path

    def _run_command(self, cmd: list[str], timeout: int = 180) -> subprocess.CompletedProcess:
        """Run a command in the repo directory."""
        return subprocess.run(
            cmd,
            cwd=self.local_repo_path,
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, "TERM": "dumb"}
        )

    def detect_test_framework(self) -> Optional[str]:
        """
        Detect which test framework the project uses.
        Returns: "pytest", "jest", "vitest", "unittest", "mocha", or None
        """
        has_pytest = any(
            os.path.exists(os.path.join(self.local_repo_path, f))
            for f in ["pytest.ini", "pyproject.toml", "setup.cfg", "conftest.py"]
        )
        if has_pytest:
            return "pytest"

        has_requirements_txt = os.path.exists(os.path.join(self.local_repo_path, "requirements.txt"))
        if has_requirements_txt:
            with open(os.path.join(self.local_repo_path, "requirements.txt"), encoding="utf-8") as f:
                content = f.read()
                if "pytest" in content:
                    return "pytest"

        if os.path.exists(os.path.join(self.local_repo_path, "package.json")):
            with open(os.path.join(self.local_repo_path, "package.json"), encoding="utf-8") as f:
                content = f.read()
                if '"vitest"' in content:
                    return "vitest"
                if '"jest"' in content:
                    return "jest"
                if '"mocha"' in content:
                    return "mocha"

        for root, _, files in os.walk(self.local_repo_path):
            for file in files:
                if file.startswith("test_") and file.endswith(".py"):
                    path = os.path.join(root, file)
                    try:
                        with open(path, encoding="utf-8") as f:
                            content = f.read()
                            if "unittest" in content or "pytest" in content or "assert " in content:
                                return "pytest"
                    except Exception:
                        continue

        return None

    def run_tests(
        self,
        test_path: str = None,
        framework: str = None,
        verbose: bool = True
    ) -> TestResult:
        framework = framework or self.detect_test_framework()

        if not framework:
            return TestResult(
                passed=False,
                output="No test framework detected. Cannot run tests."
            )

        cmd = self._build_command(framework, test_path, verbose)

        try:
            result = self._run_command(cmd, timeout=300)
            return self._parse_result(framework, result, passed=result.returncode == 0)
        except subprocess.TimeoutExpired:
            return TestResult(passed=False, output="Tests timed out after 5 minutes.")
        except Exception as e:
            return TestResult(passed=False, output=f"Error running tests: {str(e)}")

    def _build_command(self, framework: str, test_path: str, verbose: bool) -> list[str]:
        if framework == "pytest":
            base = ["python", "-m", "pytest"]
            if verbose:
                base.extend(["-v", "--tb=short"])
            if test_path:
                base.append(test_path)
            else:
                base.extend(["-q"])
            return base

        if framework == "jest":
            base = ["npx", "jest"]
            if verbose:
                base.append("--verbose")
            if test_path:
                base.extend([test_path, "--no-coverage"])
            else:
                base.append("--no-coverage")
            return base

        if framework == "vitest":
            base = ["npx", "vitest", "run"]
            if test_path:
                base.append(test_path)
            return base

        if framework == "mocha":
            base = ["npx", "mocha"]
            if test_path:
                base.extend([test_path, "--reporter", "spec"])
            else:
                base.extend(["--reporter", "spec"])
            return base

        if framework == "unittest":
            base = ["python", "-m", "unittest"]
            if test_path:
                base.append(test_path)
            else:
                base.append("discover")
            return base

        return ["python", "-m", "pytest", "-q"]

    def _parse_result(self, framework: str, result: subprocess.CompletedProcess, passed: bool) -> TestResult:
        output = result.stdout + "\n" + result.stderr
        total = passed_tests = failed = errors = 0

        if framework == "pytest":
            match = re.search(r"(\d+)\s+passed", output)
            if match:
                passed_tests = int(match.group(1))
            match = re.search(r"(\d+)\s+failed", output)
            if match:
                failed = int(match.group(1))
            match = re.search(r"(\d+)\s+error", output)
            if match:
                errors = int(match.group(1))
            total = passed_tests + failed + errors

        elif framework in ("jest", "vitest"):
            match = re.search(r"Tests:\s+(\d+)\s+passed", output)
            if match:
                passed_tests = int(match.group(1))
            match = re.search(r"(\d+)\s+failed", output)
            if match:
                failed = int(match.group(1))
            total = passed_tests + failed

        return TestResult(
            passed=passed and failed == 0 and errors == 0,
            total_tests=total,
            passed_tests=passed_tests,
            failed_tests=failed,
            errors=errors,
            output=output[-3000:],
        )

    def run_lint(self, linter: str = "ruff") -> TestResult:
        coder_path = os.path.join(self.local_repo_path, "automaton", "bounty_hunter")
        if not os.path.exists(coder_path):
            return TestResult(passed=True, output="No bounty_hunter code to lint")

        if linter == "ruff":
            cmd = ["python", "-m", "ruff", "check", coder_path]
        elif linter == "flake8":
            cmd = ["python", "-m", "flake8", coder_path]
        elif linter == "eslint":
            cmd = ["npx", "eslint", coder_path]
        else:
            return TestResult(passed=True, output=f"Unknown linter: {linter}")

        try:
            result = self._run_command(cmd, timeout=60)
            passed = result.returncode == 0
            return TestResult(passed=passed, output=result.stdout + "\n" + result.stderr)
        except Exception as e:
            return TestResult(passed=False, output=str(e))
