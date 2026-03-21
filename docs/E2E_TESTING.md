# End-to-End Integration Testing Suite

## Overview

The E2E test suite validates every major user flow in the SolFoundry marketplace, from bounty creation through payout. It serves as the quality gate before production launch.

## Architecture

```
backend/tests/e2e/
├── __init__.py                        # Package docstring
├── conftest.py                        # Fixtures, test app, cleanup, helpers
├── factories.py                       # Deterministic data factories
├── pytest.ini                         # Markers and configuration
├── test_bounty_lifecycle.py           # Req 1: Full lifecycle tests
├── test_dispute_flow.py               # Req 2: Dispute resolution
├── test_timeout_refund.py             # Req 3: Timeout & auto-refund
├── test_concurrent_submissions.py     # Req 4: Concurrent submissions
├── test_auth_flow.py                  # Req 5: Auth flow (OAuth + wallet)
├── test_websocket_events.py           # Req 6: WebSocket real-time events
├── test_load.py                       # Req 7: Load testing (50+100 concurrent)
└── test_negative_cases.py             # Req 8: Negative tests & edge cases
```

## Quick Start

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

## Test Categories

### 1. Full Bounty Lifecycle (`test_bounty_lifecycle.py`)
Tests the complete happy path: create bounty -> submit PR -> AI review -> approve -> payout -> verify.

**Key tests:**
- `test_complete_bounty_lifecycle_happy_path` — Full flow with all validations
- `test_lifecycle_with_multiple_submissions` — Multiple contributors scenario
- `test_payout_verification_via_treasury` — Payout ledger consistency
- `test_submission_records_persist_through_status_changes` — Data integrity

### 2. Dispute Resolution (`test_dispute_flow.py`)
Tests: submit -> reject -> dispute -> mediation -> resolution.

**Key tests:**
- `test_create_dispute_for_rejected_submission` — Dispute payload validation
- `test_dispute_resolved_approved/rejected/cancelled` — All resolution outcomes
- `test_bounty_can_reopen_after_dispute_approved` — Post-dispute lifecycle
- `test_full_dispute_mediation_flow` — Complete mediation flow

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
- `test_multiple_contributors_submit_sequentially` — Sequential multi-submit
- `test_first_submission_wins_on_completion` — Winner determination
- `test_concurrent_submissions_via_async_client` — 10 async concurrent submissions
- `test_concurrent_duplicate_detection` — Race condition handling

### 5. Auth Flow (`test_auth_flow.py`)
Tests: GitHub OAuth -> wallet connect -> link wallet -> create bounty.

**Key tests:**
- JWT token lifecycle (create, decode, expiration, type confusion)
- OAuth state verification (CSRF protection)
- Wallet challenge-response (nonce generation, replay prevention)
- Authenticated bounty creation (auth -> action flow)

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

## Test Fixtures

### `conftest.py` Fixtures

| Fixture | Scope | Description |
|---------|-------|-------------|
| `initialise_test_database` | session | Creates DB tables once |
| `clear_stores` | function | Resets all in-memory stores between tests |
| `client` | function | Synchronous `TestClient` |
| `async_client` | function | Async `httpx.AsyncClient` for concurrent tests |
| `authenticated_user_id` | function | Fresh UUID for auth |
| `auth_headers` | function | `X-User-ID` header dict |
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
| `build_github_user_data()` | Mock GitHub API response |
| `future_deadline()` / `past_deadline()` | Timestamp helpers |

All factories use deterministic counters (reset between tests) for reproducibility.

## Design Principles

1. **Deterministic** — No random data; counters and fixed seeds ensure reproducibility.
2. **Isolated** — Each test clears all stores; no cross-test contamination.
3. **Fast** — In-memory SQLite, mocked external services, no network calls.
4. **Independent** — Tests can run in any order.
5. **Parallelisable** — Markers enable splitting across CI matrix jobs.

## CI Integration

The E2E suite is designed to run on every PR via GitHub Actions. The workflow file is at `docs/ci-e2e-workflow.yml` — copy it to `.github/workflows/e2e-tests.yml` to activate.

### CI matrix strategy
Tests are split by marker for parallel execution:
- `lifecycle`, `dispute`, `timeout`, `concurrent`, `auth`, `websocket`, `load`, `negative`

Each group runs as a separate matrix job, with results aggregated by the `e2e-summary` gate job.

### Test reports
HTML reports are generated using `pytest-html` and uploaded as GitHub Actions artifacts with 14-day retention.

## Adding New Tests

1. Create a new test file in `backend/tests/e2e/` following the naming convention `test_<feature>.py`.
2. Add a marker in `pytest.ini` if creating a new category.
3. Use factories from `factories.py` for test data.
4. Use fixtures from `conftest.py` for clients and cleanup.
5. Add Google-style docstrings to every test class and method.
6. Update this document with the new test category.

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
