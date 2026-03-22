# CI/CD Architecture

This document describes the CI/CD pipelines for SolFoundry and explains how to add new services.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Developer / Agent                          │
│                     opens a Pull Request                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CI Pipeline  (ci.yml)                        │
│   Triggers on: pull_request → main                              │
│                                                                 │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │   Backend    │  │    Frontend    │  │     Contracts      │  │
│  │              │  │                │  │                    │  │
│  │ Lint (Ruff)  │  │ Lint (ESLint)  │  │ Build (Anchor)     │  │
│  │ Tests(pytest)│  │ TypeCheck(tsc) │  │ Clippy / fmt       │  │
│  │              │  │ Tests(Vitest)  │  │ Security audit     │  │
│  │              │  │   Node 18/20   │  │                    │  │
│  │              │  │ Build (Vite)   │  │                    │  │
│  └──────────────┘  └────────────────┘  └────────────────────┘  │
│                                                                 │
│   All jobs must pass before PR can merge (branch protection)    │
└───────────────────────────┬─────────────────────────────────────┘
                            │  PR merged to main
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Deploy Pipeline  (deploy.yml)                  │
│   Triggers on: push → main                                      │
│                                                                 │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐  │
│  │       Frontend           │  │         Backend             │  │
│  │                          │  │                             │  │
│  │ Build (Vite)             │  │ Build Docker image          │  │
│  │ Deploy → Vercel          │  │ Push → GHCR                 │  │
│  │                          │  │ Deploy → DigitalOcean K8s   │  │
│  │                          │  │ Run DB migrations           │  │
│  └──────────────────────────┘  └─────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │  git tag v*
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Devnet Deploy Pipeline  (devnet-deploy.yml)        │
│   Triggers on: push tag v*                                      │
│                                                                 │
│   Build Anchor programs → Deploy programs to Solana devnet      │
│   Verify IDL → Upload artifacts (30-day retention)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              Anchor CI Pipeline  (anchor.yml)                   │
│   Triggers on: changes to contracts/**                          │
│                                                                 │
│   Build → Bankrun Tests (local) → Devnet Tests → Audit → Clippy │
└─────────────────────────────────────────────────────────────────┘
```

## Workflow Files

| File | Trigger | Purpose |
|------|---------|---------|
| `ci.yml` | PR to main | Lint, type-check, test, build all services |
| `deploy.yml` | Push to main | Deploy frontend (Vercel) + backend (DO K8s) |
| `anchor.yml` | Changes to `contracts/` | Anchor build, bankrun tests, devnet tests, audit |
| `devnet-deploy.yml` | Push tag `v*` | Release programs to Solana devnet |
| `pr-review.yml` | PR opened/updated | 5-LLM automated code review |

## Caching Strategy

| Cache | Key | Scope |
|-------|-----|-------|
| Python pip | `requirements.txt` hash | Per Python file change |
| npm | `package-lock.json` hash | Per lockfile change |
| Cargo/Anchor | `Cargo.lock` + `Anchor.toml` hash | Per Rust dependency change |
| Docker layers | GitHub Actions Cache (GHA) | Per Dockerfile change |

## Required Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Used by | Description |
|--------|---------|-------------|
| `VERCEL_TOKEN` | deploy.yml | Vercel API token |
| `VERCEL_ORG_ID` | deploy.yml | Vercel organisation ID |
| `VERCEL_PROJECT_ID` | deploy.yml | Vercel project ID |
| `DIGITALOCEAN_ACCESS_TOKEN` | deploy.yml | DigitalOcean API token |
| `DIGITALOCEAN_CLUSTER_NAME` | deploy.yml | DO Kubernetes cluster name |
| `DATABASE_URL` | deploy.yml | Production PostgreSQL URL |
| `API_URL` | deploy.yml | Backend API base URL (used in frontend build) |
| `DEVNET_DEPLOY_KEYPAIR` | devnet-deploy.yml | Solana keypair JSON for devnet deploys |

## Local CI with `act`

You can run GitHub Actions locally using [`act`](https://github.com/nektos/act):

```bash
# Install act
brew install act          # macOS
# or
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run the full CI pipeline locally
act pull_request -W .github/workflows/ci.yml

# Run only the frontend tests
act pull_request -j frontend-tests

# Run deploy pipeline (requires .secrets file)
act push -W .github/workflows/deploy.yml --secret-file .secrets
```

Create a `.secrets` file for local testing (never commit this):

```
VERCEL_TOKEN=...
DIGITALOCEAN_ACCESS_TOKEN=...
DATABASE_URL=...
```

## Environment Configs

| File | Purpose |
|------|---------|
| `.env.example` | Template — copy to `.env` for local Docker Compose |
| `.env.devnet` | Devnet-specific overrides (no secrets, safe to commit) |
| `.env.mainnet.example` | Mainnet template — fill in secrets locally, never commit |

## Adding a New Service

Follow these steps to add a new service (e.g. an indexer) to the CI/CD pipeline:

### 1. Add a Dockerfile

Create `Dockerfile.<service>` in the repository root using the same multi-stage pattern as `Dockerfile.backend`:

```dockerfile
FROM python:3.11-slim AS dependencies
WORKDIR /build
COPY <service>/requirements.txt .
RUN python -m venv /opt/venv && /opt/venv/bin/pip install -r requirements.txt

FROM python:3.11-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/SolFoundry/solfoundry"
RUN useradd --create-home --shell /bin/bash solfoundry
USER solfoundry
WORKDIR /home/solfoundry/app
COPY --from=dependencies --chown=solfoundry:solfoundry /opt/venv /opt/venv
COPY --chown=solfoundry:solfoundry <service>/ .
ENV PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1
EXPOSE <port>
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:<port>/health || exit 1
CMD ["python", "-m", "<service>.main"]
```

### 2. Add the service to `docker-compose.yml`

```yaml
  <service>:
    build:
      context: .
      dockerfile: Dockerfile.<service>
    restart: unless-stopped
    ports:
      - "${<SERVICE>_PORT:-<port>}:<port>"
    environment:
      DATABASE_URL: postgresql+asyncpg://...
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:<port>/health"]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3
```

### 3. Add CI jobs to `ci.yml`

Add lint and test jobs in `ci.yml` following the pattern of the `backend-lint` / `backend-tests` jobs. Add the new job names to the `needs` list of `ci-status`.

### 4. Add deploy job to `deploy.yml`

Add a `build-<service>` job that builds and pushes the Docker image to GHCR, and a `deploy-<service>` job that rolls it out to the Kubernetes cluster. Add both jobs to `deploy-status`.

### 5. Update branch protection

After merging, update the required status checks in **Settings → Branches → main** to include the new CI job names.

### 6. Update this document

Add the new service to the architecture diagram and secrets table above.

---

*Keep this document up to date when CI/CD pipelines change.*
