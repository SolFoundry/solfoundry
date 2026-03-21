## Description

This pull request implements a complete, production-ready dispute resolution system for the SolFoundry bounty platform that protects both bounty creators and contributors when a submission rejection is contested. The system provides a structured, auditable four-state lifecycle (OPENED, EVIDENCE, MEDIATION, RESOLVED) with multiple resolution pathways: AI-powered auto-mediation via a swappable provider interface (AIMediationProvider abstract base class with a deterministic test implementation and a clean injection point for production AI services), and manual admin resolution through both the REST API and interactive Telegram bot commands with inline keyboard buttons. The implementation spans the full stack with proper integration into existing platform services: the API layer uses the platform's native User.role field for admin authorization instead of environment-variable hacks, dispute creation validates submission ownership by checking the authenticated user against the submission's submitted_by field via a direct O(1) lookup through bounty_service.get_submission(), evidence submission enforces the 48-hour deadline, and state filter queries validate against the DisputeState enum. Reputation impact from dispute outcomes is not only recorded on the dispute row but also pushed to the contributor service's in-memory store via _sync_reputation_to_contributors(), ensuring leaderboard and profile views immediately reflect penalties and bonuses. The frontend includes a complete React dispute page with a state progress bar, evidence timeline with party-labeled cards, an evidence submission form, a mediation trigger, and an admin resolution panel with outcome selection and split percentage slider — all styled with the existing SolFoundry Tailwind dark theme and wired into React Router at /disputes/:id. A Telegram webhook endpoint handles both inline keyboard callbacks and /resolve text commands, enabling administrators to resolve disputes without leaving Telegram. The service layer exposes only public methods to the API (get_dispute_by_id replaces the former private _get_dispute), and the AI mediation interface follows the Strategy pattern so production deployments can inject their own scoring provider via set_ai_mediation_provider() without changing any business logic. Test coverage includes 60+ cases spanning Pydantic validation, state machine transitions, 72-hour window boundary conditions, evidence deadline enforcement, AI provider interface contracts, reputation sync integration with the contributor store, Telegram webhook command parsing, UUID validation, role-based admin checks, and frontend component rendering for all dispute states.

Closes #192

## Solana Wallet for Payout

**Wallet:** EwWiRi5zkynTYN9pvgjqCEiWKuFwR7SLdgFox9R3GmyS

## Type of Change

- [x] ✨ New feature (non-breaking change which adds functionality)
- [x] ✅ Test addition/update

## Changes

### Backend — Database Models (`backend/app/models/dispute.py`)
- Three PostgreSQL tables: `disputes`, `dispute_evidence`, `dispute_audit` with UUID PKs, FKs, and JSON columns
- Enums: `DisputeState`, `DisputeOutcome`, `DisputeReason`, `MediationType`, `EvidenceParty`
- State machine with `VALID_STATE_TRANSITIONS` enforcing legal transitions
- Pydantic request/response schemas with field-level validation

### Backend — AI Mediation Interface (`backend/app/services/dispute_service.py`)
- `AIMediationProvider` abstract base class with `score_dispute()` method
- `DeterministicMediationProvider` for testing (hash-based, repeatable scores 3.0-10.0)
- `set_ai_mediation_provider()` global setter for production swap-in
- Constructor injection: `DisputeService(db, ai_provider=custom_provider)`

### Backend — Service Layer (`backend/app/services/dispute_service.py`)
- `create_dispute`: 72-hour window validation, duplicate prevention, auto-transition to EVIDENCE
- `submit_evidence`: party detection, EVIDENCE-state + deadline enforcement
- `advance_to_mediation`: AI provider delegation, auto-resolve if score >= threshold
- `resolve_dispute`: outcome-specific logic, split percentages, reputation deltas
- `_sync_reputation_to_contributors`: pushes deltas to contributor service store
- `get_dispute_by_id`: public method (replaces former private `_get_dispute`)
- State filter validation on `list_disputes`

### Backend — API Endpoints (`backend/app/api/disputes.py`)
- Admin authorization uses `User.role == "admin"` (platform-native, no env vars)
- `POST /api/disputes` — ownership-verified (submitted_by == authenticated user)
- `GET /api/disputes` — scoped to user's disputes; admins see all
- `GET /api/disputes/stats` — admin-only
- `GET /api/disputes/{id}` — party-or-admin access control
- `POST /api/disputes/{id}/evidence` — party-only, deadline-enforced
- `POST /api/disputes/{id}/mediate` — party-or-admin
- `POST /api/disputes/{id}/resolve` — admin-only with role check
- UUID validation on all path/query parameters
- Direct `bounty_service.get_submission(bounty_id, submission_id)` lookup (O(1))

### Backend — Telegram Bot (`backend/app/api/telegram_webhook.py`)
- Webhook at `POST /api/webhooks/telegram`
- Inline keyboard callback parsing (`resolve:<id>:contributor/creator/split:<pct>`)
- `/resolve <id> <outcome> [split_pct]` text command parsing
- Webhook secret validation + admin chat ID enforcement

### Backend — Platform Integration
- Added `role` field to `User` model for native admin authorization
- Added `get_submission()` direct lookup to `bounty_service`
- Reputation sync to `contributor_service._store` for immediate leaderboard updates

### Frontend — Dispute Page (`frontend/src/components/disputes/`)
- `DisputePage.tsx` — detail view with state progress bar, evidence timeline, evidence form, mediation trigger, admin resolve panel
- `DisputeCreateForm.tsx` — dispute filing with reason selection and initial evidence
- `DisputePageRoute` at `/disputes/:id` in React Router
- Tailwind dark theme matching SolFoundry design system
- `DisputePage.test.tsx` — 10 component tests covering all states and roles

### Test Coverage (60+ test cases)
- Pydantic schema validation and state machine transitions
- 72-hour window boundary conditions (exact boundary, past boundary)
- Evidence deadline enforcement (reject after deadline)
- AI provider interface: deterministic scoring, repeatability, custom injection
- Reputation sync: verifies contributor store updated after resolution
- Direct submission lookup (bounty_service.get_submission)
- State filter validation on list queries
- Telegram webhook parsers (callbacks, commands, edge cases)
- UUID validation and role-based admin checks
- Frontend: state badges, evidence rendering, form visibility, admin panel, error handling

## Checklist

- [x] Code is clean and follows the issue spec exactly
- [x] One PR per bounty (no multiple bounties in one PR)
- [x] Tests included for new functionality
- [x] All existing tests pass
- [x] No `console.log` or debugging code left behind
- [x] No hardcoded secrets or API keys

## Testing

- [x] Unit tests added/updated
- [x] Integration tests added/updated

```bash
# Backend
cd backend && pytest tests/test_disputes.py -v

# Frontend
cd frontend && npx vitest run src/components/disputes/
```

## Additional Notes

The `DeterministicMediationProvider` uses SHA-256 hashing for repeatable test scores. To swap in a production AI service, implement `AIMediationProvider.score_dispute()` and call `set_ai_mediation_provider(YourProvider())` at app startup, or pass it directly to the `DisputeService` constructor. Telegram requires `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, and optionally `TELEGRAM_WEBHOOK_SECRET` env vars. Admin users need `role="admin"` set on their `users` row.

---

<!-- CI Pipeline will automatically run:
- Linting (ESLint, Ruff, Clippy)
- Type checking (tsc)
- Unit tests (pytest, vitest)
- Build checks (next build, cargo build)
- Anchor tests (if contracts changed)
-->
