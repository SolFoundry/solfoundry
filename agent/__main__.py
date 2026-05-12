"""CLI entry point for the SolFoundry Autonomous Bounty Agent."""

import argparse
import sys

from agent.orchestrator import OrchestratorAgent


def main():
    parser = argparse.ArgumentParser(
        description="SolFoundry Autonomous Bounty-Hunting Agent",
    )
    parser.add_argument(
        "--config", default="config.yaml",
        help="Path to configuration file",
    )
    parser.add_argument(
        "--phase",
        choices=["scout", "analyze", "implement", "submit"],
        help="Run only a specific phase",
    )
    parser.add_argument(
        "--bounty", type=int,
        help="Target a specific bounty by issue number",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Only scout and analyze, don't implement or submit",
    )

    args = parser.parse_args()

    orchestrator = OrchestratorAgent(config_path=args.config)

    if args.dry_run:
        # Only run scout phase
        orchestrator.run_all(phase="scout", bounty_id=args.bounty)
    else:
        orchestrator.run_all(phase=args.phase, bounty_id=args.bounty)


if __name__ == "__main__":
    main()
