# SolFoundry Security Documentation

## OWASP Top 10 Mitigations

This document maps each OWASP Top 10 (2021) vulnerability category to its implementation in the SolFoundry codebase.

### A01:2021 — Broken Access Control

**Mitigation:** All mutation endpoints require JWT authentication via `get_current_user_id` dependency. Role-based access tiers (anonymous, authenticated, admin) enforce different rate limits and permissions.

**Code references:**
- `backend/app/api/auth.py` — JWT token extraction and validation
- `backend/app/auth.py` — `get_current_user_id` dependency
- `backend/app/middleware/rate_limiter.py` — Tiered access control

**Implementation details:**
- Bearer token required for all state-changing operations
- Resource ownership checks via `AuthenticatedUser.owns_resource()`
- Session invalidation on security events (token theft detection)

---

### A02:2021 — Cryptographic Failures

**Mitigation:** All secrets via environment variables (never hardcoded). JWT tokens use HS256 with minimum 32-character secret keys. Refresh tokens are stored as SHA-256 hashes (never plaintext). HTTPS enforced via HSTS headers.

**Code references:**
- `backend/app/services/config_validator.py` — Secret validation and audit
- `backend/app/services/auth_service.py` — JWT token signing
- `backend/app/services/auth_hardening.py` — Token hash storage
- `backend/app/middleware/security.py` — HSTS enforcement
- `backend/.env.example` — Configuration template

**Implementation details:**
- `validate_secrets()` checks all required secrets at startup
- `SensitiveDataFilter` redacts secrets from log output
- `audit_source_for_secrets()` scans for hardcoded credentials

---

### A03:2021 — Injection

**Mitigation:** SQLAlchemy ORM with parameterized queries prevents SQL injection. Input sanitization middleware scans for SQL injection patterns as defense-in-depth. Pydantic validators enforce field constraints.

**Code references:**
- `backend/app/database.py` — SQLAlchemy async engine (parameterized queries)
- `backend/app/middleware/sanitization.py` — SQL injection pattern detection
- `backend/app/models/bounty.py` — Pydantic field validators

**Implementation details:**
- All database queries use SQLAlchemy `select()`, `insert()`, `update()` (never raw SQL)
- `SQL_INJECTION_PATTERNS` catches UNION SELECT, DROP TABLE, boolean-based blind, time-based blind
- Input fields have `max_length`, `min_length`, regex patterns via Pydantic

---

### A04:2021 — Insecure Design

**Mitigation:** Security-by-design architecture with defense-in-depth layers. Escrow operations use transaction verification pipeline. Auth uses token rotation and session management.

**Code references:**
- `backend/app/services/escrow_security.py` — Multi-step verification pipeline
- `backend/app/services/auth_hardening.py` — Token rotation, session management
- `docs/ESCROW_SECURITY.md` — Threat model documentation

**Implementation details:**
- Escrow operations require: format validation → double-spend check → age verification → address validation → amount validation
- Refresh tokens rotate on each use with theft detection
- Brute force protection with exponential backoff

---

### A05:2021 — Security Misconfiguration

**Mitigation:** Security headers set on all responses. Default-deny Content-Security-Policy. Environment-based configuration with validation.

**Code references:**
- `backend/app/middleware/security.py` — Security headers middleware
- `backend/app/services/config_validator.py` — Configuration validation
- `backend/.env.example` — Documented configuration template

**Implementation details:**
- HSTS with preload, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- `validate_secrets()` detects placeholder values and weak configurations
- Server identification headers removed

---

### A06:2021 — Vulnerable and Outdated Components

**Mitigation:** Automated dependency scanning for Python (pip-audit) and Node.js (npm audit) with CI/CD integration.

**Code references:**
- `scripts/audit_deps.py` — Dependency vulnerability scanner
- `backend/requirements.txt` — Pinned Python dependencies
- `frontend/package.json` — Pinned Node.js dependencies

**Implementation details:**
- CI mode fails builds on critical/high vulnerabilities
- JSON report output for tracking over time
- Covers both direct and transitive dependencies

---

### A07:2021 — Identification and Authentication Failures

**Mitigation:** Brute force protection with exponential backoff lockout. Refresh token rotation with reuse detection. Session limits per user. Multi-factor auth via wallet signature.

**Code references:**
- `backend/app/services/auth_hardening.py` — `BruteForceProtector`, `RefreshTokenStore`, `SessionManager`
- `backend/app/services/auth_service.py` — JWT + wallet signature auth
- `backend/app/api/auth.py` — Auth endpoints

**Implementation details:**
- 5 failed attempts → 15-minute lockout (escalating to 24h max)
- Refresh token reuse triggers full session revocation (theft detection)
- Maximum 5 concurrent sessions per user
- Wallet authentication requires signing a server-generated nonce

---

### A08:2021 — Software and Data Integrity Failures

**Mitigation:** GitHub webhook signature verification (HMAC-SHA256). Transaction signature verification for Solana operations. Dependency integrity via lock files.

