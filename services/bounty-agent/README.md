# Bounty Agent — Autonomous Bounty-Hunting Agent

A fully autonomous multi-agent system that finds bounties, analyzes requirements, implements solutions, runs tests, and submits PRs without human intervention.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│  Discovery   │────▶│   Planner    │────▶│  Implementer │────▶│  Reviewer   │
│   Agent      │     │    Agent     │     │    Agent      │     │   Agent     │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
       │                   │                     │                    │
       ▼                   ▼                     ▼                    ▼
  GitHub Issues      Task Breakdown        Code Generation      PR Submission
  Bounty Board       Requirements          File Changes          & Formatting
```

## Components

- **Discovery Agent**: Scans GitHub issues labeled as bounties, filters by tier and domain
- **Planner Agent**: Analyzes requirements, breaks down tasks, creates implementation plan
- **Implementer Agent**: Generates code changes based on the plan using LLM orchestration
- **Reviewer Agent**: Runs tests, validates changes, formats and submits PRs

## Setup

```bash
cd services/bounty-agent
pip install -r requirements.txt
cp .env.example .env  # Edit with your GitHub token and LLM config
python -m app.main
```

## Configuration

Set these environment variables:

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token |
| `LLM_PROVIDER` | `ollama` or `openai` |
| `LLM_MODEL` | Model name (e.g. `glm-5.1:cloud`) |
| `LLM_BASE_URL` | LLM API endpoint |
| `TARGET_REPOS` | Comma-separated repos to scan |
| `DRY_RUN` | If `true`, skip actual PR submission |
| `MAX_BOUNTIES` | Max bounties to process per cycle |

## Usage

```bash
# Run one cycle
python -m app.main --once

# Run continuously (daemon mode)
python -m app.main --daemon --interval 300

# Target specific bounty
python -m app.main --bounty 861
```

## Testing

```bash
pytest tests/ -v
```