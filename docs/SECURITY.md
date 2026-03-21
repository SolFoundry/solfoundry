# Security Documentation

This document outlines the security measures implemented in SolFoundry for production deployment.

## Table of Contents

1. [SSL/TLS Configuration](#ssltls-configuration)
2. [Secrets Management](#secrets-management)
3. [Input Sanitization](#input-sanitization)
4. [SQL Injection Prevention](#sql-injection-prevention)
5. [XSS Prevention](#xss-prevention)
6. [Escrow Security](#escrow-security)
7. [Authentication Hardening](#authentication-hardening)
8. [DDoS Protection](#ddos-protection)
9. [Dependency Security](#dependency-security)
10. [Security Headers](#security-headers)
11. [Backup Strategy](#backup-strategy)

---

## SSL/TLS Configuration

### HTTPS Enforcement

All production traffic is forced to HTTPS via the `HTTPSRedirectMiddleware`:

- HTTP requests are redirected to HTTPS with 308 status code
- HSTS header is set with `max-age=31536000; includeSubDomains`
- Supports reverse proxy setups via `X-Forwarded-Proto` header

### Configuration

```bash
# In production
ENV=production
FORCE_HTTPS=true
```

### Certificate Management

For production deployments, use Let's Encrypt with cert-manager:

```yaml
# kubernetes/cert-manager.yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: solfoundry-tls
spec:
  secretName: solfoundry-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - solfoundry.org
    - api.solfoundry.org
```

---

## Secrets Management

### Environment Variables

All secrets are loaded from environment variables:

| Variable | Description | Minimum Length |
|----------|-------------|----------------|
| `JWT_SECRET_KEY` | JWT signing key | 32 chars |
| `SECRET_KEY` | General secret key | 32 chars |
| `DATABASE_URL` | PostgreSQL connection | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | 20 chars |
| `GITHUB_WEBHOOK_SECRET` | Webhook verification | 16 chars |

### Secret Generation

```bash
# Generate a secure secret
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Validation

Secrets are validated on startup in `app/core/secrets_validator.py`:

- Checks minimum length requirements
- Detects insecure default values
- Validates production configuration

---

## Input Sanitization

### Implementation

All user inputs are sanitized via `app/core/input_sanitizer.py`:

```python
from app.core.input_sanitizer import (
    sanitize_html,
    sanitize_text,
    validate_solana_wallet,
    sanitize_bounty_title,
    sanitize_bounty_description,
)
```

### Input Limits

| Field | Maximum Length |
|-------|---------------|
| Title | 200 chars |
| Description | 10,000 chars |
| Comment | 2,000 chars |
| Wallet Address | 58 chars |

### Wallet Validation

Solana wallet addresses are validated:

- Length check (32-58 characters)
- Base58 character set verification
- Format validation

---

## SQL Injection Prevention

### ORM Usage

All database operations use SQLAlchemy ORM with parameterized queries:

```python
# Safe - uses ORM
result = await db.execute(select(User).where(User.id == user_id))

# Safe - uses text() with bind parameters
result = await conn.execute(text("SELECT 1"))
```

### Audit Results

- ✅ All queries use SQLAlchemy ORM
- ✅ No raw SQL with string concatenation
- ✅ `text("SELECT 1")` in health check is safe (no user input)

---

## XSS Prevention

### Content Security Policy

Strict CSP headers are set on all responses:

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; ...
```

### HTML Escaping

All user content is HTML-escaped before storage and display:

```python
from app.core.input_sanitizer import sanitize_html
safe_content = sanitize_html(user_input)
```

### Security Headers

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - XSS filter (legacy browsers)

---

## Escrow Security

### Transaction Verification

All escrow operations verify on-chain transactions:

1. **Funding**: Transaction confirmed before state transition
2. **Release**: Funds only released after confirmation
3. **Refund**: Return to verified creator wallet

### Double-Spend Protection

```python
async def confirm_transaction(tx_hash: str) -> bool:
    """Verify transaction is confirmed on-chain."""
    # Check for 32 confirmations (Solana)
    # Prevents double-spend attacks
```

### State Machine

Escrow follows strict state transitions:

```
PENDING → FUNDED → ACTIVE → RELEASING → COMPLETED
                  ↓
               REFUNDED
```

### Rate Limiting

Escrow endpoints have rate limiting:

- `/api/escrow/fund`: 5 requests/minute
- `/api/escrow/release`: 5 requests/minute
- `/api/escrow/refund`: 5 requests/minute

---

## Authentication Hardening

### JWT Implementation

- **Access tokens**: 1 hour expiration
- **Refresh tokens**: 7 days expiration
- **Algorithm**: HS256
- **JTI claim**: Unique token ID for revocation

### Refresh Token Rotation

```python
async def refresh_access_token(db: AsyncSession, refresh_token: str) -> Dict:
    """Exchange refresh token for new access token."""
    # Validates refresh token type
    # Returns new access token
```

### Brute Force Protection

Implemented in `app/middleware/brute_force_protection.py`:

- Max 5 failed attempts before lockout
- 15-minute lockout duration
- Progressive delays (0, 1, 2, 5, 10 seconds)
- Distributed tracking via Redis

### OAuth State Verification

```python
def verify_oauth_state(state: str) -> bool:
    """Verify OAuth state parameter."""
    # Validates state exists and hasn't expired
    # Prevents CSRF attacks
```

---

## DDoS Protection

### Rate Limiting Tiers

| Endpoint Group | Limit | Burst |
|---------------|-------|-------|
| Authentication | 5/min | 5 |
| API | 60/min | 60 |
| Webhooks | 120/min | 120 |

### Implementation

Rate limiting uses Redis-backed token bucket algorithm:

```python
# Lua script ensures atomic check-and-decrement
TOKEN_BUCKET_SCRIPT = """
local now = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
...
"""
```

### Request Size Limits

- Maximum payload: 10MB (configurable via `MAX_PAYLOAD_SIZE`)
- Connection limits handled by reverse proxy

---

## Dependency Security

### Python Dependencies

Audit with pip-audit:

```bash
pip install pip-audit
pip-audit -r requirements.txt
```

### Node Dependencies

Audit with npm:

```bash
cd frontend
npm audit
npm audit fix
```

### Automated Scanning

GitHub Dependabot is enabled for both Python and Node dependencies.

---

## Security Headers

All responses include these security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS enforcement |
| `X-Frame-Options` | `DENY` | Clickjacking prevention |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing prevention |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |
| `Content-Security-Policy` | (see above) | XSS/injection prevention |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy |
| `Permissions-Policy` | (restrictive) | Feature restriction |

---

## Backup Strategy

### PostgreSQL Backups

Automated backups configured via:

- **Schedule**: Daily at 3 AM UTC
- **Retention**: 30 days
- **Storage**: S3-compatible storage
- **Encryption**: AES-256

### Backup Script

```bash
#!/bin/bash
# scripts/backup-postgres.sh

BACKUP_FILE="solfoundry_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump $DATABASE_URL | gzip > $BACKUP_FILE
aws s3 cp $BACKUP_FILE s3://$BACKUP_BUCKET/$BACKUP_FILE
```

### Point-in-Time Recovery

PostgreSQL WAL archiving enabled for point-in-time recovery:

```sql
-- postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://bucket/wal/%f'
```

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets configured in secrets manager
- [ ] HTTPS enforced
- [ ] Rate limiting enabled
- [ ] Backup automation tested
- [ ] Dependency audit passed
- [ ] Security headers verified
- [ ] CSP tested with real traffic

### Ongoing

- [ ] Monitor security alerts
- [ ] Regular dependency updates
- [ ] Periodic security audits
- [ ] Review rate limit logs
- [ ] Verify backup integrity

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Email: security@solfoundry.org
2. Include detailed description and reproduction steps
3. Allow 90 days for fix before public disclosure

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-03-22 | Initial security hardening (Issue #197) |