# Autonomous Bounty Hunter Agent

An autonomous multi-agent system for SolFoundry that finds, analyzes, implements, tests, and submits solutions for GitHub bounty issues — entirely automatically.

## Overview

Built for **Bounty #861** — *Full Autonomous Bounty-Hunting Agent* — this agent implements a state machine that:

1. **Scans** for open bounties via GitHub API (filtered by `bounty` label)
2. **Analyzes** each issue's requirements and codebase context
3. **Plans** implementation using an LLM planner
4. **Implements** code by writing/editing files in a local fork
5. **Tests** using the project's existing test framework
6. **Submits** a properly formatted PR to the SolFoundry repo

## Architecture

```
BountyHunterAgent (state machine)
├── GitHubClient     — GitHub API: list issues, create branches, push, create PRs
├── Planner          — LLM: generate implementation plans and code
├── Coder            — Local file operations: write, commit, push
└── Tester           — Detect framework, run tests, parse results
```

## State Machine

```
IDLE → SCANNING → ANALYZING → PLANNING → IMPLEMENTING → TESTING → SUBMITTING → DONE
                                                                         ↓
                                                                    BLOCKED (retry)
```

## Installation

```bash
# Requires Python 3.10+
pip install -e automaton/bounty_hunter

# Or install dependencies manually
pip install openai  # Optional, for LLM planning
```

## Configuration

Set these environment variables:

```bash
export GITHUB_TOKEN="ghp_your_token_here"
export OPENAI_API_KEY="sk-your-key"  # Optional, enables LLM planning
```

## Usage

### CLI

```bash
# Scan for open bounties
python -m automaton.bounty_hunter.agent --scan

# Hunt a specific bounty
python -m automaton.bounty_hunter.agent --bounty 861

# Auto-select best available bounty
python -m automaton.bounty_hunter.agent
```

### Python API

```python
from automaton.bounty_hunter import BountyHunterAgent, AgentConfig

config = AgentConfig(
    github_owner="your-github-username",
    github_repo="solfoundry",
    wallet_address="YourSolanaWalletAddress",
)

agent = BountyHunterAgent(config)

# Hunt a specific bounty
result = agent.run(bounty_number=861)
print(f"PR: {result.pr_url}")

# Or auto-select the best bounty
result = agent.hunt_best_bounty()
```

## Output

When a bounty is successfully hunted:

- A new branch in your fork: `feat/bounty-hunter-{number}`
- Files written and committed
- Tests run (if applicable)
- PR submitted to SolFoundry/solfoundry with:
  - `Closes #{number}` reference
  - Implementation plan in PR body
  - Your wallet address for payout

## Bounty Tiers & Scores

| Tier | Min Score | Reward | Notes |
|------|-----------|--------|-------|
| T1 | 6.0/10 | Up to $100 | Open race |
| T2 | 6.5/10 | $100–$500 | Assigned bounty |
| T3 | 7.0/10 | $500+ | Full autonomy |

## Module Reference

- `agent.py` — Main `BountyHunterAgent` class + `AgentConfig`
- `github_client.py` — `GitHubClient` + `Bounty` dataclass
- `planner.py` — `Planner` (LLM-based) + `ImplementationPlan`
- `coder.py` — `Coder` for local file operations
- `tester.py` — `Tester` for test execution + `TestResult`

## License

MIT — SolFoundry Bounty Platform
