"""Bounty Agent — Autonomous Bounty-Hunting Agent CLI."""
import argparse
import asyncio
import json
import sys

from app.orchestrator import BountyOrchestrator
from app.config import config


def main():
    parser = argparse.ArgumentParser(description="Bounty Agent — Autonomous Bounty-Hunting Agent")
    parser.add_argument("--once", action="store_true", help="Run one cycle then exit")
    parser.add_argument("--daemon", action="store_true", help="Run continuously")
    parser.add_argument("--interval", type=int, default=300, help="Seconds between cycles (daemon mode)")
    parser.add_argument("--bounty", type=int, help="Process a specific bounty number")
    parser.add_argument("--dry-run", action="store_true", help="Skip PR submission")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()

    if args.dry_run:
        config.DRY_RUN = True

    orchestrator = BountyOrchestrator()

    if args.once or args.bounty:
        results = asyncio.run(orchestrator.run_once(bounty_number=args.bounty))
        print("\n" + "=" * 60)
        print("RESULTS")
        print("=" * 60)
        for r in results:
            print(f"\nBounty #{r.get('bounty', '?')}: {r.get('title', '?')}")
            print(f"  Status: {r.get('status', '?')}")
            if r.get("pr", {}).get("pr_url"):
                print(f"  PR: {r['pr']['pr_url']}")
            if r.get("error"):
                print(f"  Error: {r['error']}")
    elif args.daemon:
        print(f"Starting Bounty Agent daemon (interval: {args.interval}s)")
        print(f"Watching repos: {config.TARGET_REPOS}")
        print(f"Dry run: {config.DRY_RUN}")
        asyncio.run(orchestrator.run_daemon(interval=args.interval))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()