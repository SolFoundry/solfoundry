# CI/CD Architecture

Comprehensive guide to SolFoundry's CI/CD pipeline, Docker containerization,
environment management, and deployment workflow.

## Architecture Diagram

```
                     ┌─────────────────────────────────────────┐
                     │          GitHub Repository               │
                     │   push / PR / tag / manual dispatch      │
                     └────────────────┬────────────────────────┘
                                      │
                     ┌────────────────▼────────────────────────┐
                     │        CI/CD Pipeline (4 Stages)         │
                     │                                          │
                     │  ┌──────┐  ┌──────┐  ┌───────┐  ┌──────┐│
                     │  │ Lint │─→│ Test │─→│ Build │─→│Deploy││
                     │  └──────┘  └──────┘  └───────┘  └──────┘│
                     │    ruff      pytest    Docker     devnet/ │
                     │    tsc       vitest    Buildx     mainnet │
                     │    clippy    bankrun   nginx              │
                     └─────┬──────────┬─────────┬──────────┬───┘
                           │          │         │          │
              ┌────────────▼──┐  ┌────▼────┐  ┌─▼────┐  ┌─▼──────────┐
              │  Backend (Py) │  │Frontend │  │Solana│  │ Docker      │
              │  ruff + mypy  │  │tsc+vite │  │anchor│  │ Registry    │
              │  pytest       │  │vitest   │  │clippy│  │ (GHCR)      │
              │  cov report   │  │build    │  │test  │  │             │
              └───────────────┘  └─────────┘  └──────┘  └─────────────┘
                                                              │
                     ┌────────────────────────────────────────▼┐
                     │          Deployment Targets              │
                     │                                          │
                     │  ┌───────┐  ┌────────┐  ┌──────────┐   │
                     │  │ Local │  │ Devnet │  │ Mainnet  │   │
                     │  │docker │  │auto on │  │manual    │   │
                     │  │compose│  │tag push│  │approval  │   │
                     │  └───────┘  └────────┘  └──────────┘   │
                     └─────────────────────────────────────────┘
```

## Pipeline Stages

### 1. Lint

Runs static analysis and type checking on all code.

| Component | Tool | Configuration |
|-----------|------|---------------|
| Backend Python | ruff | `backend/ruff.toml` (or pyproject.toml) |
| Backend types | mypy | `--ignore-missing-imports` |
| Frontend TypeScript | tsc | `frontend/tsconfig.json` |
| Solana contracts | clippy | `contracts/Cargo.toml` |

### 2. Test

Runs all test suites with matrix strategy for version compatibility.

| Component | Framework | Matrix |
|-----------|-----------|--------|
| Backend | pytest + pytest-asyncio | Python 3.11, 3.12 |
| Frontend | vitest | Node 18, 20 |
| Solana programs | Anchor bankrun | Solana CLI 1.18.x, 2.0.x |

**Test database**: SQLite in-memory for CI speed (PostgreSQL for integration).

### 3. Build

Builds Docker images and frontend bundles.

- **Backend**: Multi-stage Dockerfile (dependencies + runtime)
- **Frontend**: Multi-stage Dockerfile (Node build + nginx serve)
- **Caching**: Docker Buildx layer caching + npm/pip dependency caching
- **Artifacts**: Images saved as tar archives for deployment stage

### 4. Deploy

Deploys to target environments based on trigger:

| Trigger | Target | Gate |
|---------|--------|------|
| PR merge to main | (none - CI only) | All tests pass |
| Release tag `v*.*.*` | Devnet | All tests + build pass |
| Manual dispatch | Devnet/Mainnet | All tests + environment approval |

## Docker Services

### Production Stack (`docker-compose.yml`)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | postgres:16-alpine | 5432 | Primary database |
| redis | redis:7-alpine | 6379 | Cache + rate limiting |
| backend | Dockerfile.backend | 8000 | FastAPI server |
| frontend | Dockerfile.frontend | 3000 | Nginx + React SPA |

### Development Stack (`docker-compose.dev.yml`)

Extends the production stack with:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| solana-validator | solanalabs/solana | 8899/8900 | Local test validator |
| indexer | (reuses backend) | - | Transaction indexer |

### Starting Local Development

```bash
# Copy environment template
cp .env.example .env

# Start full development stack
docker compose -f docker-compose.dev.yml up --build

# Services available at:
#   Backend API:      http://localhost:8000
#   Frontend:         http://localhost:3000
#   PostgreSQL:       localhost:5432
#   Redis:            localhost:6379
#   Solana Validator: http://localhost:8899 (RPC)
#                     ws://localhost:8900 (WebSocket)
```

