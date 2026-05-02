# Deployment Guide — OpenClaw Bounty Agent

> Production-grade deployment with Docker, CI/CD, and full observability stack.
> Bounty #861 | SolFoundry/solfoundry

---

## Prerequisites

- **Python 3.11+** (3.12 recommended)
- **Docker** 24+ and **Docker Compose** v2
- **GitHub CLI** (`gh`) authenticated
- **GitHub Token** with `repo` and `public_repo` scopes
- **8GB RAM** minimum for full stack (agent + DB + Redis + monitoring)

---

## Quick Start (Local Development)

```bash
# 1. Clone and install
git clone https://github.com/508704820/solfoundry.git
cd solfoundry
pip install -r bounty_agent/requirements.txt

# 2. Set environment
export GITHUB_TOKEN="ghp_your_token_here"

# 3. Scan for bounties
python main_bounty_agent.py --scan --keywords "bounty"

# 4. Run full autonomous cycle
python main_bounty_agent.py --run

# 5. Check team status
python main_bounty_agent.py --status
```

---

## Docker Deployment (Recommended for Production)

### Single Container

```bash
# Build the image
docker build -f Dockerfile.bounty-agent -t bounty-agent:latest .

# Run with environment
docker run -d \
  --name bounty-agent \
  -e GITHUB_TOKEN="ghp_your_token" \
  -e ANTHROPIC_API_KEY="sk-ant-xxx" \
  -p 8080:8080 \
  -v agent_data:/home/bountyagent/app/data \
  bounty-agent:latest
```

### Full Stack with Docker Compose

```bash
# 1. Configure environment
cp .env.bounty-agent.example .env
# Edit .env with your tokens

# 2. Start all services
docker compose -f docker-compose.bounty-agent.yml up -d

# 3. Verify all services are healthy
docker compose -f docker-compose.bounty-agent.yml ps

# 4. View agent logs
docker compose -f docker-compose.bounty-agent.yml logs -f bounty-agent

# 5. Open Grafana dashboard
open http://localhost:3001  # admin / bountyagent_dev
```

### Stack Components

| Service | Port | Purpose |
|---------|------|---------|
| **bounty-agent** | 8080 | Main autonomous agent |
| **bounty-scheduler** | — | Cron-like bounty scanner |
| **PostgreSQL** | 5433 | State persistence + earnings |
| **Redis** | 6380 | Event bus + caching |
| **Prometheus** | 9090 | Metrics collection |
| **Grafana** | 3001 | Dashboard visualization |

### Resource Limits

| Service | Memory Limit | CPU Limit |
|---------|-------------|-----------|
| bounty-agent | 1GB | 1.0 |
| bounty-scheduler | 512MB | 0.5 |
| PostgreSQL | 256MB | — |
| Redis | 128MB | — |

> ⚠️ Total stack requires ~2GB RAM. On Mac Mini 16GB, this leaves ample headroom for 7 gateway instances.

---

## Running Tests

```bash
# Install test dependencies
pip install -r bounty_agent/requirements.txt

# Run all tests with coverage
PYTHONPATH=. pytest bounty_agent/tests/ tests/ -v \
  --cov=bounty_agent \
  --cov-report=term-missing \
  --cov-fail-under=60

# Run specific test module
pytest bounty_agent/tests/test_orchestrator.py -v

# Run with Docker
docker compose -f docker-compose.bounty-agent.yml exec bounty-agent \
  pytest bounty_agent/tests/ -v
```

---

## CI/CD Pipeline

The Bounty Agent uses GitHub Actions for automated testing and deployment:

### Pipeline Stages

```
Push/PR → Lint + Type Check → Test (Python 3.11/3.12) → Docker Build → Deploy
                ↓                    ↓                       ↓
            Ruff/Bandit         Pytest + Coverage        Trivy Scan
            MyPy               PostgreSQL + Redis        Multi-platform
```

### Triggering Deployments

- **Automatic**: Push to `main` → deploy to staging
- **Manual**: `workflow_dispatch` → choose staging or production

### Security Scans

- **Bandit** — Python static security analysis
- **Trivy** — Container vulnerability scanning
- **MyPy** — Type safety verification

---

## Gateway Configuration

For production deployment with real OpenClaw gateways:

