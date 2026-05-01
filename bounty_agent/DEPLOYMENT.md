# Deployment Guide

## Prerequisites

- Python 3.10+
- GitHub CLI (`gh`) authenticated
- GitHub Token with `repo` and `public_repo` scopes

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/solfoundry.git
cd solfoundry
pip install -e .

# 2. Set environment
export GITHUB_TOKEN="ghp_your_token_here"

# 3. Scan for bounties
python main_bounty_agent.py --scan --keywords "bounty"

# 4. Run full autonomous cycle
python main_bounty_agent.py --run

# 5. Check team status
python main_bounty_agent.py --status
```

## Running Tests

```bash
pip install pytest
PYTHONPATH=. pytest bounty_agent/tests/ -v
```

Expected output: **34 passed** (unit + integration tests)

## Docker Deployment (Optional)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install -e .
CMD ["python", "main_bounty_agent.py", "--run"]
```

```bash
docker build -t bounty-agent .
docker run -e GITHUB_TOKEN="ghp_xxx" bounty-agent
```

## Gateway Configuration

For production deployment with real gateways:

1. Set up 7 OpenClaw gateway instances on ports 18789-18795
2. Configure each gateway with the appropriate models
3. Update `config.bounty-agent.yaml` with gateway URLs
4. Set `GITHUB_TOKEN` and `SOLFOUNDRY_API_KEY` environment variables

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub PAT with repo + public_repo |
| `SOLFOUNDRY_API_KEY` | No | SolFoundry API key for bounty posting |
| `GITHUB_USERNAME` | No | GitHub username for PR attribution |

## Monitoring

- Team status: `python main_bounty_agent.py --status`
- Logs: Check stdout for scan/execution logs
- PR tracking: All submitted PRs stored in agent session state
