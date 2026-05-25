#!/usr/bin/env python3
"""Bounty Hunter CLI — autonomous bounty hunting for SolFoundry."""

import argparse
import logging
import sys

from bounty_hunter.config import Config
from bounty_hunter.orchestrator import Orchestrator


def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def main():
    parser = argparse.ArgumentParser(
        description="SolFoundry Autonomous Bounty Hunter Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  bounty-hunter discover           # List all open bounties
  bounty-hunter hunt               # Auto-select best bounty & run full pipeline
  bounty-hunter hunt --issue 861   # Target specific issue
  bounty-hunter validate           # Validate PR formatting
  bounty-hunter --version          # Show version
        """,
    )

    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    parser.add_argument("--version", action="store_true", help="Show version and exit")

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # discover
    subparsers.add_parser("discover", help="List available bounty issues")

    # hunt
    hunt_parser = subparsers.add_parser("hunt", help="Run the full autonomous pipeline")
    hunt_parser.add_argument("--issue", "-i", type=int, help="Target specific issue number")
    hunt_parser.add_argument("--dry-run", action="store_true", help="Plan only, no implementation")

    # validate
    validate_parser = subparsers.add_parser("validate", help="Validate a PR body")
    validate_parser.add_argument("--file", "-f", help="Path to PR body file to validate")
    validate_parser.add_argument("--text", "-t", help="PR body text to validate")

    args = parser.parse_args()

    if args.version:
        from bounty_hunter import __version__
        print(f"bounty-hunter v{__version__}")
        return 0

    setup_logging(args.verbose)

    config = Config()
    orchestrator = Orchestrator(config)

    if args.command == "discover":
        bounties = orchestrator.run_discover_only()
        print(f"\nFound {len(bounties)} available bounties:")
        for b in bounties:
            print(f"  #{b.number:4d} [{b.tier:2s}] {b.reward:12s} — {b.title[:70]}")
        return 0

    elif args.command == "hunt":
        if args.dry_run:
            bounties = orchestrator.run_discover_only()
            if bounties:
                print(f"\nDry-run mode. Would target: #{bounties[0].number}")
            return 0

        success = orchestrator.run_full_pipeline(target_issue=args.issue)
        return 0 if success else 1

    elif args.command == "validate":
        from bounty_hunter.tester import Tester
        if args.file:
            with open(args.file) as f:
                text = f.read()
        elif args.text:
            text = args.text
        else:
            print("Provide either --file or --text")
            return 1

        result = Tester.validate_pr_content(text)
        print(result.summary)
        for f in result.failures:
            print(f"  ✗ {f}")
        return 0 if result.passed else 1

    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
