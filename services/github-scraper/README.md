# SolFoundry GitHub Issue Scraper

A backend service that automatically scrapes GitHub issues from configured repositories and posts them as SolFoundry bounties with appropriate reward tiers.

## Features

- **Automatic GitHub issue detection** — Scans repositories for bounty-labeled issues
- **Smart tier estimation** — Infers reward tier from issue labels (T1/T2/T3)
- **Reward estimation** — Extracts reward amounts from labels like `reward:50-mrg`
- **Webhook support** — Real-time issue processing via GitHub webhooks
- **Deduplication** — Tracks already-posted issues to avoid duplicates
- **REST API** — Full API for manual scraping and status monitoring

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/scrape` | Scrape a specific repository |
| POST | `/api/v1/scrape/all` | Scrape all configured repositories |
| POST | `/api/v1/webhook` | GitHub webhook endpoint |
| GET | `/api/v1/stats` | Scraper statistics |

## Configuration

Environment variables (prefix: `SCRAPER_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPER_GITHUB_TOKEN` | `""` | GitHub API token |
| `SCRAPER_GITHUB_API_BASE` | `https://api.github.com` | GitHub API base URL |
| `SCRAPER_SOLFOUNDRY_API_URL` | `http://localhost:8000` | SolFoundry API base URL |
| `SCRAPER_SOLFOUNDRY_API_TOKEN` | `""` | SolFoundry API auth token |
| `SCRAPER_POLL_INTERVAL_SECONDS` | `300` | Polling interval |
| `SCRAPER_DEFAULT_REPOS` | `""` | Comma-separated repos (e.g., `owner/repo1,owner/repo2`) |
| `SCRAPER_REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `SCRAPER_DEBUG` | `false` | Enable debug logging |

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run with environment variables
SCRAPER_GITHUB_TOKEN=ghp_xxx \
SCRAPER_SOLFOUNDRY_API_URL=https://api.solfoundry.io \
SCRAPER_DEFAULT_REPOS=SolFoundry/solfoundry \
python -m app.main

# Docker
docker build -t solfoundry-github-scraper .
docker run -e SCRAPER_GITHUB_TOKEN=ghp_xxx -p 8010:8010 solfoundry-github-scraper
```

## Example

```bash
# Scrape a repository
curl -X POST http://localhost:8010/api/v1/scrape \
  -H "Content-Type: application/json" \
  -d '{"owner": "SolFoundry", "repo": "solfoundry", "labels": ["bounty", "good first issue"]}'

# Check health
curl http://localhost:8010/api/v1/health
```