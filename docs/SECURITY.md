# Security Documentation

This document outlines the security measures implemented in SolFoundry as per Issue #197 - Production Security Hardening.

## Table of Contents

1. [SSL/TLS Configuration](#ssltls-configuration)
2. [Secrets Management](#secrets-management)
3. [Input Validation & Sanitization](#input-validation--sanitization)
4. [SQL Injection Prevention](#sql-injection-prevention)
5. [XSS Prevention](#xss-prevention)
6. [Escrow Security](#escrow-security)
7. [Authentication Hardening](#authentication-hardening)
8. [DDoS Protection](#ddos-protection)
9. [Dependency Audit](#dependency-audit)
10. [Security Headers](#security-headers)
11. [Backup Strategy](#backup-strategy)
12. [OWASP Top 10 Mitigations](#owasp-top-10-mitigations)

---

## SSL/TLS Configuration

### HTTPS Enforcement

- All production traffic must use HTTPS
- HTTP requests are redirected to HTTPS
- HSTS header enforces HTTPS for 1 year with subdomains

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Certificate Management

- TLS 1.2+ required, TLS 1.3 preferred
- Certificates managed via Let's Encrypt automation
- Automatic renewal via certbot

### Configuration

```nginx
# Nginx configuration for SSL
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
```

---

## Secrets Management

### Environment Variables

All secrets are loaded from environment variables. **Never** hardcode secrets in source code.

Required environment variables:

```bash
# Authentication
JWT_SECRET_KEY=<random-256-bit-key>
GITHUB_CLIENT_ID=<github-oauth-client-id>
GITHUB_CLIENT_SECRET=<github-oauth-secret>

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host/db

# Redis
REDIS_URL=redis://localhost:6379/0

# Solana
SOLANA_RPC_URL=<rpc-endpoint>
TREASURY_KEYPAIR_PATH=/path/to/keypair.json

# Security
AUTH_SECRET=<auth-signing-secret>
```

### .env.example

A `.env.example` file is provided with dummy values. **Never commit `.env` files.**

```bash
# .env.example - Copy to .env and fill in real values
JWT_SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost/solfoundry
REDIS_URL=redis://localhost:6379/0
```

### Secret Rotation

- JWT secrets should be rotated every 90 days
- Database credentials rotated quarterly
- Use secret management service (AWS Secrets Manager, HashiCorp Vault) in production

---

## Input Validation & Sanitization

### Input Sanitization Module

Location: `backend/app/core/security.py`

All user inputs are sanitized before processing:

```python
from app.core.security import sanitize_html, sanitize_text, validate_solana_wallet

# Sanitize HTML content
clean_html = sanitize_html(user_input, max_length=10000)

# Sanitize plain text
clean_text = sanitize_text(user_input, max_length=500)

# Validate wallet address
if validate_solana_wallet(wallet_address):
    # Process wallet
```

### Validation Rules

| Input Type | Max Length | Validation |
|------------|------------|------------|
| Bounty Title | 500 chars | No HTML, text only |
| Bounty Description | 10,000 chars | Sanitized HTML |
| Comments | 5,000 chars | Sanitized HTML |
| Wallet Address | 44 chars | Base58 format validation |
| GitHub URLs | 2,048 chars | GitHub domain check |

### Wallet Address Validation

Solana wallet addresses are validated using base58 regex pattern:

```python
SOLANA_WALLET_PATTERN = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
```

---

## SQL Injection Prevention

### Parameterized Queries

All database operations use SQLAlchemy ORM with parameterized queries:

```python
# Safe: SQLAlchemy ORM
result = await db.execute(select(User).where(User.wallet_address == wallet))

# Safe: SQLAlchemy Core with bind parameters
result = await db.execute(text("SELECT * FROM users WHERE id = :id"), {"id": user_id})

# NEVER: String concatenation (VULNERABLE!)
# result = await db.execute(text(f"SELECT * FROM users WHERE id = {user_id}"))
```

### Raw SQL Audit

All raw SQL queries have been audited to ensure they use parameterized inputs. See `backend/app/core/security.py` for the `sanitize_sql_identifier` and `escape_like_pattern` utilities.

### LIKE Query Protection

```python
from app.core.security import escape_like_pattern

# Escape special characters before using in LIKE
safe_pattern = escape_like_pattern(user_search)
result = await db.execute(
    select(Bounty).where(Bounty.title.ilike(f"%{safe_pattern}%"))
)
```

---

## XSS Prevention

### Content Security Policy

CSP header restricts sources of executable scripts:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;
```

### HTML Sanitization

User-submitted HTML is sanitized to remove dangerous elements:

```python
# Dangerous patterns removed:
# - <script> tags
# - <iframe>, <object>, <embed> tags
# - javascript: URLs
# - Event handlers (onclick, onerror, etc.)
# - data: URLs

# Allowed tags: p, br, b, i, u, strong, em, ul, ol, li, code, pre
```

### Output Encoding

All dynamic content is HTML-escaped when rendered:

```python
from app.core.security import sanitize_html

# Escape before rendering
safe_content = sanitize_html(user_content)
```

---

## Escrow Security

### Transaction Verification

All escrow transactions are verified on-chain:

1. **Transaction Signature Verification**: Server-side verification of Solana signatures using `solders` library
2. **Confirmation Check**: Transactions must be confirmed before state change
3. **Double-Spend Protection**: Unconfirmed transactions result in automatic refund

```python
# Escrow flow:
# 1. User initiates funding → PENDING state
# 2. SPL transfer executed → awaiting confirmation
# 3. Confirmation received → FUNDED state
# 4. If not confirmed → REFUNDED state (double-spend protection)
```

### State Machine

Escrow follows strict state transitions:

```
PENDING → FUNDED → ACTIVE → RELEASING → COMPLETED
                     ↓
                  REFUNDED
```

Invalid transitions are rejected:

```python
ALLOWED_ESCROW_TRANSITIONS = {
    EscrowState.PENDING: {EscrowState.FUNDED, EscrowState.REFUNDED},
    EscrowState.FUNDED: {EscrowState.ACTIVE, EscrowState.REFUNDED},
    EscrowState.ACTIVE: {EscrowState.RELEASING, EscrowState.REFUNDED},
    EscrowState.RELEASING: {EscrowState.COMPLETED, EscrowState.ACTIVE},
}
```

### Rate Limiting

Escrow operations are rate-limited to prevent abuse:

- Fund operations: 10/hour per wallet
- Release operations: 20/hour per wallet

---

## Authentication Hardening

### Refresh Token Rotation

Each refresh token can only be used once. Upon refresh, a new refresh token is issued:

```python
# Token rotation flow:
# 1. Client sends refresh_token
# 2. Server validates and marks token as used
# 3. New access_token + refresh_token issued
# 4. Old refresh_token invalidated

# Replay detection:
# If a used token is presented again, entire token family is revoked
```

### Session Invalidation

Users can invalidate all sessions:

```python
# Logout all devices
await revoke_all_user_sessions(user_id)
```

### Brute Force Protection

Failed login attempts are tracked and limited:

- Max failed attempts: 5 per 5 minutes
- Lockout duration: 15 minutes
- Tracked per IP address

```python
# Middleware tracks:
# - Failed auth attempts (401 responses)
# - Locks out IP after threshold
# - Clears attempts on successful auth
```

### OAuth State Verification

GitHub OAuth uses state parameter to prevent CSRF:

```python
# OAuth flow:
# 1. Generate random state token
# 2. Store state with 10-minute expiry
# 3. Verify state on callback
# 4. Reject if state missing or expired
```

### Wallet Auth Nonce Binding

Wallet authentication uses nonce to prevent replay attacks:

```python
# Wallet auth flow:
# 1. Generate nonce and message
# 2. User signs message with wallet
# 3. Verify nonce hasn't been used
# 4. Verify signature matches wallet
```

---

## DDoS Protection

### Rate Limiting Tiers

| Endpoint Group | Rate Limit | Burst |
|----------------|------------|-------|
| Authentication | 5/min | 5 |
| API | 60/min | 60 |
| Webhooks | 120/min | 120 |

### Implementation

Redis-backed token bucket algorithm:

```python
# Token bucket parameters:
# - Rate: tokens added per second
# - Capacity: maximum tokens (burst size)
# - Each request consumes 1 token

# Headers returned:
# X-RateLimit-Limit: 60
# X-RateLimit-Remaining: 45
# X-RateLimit-Reset: 1711234567
```

### Request Size Limits

Maximum request body size: 10MB

```python
MAX_PAYLOAD_SIZE = 10 * 1024 * 1024  # 10MB
```

### Connection Limits

At the infrastructure level (nginx/HAProxy):

- Max connections per IP: 100
- Max connections per endpoint: 1000
- Connection timeout: 30 seconds

---

## Dependency Audit

### Python Dependencies

Run security audit:

```bash
pip install safety
safety check --full-report
```

### Node.js Dependencies

Run npm audit:

```bash
npm audit
npm audit fix
```

### Automated Scanning

GitHub Dependabot is enabled for automated vulnerability scanning:

- Python: `requirements.txt`
- Node.js: `package.json`, `package-lock.json`

### Known Vulnerabilities

All dependencies are scanned weekly for:
- CVE vulnerabilities
- Security advisories
- Outdated versions

---

## Security Headers

All responses include security headers:

```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
X-Permitted-Cross-Domain-Policies: none
```

### Header Implementation

```python
# backend/app/middleware/security.py
response.headers["X-Frame-Options"] = "DENY"
response.headers["X-Content-Type-Options"] = "nosniff"
response.headers["X-XSS-Protection"] = "1; mode=block"
response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
response.headers["Content-Security-Policy"] = CSP_DEFAULT
response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
```

---

## Backup Strategy

### PostgreSQL Backups

**Daily Full Backups**:
- Automated via cron job at 2 AM UTC
- Retention: 30 days daily, 12 weeks weekly, 12 months monthly
- Format: Custom pg_dump with compression

**Point-in-Time Recovery (PITR)**:
- WAL archiving enabled
- WAL segments retained for recovery
- Recovery to any point within retention window

### Backup Configuration

```bash
# PostgreSQL WAL archiving (postgresql.conf)
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

### Restoration Procedure

```bash
# Restore from backup
pg_restore -h localhost -U postgres -d solfoundry \
  --no-owner --no-acl --clean --if-exists \
  /backups/solfoundry_20240322_020000.dump
```

### Kubernetes CronJob

Automated backups via Kubernetes CronJob:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
```

---

## OWASP Top 10 Mitigations

### A01: Broken Access Control
- JWT-based authentication
- Role-based access control
- Session invalidation support
- OAuth state verification

### A02: Cryptographic Failures
- TLS 1.2+ for all connections
- Secure key generation (256-bit)
- No secrets in logs
- Environment variable management

### A03: Injection
- Parameterized queries everywhere
- Input sanitization
- SQL identifier validation
- LIKE pattern escaping

### A04: Insecure Design
- Threat modeling completed
- Secure architecture patterns
- Defense in depth
- Security by default

### A05: Security Misconfiguration
- Secure default settings
- Security headers enforced
- Error messages sanitized
- Debug mode disabled in production

### A06: Vulnerable Components
- Regular dependency audits
- Automated vulnerability scanning
- Patch management process

### A07: Authentication Failures
- Brute force protection
- Session management
- Multi-factor auth support
- Password strength requirements

### A08: Software and Data Integrity
- Code signing
- CI/CD security
- Dependency verification
- Backup integrity checks

### A09: Security Logging Failures
- Comprehensive audit logging
- Structured logging (structlog)
- Event tracking
- Alert on suspicious activity

### A10: SSRF
- URL validation
- Allowed host lists
- No arbitrary URL fetching
- Internal network protection

---

## Penetration Testing

### Escrow Service Attack Vectors

Documented attack vectors and mitigations:

| Attack Vector | Mitigation |
|---------------|------------|
| Replay attack | Nonce validation, token rotation |
| Double spend | Transaction confirmation check |
| Signature forgery | Cryptographic verification with solders |
| State manipulation | Strict state machine validation |
| Race conditions | Database transactions, atomic operations |

### Security Testing

Run security tests:

```bash
# Backend security tests
pytest tests/security/ -v

# Dependency vulnerability scan
safety check

# Code security analysis
bandit -r backend/app
```

---

## Contact

For security issues, please contact: security@solfoundry.org

Do not disclose security vulnerabilities publicly. We will respond within 48 hours.