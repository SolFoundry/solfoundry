# Security Hardening Documentation

This document outlines the security measures implemented as part of the Production Security Hardening bounty.

## 1. SSL/TLS
- **HTTPS Everywhere:** All HTTP traffic is redirected to HTTPS (Nginx configuration in `ops/nginx/default.conf`).
- **HSTS Headers:** HTTP Strict Transport Security is enforced with `max-age=63072000; includeSubDomains; preload` (Nginx configuration).
- **Certificate Automation:** Let's Encrypt integration via Certbot is documented in `ops/scripts/certbot_setup.sh` for automated certificate management and renewal.

## 2. Secrets Management
- All sensitive configuration (API keys, database credentials, JWT secrets) are loaded via environment variables.
- A `.env.example` file provides dummy values for local development, instructing users to create a `.env` file with actual secrets.
- Secrets are never hardcoded in the codebase or logged.
- Docker Compose configuration (`docker-compose.yml`) explicitly uses environment variables.

## 3. Input Sanitization & SQL Injection Prevention
- **Input Sanitization:** All user inputs (e.g., bounty descriptions, comments, wallet addresses) are validated and sanitized.
  - Python: `app/utils/sanitizers.py` (e.g., `html.escape` for text, regex for addresses).
  - Node.js: `src/utils/sanitizers.js` (e.g., `DOMPurify` for HTML, regex for addresses).
- **SQL Injection Prevention:** All database queries MUST use parameterized statements. Raw string concatenation for SQL queries is strictly forbidden and regularly audited.

## 4. XSS Prevention
- **Content-Security-Policy (CSP):** HTTP headers are configured to mitigate XSS (Nginx configuration).
- All user-generated content rendered on the frontend is sanitized to prevent XSS attacks (e.g., using DOMPurify on client-side, or server-side HTML escaping before rendering).

## 5. Escrow Security
- **Transaction Signature Verification:** All Solana transaction signatures are verified server-side using the Solana RPC API (implemented in `app/services/escrow_service.py` and `src/services/escrowService.js`).
- **Double-Spend Prevention:** Fund and release operations implement idempotency checks using unique transaction IDs to prevent double-spending.
- **Rate Limiting:** API endpoints for fund/release operations are rate-limited to prevent abuse (via Nginx and potentially application-level mechanisms).
- See `SECURITY/ESCROW_PEN_TEST.md` for detailed pen-test report and attack vectors.

## 6. Auth Hardening
- **Refresh Token Rotation:** Refresh tokens are rotated upon use, invalidating the old token to minimize session hijacking windows (implemented in `app/services/auth_service.py` and `src/services/authService.js`).
- **Session Invalidation:** User sessions are immediately invalidated on logout, password changes, or other security-sensitive events.
- **Brute Force Protection:** Login endpoints implement brute force protection (e.g., account lockout after multiple failed attempts) (implemented in `app/services/auth_service.py` and `src/services/authService.js`).

## 7. DDoS Basics
- **Rate Limiting Tiers:** Nginx is configured with rate limiting zones (`limit_req_zone`) and applies limits to specific endpoints (`limit_req`) (Nginx configuration in `ops/nginx/nginx.conf` and `ops/nginx/default.conf`).
- **Request Size Limits:** `client_max_body_size` is configured in Nginx to prevent large request payloads.
- **Connection Limits:** `limit_conn_zone` and `limit_conn` are used in Nginx to limit concurrent connections per IP.

## 8. Dependency Audit
- Automated dependency scanning is integrated into the CI/CD pipeline.
- Python dependencies are scanned using [Safety](https://github.com/pyupio/safety) and [Bandit](https://github.com/PyCQA/bandit).
- Node.js dependencies are scanned using `npm audit` and [npm-audit-ci](https://github.com/Soluto/npm-audit-ci).
- The script `ops/scripts/scan_dependencies.sh` provides commands for manual execution.

## 9. Security Headers
- The following security headers are enforced via Nginx:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer-when-downgrade`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- (Configured in `ops/nginx/default.conf`).

## 10. Backup Strategy
- **Automated PostgreSQL Backups:** A daily `pg_dump` is scheduled to create full database backups (script: `ops/scripts/backup_postgres.sh`).
- **Point-In-Time Recovery (PITR):** PostgreSQL is configured with WAL (Write-Ahead Log) archiving enabled to allow for point-in-time recovery, ensuring minimal data loss in disaster scenarios. WAL files are automatically copied to an archive location.
- Backups and WAL archives are replicated to off-site storage.
