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


class Tester:
    """
    Test execution module.
    Detects test framework and runs appropriate test commands.
    """

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
        has_pytest = any(os.path.exists(os.path.join(self.local_repo_path, f)) 
                        for f in ["pytest.ini", "pyproject.toml", "setup.cfg", "conftest.py"])
        if has_pytest:
            return "pytest"
        
        has_requirements_txt = os.path.exists(os.path.join(self.local_repo_path, "requirements.txt"))
        if has_requirements_txt:
            with open(os.path.join(self.local_repo_path, "requirements.txt")) as f:
                content = f.read()
                if "pytest" in content:
                    return "pytest"

        if os.path.exists(os.path.join(self.local_repo_path, "package.json")):
            with open(os.path.join(self.local_repo_path, "package.json")) as f:
                content = f.read()
                if '"vitest"' in content:
                    return "vitest"
                if '"jest"' in content:
                    return "jest"
                if '"mocha"' in content:
                    return "mocha"

        # Check for unittest in Python files
        for root, _, files in os.walk(os.path.join(self.local_repo_path, "tests")):
            for file in files:
                if file.endswith(".py"):
                    path = os.path.join(root, file)
                    with open(path) as f:
                        content = f.read()
                        if "unittest" in content or "pytest" in content:
                            return "pytest"

        return None

    def run_tests(
        self,
        test_path: str = None,
        framework: str = None,
        verbose: bool = True
    ) -> TestResult:
        """
        Run tests for the project.
        
        Args:
            test_path: Specific test file/dir to run (optional)
            framework: Force a specific framework (auto-detected if None)
            verbose: Whether to show verbose output
        """
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
            return TestResult(
                passed=False,
                output="Tests timed out after 5 minutes."
            )
        except Exception as e:
            return TestResult(
                passed=False,
                output=f"Error running tests: {str(e)}"
            )

    def _build_command(self, framework: str, test_path: str, verbose: bool) -> list[str]:
        """Build the test command based on framework."""
        base = []
        
        if framework == "pytest":
            base = ["python", "-m", "pytest"]
            if verbose:
                base.extend(["-v", "--tb=short"])
            if test_path:
                base.append(test_path)
            else:
                base.extend(["tests/", "-k", "not e2e"])
                
        elif framework == "jest":
            base = ["npx", "jest"]
            if verbose:
                base.append("--verbose")
            if test_path:
                base.extend([test_path, "--no-coverage"])
            else:
                base.extend(["--testPathPattern", "tests/", "--no-coverage"])
                
        elif framework == "vitest":
            base = ["npx", "vitest"]
            if verbose:
                base.append("run")
            if test_path:
                base.append(test_path)
            else:
                base.extend(["run", "tests/"])
                
        elif framework == "mocha":
            base = ["npx", "mocha"]
            if test_path:
                base.extend([test_path, "--reporter", "spec"])
            else:
                base.extend(["tests/**/*.test.js", "--reporter", "spec"])
                
        elif framework == "unittest":
            base = ["python", "-m", "unittest"]
            if test_path:
                base.append(test_path)
            else:
                base.append("discover")
        
        else:
            base = ["python", "-m", "pytest", "tests/"]
        
        return base

    def _parse_result(self, framework: str, result: subprocess.CompletedProcess, passed: bool) -> TestResult:
        """Parse test output into a TestResult."""
        output = result.stdout + "\n" + result.stderr
        
        total = passed_tests = failed = errors = 0
        
        # Parse pytest output
        if framework == "pytest":
            # Example: "5 passed, 2 failed in 1.23s"
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
            # Example: "Tests: 5 passed, 2 failed, 7 total"
            match = re.search(r"Tests:\s+(\d+)\s+passed", output)
            if match:
                passed_tests = int(match.group(1))
            match = re.search(r"(\d+)\s+failed", output)
            if match:
                failed = int(match.group(1))
            total = passed_tests + failed
            
        return TestResult(
            passed=passed and (failed == 0 and errors == 0),
            total_tests=total,
            passed_tests=passed_tests,
            failed_tests=failed,
            errors=errors,
            output=output[-3000:],  # Last 3000 chars
        )

    def run_lint(self, linter: str = "ruff") -> TestResult:
        """
        Run a linter on the changed files.
        """
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
            return TestResult(
                passed=passed,
                output=result.stdout + "\n" + result.stderr
            )
        except Exception as e:
            return TestResult(passed=False, output=str(e))
