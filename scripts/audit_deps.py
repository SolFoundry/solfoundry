#!/usr/bin/env python3
"""Dependency vulnerability audit script for SolFoundry.

Scans both Python (pip-audit) and Node.js (npm audit) dependencies for
known security vulnerabilities. Designed for CI/CD integration with
exit code 1 on critical/high findings.

Usage:
    # Audit all dependencies
    python scripts/audit_deps.py

    # Audit Python only
    python scripts/audit_deps.py --python-only

    # Audit Node.js only
    python scripts/audit_deps.py --node-only

    # Output JSON report
    python scripts/audit_deps.py --output report.json

    # CI mode (fail on high/critical)
    python scripts/audit_deps.py --ci

CI/CD Integration:
    Add to your GitHub Actions workflow:
    ```yaml
    - name: Audit dependencies
      run: python scripts/audit_deps.py --ci --output audit-report.json
    ```

References:
    - pip-audit: https://github.com/pypa/pip-audit
    - npm audit: https://docs.npmjs.com/cli/v8/commands/npm-audit
    - OWASP Dependency Check: https://owasp.org/www-project-dependency-check/
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Project root (one level up from scripts/)
PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent
BACKEND_DIR: Path = PROJECT_ROOT / "backend"
FRONTEND_DIR: Path = PROJECT_ROOT / "frontend"


def run_pip_audit(requirements_file: Optional[Path] = None) -> dict:
    """Run pip-audit to scan Python dependencies for vulnerabilities.

    Uses pip-audit to check installed packages or a requirements file
    against the Python Packaging Advisory Database (PyPI).

    Args:
        requirements_file: Path to requirements.txt. If None, scans
            installed packages in the current environment.

    Returns:
        dict: Audit results with 'vulnerabilities' list and 'summary'.
    """
    result = {
        "tool": "pip-audit",
        "language": "Python",
        "vulnerabilities": [],
        "summary": {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0},
        "error": None,
    }

    cmd = ["pip-audit", "--format", "json"]
    if requirements_file and requirements_file.exists():
        cmd.extend(["--requirement", str(requirements_file)])

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(BACKEND_DIR),
        )

        if proc.stdout:
            try:
                audit_data = json.loads(proc.stdout)
                if isinstance(audit_data, list):
                    # pip-audit returns a list of vulnerability objects
                    for vuln in audit_data:
                        severity = vuln.get("fix_versions", [])
                        result["vulnerabilities"].append({
                            "package": vuln.get("name", "unknown"),
                            "installed_version": vuln.get("version", "unknown"),
                            "vulnerability_id": vuln.get("id", "unknown"),
                            "description": vuln.get("description", ""),
                            "fix_versions": severity,
                        })
                elif isinstance(audit_data, dict):
                    dependencies = audit_data.get("dependencies", [])
                    for dep in dependencies:
                        for vuln in dep.get("vulns", []):
                            result["vulnerabilities"].append({
                                "package": dep.get("name", "unknown"),
                                "installed_version": dep.get("version", "unknown"),
                                "vulnerability_id": vuln.get("id", "unknown"),
                                "description": vuln.get("description", ""),
                                "fix_versions": vuln.get("fix_versions", []),
                            })
            except json.JSONDecodeError:
                result["error"] = f"Failed to parse pip-audit output: {proc.stdout[:200]}"

        result["summary"]["total"] = len(result["vulnerabilities"])

        if proc.returncode != 0 and not result["vulnerabilities"] and not result["error"]:
            stderr_msg = proc.stderr.strip() if proc.stderr else "Unknown error"
            result["error"] = f"pip-audit exited with code {proc.returncode}: {stderr_msg[:200]}"

    except FileNotFoundError:
        result["error"] = (
            "pip-audit not installed. Install with: pip install pip-audit"
        )
    except subprocess.TimeoutExpired:
        result["error"] = "pip-audit timed out after 120 seconds"

    return result


def run_npm_audit(package_dir: Optional[Path] = None) -> dict:
    """Run npm audit to scan Node.js dependencies for vulnerabilities.

    Uses npm audit to check package-lock.json against the npm advisory
    database for known security issues.

    Args:
        package_dir: Directory containing package.json and package-lock.json.
            Defaults to the frontend directory.

    Returns:
        dict: Audit results with 'vulnerabilities' list and 'summary'.
    """
    target_dir = package_dir or FRONTEND_DIR
    result = {
        "tool": "npm audit",
        "language": "Node.js",
        "vulnerabilities": [],
        "summary": {"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0},
        "error": None,
    }

    if not (target_dir / "package-lock.json").exists():
        result["error"] = f"No package-lock.json found in {target_dir}"
        return result

    cmd = ["npm", "audit", "--json"]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=str(target_dir),
        )

        if proc.stdout:
            try:
                audit_data = json.loads(proc.stdout)
                metadata = audit_data.get("metadata", {}).get("vulnerabilities", {})
                result["summary"]["critical"] = metadata.get("critical", 0)
                result["summary"]["high"] = metadata.get("high", 0)
                result["summary"]["medium"] = metadata.get("moderate", 0)
                result["summary"]["low"] = metadata.get("low", 0)
                result["summary"]["total"] = metadata.get("total", 0)

                vulnerabilities = audit_data.get("vulnerabilities", {})
                for pkg_name, vuln_info in vulnerabilities.items():
                    result["vulnerabilities"].append({
                        "package": pkg_name,
                        "severity": vuln_info.get("severity", "unknown"),
                        "description": vuln_info.get("title", ""),
                        "via": [
                            v if isinstance(v, str) else v.get("title", "")
                            for v in vuln_info.get("via", [])
                        ],
                        "fix_available": vuln_info.get("fixAvailable", False),
                    })
            except json.JSONDecodeError:
                result["error"] = f"Failed to parse npm audit output: {proc.stdout[:200]}"

    except FileNotFoundError:
        result["error"] = "npm not found. Install Node.js and npm."
    except subprocess.TimeoutExpired:
        result["error"] = "npm audit timed out after 120 seconds"

    return result


def generate_report(
    python_results: Optional[dict],
    node_results: Optional[dict],
) -> dict:
    """Generate a combined audit report from Python and Node.js results.

    Args:
        python_results: pip-audit results dictionary.
        node_results: npm audit results dictionary.

    Returns:
        dict: Combined report with timestamp, results, and overall status.
    """
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "project": "SolFoundry",
        "results": [],
        "overall_status": "pass",
        "total_vulnerabilities": 0,
        "critical_and_high": 0,
    }

    for results in [python_results, node_results]:
        if results is None:
            continue

        report["results"].append(results)
        total = results["summary"]["total"]
        critical = results["summary"].get("critical", 0)
        high = results["summary"].get("high", 0)

        report["total_vulnerabilities"] += total
        report["critical_and_high"] += critical + high

    if report["critical_and_high"] > 0:
        report["overall_status"] = "fail"
    elif report["total_vulnerabilities"] > 0:
        report["overall_status"] = "warn"

    return report


def print_report(report: dict) -> None:
    """Print a human-readable summary of the audit report to stdout.

    Args:
        report: The combined audit report dictionary.
    """
    print("\n" + "=" * 60)
    print("  SolFoundry Dependency Vulnerability Audit")
    print(f"  Generated: {report['timestamp']}")
    print("=" * 60)

    for result in report["results"]:
        print(f"\n--- {result['tool']} ({result['language']}) ---")

        if result.get("error"):
            print(f"  ERROR: {result['error']}")
            continue

        summary = result["summary"]
        print(f"  Total vulnerabilities: {summary['total']}")
        print(f"  Critical: {summary.get('critical', 0)}")
        print(f"  High: {summary.get('high', 0)}")
        print(f"  Medium: {summary.get('medium', 0)}")
        print(f"  Low: {summary.get('low', 0)}")

        if result["vulnerabilities"]:
            print("\n  Findings:")
            for vuln in result["vulnerabilities"][:20]:  # Limit output
                print(f"    - {vuln.get('package', 'unknown')}: "
                      f"{vuln.get('vulnerability_id', vuln.get('description', 'N/A'))}")

    print(f"\n{'=' * 60}")
    print(f"  Overall status: {report['overall_status'].upper()}")
    print(f"  Total vulnerabilities: {report['total_vulnerabilities']}")
    print(f"  Critical + High: {report['critical_and_high']}")
    print("=" * 60 + "\n")


def main() -> int:
    """Run the dependency audit and return an exit code.

    Returns:
        int: 0 if no critical/high vulnerabilities found, 1 otherwise.
    """
    parser = argparse.ArgumentParser(
        description="Audit Python and Node.js dependencies for vulnerabilities"
    )
    parser.add_argument(
        "--python-only", action="store_true", help="Only audit Python dependencies"
    )
    parser.add_argument(
        "--node-only", action="store_true", help="Only audit Node.js dependencies"
    )
    parser.add_argument(
        "--output", type=str, help="Write JSON report to file"
    )
    parser.add_argument(
        "--ci", action="store_true", help="CI mode: exit 1 on critical/high findings"
    )
    args = parser.parse_args()

    python_results = None
    node_results = None

    if not args.node_only:
        print("Auditing Python dependencies...")
        requirements_file = BACKEND_DIR / "requirements.txt"
        python_results = run_pip_audit(requirements_file)

    if not args.python_only:
        print("Auditing Node.js dependencies...")
        node_results = run_npm_audit()

    report = generate_report(python_results, node_results)
    print_report(report)

    if args.output:
        output_path = Path(args.output)
        output_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Report written to: {output_path}")

    if args.ci and report["overall_status"] == "fail":
        print("CI mode: Failing due to critical/high vulnerabilities")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
