# Autonomous Bounty-Hunting Agent

## Architecture

```
┌─────────────────────────────────────────────┐
│          AutonomousBountyAgent               │
│           (Orchestrator)                     │
├──────┬──────┬───────┬──────┬─────────────────┤
│      │      │       │      │                 │
▼      ▼      ▼       ▼      ▼                 │
Scan  Plan  Implement Submit Review            │
      │                                          │
      └──────── Loop ───────────────────────────┘
```

## Modules

| Module | File | Description |
|--------|------|-------------|
| BountyScanner | discovery.py | GitHub issue discovery with priority ranking |
| BountyPlanner | planner.py | Multi-department task decomposition |
| PRSubmitter | submitter.py | Formatted PR generation with multi-LLM review |
| AutonomousBountyAgent | orchestrator.py | Full orchestration pipeline |

## Pipeline

1. **Discover** — Scan target repos for open bounty issues
2. **Analyze** — Rank by priority (tier, reward, difficulty)
3. **Plan** — Decompose into subtasks, assign to departments
4. **Implement** — Generate code changes for each subtask
5. **Review** — Multi-LLM code review (format, security, quality)
6. **Submit** — Create formatted PR with proper description

## Deployment

```bash
# Set environment variable
export GITHUB_TOKEN="your_token"

# Run the agent
python main_bounty_agent.py --repo SolFoundry/solfoundry --max-bounties 5
```

## Testing

```bash
# Unit tests
python -m pytest tests/test_discovery.py -v
python -m pytest tests/test_planner.py -v

# Integration tests
python -m pytest tests/test_integration.py -v
```

## Security

- All API tokens read from environment variables only
- No hardcoded credentials in source code
- PR submissions include security review step
- Config file references env vars, not actual tokens
