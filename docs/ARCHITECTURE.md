# SolFoundry System Architecture

Last updated: 2026-03-29

## Overview

SolFoundry is an AI-powered bounty marketplace on Solana. Contributors earn rewards by solving GitHub issues — every submission goes through a multi-model AI code review before payout.

```
GitHub Issues (bounties)
    |
    v
FastAPI Backend (192.241.139.206)
    |--- PostgreSQL (persistent state)
    |--- Redis (caching, rate limits)
    |--- Solana RPC (token transfers)
    |
    +---> React Frontend (solfoundry.org, static via Nginx)
    +---> GitHub Actions (CI, AI review pipeline)
    +---> Telegram (admin alerts)
```

---

## What Runs Where

| Component | Location | Process | Port |
|-----------|----------|---------|------|
| FastAPI Backend | 192.241.139.206 | systemd: `solfoundry-api` | 8000 |
| PostgreSQL 16 | 192.241.139.206 | systemd: `postgresql` | 5432 |
| Redis 7 | 192.241.139.206 | systemd: `redis-server` | 6379 |
| Nginx (reverse proxy) | 192.241.139.206 | systemd: `nginx` | 80/443 |
| React Frontend | 192.241.139.206 | Static files via Nginx | — |
| AI Review Engine | GitHub Actions | Private repo dispatch | — |
| GitHub Sync | Backend (background task) | In-process async loop | — |

---

## Data Flow

### Bounty Creation (GitHub Issue -> Site)

```
1. Maintainer creates GitHub issue with "bounty" + tier label
2. GitHub webhook fires POST /api/webhooks/github
3. Backend validates HMAC-SHA256 signature
4. webhook_processor creates/updates bounty in PostgreSQL
5. bounty_service updates in-memory cache
6. Frontend fetches /api/bounties -> displays on marketplace
```

Backup: `github_sync.py` polls every 30 minutes in case webhooks miss.

### Submission Flow (PR -> Review -> Payout)

```
1. Contributor opens PR referencing bounty issue
2. POST /api/bounties/{id}/submissions (PR URL + wallet)
3. GitHub Actions pr-review.yml triggers on PR open/sync
4. Pre-review gates: tier eligibility, spam filter, dedup
5. Dispatches to private repo (solfoundry-review) via repository_dispatch
6. Private pipeline runs 3 AI models in parallel:
   - GPT-5.4
   - Gemini 2.5 Pro
   - Grok 4
7. Each model scores: quality, correctness, security, completeness, tests (0-10)
8. Scores posted back to POST /api/bounties/{id}/submissions/{sid}/reviews
9. Backend aggregates scores, checks threshold:
   - T1: 6.0/10
   - T2: 7.0/10
   - T3: 8.0/10
10. Auto-approve runs every 5 min:
    - Score >= threshold AND 48h elapsed -> AUTO-APPROVE (T1/T2 only)
    - T3 -> always requires manual approval via Telegram
11. On approval -> escrow release -> SPL transfer to contributor wallet
```

### Token & Wallet Flow

```
Bounty Creator                    Treasury Wallet                    Contributor
     |                                  |                                |
     |-- fund_escrow (SPL transfer) --> |                                |
     |   (FNDRY or USDC)               |                                |
     |                                  |                                |
     |                          [Escrow: FUNDED -> ACTIVE]               |
     |                                  |                                |
     |                          [Submission approved]                    |
     |                                  |                                |
     |                                  |-- release_escrow (95%) ------> |
     |                                  |   (minus 5% platform fee)      |
     |                                  |                                |
     |                          [5% fee stays in treasury]               |
```

**Token types:**
- SolFoundry bounties: funded in $FNDRY, free AI reviews
- User-posted bounties: funded in USDC, 5% platform fee
- Review fee: contributors pay $FNDRY to submit on USDC bounties (anti-spam + token utility)
- Platform fees: accumulated USDC used for $FNDRY buyback

---

## Escrow Lifecycle

```
PENDING ---> FUNDED ---> ACTIVE ---> RELEASING ---> COMPLETED
               |                                      |
               +-------> REFUNDED (timeout/cancel) <--+
```

