#!/usr/bin/env python3
"""
CLI tool for AI Bounty Description Enhancer.

Usage:
    python -m backend.app.services.bounty_enhancer.cli enhance "title" "description"
    python -m backend.app.services.bounty_enhancer.cli enhance-file bounty.yaml
    python -m backend.app.services.bounty_enhancer.cli approve BOUNTY_ID --reviewer "user"
    python -m backend.app.services.bounty_enhancer.cli reject BOUNTY_ID --reviewer "user" --notes "reason"
    python -m backend.app.services.bounty_enhancer.cli list-pending
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Optional

from .models import (
    BountyInput,
    EnhancementRequest,
    ApprovalRequest,
    LLMProvider,
)
from .enhancer import BountyEnhancer


def load_api_keys() -> dict[LLMProvider, str]:
    """Load API keys from environment or .env file."""
    # Try loading from .env
    env_file = Path(".env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"'))

    return {
        LLMProvider.CLAUDE: os.getenv("CLAUDE_API_KEY", ""),
        LLMProvider.GPT: os.getenv("OPENAI_API_KEY", ""),
        LLMProvider.GEMINI: os.getenv("GEMINI_API_KEY", ""),
        LLMProvider.DEEPSEEK: os.getenv("DEEPSEEK_API_KEY", ""),
    }


def print_result(result) -> None:
    """Pretty print an enhancement result."""
    print(f"\n{'='*60}")
    print(f"Enhancement ID: {result.bounty_id}")
    print(f"Status: {result.status.value}")
    print(f"{'='*60}")

    print(f"\n📝 Original Title:\n  {result.original.title}")
    print(f"\n✨ Enhanced Title:\n  {result.final_title}")

    print(f"\n📝 Original Description:\n  {result.original.description[:200]}...")
    print(f"\n✨ Enhanced Description:\n  {result.final_description}")

    if result.final_requirements:
        print(f"\n📋 Requirements:")
        for i, req in enumerate(result.final_requirements, 1):
            print(f"  {i}. {req}")

    if result.final_acceptance_criteria:
        print(f"\n✅ Acceptance Criteria:")
        for i, crit in enumerate(result.final_acceptance_criteria, 1):
            print(f"  {i}. {crit}")

    if result.final_examples:
        print(f"\n💡 Examples:")
        for ex in result.final_examples:
            print(f"  • {ex}")

    print(f"\n🤖 LLM Suggestions ({len(result.suggestions)} providers):")
    for s in result.suggestions:
        status = "✓" if s.confidence_score >= 0.7 else "⚠"
        print(f"  {status} {s.provider.value}: {s.confidence_score:.2f} confidence ({s.processing_time_ms:.0f}ms)")

    print(f"\n{'='*60}\n")


async def cmd_enhance(args) -> int:
    """Enhance a bounty from command line arguments."""
    enhancer = BountyEnhancer(load_api_keys())

    bounty = BountyInput(
        title=args.title,
        description=args.description,
        tags=args.tags.split(",") if args.tags else [],
    )

    request = EnhancementRequest(
        bounty=bounty,
        auto_approve=args.auto_approve,
    )

    result = await enhancer.enhance(request)
    print_result(result)

    if args.output:
        out = {
            "bounty_id": result.bounty_id,
            "status": result.status.value,
            "original": {
                "title": result.original.title,
                "description": result.original.description,
            },
            "enhanced": {
                "title": result.final_title,
                "description": result.final_description,
                "requirements": result.final_requirements,
                "acceptance_criteria": result.final_acceptance_criteria,
                "examples": result.final_examples,
            },
            "suggestions": [
                {
                    "provider": s.provider.value,
                    "confidence": s.confidence_score,
                    "reasoning": s.reasoning,
                }
                for s in result.suggestions
            ],
        }
        Path(args.output).write_text(json.dumps(out, indent=2))
        print(f"📄 Output saved to {args.output}")

    return 0


async def cmd_enhance_file(args) -> int:
    """Enhance a bounty from YAML/JSON file."""
    import yaml  # Lazy import

    path = Path(args.file)
    if not path.exists():
        print(f"Error: File not found: {path}", file=sys.stderr)
        return 1

    if path.suffix in (".yaml", ".yml"):
        data = yaml.safe_load(path.read_text())
    elif path.suffix == ".json":
        data = json.loads(path.read_text())
    else:
        print(f"Error: Unsupported file type: {path.suffix}", file=sys.stderr)
        return 1

    bounty = BountyInput(
        title=data.get("title", ""),
        description=data.get("description", ""),
        tags=data.get("tags", []),
        repository=data.get("repository"),
        issue_number=data.get("issue_number"),
    )

    enhancer = BountyEnhancer(load_api_keys())
    request = EnhancementRequest(
        bounty=bounty,
        auto_approve=args.auto_approve,
    )

    result = await enhancer.enhance(request)
    print_result(result)
    return 0


def cmd_approve(args) -> int:
    """Approve an enhancement."""
    enhancer = BountyEnhancer(load_api_keys())

    approval = ApprovalRequest(
        bounty_id=args.bounty_id,
        approved=True,
        reviewer=args.reviewer,
        notes=args.notes,
    )

    try:
        result = enhancer.review(approval)
        print(f"✅ Approved: {result.bounty_id}")
        print(f"   Final title: {result.final_title}")
        return 0
    except KeyError:
        print(f"Error: Bounty {args.bounty_id} not found", file=sys.stderr)
        return 1
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_reject(args) -> int:
    """Reject an enhancement."""
    enhancer = BountyEnhancer(load_api_keys())

    approval = ApprovalRequest(
        bounty_id=args.bounty_id,
        approved=False,
        reviewer=args.reviewer,
        notes=args.notes,
    )

    try:
        result = enhancer.review(approval)
        print(f"❌ Rejected: {result.bounty_id}")
        if args.notes:
            print(f"   Reason: {args.notes}")
        return 0
    except KeyError:
        print(f"Error: Bounty {args.bounty_id} not found", file=sys.stderr)
        return 1
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def cmd_list_pending(args) -> int:
    """List pending enhancements."""
    enhancer = BountyEnhancer(load_api_keys())
    pending = enhancer.list_pending()

    if not pending:
        print("No pending enhancements.")
        return 0

    print(f"\n📋 Pending Enhancements ({len(pending)}):\n")
    for r in pending:
        print(f"  [{r.bounty_id}] {r.original.title}")
        print(f"      → {r.final_title}")
        print(f"      Providers: {len(r.suggestions)}, Created: {r.created_at}")
        print()

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="AI Bounty Description Enhancer CLI"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # enhance command
    p_enhance = subparsers.add_parser("enhance", help="Enhance a bounty description")
    p_enhance.add_argument("title", help="Bounty title")
    p_enhance.add_argument("description", help="Bounty description")
    p_enhance.add_argument("--tags", help="Comma-separated tags")
    p_enhance.add_argument("--auto-approve", action="store_true", help="Auto-approve result")
    p_enhance.add_argument("--output", "-o", help="Output JSON file")
    p_enhance.set_defaults(func=cmd_enhance)

    # enhance-file command
    p_file = subparsers.add_parser("enhance-file", help="Enhance from YAML/JSON file")
    p_file.add_argument("file", help="YAML or JSON bounty spec file")
    p_file.add_argument("--auto-approve", action="store_true")
    p_file.set_defaults(func=cmd_enhance_file)

    # approve command
    p_approve = subparsers.add_parser("approve", help="Approve an enhancement")
    p_approve.add_argument("bounty_id", help="Enhancement ID")
    p_approve.add_argument("--reviewer", "-r", required=True, help="Reviewer name")
    p_approve.add_argument("--notes", "-n", help="Approval notes")
    p_approve.set_defaults(func=cmd_approve)

    # reject command
    p_reject = subparsers.add_parser("reject", help="Reject an enhancement")
    p_reject.add_argument("bounty_id", help="Enhancement ID")
    p_reject.add_argument("--reviewer", "-r", required=True, help="Reviewer name")
    p_reject.add_argument("--notes", "-n", help="Rejection reason")
    p_reject.set_defaults(func=cmd_reject)

    # list-pending command
    p_list = subparsers.add_parser("list-pending", help="List pending enhancements")
    p_list.set_defaults(func=cmd_list_pending)

    args = parser.parse_args()
    func = args.func

    if asyncio.iscoroutinefunction(func):
        return asyncio.run(func(args))
    return func(args)


if __name__ == "__main__":
    sys.exit(main())