1. Set up 7 gateway instances on ports 18789-18795
2. Configure each gateway with appropriate models:
   - GW-1: GLM-5.1 (甘九真, 诺依, 铁兰, 司雨-S)
   - GW-2: Kimi-K2.5 (千绘)
   - GW-3: GLM-5.1 (烛心)
3. Update `config.bounty-agent.yaml` with gateway URLs
4. Set `GITHUB_TOKEN` and LLM API keys

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GITHUB_TOKEN` | ✅ | — | GitHub PAT (Classic, repo+public_repo) |
| `GITHUB_USERNAME` | No | — | Username for PR attribution |
| `ANTHROPIC_API_KEY` | No | — | Claude API key for LLM analysis |
| `OPENAI_API_KEY` | No | — | OpenAI API key |
| `DATABASE_URL` | No | SQLite | PostgreSQL connection string |
| `REDIS_URL` | No | — | Redis URL for event bus |
| `AGENT_MAX_CONCURRENT` | No | 5 | Max concurrent bounty tasks |
| `AGENT_SCAN_INTERVAL` | No | 300 | Seconds between scans |
| `AGENT_CONFIDENCE_THRESHOLD` | No | 0.8 | Min confidence to act |
| `MOLTSPAY_WALLET` | No | — | Solana wallet for payouts |
| `SOLANA_RPC_URL` | No | devnet | Solana RPC endpoint |

---

## Monitoring & Observability

### Health Checks

- **Agent**: `curl http://localhost:8080/health`
- **PostgreSQL**: `docker exec solfoundry-bounty-db pg_isready`
- **Redis**: `docker exec solfoundry-bounty-redis redis-cli ping`

### Metrics (Prometheus)

- `bounty_agent_bounties_scanned_total` — Total bounties discovered
- `bounty_agent_bounties_completed_total` — Bounties successfully submitted
- `bounty_agent_earnings_total` — Total RTC earned
- `bounty_agent_errors_total` — Error count by type
- `bounty_agent_circuit_breaker_state` — 0=closed, 1=half-open, 2=open
- `bounty_agent_active_agents` — Currently running agents
- `bounty_agent_relay_messages_total` — Inter-agent messages sent
- `bounty_agent_llm_tokens_total` — LLM API token usage

### Alert Rules

| Alert | Severity | Condition |
|-------|----------|-----------|
| BountyAgentDown | Critical | Agent unreachable 2m |
| HighErrorRate | Warning | Error rate > 0.1/s for 5m |
| NoEarningsFor24h | Warning | Zero earnings in 24h |
| CircuitBreakerOpen | Critical | Circuit breaker tripped |
| HighMemoryUsage | Warning | Memory > 850MB for 5m |

---

## Disaster Recovery

### Backup Strategy (3-2-1)

- **3 copies** of state data (live + Docker volume + S3)
- **2 different media** (local SSD + cloud object storage)
- **1 offsite** (cloud backup)

### Recovery Procedure

```bash
# 1. Stop the agent
docker compose -f docker-compose.bounty-agent.yml down

# 2. Restore PostgreSQL from backup
docker exec -i solfoundry-bounty-db pg_restore < backup.dump

# 3. Restore agent state
docker run --rm -v agent_state:/data -v $(pwd)/backup:/backup \
  alpine tar xzf /backup/agent-state.tar.gz -C /data

# 4. Restart services
docker compose -f docker-compose.bounty-agent.yml up -d

# 5. Verify health
curl http://localhost:8080/health
```

---

## Security Hardening

- ✅ Non-root container user (`bountyagent`)
- ✅ Multi-stage build (minimal attack surface)
- ✅ Pinned dependency versions
- ✅ Trivy container scanning in CI
- ✅ Bandit Python security analysis
- ✅ No secrets in image layers (environment-only)
- ✅ Network isolation (dedicated `bounty-net` bridge)
- ✅ Resource limits (memory + CPU capping)

---

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| Agent exits immediately | Missing `GITHUB_TOKEN` | Set env var in `.env` |
| 403 on PR creation | Fine-grained PAT | Use Classic PAT instead |
| OOM killed | Memory limit too low | Increase to 1.5GB in compose |
| Redis connection refused | Redis not ready | Check `docker compose ps redis` |
| No bounties found | GitHub API rate limit | Wait or use authenticated requests |

---

*Last updated: 2026-05-02 | Author: 司雨-S*
