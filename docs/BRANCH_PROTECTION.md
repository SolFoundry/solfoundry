# Branch Protection Rules

This document describes the branch protection rules for the SolFoundry repository.

## Main Branch Protection

The `main` branch is protected with the following rules:

### Required Status Checks

All of the following checks must pass before a PR can be merged:

| Check | Description |
|-------|-------------|
| `backend-lint` | Ruff linter for Python code |
| `backend-tests` | pytest unit tests |
| `frontend-lint` | ESLint for TypeScript/React |
| `frontend-typecheck` | TypeScript type checking |
| `frontend-tests` | Vitest unit tests |
| `frontend-build` | Next.js production build |
| `anchor-build` | Anchor program compilation |
| `anchor-test` | Anchor tests on devnet |
| `rust-clippy` | Rust clippy linting |

### Protection Settings

```yaml
# GitHub Branch Protection Rules (configure in Settings > Branches)

Branch name pattern: main

☑ Require a pull request before merging
  ☑ Require approvals: 1
  ☑ Dismiss stale pull request approvals when new commits are pushed
  
☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  Status checks:
    - backend-lint
    - backend-tests
    - frontend-lint
    - frontend-typecheck
    - frontend-tests
    - frontend-build
    - anchor-build
    - anchor-test (optional - only required when contracts changed)
    - rust-clippy (optional - only required when Rust code changed)

☑ Require conversation resolution before merging

☑ Do not allow bypassing the above settings
```

### Additional Rules

1. **Linear History**: Require linear history for merge commits (optional)
2. **Signed Commits**: Require signed commits (recommended for security)
3. **Force Push**: Block force pushes to protected branches
4. **Deletion**: Block branch deletion

## Setting Up Branch Protection

### Via GitHub UI

1. Go to repository **Settings** > **Branches**
2. Click **Add branch protection rule**
3. Enter `main` as the branch name pattern
4. Configure the settings as described above
5. Click **Create** or **Save changes**

### Via GitHub CLI

```bash
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["backend-lint","backend-tests","frontend-lint","frontend-typecheck","frontend-tests","frontend-build"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"required_approving_review_count":1}' \
  --field restrictions=null
```

### Via GitHub REST API

```bash
curl -X PUT \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/:owner/:repo/branches/main/protection \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["backend-lint", "backend-tests", "frontend-lint", "frontend-typecheck", "frontend-tests", "frontend-build"]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": false,
      "required_approving_review_count": 1
    },
    "restrictions": null
  }'
```

## CI/CD Pipeline Overview

### Pull Request Workflow (ci.yml)

Triggers on: `pull_request` to `main`

```
PR Opened/Synced
       │
       ▼
┌──────────────────────────────────────────────┐
│                 PARALLEL JOBS                 │
├──────────────────────────────────────────────┤
│  Backend:                                    │
│    ├── Lint (Ruff)                           │
│    └── Tests (pytest)                        │
│                                              │
│  Frontend:                                   │
│    ├── Lint (ESLint)                         │
│    ├── Type Check (tsc)                      │
│    ├── Tests (Vitest)                        │
│    └── Build (Next.js)                       │
│                                              │
│  Contracts:                                  │
│    ├── Build (Anchor)                        │
│    ├── Test (Devnet)                         │
│    ├── Security Audit (cargo-audit)          │
│    └── Lint (Clippy)                         │
└──────────────────────────────────────────────┘
       │
       ▼
   All Pass? ──No──► PR Cannot Merge
       │
      Yes
       │
       ▼
   PR Ready for Review
```

### Deploy Workflow (deploy.yml)

Triggers on: `push` to `main` (after PR merge)

```
Merged to main
       │
       ▼
┌──────────────────────────────────────────────┐
│              PARALLEL DEPLOYS                 │
├──────────────────────────────────────────────┤
│  Frontend:                                   │
│    ├── Build                                 │
│    └── Deploy to Vercel                      │
│                                              │
│  Backend:                                    │
│    ├── Build Docker Image                    │
│    ├── Push to GHCR                          │
│    ├── Deploy to DigitalOcean K8s            │
│    └── Run Database Migrations               │
└──────────────────────────────────────────────┘
       │
       ▼
   Production Live
```

### Anchor Workflow (anchor.yml)

Triggers on: Changes to `contracts/**` or manual dispatch

```
Contracts Changed
       │
       ▼
┌──────────────────────────────────────────────┐
│              ANCHOR CI                        │
├──────────────────────────────────────────────┤
│    ├── Build Anchor Program                  │
│    ├── Test on Devnet                        │
│    ├── Security Audit                        │
│    └── Clippy Lint                           │
└──────────────────────────────────────────────┘
       │
       ▼
   Contract Validated
```

## Required Secrets

The following secrets must be configured in repository settings:

| Secret | Description | Used By |
|--------|-------------|---------|
| `VERCEL_TOKEN` | Vercel deployment token | deploy.yml |
| `VERCEL_ORG_ID` | Vercel organization ID | deploy.yml |
| `VERCEL_PROJECT_ID` | Vercel project ID | deploy.yml |
| `DIGITALOCEAN_ACCESS_TOKEN` | DigitalOcean API token | deploy.yml |
| `DIGITALOCEAN_CLUSTER_NAME` | DO Kubernetes cluster name | deploy.yml |
| `DATABASE_URL` | PostgreSQL connection string | deploy.yml |
| `API_URL` | Backend API URL | deploy.yml |

### Setting Secrets

1. Go to repository **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret**
3. Enter the secret name and value
4. Click **Add secret**

## Troubleshooting

### CI Checks Failing

1. **Lint errors**: Run `ruff check .` or `npm run lint` locally
2. **Type errors**: Run `npx tsc --noEmit` locally
3. **Test failures**: Run `pytest` or `npm run test` locally

### Anchor Build Failing

1. Ensure Anchor CLI is installed: `anchor --version`
2. Check Solana CLI: `solana --version`
3. Try building locally: `anchor build`

### Deploy Failing

1. Check secrets are configured correctly
2. Verify Docker image builds locally
3. Check Kubernetes deployment logs

---

*This document should be updated when CI/CD pipelines are modified.*