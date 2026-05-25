# SolFoundry — Full Autonomous Bounty-Hunting Agent

> **Bounty:** #861 | **Tier:** T3 | **Reward:** 1,000,000 $FNDRY

A fully autonomous multi-agent system that discovers, analyzes, implements, tests, and submits bounty solutions without human intervention.

## Architecture

```
bounty-hunter/
├── pyproject.toml           # Python package configuration
├── README.md                # This file
├── bounty_hunter/
│   ├── __init__.py          # Package init, exports
│   ├── __main__.py          # CLI entry point
│   ├── config.py            # Environment & configuration
│   ├── discoverer.py        # Bounty discovery via GitHub API
│   ├── planner.py           # Requirements analysis → implementation plan
│   ├── implementer.py       # File creation and modification
│   ├── tester.py            # Test execution & validation
│   ├── submitter.py         # Git operations & PR submission
│   └── orchestrator.py      # Full pipeline coordinator
└── tests/
    ├── __init__.py
    └── test_bounty_hunter.py  # Unit & integration tests
```

## Pipeline

| Step | Component | Description |
|------|-----------|-------------|
| 1 | **Discoverer** | Finds bounty issues via `gh` CLI, parses tier/reward |
| 2 | **Planner** | Analyzes acceptance criteria, generates task list |
| 3 | **Implementer** | Creates/modifies files per the plan |
| 4 | **Tester** | Runs pytest, validates code quality, checks PR format |
| 5 | **Submitter** | Branches, commits, pushes, and submits PR via `gh` |
| 6 | **Orchestrator** | Coordinates all steps with logging and error handling |

## Usage

### CLI

```bash
# Install
pip install -e bounty-hunter/

# List open bounties
bounty-hunter discover

# Auto-hunt the best available bounty
bounty-hunter hunt

# Target a specific issue
bounty-hunter hunt --issue 861

# Dry run (plan only)
bounty-hunter hunt --dry-run

# Validate a PR body
bounty-hunter validate --file .pr_body.md
```

### Python API

```python
from bounty_hunter import Orchestrator

orch = Orchestrator()
bounties = orch.run_discover_only()  # List bounties
orch.run_full_pipeline(target_issue=861)  # Full pipeline
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WALLET_ADDRESS` | `7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU` | Solana wallet for $FNDRY payout |
| `REPO_OWNER` | `SolFoundry` | GitHub repo owner |
| `REPO_NAME` | `solfoundry` | GitHub repo name |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

## Multi-LLM Orchestration

The agent uses a modular architecture that supports multi-LLM analysis:

- **Planner** analyzes bounty requirements using rule-based extraction and optional LLM endpoints
- **Discoverer** validates claim status before committing to a bounty
- **Tester** runs quality gates including code style and missing CI warnings

## Test Coverage

```bash
cd bounty-hunter && python3 -m pytest tests/ -v
```

Unit tests cover: config, discovery parsing, planning logic, PR validation, PR body generation, and the full import chain.

## Quality Gates

- ✅ All PRs include `Closes #N` and wallet address
- ✅ Tests run before PR submission
- ✅ Code quality check (no AI slop / excessive TODOs)
- ✅ No hardcoded secrets
- ✅ Follows SolFoundry PR template exactly
