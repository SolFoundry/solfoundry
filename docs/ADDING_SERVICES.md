# Adding New Services to the CI/CD Pipeline

Step-by-step guide for integrating a new service into SolFoundry's CI/CD
pipeline, Docker stack, and environment configuration.

## Overview

When adding a new service (e.g., a notification worker, analytics service,
or new Solana indexer), you need to update four areas:

1. **Dockerfile** -- containerize the service
2. **Docker Compose** -- add the service to the local dev stack
3. **CI Workflow** -- add lint, test, and build jobs
4. **Environment Config** -- add environment-specific settings

## Step 1: Create the Dockerfile

Create a multi-stage Dockerfile following the existing pattern:

```dockerfile
# Dockerfile.myservice
# Multi-stage build: dependencies + runtime

# ── Stage 1: Dependencies ─────────────────────────────────
FROM python:3.11-slim AS dependencies
WORKDIR /build
COPY myservice/requirements.txt .
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ──────────────────────────────────────
FROM python:3.11-slim AS runtime

RUN useradd --create-home --shell /bin/bash solfoundry
USER solfoundry
WORKDIR /home/solfoundry/app

COPY --from=dependencies --chown=solfoundry:solfoundry /opt/venv /opt/venv
COPY --chown=solfoundry:solfoundry myservice/ .

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "-m", "myservice.main"]
```

Key requirements:
- Multi-stage build (dependencies separate from runtime)
- Non-root user for security
- Health check endpoint
- Minimal image size (use `-slim` or `-alpine` base)

## Step 2: Add to Docker Compose

Add the service to both `docker-compose.yml` and `docker-compose.dev.yml`:

```yaml
# In docker-compose.dev.yml
services:
  myservice:
    build:
      context: .
      dockerfile: Dockerfile.myservice
    restart: unless-stopped
    ports:
      - "${MYSERVICE_PORT:-8001}:8001"
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-solfoundry}:${POSTGRES_PASSWORD:-solfoundry_dev}@postgres:5432/${POSTGRES_DB:-solfoundry}
      REDIS_URL: redis://redis:6379/0
      SOLANA_RPC_URL: http://solana-validator:8899
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3
```

Requirements:
- Health check with proper `start_period`
- Dependency ordering via `depends_on` with `condition: service_healthy`
- Environment variables from `.env` file with defaults
- Port mapping using environment variable

## Step 3: Add CI Workflow Jobs

Add lint, test, and build jobs to the appropriate workflow file. Copy the
workflow template from `docs/ci-cd-web-app.yml` and add:

```yaml
# In docs/ci-cd-web-app.yml (or a new workflow file)
jobs:
  myservice-lint:
    name: "MyService: Lint"
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
          cache-dependency-path: myservice/requirements.txt
      - run: pip install -r myservice/requirements.txt && pip install ruff
      - run: ruff check myservice/

  myservice-test:
    name: "MyService: Test"
    needs: [myservice-lint]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip
      - run: |
          pip install -r myservice/requirements.txt
          pip install pytest pytest-asyncio
      - run: python -m pytest myservice/tests/ -v
        env:
          DATABASE_URL: "sqlite+aiosqlite:///:memory:"

  myservice-build:
    name: "MyService: Build"
    needs: [myservice-test]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile.myservice
          push: false
          tags: solfoundry/myservice:${{ github.sha }}
```

Requirements:
- `timeout-minutes` on every job
- Dependency caching via `actions/setup-*` with `cache` option
- Test database uses SQLite in-memory for CI speed

## Step 4: Add Environment Configuration

Use the pipeline API to register environment configs:

```bash
# Set config for each environment
curl -X POST http://localhost:8000/api/pipelines/configs \
  -H "Content-Type: application/json" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "environment": "local",
    "key": "MYSERVICE_URL",
    "value": "http://localhost:8001",
    "description": "MyService base URL for local development"
  }'

curl -X POST http://localhost:8000/api/pipelines/configs \
  -H "Content-Type: application/json" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "environment": "devnet",
    "key": "MYSERVICE_URL",
    "value": "https://myservice.devnet.solfoundry.org",
    "description": "MyService base URL for devnet"
  }'
```

## Step 5: Validate Configuration

Use the CI config validator to check your workflow:

```bash
# Validate workflow YAML
curl -X POST http://localhost:8000/api/pipelines/validate \
  -H "Content-Type: application/json" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "config_type": "workflow",
    "config": { ... your workflow YAML as JSON ... }
  }'

# Validate Docker Compose
curl -X POST http://localhost:8000/api/pipelines/validate \
  -H "Content-Type: application/json" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "config_type": "docker_compose",
    "config": { ... your compose YAML as JSON ... }
  }'
```

## Checklist

Before submitting a PR with a new service:

- [ ] Multi-stage Dockerfile with non-root user and health check
- [ ] Added to `docker-compose.dev.yml` with proper dependencies
- [ ] CI jobs: lint, test, build (with caching and timeout)
- [ ] Environment configs for local, devnet, and mainnet
- [ ] Tests passing in CI (SQLite in-memory for speed)
- [ ] Documentation updated (this file and CI_CD_ARCHITECTURE.md)
- [ ] `docker compose -f docker-compose.dev.yml config -q` passes

## Troubleshooting

**Service won't start**: Check health check configuration. Ensure
`start_period` is long enough for the service to initialize.

**Tests fail in CI but pass locally**: Likely a database URL mismatch.
CI uses `sqlite+aiosqlite:///:memory:` by default.

**Docker build too slow**: Enable Buildx caching with
`actions/cache` for Docker layer cache.

**Port conflict**: Use environment variables for port mapping
(e.g., `${MYSERVICE_PORT:-8001}:8001`).
