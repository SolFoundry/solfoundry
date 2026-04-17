# GitHub Issue Scraper for SolFoundry Bounties

Automatically scrapes GitHub issues from configured repositories and posts them as SolFoundry bounties with appropriate reward tiers.

## Features

- **Periodic Scraping**: Polls configured GitHub repositories on a configurable interval (default: 30 minutes)
- **Webhook Support**: Receives GitHub webhook events for real-time issue updates (issues, labels, milestones)
- **Reward Tier Mapping**: Automatically maps GitHub labels to SolFoundry bounty tiers (T1/T2/T3)
- **Deduplication**: Tracks already-imported issues to prevent duplicate bounties
- **Configurable Repositories**: Manage watched repos via YAML config or API endpoints
- **HMAC Verification**: Validates GitHub webhook signatures for security

## Architecture

```
GitHub Repositories
    |          |
    v          v
  Poller    Webhook Endpoint
    |          |
    v          v
  Issue Processor
    |
    v
  SolFoundry API (POST /api/bounties)
```

## Configuration

Set these environment variables (or use `.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_TOKEN` | — | GitHub PAT for API access (higher rate limits) |
| `GITHUB_WEBHOOK_SECRET` | — | Secret for HMAC webhook verification |
| `SOLFOUNRY_API_URL` | `http://localhost:8000` | SolFoundry backend URL |
| `SOLFOUNRY_API_TOKEN` | — | Auth token for SolFoundry API |
| `SCRAPING_INTERVAL_SECONDS` | `1800` | Polling interval (30 min) |
| `DATABASE_URL` | `sqlite+aiosqlite:///./scraper.db` | Database for dedup tracking |
| `REPO_CONFIG_PATH` | `./repos.yaml` | Path to repository config |
| `REDIS_URL` | — | Redis URL (optional, for distributed locking) |

## Repository Configuration (`repos.yaml`)

```yaml
repositories:
  - owner: SolFoundry
    repo: solfoundry
    label_mapping:
      bounty: true           # Required label to qualify as bounty
      tier-1: 1              # Maps to T1
      tier-2: 2              # Maps to T2
      tier-3: 3              # Maps to T3
    default_tier: 2           # Fallback tier if no tier label
    default_reward:
      1: 200000              # T1: 200K $FNDRY
      2: 600000              # T2: 600K $FNDRY
      3: 1200000             # T3: 1.2M $FNDRY
    category: backend
    enabled: true

  - owner: some-org
    repo: some-repo
    label_mapping:
      bounty: true
      tier-1: 1
      tier-2: 2
      tier-3: 3
    default_tier: 1
    default_reward:
      1: 200000
      2: 600000
      3: 1200000
    category: smart-contract
    enabled: true
```

## Running

```bash
# Install dependencies
pip install -r requirements.txt

# Run the service
uvicorn app.main:app --host 0.0.0.0 --port 8001

# Or with Docker
docker build -f Dockerfile.github-scraper -t solfoundry/github-scraper .
docker run -p 8001:8001 --env-file .env solfoundry/github-scraper
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/webhooks/github` | GitHub webhook receiver |
| `GET` | `/api/scraper/repos` | List watched repositories |
| `POST` | `/api/scraper/repos` | Add a repository to watch |
| `DELETE` | `/api/scraper/repos/{owner}/{repo}` | Remove a watched repository |
| `POST` | `/api/scraper/trigger` | Manually trigger a scrape |
| `GET` | `/api/scraper/status` | Scraper status and last run info |
| `GET` | `/api/scraper/history` | Import history |

## Webhook Setup

1. Set `GITHUB_WEBHOOK_SECRET` in your environment
2. Configure GitHub webhook in repo Settings → Webhooks:
   - **Payload URL**: `https://your-scraper-host/api/webhooks/github`
   - **Content type**: `application/json`
   - **Secret**: Your `GITHUB_WEBHOOK_SECRET`
   - **Events**: Issues, Label, Milestone

## License

MIT