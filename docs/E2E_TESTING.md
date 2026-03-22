# End-to-End Integration Testing Suite

## Overview

The E2E test suite validates every major user flow in the SolFoundry marketplace, from bounty creation through payout. It covers both the **backend API** (Python/FastAPI) and the **frontend UI** (React/Playwright), serving as the quality gate before production launch.

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         E2E Test Suite               │
                    └────────────┬────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                   │
   ┌──────────▼──────────┐  ┌───▼──────────┐  ┌────▼───────────┐
   │  Backend API Tests   │  │  Frontend UI │  │  CI Pipeline   │
   │  (pytest + httpx)    │  │  (Playwright)│  │  (GitHub       │
   │                      │  │              │  │   Actions)     │
   └──────────┬───────────┘  └──────┬───────┘  └────────────────┘
              │                     │
   ┌──────────▼───────────┐  ┌──────▼───────────┐
   │  In-Memory SQLite    │  │  Vite Dev Server  │
   │  + FastAPI TestClient│  │  + Chromium/FF    │
   └──────────────────────┘  └──────────────────┘
```

### File Layout

```
backend/tests/e2e/
├── __init__.py                        # Package docstring
├── conftest.py                        # Fixtures, test app, cleanup, helpers
├── factories.py                       # Deterministic data factories
├── pytest.ini                         # Markers and configuration
├── test_bounty_lifecycle.py           # Req 1: Full lifecycle tests
├── test_dispute_flow.py               # Req 2: Dispute resolution (real API)
├── test_timeout_refund.py             # Req 3: Timeout & auto-refund
├── test_concurrent_submissions.py     # Req 4: Concurrent submissions
├── test_auth_flow.py                  # Req 5: Auth flow (OAuth + wallet)
├── test_websocket_events.py           # Req 6: WebSocket real-time events
├── test_load.py                       # Req 7: Load testing (50+100 concurrent)
└── test_negative_cases.py             # Req 8: Negative tests & edge cases

frontend/
├── playwright.config.ts               # Playwright configuration
└── tests/e2e/
    ├── bounty-lifecycle.spec.ts       # UI: Bounty board, detail, create
    ├── auth-flow.spec.ts              # UI: Wallet connect, login, nav
    └── dispute-flow.spec.ts           # UI: Dispute controls, detail page

docs/
├── E2E_TESTING.md                     # This document
└── ci-e2e-workflow.yml                # CI pipeline (copy to .github/workflows/)
```

## Quick Start

### Backend E2E Tests

```bash
# Install dependencies
cd backend
pip install -r requirements.txt
pip install pytest-asyncio pytest-html httpx aiosqlite

# Run all E2E tests
python -m pytest tests/e2e/ -v

# Run specific test group
python -m pytest tests/e2e/test_bounty_lifecycle.py -v

# Run by marker
python -m pytest tests/e2e/ -m lifecycle -v
python -m pytest tests/e2e/ -m "not load" -v  # Skip slow load tests

# Generate HTML report
python -m pytest tests/e2e/ -v --html=reports/e2e.html --self-contained-html
```

### Frontend Playwright E2E Tests

```bash
# Install dependencies
cd frontend
npm install
npx playwright install --with-deps chromium firefox

