#!/usr/bin/env python3
"""Batch bounty creation from a directory of YAML spec files.

Reads all .yaml/.yml files from the given directory, validates each against
tier-specific rules, and creates bounties for all valid specs. Provides a
summary report of successes and failures.

Usage:
    python3 scripts/create-bounties.py specs/
    python3 scripts/create-bounties.py specs/ --json
    python3 scripts/create-bounties.py specs/ --dry-run

Exit codes:
    0 — all specs processed successfully (or dry-run)
    1 — one or more specs failed validation
    2 — directory not found or no YAML files

Examples:
    # Create bounties from all specs in a directory
    python3 scripts/create-bounties.py specs/

    # Dry-run: validate only, do not create bounties
    python3 scripts/create-bounties.py specs/ --dry-run

    # JSON output for programmatic consumption
    python3 scripts/create-bounties.py specs/ --json
"""

import argparse
import json
import sys
from pathlib import Path

# Add the backend directory to the Python path so we can import app modules
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.models.bounty import BountyCreate, BountyTier
from app.services.bounty_spec_service import (
    parse_yaml_file,
    validate_spec,
    generate_labels,
)
from app.services import bounty_service


def process_directory(directory: str, dry_run: bool = False) -> dict:
    """Process all YAML spec files in a directory.

    Iterates over all .yaml/.yml files, validates each, and optionally
    creates bounties for valid specs. Returns a summary report.

    Args:
        directory: Path to the directory containing YAML spec files.
        dry_run: If True, validate only without creating bounties.

    Returns:
        Dict with 'total', 'created', 'failed', and 'results' keys.
    """
    path = Path(directory)
    if not path.is_dir():
        return {
            "total": 0,
            "created": 0,
            "failed": 0,
            "results": [{
                "filename": directory,
                "success": False,
                "error": f"Directory not found: {directory}",
            }],
        }

    yaml_files = sorted(
        f for f in path.iterdir()
        if f.suffix.lower() in (".yaml", ".yml") and f.is_file()
    )

    if not yaml_files:
        return {
            "total": 0,
            "created": 0,
            "failed": 0,
            "results": [{
                "filename": directory,
                "success": False,
                "error": "No YAML files found in directory.",
            }],
        }

    results = []
    created_count = 0
    failed_count = 0

    for yaml_file in yaml_files:
        spec, parse_error = parse_yaml_file(str(yaml_file))

        if parse_error:
            results.append({
                "filename": yaml_file.name,
                "success": False,
                "error": parse_error,
            })
            failed_count += 1
            continue

        assert spec is not None
        validation = validate_spec(spec)

        if not validation.valid:
            error_findings = [
                {"field": f.field, "severity": f.severity.value, "message": f.message}
                for f in validation.findings
            ]
            results.append({
                "filename": yaml_file.name,
                "success": False,
                "error": f"Validation failed with {validation.error_count} error(s)",
                "findings": error_findings,
            })
            failed_count += 1
            continue

        if dry_run:
            results.append({
                "filename": yaml_file.name,
                "success": True,
                "dry_run": True,
                "labels": validation.labels,
            })
            created_count += 1
            continue

        # Create the bounty via the bounty service
        tier_map = {1: BountyTier.T1, 2: BountyTier.T2, 3: BountyTier.T3}
        bounty_data = BountyCreate(
            title=spec.title,
            description=spec.description,
            tier=tier_map[spec.tier],
            reward_amount=float(spec.reward),
            github_issue_url=spec.github_issue_url,
            required_skills=spec.skills,
            deadline=spec.deadline,
            created_by=spec.created_by,
        )

        try:
            bounty_response = bounty_service.create_bounty(bounty_data)
            results.append({
                "filename": yaml_file.name,
                "success": True,
                "bounty_id": bounty_response.id,
                "labels": validation.labels,
            })
            created_count += 1
        except Exception as creation_error:
            results.append({
                "filename": yaml_file.name,
                "success": False,
                "error": f"Bounty creation failed: {creation_error}",
            })
            failed_count += 1

    return {
        "total": len(yaml_files),
        "created": created_count,
        "failed": failed_count,
        "results": results,
    }


def main() -> int:
    """Run batch bounty creation from a directory of YAML specs.

    Parses command-line arguments, processes the directory, and outputs
    results to stdout. Supports text, JSON, and dry-run modes.

    Returns:
        Exit code: 0 for all success, 1 for any failures, 2 for missing dir.
    """
    parser = argparse.ArgumentParser(
        description="Create bounties from a directory of YAML spec files.",
        epilog="Exit codes: 0 = all passed, 1 = some failed, 2 = dir not found",
    )
    parser.add_argument(
        "directory",
        type=str,
        help="Path to directory containing YAML bounty spec files",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="json_output",
        help="Output results as JSON",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        dest="dry_run",
        help="Validate only — do not create bounties",
    )
    args = parser.parse_args()

    report = process_directory(args.directory, dry_run=args.dry_run)

    if args.json_output:
        print(json.dumps(report, indent=2, default=str))
    else:
        mode = " (DRY RUN)" if args.dry_run else ""
        print(f"Batch Bounty Creation{mode}")
        print(f"  Directory: {args.directory}")
        print(f"  Total: {report['total']} | Created: {report['created']} | Failed: {report['failed']}")
        print()

        for result in report["results"]:
            if result["success"]:
                status_label = "OK   " if not args.dry_run else "VALID"
                bounty_info = f" → {result.get('bounty_id', 'dry-run')}"
                labels_info = f" [{', '.join(result.get('labels', []))}]"
                print(f"  [{status_label}] {result['filename']}{bounty_info}{labels_info}")
            else:
                print(f"  [FAIL ] {result['filename']}: {result.get('error', 'Unknown error')}")
                for finding in result.get("findings", []):
                    severity = finding["severity"].upper()
                    prefix = "ERROR" if severity == "ERROR" else "WARN "
                    print(f"          [{prefix}] {finding['field']}: {finding['message']}")

    if report["total"] == 0:
        return 2
    if report["failed"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
