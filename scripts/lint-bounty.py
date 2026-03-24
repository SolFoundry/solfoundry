#!/usr/bin/env python3
"""Bounty spec linter CLI.

Validates a YAML bounty spec file against tier-specific rules and reports
all findings (errors and warnings). Returns exit code 0 if the spec is valid,
or exit code 1 if any blocking errors are found.

Usage:
    python3 scripts/lint-bounty.py bounty.yaml
    python3 scripts/lint-bounty.py specs/tier2-devops.yaml --json

Exit codes:
    0 — spec is valid (may have warnings)
    1 — spec has blocking errors
    2 — file not found or unparseable

Examples:
    # Lint a single spec file
    python3 scripts/lint-bounty.py bounty.yaml

    # Lint with JSON output for CI integration
    python3 scripts/lint-bounty.py bounty.yaml --json

    # Lint multiple files in sequence
    for f in specs/*.yaml; do python3 scripts/lint-bounty.py "$f"; done
"""

import argparse
import json
import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import app modules
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.bounty_spec_service import parse_yaml_file, validate_spec


def format_finding_text(finding_dict: dict) -> str:
    """Format a single validation finding for terminal output.

    Args:
        finding_dict: Dict with 'field', 'severity', and 'message' keys.

    Returns:
        Formatted string with severity indicator and field context.
    """
    severity = finding_dict["severity"].upper()
    prefix = "ERROR" if severity == "ERROR" else "WARN "
    return f"  [{prefix}] {finding_dict['field']}: {finding_dict['message']}"


def main() -> int:
    """Run the bounty spec linter on a single YAML file.

    Parses command-line arguments, reads and validates the spec file,
    and outputs findings to stdout. Supports both human-readable text
    and JSON output formats.

    Returns:
        Exit code: 0 for valid, 1 for errors, 2 for parse failures.
    """
    parser = argparse.ArgumentParser(
        description="Lint a bounty spec YAML file against tier-specific rules.",
        epilog="Exit codes: 0 = valid, 1 = errors found, 2 = parse failure",
    )
    parser.add_argument(
        "file",
        type=str,
        help="Path to the YAML bounty spec file to validate",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="json_output",
        help="Output results as JSON (for CI integration)",
    )
    args = parser.parse_args()

    # Parse the YAML file
    spec, parse_error = parse_yaml_file(args.file)

    if parse_error:
        if args.json_output:
            result = {
                "file": args.file,
                "valid": False,
                "parse_error": parse_error,
                "findings": [],
                "labels": [],
            }
            print(json.dumps(result, indent=2))
        else:
            print(f"FAIL: {args.file}")
            print(f"  Parse error: {parse_error}")
        return 2

    # Validate the parsed spec
    assert spec is not None
    validation = validate_spec(spec)

    if args.json_output:
        result = {
            "file": args.file,
            "valid": validation.valid,
            "error_count": validation.error_count,
            "warning_count": validation.warning_count,
            "findings": [
                {
                    "field": f.field,
                    "severity": f.severity.value,
                    "message": f.message,
                }
                for f in validation.findings
            ],
            "labels": validation.labels,
        }
        print(json.dumps(result, indent=2))
    else:
        status_label = "PASS" if validation.valid else "FAIL"
        print(f"{status_label}: {args.file}")
        print(f"  Tier: {spec.tier} | Category: {spec.category} | Reward: {spec.reward} $FNDRY")
        print(f"  Errors: {validation.error_count} | Warnings: {validation.warning_count}")

        if validation.findings:
            print("  Findings:")
            for finding in validation.findings:
                finding_dict = {
                    "field": finding.field,
                    "severity": finding.severity.value,
                    "message": finding.message,
                }
                print(format_finding_text(finding_dict))

        if validation.labels:
            print(f"  Labels: {', '.join(validation.labels)}")

    return 0 if validation.valid else 1


if __name__ == "__main__":
    sys.exit(main())