# Run all Playwright tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/bounty-lifecycle.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Generate HTML report with screenshots
npx playwright test --reporter=html
npx playwright show-report
```

## Backend Test Categories

### 1. Full Bounty Lifecycle (`test_bounty_lifecycle.py`)
Tests the complete happy path: create bounty -> submit PR -> AI review -> approve -> payout -> verify.

**Key tests:**
- `test_complete_bounty_lifecycle_happy_path` — Full flow with all validations
- `test_lifecycle_with_multiple_submissions` — Multiple contributors scenario
- `test_payout_recording_returns_correct_data` — Payout ledger consistency
- `test_submission_records_persist_through_status_changes` — Data integrity

### 2. Dispute Resolution (`test_dispute_flow.py`)
Tests: submit -> reject -> dispute -> mediation -> resolution. Uses the **real API dispute endpoint** (`POST /api/bounties/{id}/submissions/{sub_id}/dispute`).

**Key tests:**
- `test_dispute_submission_via_api` — Files dispute through the REST API
- `test_dispute_nonexistent_submission_returns_404` — 404 for bad submission IDs
- `test_dispute_requires_reason` — Validates reason field enforcement
- `test_bounty_can_reopen_after_dispute_approved` — Post-dispute lifecycle with API calls
- `test_full_dispute_mediation_flow` — Complete mediation with real API dispute calls

### 3. Timeout & Auto-Refund (`test_timeout_refund.py`)
Tests: create bounty -> no submissions -> deadline passes -> auto-refund eligibility.

**Key tests:**
- `test_expired_bounty_with_no_submissions` — Refund candidate detection
- `test_bounty_with_submissions_is_not_auto_refundable` — Refund exclusion
- `test_identify_all_expired_bounties` — Batch expiration scanning
- `test_bounty_without_deadline_never_expires` — No-deadline handling

### 4. Concurrent Submissions (`test_concurrent_submissions.py`)
Tests: multiple contributors submit to same bounty -> first to pass wins.

**Key tests:**
- `test_multiple_submissions_sequentially` — Sequential multi-submit
- `test_first_submission_wins_on_completion` — Winner determination
- `test_concurrent_submissions_via_async_client` — 10 async concurrent submissions
- `test_concurrent_duplicate_detection` — Race condition handling

### 5. Auth Flow (`test_auth_flow.py`)
Tests: GitHub OAuth -> wallet connect -> link wallet -> create bounty. All authenticated requests **send auth headers**.

**Key tests:**
- JWT token lifecycle (create, decode, expiration, type confusion)
- OAuth state verification (CSRF protection, explicit error handling)
- Wallet challenge-response (nonce generation, replay prevention)
- Authenticated bounty creation (auth headers on every request)

### 6. WebSocket Events (`test_websocket_events.py`)
Tests: real-time updates fire for all state transitions.

**Key tests:**
- Connection/disconnection lifecycle
- Channel subscription and unsubscription
- Broadcast to single and multiple subscribers
- State transition events (created, status_changed, submission, payout, dispute)
- Rate limiting enforcement
- Message handler for subscribe/unsubscribe/broadcast/pong

### 7. Load Testing (`test_load.py`)
Tests: 50 concurrent bounty creations, 100 concurrent submissions.

**Key tests:**
- `test_fifty_concurrent_bounty_creations` — 50 parallel creates
- `test_one_hundred_concurrent_submissions` — 100 parallel submits
- `test_concurrent_reads_and_writes` — Mixed read/write load
- `test_concurrent_list_queries_under_load` — Read-heavy load

### 8. Negative Cases (`test_negative_cases.py`)
Tests: insufficient balance, expired deadline, duplicate submission, invalid wallet.

**Key tests:**
- Invalid bounty creation (missing fields, out-of-range values, bad URLs)
- Invalid status transitions (skipping states, modifying terminal states)
- Invalid submissions (bad URLs, missing fields, duplicates)
- Invalid payouts (bad wallet format, zero/negative amounts, duplicate tx hashes)
- Invalid contributor operations (duplicate usernames, bad characters)
- Invalid pagination parameters

## Frontend Playwright Test Categories

### 1. Bounty Lifecycle UI (`bounty-lifecycle.spec.ts`)
Tests the bounty board page, navigation to detail pages, and create bounty form.

**Key tests:**
- `bounty board loads and displays heading` — Page renders without errors
- `bounty board shows bounty cards or empty state` — Content is present
- `navigation to bounty detail page works` — Click-through navigation
- `create bounty page is accessible` — Form page loads
- `home redirects to bounties page` — Route redirect
- `leaderboard page loads` — Secondary page navigation
- `tokenomics page loads` — Dashboard page

### 2. Auth Flow UI (`auth-flow.spec.ts`)
Tests wallet connect button, navigation, and unauthenticated browsing.

**Key tests:**
- `wallet connect button is visible in header` — Auth UI presence
- `header shows navigation links` — Nav structure
- `unauthenticated user can browse bounties` — Public access
- `dashboard page handles unauthenticated access` — Auth redirect/prompt
- `wallet connect modal or dropdown appears` — Click interaction

### 3. Dispute Flow UI (`dispute-flow.spec.ts`)
Tests dispute-related UI elements and bounty detail interactions.

**Key tests:**
- `bounty detail page loads with submission section` — Detail page content
- `how-it-works page describes dispute process` — Documentation page
- `bounty detail shows status information` — Status indicators
- `back navigation from detail page works` — Navigation flow

### Screenshot Policy
- Screenshots are captured **on failure** (configured in `playwright.config.ts`).
- Explicit screenshots are taken at key checkpoints in each test.
- All screenshots are saved to `frontend/test-results/` and uploaded as CI artifacts.

## Test Fixtures

### Backend `conftest.py` Fixtures

| Fixture | Scope | Description |
|---------|-------|-------------|
| `initialise_test_database` | session | Creates DB tables once |
| `clear_stores` | function | Resets all in-memory stores between tests |
| `client` | function | Synchronous `TestClient` |
| `async_client` | function | Async `httpx.AsyncClient` for concurrent tests |
| `authenticated_user_id` | function | Fresh UUID for auth |
| `auth_headers` | function | `Authorization: Bearer` header dict |
| `websocket_manager` | function | Fresh `WebSocketManager` with in-memory pub/sub |

### Factories (`factories.py`)

| Factory | Description |
|---------|-------------|
| `build_bounty_create_payload()` | Bounty creation JSON |
| `build_bounty_update_payload()` | Bounty partial update JSON |
| `build_submission_payload()` | PR submission JSON |
| `build_contributor_create_payload()` | Contributor registration JSON |
| `build_payout_create_payload()` | Payout recording JSON |
| `build_dispute_create_payload()` | Dispute filing JSON |
| `build_dispute_resolve_payload()` | Dispute resolution JSON |
| `build_user_id()` | Deterministic counter-based UUID |
| `build_github_user_data()` | Mock GitHub API response |
| `future_deadline()` / `past_deadline()` | Timestamp helpers |

All factories use deterministic counters (reset between tests) for reproducibility. The `build_user_id()` function generates UUIDs from a counter (`00000000-0000-0000-0000-000000000001`, etc.) to avoid non-determinism.

## Design Principles

1. **Deterministic** — No random data; counters and fixed seeds ensure reproducibility.
2. **Isolated** — Each test clears all stores; no cross-test contamination.
3. **Fast** — In-memory SQLite, mocked external services, no network calls.
4. **Independent** — Tests can run in any order.
5. **Parallelisable** — Markers enable splitting across CI matrix jobs.
6. **Real API Calls** — Dispute, auth, and lifecycle tests hit real HTTP endpoints (not just payload validation).
7. **Visual Verification** — Playwright tests capture screenshots for UI regression detection.

## CI Integration

The E2E suite is designed to run on every PR via GitHub Actions.

> **IMPORTANT: Manual Activation Required**
>
> The CI workflow file is stored at `docs/ci-e2e-workflow.yml` because
> contributors cannot push directly to `.github/workflows/`. A repository
> maintainer must copy this file to activate the CI pipeline:
>
> ```bash
> cp docs/ci-e2e-workflow.yml .github/workflows/e2e-tests.yml
> git add .github/workflows/e2e-tests.yml
> git commit -m "ci: activate E2E test workflow"
> ```
>
> This one-time step is required because GitHub Actions workflow files
> must reside in `.github/workflows/` to be recognized by the runner.

### CI Matrix Strategy

**Backend tests** are split by marker for parallel execution:
- `lifecycle`, `dispute`, `timeout`, `concurrent`, `auth`, `websocket`, `load`, `negative`

Each group runs as a separate matrix job, with results aggregated by the `e2e-summary` gate job.

**Frontend Playwright tests** run in a single job with Chromium and Firefox browsers.

### Test Reports
- Backend: HTML reports via `pytest-html`, uploaded as GitHub Actions artifacts (14-day retention).
- Frontend: Playwright HTML reports with screenshots, uploaded as artifacts (14-day retention).

### Parallelization Strategy

```
                    CI Pipeline
                        │
          ┌─────────────┼───────────────┐
          │             │               │
    ┌─────▼─────┐ ┌────▼──────┐ ┌──────▼──────┐
    │ Backend   │ │ Backend   │ │  Frontend   │
    │ Matrix    │ │ Full      │ │  Playwright │
    │ (8 jobs)  │ │ Suite     │ │  (1 job)    │
    └─────┬─────┘ └────┬──────┘ └──────┬──────┘
          │            │               │
          └────────────┼───────────────┘
                       │
                ┌──────▼──────┐
                │  E2E Gate   │
                │  (pass/fail)│
                └─────────────┘