## Environment Management

Three deployment environments with isolated configurations:

### Local

```
SOLANA_RPC_URL=http://localhost:8899
DATABASE_URL=postgresql+asyncpg://solfoundry:solfoundry_dev@localhost:5432/solfoundry
REDIS_URL=redis://localhost:6379/0
```

### Devnet

```
SOLANA_RPC_URL=https://api.devnet.solana.com
DATABASE_URL=postgresql+asyncpg://...@db.devnet.solfoundry.org:5432/solfoundry
REDIS_URL=redis://redis.devnet.solfoundry.org:6379/0
```

### Mainnet

```
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
DATABASE_URL=postgresql+asyncpg://...@db.solfoundry.org:5432/solfoundry
REDIS_URL=redis://redis.solfoundry.org:6379/0
```

Environment configs are managed through the API at `/api/pipelines/configs/{env}`
and stored in PostgreSQL. Secret values are masked in API responses.

## Caching Strategy

| Cache | Tool | Invalidation |
|-------|------|-------------|
| Python dependencies | `actions/setup-python` with `cache: pip` | `requirements.txt` hash |
| Node dependencies | `actions/setup-node` with `cache: npm` | `package-lock.json` hash |
| Rust/Cargo | `actions/cache` | `Cargo.lock` hash |
| Docker layers | Docker Buildx local cache | Per-commit SHA |

## Security

### Secrets Management

- **No long-lived keys**: OIDC token exchange at deploy time
- **No secrets in logs**: CI config validator checks for `echo ${{ secrets.* }}`
- **Minimal permissions**: Each job requests only needed permissions
- **Environment protection**: Mainnet deployments require manual approval

### OIDC-Based Deployments

```yaml
permissions:
  id-token: write  # Request OIDC token
  contents: read   # Read repository

steps:
  - name: Deploy with OIDC
    # Token is exchanged at runtime, no stored credentials
```

## API Endpoints

The pipeline management API is available at `/api/pipelines/`:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/pipelines/runs` | Required | Create pipeline run |
| GET | `/api/pipelines/runs` | Public | List pipeline runs |
| GET | `/api/pipelines/runs/{id}` | Public | Get pipeline run |
| PATCH | `/api/pipelines/runs/{id}/status` | Required | Update status |
| PATCH | `/api/pipelines/stages/{id}/status` | Required | Update stage |
| POST | `/api/pipelines/deployments` | Required | Record deployment |
| GET | `/api/pipelines/deployments` | Public | List deployments |
| GET | `/api/pipelines/stats` | Public | Pipeline statistics |
| POST | `/api/pipelines/configs` | Required | Set env config |
| GET | `/api/pipelines/configs/{env}` | Public | Get env configs |
| GET | `/api/pipelines/environments` | Public | All env summary |
| POST | `/api/pipelines/validate` | Required | Validate CI config |

## CI Config Validation

The `POST /api/pipelines/validate` endpoint validates workflow configurations
programmatically, checking:

1. Required keys (name, on, jobs)
2. Job structure (runs-on, steps)
3. Caching configuration
4. Security rules (no secrets in logs, OIDC permissions)
5. Test matrix coverage (Node 18/20)
6. Concurrency groups
7. Timeout configuration

This achieves >90% CI config test coverage without requiring Docker or `act`.

## Workflow Files

CI workflow YAML files are stored in `docs/` because the contributing PAT
cannot push to `.github/workflows/`. To activate a workflow:

```bash
cp docs/ci-cd-pipeline.yml .github/workflows/ci-cd-pipeline.yml
cp docs/ci-cd-solana.yml .github/workflows/ci-cd-solana.yml
cp docs/ci-cd-web-app.yml .github/workflows/ci-cd-web-app.yml
```

| File | Purpose |
|------|---------|
| `docs/ci-cd-pipeline.yml` | Full pipeline: lint, test, build, deploy |
| `docs/ci-cd-solana.yml` | Solana program CI with version matrix |
| `docs/ci-cd-web-app.yml` | Web app CI for backend + frontend |
| `docs/ci-e2e-workflow.yml` | E2E integration tests |

## Adding New Services

See [ADDING_SERVICES.md](./ADDING_SERVICES.md) for the step-by-step guide
to adding new services to the CI/CD pipeline and Docker stack.
