from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from bounty_agent.models import Bounty, DiscoveryCriteria
from bounty_agent.utils.reporting import detailed_report, summarize_report
from bounty_agent.workflows.bounty_hunt import BountyHuntingWorkflow


def load_marketplace(path: Path) -> list[Bounty]:
    raw_items = json.loads(path.read_text())
    return [Bounty(**item) for item in raw_items]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Autonomous bounty-hunting multi-agent system")
    parser.add_argument("marketplace", type=Path, help="Path to a JSON file containing bounty definitions")
    parser.add_argument("--min-reward", type=int, default=1_000)
    parser.add_argument("--language", action="append", default=[])
    parser.add_argument("--exclude-tag", action="append", default=[])
    parser.add_argument("--max-difficulty", default=None)
    parser.add_argument("--json", action="store_true", help="Emit full JSON execution reports")
    parser.add_argument("--detailed", action="store_true", help="Emit detailed text reports")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    marketplace = load_marketplace(args.marketplace)
    workflow = BountyHuntingWorkflow.build_default()
    criteria = DiscoveryCriteria(
        min_reward_usd=args.min_reward,
        preferred_languages=args.language,
        excluded_tags=args.exclude_tag,
        max_difficulty=args.max_difficulty,
    )
    reports = workflow.run(marketplace, criteria)
    if args.json:
        print(json.dumps([asdict(report) for report in reports], indent=2))
    else:
        for report in reports:
            print(detailed_report(report) if args.detailed else summarize_report(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