```

## Adding New Tests

### Backend
1. Create a new test file in `backend/tests/e2e/` following `test_<feature>.py`.
2. Add a marker in `pytest.ini` if creating a new category.
3. Use factories from `factories.py` for test data.
4. Use fixtures from `conftest.py` for clients and cleanup.
5. Add Google-style docstrings to every test class and method.
6. Update this document with the new test category.

### Frontend (Playwright)
1. Create a new spec file in `frontend/tests/e2e/` following `<feature>.spec.ts`.
2. Import `{ test, expect }` from `@playwright/test`.
3. Capture screenshots at key checkpoints: `await page.screenshot(...)`.
4. Use `page.waitForLoadState('networkidle')` after navigation.
5. Update this document with the new test category.

## PostgreSQL Migration Path

The E2E suite currently uses in-memory SQLite for speed and zero-dependency CI. When migrating to PostgreSQL:

1. Set `DATABASE_URL=postgresql+asyncpg://user:pass@host/db` in the environment.
2. Add a `docker-compose.test.yml` with a PostgreSQL service.
3. Update the CI workflow to start a PG container before tests.
4. The `conftest.py` `initialise_test_database` fixture handles schema creation automatically.

Schema for test data isolation:
```sql
CREATE SCHEMA IF NOT EXISTS e2e_test;
SET search_path TO e2e_test, public;
```