- **PENDING**: Escrow record created, awaiting funding tx
- **FUNDED**: On-chain tx verified, tokens in treasury
- **ACTIVE**: Bounty open for submissions
- **RELEASING**: Release initiated, SPL transfer in-flight
- **COMPLETED**: Winner paid, fee recorded in ledger
- **REFUNDED**: Tokens returned to creator (timeout or cancellation)

Every state change is recorded in `escrow_ledger` with tx hash and wallet addresses.

---

## Background Tasks

| Task | Interval | Service |
|------|----------|---------|
| GitHub sync | 30 min | `github_sync.periodic_sync()` |
| Auto-approve | 5 min | `auto_approve_service.periodic_auto_approve()` |
| Deadline check | 60 sec | `bounty_lifecycle_service.periodic_deadline_check()` |
| Escrow auto-refund | 60 sec | `escrow_service.periodic_escrow_refund()` |
| Metrics refresh | configurable | `observability.periodic_refresh()` |

All tasks are started in the FastAPI lifespan handler and cancelled on shutdown.

---

## Database Tables

### Core
- `bounties` — Bounty listings (tier, status, reward, funding_token)
- `submissions` — PR submissions (matching, review scores, payout)
- `escrows` — Custodial escrows (amount, token, state, tx hashes)
- `escrow_ledger` — Immutable audit trail (deposits, releases, fees)
- `contributors` — Contributor profiles and stats
- `leaderboard` — Cached ranking data
- `users` — User accounts (GitHub OAuth, wallet links)

### Financial
- `payouts` — SPL transfer records (status, tx hash, amount)
- `buybacks` — Treasury buyback events (SOL/USDC -> FNDRY)

### Reviews & Lifecycle
- `reviews` — Per-model AI review scores
- `bounty_lifecycle_log` — State transition history
- `bounty_submissions` — Simplified submission tracking

### Security & Admin
- `admin_audit_log` — Admin action audit trail
- `webhook_logs` — GitHub webhook delivery log
- `siws_nonce` — Sign In With Solana replay prevention
- `oauth_state` — OAuth CSRF tokens
- `auth_sessions` — User session management

### Other
- `disputes` / `dispute_history` — Dispute resolution
- `notifications` — User alerts
- `agents` — AI agent registrations (future)
- `reputation_history` — Per-contributor reputation tracking
- `contributor_webhooks` — Custom webhook integrations

---

## API Routes

### Public
- `GET /health` — System health (DB, Redis, Solana RPC, GitHub)
- `GET /api/bounties` — List bounties (paginated, filterable)
- `GET /api/bounties/{id}` — Bounty detail
- `GET /api/leaderboard` — Contributor rankings
- `GET /api/stats` — Platform statistics
- `GET /api/contributors/{username}` — Contributor profile

### Authenticated
- `POST /api/bounties` — Create bounty
- `POST /api/bounties/{id}/submissions` — Submit PR for bounty
- `POST /api/escrow/fund` — Fund bounty escrow
- `GET /api/escrow/{bounty_id}/status` — Escrow status + ledger

### Admin (requires ADMIN_API_KEY or admin JWT)
- `GET /api/admin/fees/summary` — Platform fee totals by token
- `GET /api/admin/fees/history` — Paginated fee collection events
- `GET /api/admin/overview` — Dashboard stats
- `POST /api/admin/bounties/{id}/approve` — Manual approval
- `GET /api/admin/audit-log` — Admin action history

### Internal
- `POST /api/webhooks/github` — GitHub webhook receiver
- `POST /api/bounties/{id}/submissions/{sid}/reviews` — AI review score intake

---

## Frontend Pages

| Route | Page |
|-------|------|
| `/bounties` | Bounty marketplace (search, filter, browse) |
| `/bounties/:id` | Bounty detail + submission form + review scores |
| `/bounties/create` | Bounty creation wizard (FNDRY/USDC toggle, escrow funding) |
| `/leaderboard` | Contributor rankings |
| `/how-it-works` | Onboarding guide |
| `/tokenomics` | Token economics dashboard |
| `/dashboard` | Contributor dashboard |
| `/creator` | Creator dashboard (manage bounties, view submissions) |
| `/contributor/:username` | Public contributor profile |