**Code references:**
- `backend/app/api/webhooks/github.py` — HMAC signature verification
- `backend/app/services/escrow_security.py` — Transaction verification
- `backend/app/services/webhook_service.py` — Signature verification

**Implementation details:**
- Webhooks rejected if HMAC-SHA256 signature doesn't match
- Fail-closed: webhooks rejected when secret not configured
- `package-lock.json` and pinned `requirements.txt` ensure dependency integrity

---

### A09:2021 — Security Logging and Monitoring Failures

**Mitigation:** Comprehensive security event logging. Sensitive data filtered from logs. Critical security events (double-spend, token theft) logged at CRITICAL level.

**Code references:**
- `backend/app/services/config_validator.py` — `SensitiveDataFilter`
- `backend/app/services/auth_hardening.py` — Brute force and session logging
- `backend/app/services/escrow_security.py` — Transaction security logging
- `backend/app/middleware/rate_limiter.py` — Rate limit violation logging

**Implementation details:**
- All security events include IP address, user agent, and identifiers
- JWT tokens redacted from logs as `[REDACTED_JWT]`
- Secret values redacted as `[REDACTED]`
- Double-spend attempts logged at CRITICAL with full context

---

### A10:2021 — Server-Side Request Forgery (SSRF)

**Mitigation:** Outbound HTTP requests limited to known endpoints (GitHub API, Solana RPC). URL validation on user-provided URLs enforces GitHub-only domains.

**Code references:**
- `backend/app/services/auth_service.py` — GitHub API calls (fixed URLs)
- `backend/app/services/solana_client.py` — Solana RPC (configured endpoint)
- `backend/app/models/bounty.py` — URL validation

**Implementation details:**
- `pr_url` and `github_issue_url` fields validate against `https://github.com/` prefix
- Solana RPC URL configured via environment variable (not user-controlled)
- No arbitrary URL fetching from user input

---

## Security Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │                  Client                      │
                    └──────────┬───────────────────────────────────┘
                               │ HTTPS (HSTS enforced)
                    ┌──────────▼───────────────────────────────────┐
                    │           Reverse Proxy / Load Balancer       │
                    │   (SSL termination, connection limits)        │
                    └──────────┬───────────────────────────────────┘
                               │
                    ┌──────────▼───────────────────────────────────┐
                    │        Security Headers Middleware            │
                    │   CSP, HSTS, X-Frame-Options, etc.           │
                    ├──────────────────────────────────────────────┤
                    │        Rate Limit Middleware                  │
                    │   Tiered: anon/auth/admin + per-endpoint     │
                    ├──────────────────────────────────────────────┤
                    │        Input Sanitization Middleware          │
                    │   XSS, SQL injection pattern detection        │
                    ├──────────────────────────────────────────────┤
                    │        CORS Middleware                        │
                    │   Origin whitelist, credential control        │
                    ├──────────────────────────────────────────────┤
                    │        FastAPI Application                    │
                    │   ┌─────────────┐  ┌──────────────────────┐ │
                    │   │ Auth Routes  │  │ API Routes           │ │
                    │   │ (JWT + wallet│  │ (bounties, payouts,  │ │
                    │   │  signature)  │  │  treasury, search)   │ │
                    │   └──────┬──────┘  └──────────┬───────────┘ │
                    │          │                     │              │
                    │   ┌──────▼──────────────────────▼───────────┐│
                    │   │         Service Layer                    ││
                    │   │  ┌─────────────┐ ┌───────────────────┐  ││
                    │   │  │ Auth        │ │ Escrow Security   │  ││
                    │   │  │ Hardening   │ │ (double-spend,    │  ││
                    │   │  │ (brute force│ │  signature verify, │  ││
                    │   │  │  token rot.)│ │  rate limit)       │  ││
                    │   │  └─────────────┘ └───────────────────┘  ││
                    │   └─────────────────────────────────────────┘│
                    │          │                                    │
                    │   ┌──────▼──────────────────────────────────┐│
                    │   │    PostgreSQL (parameterized queries)    ││
                    │   │    + Automated backups (pg_dump + PITR)  ││
                    │   └─────────────────────────────────────────┘│
                    └──────────────────────────────────────────────┘
```

## Configuration Checklist

Before deploying to production, verify:

- [ ] `JWT_SECRET_KEY` is a cryptographically random string (32+ chars)
- [ ] `GITHUB_CLIENT_SECRET` is set from GitHub OAuth app settings
- [ ] `GITHUB_WEBHOOK_SECRET` is set and matches GitHub webhook config
- [ ] `DATABASE_URL` points to production PostgreSQL (not SQLite)
- [ ] `ENFORCE_HTTPS=true` is set
- [ ] `AUTH_ENABLED=true` is set
- [ ] Rate limits are tuned for expected traffic
- [ ] Backup cron jobs are installed (`python scripts/pg_backup.py cron`)
- [ ] WAL archiving is configured for PITR (`python scripts/pg_backup.py pitr`)
- [ ] Dependency audit runs in CI (`python scripts/audit_deps.py --ci`)
- [ ] Log aggregation is configured to capture CRITICAL events
