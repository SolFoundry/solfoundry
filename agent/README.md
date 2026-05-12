# SolFoundry Autonomous Bounty-Hunting Agent

Multi-LLM agent system that autonomously finds, analyzes, implements, tests, and submits bounty solutions.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Orchestrator Agent              │
│  (Planning, coordination, decision-making)   │
├──────────┬──────────┬──────────┬────────────┤
│  Scout   │ Analyst  │ Coder    │  Submitter │
│  Agent   │ Agent    │ Agent    │  Agent     │
│          │          │          │            │
│ Find &   │ Read &   │ Implement│ Test & PR  │
│ Filter   │ Analyze  │ Solution │ Submit     │
│ Bounties │ Reqrmnts │ Code     │ Results    │
└──────────┴──────────┴──────────┴────────────┘
```

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GITHUB_TOKEN=ghp_...
export OPENAI_API_KEY=sk-...  # or OPENROUTER_API_KEY
export SOLANA_WALLET=...      # For bounty payment address

# Run the agent
python -m agent.main --config config.yaml

# Run specific phase only
python -m agent.main --phase scout
python -m agent.main --phase analyze --bounty 833
python -m agent.main --phase implement --bounty 833
python -m agent.main --phase submit --bounty 833
```

## Agent Phases

### 1. Scout — Discovery & Filtering
Scans SolFoundry and other bounty platforms for open bounties matching your skills.
Filters by: tier, comment count (competition), token value, tech stack, deadline.

### 2. Analyst — Requirement Analysis
Clones the repo, reads issue description, examines codebase structure,
identifies files to modify, estimates effort, and generates an implementation plan.

### 3. Coder — Solution Implementation
Creates a feature branch, implements the solution according to the plan,
runs linters and tests, and commits with proper messages.

### 4. Submitter — PR Creation & Submission
Pushes to fork, opens PR against upstream with full description,
includes wallet address for payment, and monitors PR status.

## Configuration

See `config.yaml` for all options including:
- Bounty platforms and API endpoints
- Skill filters and blacklist patterns
- LLM model selection per agent
- Rate limits and retry settings
- Wallet and payment configuration
