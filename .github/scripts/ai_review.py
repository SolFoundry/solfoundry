#!/usr/bin/env python3
"""
SolFoundry Multi-LLM Code Review Pipeline

The review engine runs GPT-5.4 + Gemini 2.5 Pro + Grok 4 in parallel
with domain-aware scoring (frontend/backend/smart-contract/devops).

The actual review logic is hosted in a private repository and fetched
at runtime by the GitHub Actions workflow. This prevents contributors
from reverse-engineering the scoring criteria to game submissions.

What the review checks (general overview):
- Code quality, correctness, security, completeness, tests, integration
- Scoring weights adjusted per domain (smart contracts = strict on security)
- Tier-calibrated thresholds (T1: 6.0, T2: 7.0, T3: 8.0)
- Bounty spec compliance (graded against issue acceptance criteria)
- Spam filtering (10 automated checks before any LLM review)

Build great code and you'll pass. There are no shortcuts.
"""

raise RuntimeError(
    "This is a placeholder. The review engine is fetched from a private repo at runtime. "
    "If you see this error, the workflow failed to fetch the private review script."
)
