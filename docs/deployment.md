# Deployment Guide

> Complete guide for deploying SolFoundry to staging and production environments.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [First-time Setup](#first-time-setup)
- [Deploying](#deploying)
- [Rollback Procedure](#rollback-procedure)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Internet → Nginx (80/443) → Frontend (React/Nginx)
                          → Backend API (FastAPI, port 8000)
                                    ↓
                             PostgreSQL 15
                             Redis 7 (cache + queues)
                             Indexer (Solana event processor)
```

All services run as Docker containers managed by `docker-compose.prod.yml`.

---

## Prerequisites

- Docker ≥ 24.0
- Docker Compose v2 (bundled with Docker Desktop / Docker Engine)
- Access to the GitHub Container Registry (`ghcr.io`)
- SSH access to the target server

---

## Environment Variables

Create a `.env` file in the deployment directory. **Never commit this file.**

```bash
cp .env.example .env
nano .env
```

### Required Variables

| Variable          | Description                                  | Example                                          |
|-------------------|----------------------------------------------|--------------------------------------------------|
| `DATABASE_URL`    | PostgreSQL connection string                 | `postgresql://user:pass@postgres:5432/solfoundry` |
| `POSTGRES_PASSWORD` | Postgres password (used by postgres service) | `supersecret`                                   |
| `SECRET_KEY`      | Django/FastAPI secret key (32+ chars)        | `$(openssl rand -hex 32)`                        |
| `GITHUB_TOKEN`    | GitHub PAT for API access                    | `ghp_...`                                        |
| `IMAGE_TAG`       | Docker image tag to deploy                   | `v1.2.3` or `sha-abc1234`                        |

### Optional Variables

| Variable            | Default                                        | Description                        |
|---------------------|------------------------------------------------|------------------------------------|
| `REDIS_URL`         | `redis://redis:6379`                           | Redis connection string            |
| `SOLANA_RPC_URL`    | `https://api.mainnet-beta.solana.com`          | Solana RPC endpoint                |
| `HELIUS_API_KEY`    | —                                              | Helius API key for event indexing  |
| `SENTRY_DSN`        | —                                              | Sentry error tracking DSN          |
| `ALLOWED_ORIGINS`   | `https://solfoundry.io`                        | CORS allowed origins               |
| `LOG_LEVEL`         | `INFO`                                         | Logging verbosity                  |
| `SLACK_WEBHOOK_URL` | —                                              | Slack webhook for deploy alerts    |
| `ALERT_EMAIL`       | —                                              | Email for critical alerts          |

---

## First-time Setup

```bash
# 1. Clone and configure
git clone https://github.com/SolFoundry/solfoundry.git /opt/solfoundry
cd /opt/solfoundry
cp .env.example .env
# Edit .env with your values

# 2. Create snapshot directory
mkdir -p /opt/solfoundry/snapshots

# 3. Log in to container registry
echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin

# 4. Pull images and start services
export IMAGE_TAG=v1.0.0
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 5. Run initial migrations
docker compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# 6. Verify health
./scripts/monitor.sh
```

---

## Deploying

### Via CI/CD (recommended)

- **Staging:** Push to `main` branch → GitHub Actions automatically deploys
- **Production:** Create and push a semver tag (e.g. `v1.2.3`)

```bash
git tag v1.2.3
git push origin v1.2.3
```

### Manually

```bash
cd /opt/solfoundry
./scripts/deploy.sh staging v1.2.3
# or
./scripts/deploy.sh production v1.2.3
```

The deploy script will:
1. Run pre-flight checks
2. Snapshot the current state
3. Pull new Docker images
4. Run database migrations
5. Restart containers with rolling update
6. Health-check for up to 2 minutes
7. Roll back automatically if health checks fail

---

## Rollback Procedure

### Automatic Rollback

The deploy script automatically rolls back if health checks fail after deployment.

### Manual Rollback

```bash
# 1. Identify the previous good image tag from deployment logs
tail -100 /var/log/solfoundry-deploy.log

# 2. Roll back to the previous tag
cd /opt/solfoundry
export IMAGE_TAG=v1.2.2   # previous working version
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# 3. Verify health
./scripts/monitor.sh

# 4. If database migration rollback is needed
docker compose -f docker-compose.prod.yml run --rm backend alembic downgrade -1
```

---

## Monitoring

### One-shot health check

```bash
./scripts/monitor.sh
```

### Continuous monitoring (runs every 30s)

```bash
./scripts/monitor.sh --loop --interval 30 --slack "$SLACK_WEBHOOK_URL"
```

### Check logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Single service
docker compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Check container status

```bash
docker compose -f docker-compose.prod.yml ps
```

### Manual health endpoint

```bash
curl http://localhost:8000/health | jq .
```

---

## Troubleshooting

### Backend won't start

1. Check logs: `docker compose -f docker-compose.prod.yml logs backend`
2. Verify `DATABASE_URL` in `.env`
3. Ensure PostgreSQL is healthy: `docker compose ps postgres`
4. Try running migrations manually: `docker compose run --rm backend alembic upgrade head`

### Nginx 502 Bad Gateway

1. Check backend health: `curl http://localhost:8000/health`
2. Check nginx logs: `docker compose logs nginx`
3. Verify the backend container is running: `docker compose ps backend`

### Database connection errors

1. Check PostgreSQL is running: `docker compose ps postgres`
2. Test connection: `docker compose exec postgres psql -U solfoundry -c "SELECT 1"`
3. Check `DATABASE_URL` format: must use `postgres:5432` (not `localhost`)

### Out of disk space

```bash
# Remove dangling images
docker image prune -f

# Remove unused volumes (careful — verify before running)
docker volume prune

# Check disk usage
df -h /
du -sh /opt/solfoundry/snapshots/*
```