---

## Token Economics

**$FNDRY Token**
- Mint: `C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS`
- Decimals: 9
- Total supply: 1,000,000,000

**USDC**
- Mint: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- Decimals: 6

**Treasury**
- Wallet: `AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1`
- Holds: $FNDRY reserves, accumulated USDC platform fees

**Fee Structure**
- Platform fee: 5% on escrow release (configurable via FEE_BASIS_POINTS)
- Review fee: $FNDRY payment for AI review on USDC-funded bounties
- USDC fees accumulated for periodic $FNDRY buyback

---

## Deployment Process

### Backend
```bash
# From local machine
scp backend/app/services/changed_file.py root@192.241.139.206:/opt/solfoundry/backend/app/services/
ssh root@192.241.139.206 'systemctl restart solfoundry-api'
```

### Frontend
```bash
# Build locally
cd frontend && npx vite build

# Deploy static files
scp -r dist/* root@192.241.139.206:/opt/solfoundry/frontend/dist/
```

### Database Migrations
```bash
# On server
cd /opt/solfoundry/backend
alembic upgrade head
```

---

## Environment Variables

### Required for Production

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `SOLANA_RPC_URL` | Solana JSON-RPC endpoint (Helius) |
| `TREASURY_WALLET` | Treasury public key |
| `TREASURY_KEYPAIR_PATH` | Path to treasury keypair (omit for mock mode) |
| `GITHUB_TOKEN` | GitHub PAT for API calls |
| `GITHUB_WEBHOOK_SECRET` | HMAC secret for webhook validation |
| `GITHUB_CLIENT_ID` | OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | OAuth app client secret |
| `JWT_SECRET_KEY` | JWT signing key |
| `ADMIN_API_KEY` | Admin dashboard API key |
| `FEE_BASIS_POINTS` | Platform fee (default: 500 = 5%) |

### Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `ENV` | Environment mode | `production` |
| `ALLOWED_ORIGINS` | CORS whitelist | `https://solfoundry.org` |
| `TELEGRAM_BOT_TOKEN` | Telegram alerts | — |
| `TELEGRAM_CHAT_ID` | Telegram chat for alerts | — |
| `RESEND_API_KEY` | Email notifications | — |
| `DB_POOL_SIZE` | Connection pool size | 5 |
| `RATE_LIMIT_API` | API rate limit | 60/min |
| `LOG_LEVEL` | Logging verbosity | INFO |

---

## Middleware Stack

Applied in reverse order (last added = first executed):

1. **SecurityHeadersMiddleware** — HSTS, CSP, X-Frame-Options, X-Content-Type-Options
2. **IPBlocklistMiddleware** — Redis-backed IP blocking
3. **RateLimiterMiddleware** — Token-bucket rate limiting (Redis + in-memory dual layer)
4. **InputSanitizationMiddleware** — XSS/SQLi pattern detection on request bodies
5. **LoggingMiddleware** — Structured request/response logging with correlation IDs
6. **CORSMiddleware** — Origin validation

---

## Key Architectural Decisions

1. **Custodial escrow (not PDA)**: Simpler implementation, full control. PDA code exists in `/contracts/` for future migration.
2. **httpx instead of solana-py**: Lighter dependency, direct RPC calls, avoids solana-py's heavy dependency tree.
3. **In-memory bounty cache**: `_bounty_store` dict for O(1) lookups. PostgreSQL is source of truth, cache hydrated on startup.
4. **Private review repo**: AI review logic lives in `SolFoundry/solfoundry-review` to prevent reverse-engineering scoring criteria.
5. **Mock transfers in dev**: When `TREASURY_KEYPAIR_PATH` is unset, `transfer_service` returns deterministic mock signatures instead of hitting Solana.
6. **Multi-model consensus**: Three independent AI models (GPT, Gemini, Grok) review in parallel. Score is averaged. Prevents single-model bias.
7. **48h auto-approve window**: Gives bounty creators time to dispute before auto-approval kicks in. T3 bounties always require manual approval.
