# Escrow Security: Attack Vectors and Mitigations

## Overview

The SolFoundry escrow system handles $FNDRY token payouts and treasury buybacks on the Solana blockchain. This document details the attack vectors identified during security review and the mitigations implemented.

## Threat Model

**Assets at risk:**
- Treasury wallet funds (SOL and $FNDRY tokens)
- Payout integrity (correct amounts to correct recipients)
- Escrow state consistency (no orphaned or duplicated operations)

**Threat actors:**
- External attackers: Attempting to drain treasury or claim fraudulent payouts
- Malicious contributors: Submitting fake transactions for payout
- Compromised accounts: Stolen credentials used for unauthorized operations

---

## Attack Vectors and Mitigations

### 1. Double-Spend Attack

**Vector:** An attacker submits the same Solana transaction hash for multiple payout records, receiving credit multiple times for a single on-chain transaction.

**Severity:** Critical

**Mitigation:**
- `TransactionVerifier.check_double_spend()` maintains a set of all processed transaction hashes
- Before any payout is recorded, the transaction hash is checked against the processed set
- On match, a `DoubleSpendError` is raised and logged at CRITICAL level
- The payout service also checks for duplicate `tx_hash` in `_payout_store`

**Code reference:** `backend/app/services/escrow_security.py` — `TransactionVerifier.check_double_spend()`

**Test:** `test_double_spend_prevention()` in `backend/tests/test_security.py`

---

### 2. Transaction Replay Attack

**Vector:** An attacker captures a legitimate old transaction and resubmits it to claim a payout for work they didn't do.

**Severity:** High

**Mitigation:**
- `TransactionVerifier.verify_transaction_age()` rejects transactions older than 300 seconds (configurable via `ESCROW_TX_MAX_AGE`)
- Transaction timestamps are verified server-side before processing
- Each bounty payout is linked to a specific bounty ID, preventing cross-bounty replays

**Code reference:** `backend/app/services/escrow_security.py` — `TransactionVerifier.verify_transaction_age()`

---

### 3. Invalid Signature / Forged Transaction

**Vector:** An attacker constructs a fake transaction hash that looks valid but was never confirmed on-chain.

**Severity:** Critical

**Mitigation:**
- Transaction hashes are validated against Base58 format constraints (64-88 chars, valid character set)
- Server-side RPC verification can query Solana for transaction confirmation status
- Wallet addresses validated against Base58 format (32-44 chars, no O/0/I/l)

**Code reference:** `backend/app/services/escrow_security.py` — `validate_transaction_hash()`, `validate_solana_address()`

---

### 4. Race Condition on Fund/Release

**Vector:** Multiple concurrent requests to fund or release escrow create inconsistent state (e.g., double-release, fund after release).

**Severity:** High

**Mitigation:**
- `TransactionVerifier` uses a `threading.Semaphore` to limit concurrent escrow operations (default: 10)
- `acquire_operation_slot()` / `release_operation_slot()` pattern prevents unbounded concurrency
- Payout service uses `threading.Lock` for thread-safe store access
- State transitions are validated before application

**Code reference:** `backend/app/services/escrow_security.py` — `ConcurrencyLimitError`, `backend/app/services/payout_service.py` — `_lock`

---

### 5. Rate-Based Fund Drain

**Vector:** An attacker rapidly submits many small payout requests to drain the treasury through volume rather than a single large attack.

**Severity:** High

**Mitigation:**
- Per-endpoint rate limiting: `POST /api/payouts` limited to 5 requests/minute per IP
- Per-endpoint rate limiting: `POST /api/treasury/buybacks` limited to 5 requests/minute per IP
- Global rate limiting applies additionally (30/min anonymous, 120/min authenticated)
- All payout requests require authentication

**Code reference:** `backend/app/middleware/rate_limiter.py` — `ENDPOINT_RATE_LIMITS`

---

### 6. Wallet Address Manipulation

**Vector:** An attacker provides a modified wallet address in the payout request, redirecting funds to their own wallet instead of the legitimate recipient.

**Severity:** Critical

**Mitigation:**
- Wallet addresses validated with `validate_solana_address()` (Base58 format, 32-44 chars)
- Recipient addresses verified against registered user wallet addresses
- Wallet linking requires signature verification (proves ownership)
- Pydantic model validators enforce format constraints (`min_length=32, max_length=64`)

**Code reference:** `backend/app/services/escrow_security.py` — `validate_solana_address()`, `backend/app/models/user.py` — `WalletAuthRequest`

---

### 7. Unauthorized Escrow Operations

**Vector:** An unauthenticated or unauthorized user triggers payout, fund, or release operations.

**Severity:** Critical

**Mitigation:**
- All escrow-related API endpoints require JWT authentication
- Auth middleware extracts and validates JWT before reaching route handlers
- Rate limiting applies per-IP and per-endpoint to slow automated attacks
- Brute force protection prevents credential guessing (5 attempts → 15min lockout)

**Code reference:** `backend/app/api/auth.py` — `get_current_user_id()`, `backend/app/services/auth_hardening.py` — `BruteForceProtector`

---

### 8. Transaction Hash Injection

**Vector:** An attacker provides a crafted transaction hash containing SQL injection or XSS payloads instead of a valid hash.

**Severity:** Medium

**Mitigation:**
- Transaction hash format validated via regex (`^[0-9a-fA-F]{64}$|^[1-9A-HJ-NP-Za-km-z]{64,88}$`)
- Input sanitization middleware scans all request fields for injection patterns
- SQLAlchemy parameterized queries prevent SQL injection even if validation is bypassed

**Code reference:** `backend/app/api/payouts.py` — `_TX_HASH_RE`, `backend/app/middleware/sanitization.py`

---

### 9. Treasury Cache Poisoning

**Vector:** An attacker manipulates cached treasury balance data to show incorrect balances, potentially masking a drain attack.

**Severity:** Medium

**Mitigation:**
- Treasury cache has a 60-second TTL (stale data is short-lived)
- Cache is invalidated on every payout and buyback operation
- Cache lock prevents race conditions during refresh
- Balances are read directly from Solana RPC (not from user input)

**Code reference:** `backend/app/services/treasury_service.py` — `_cache`, `invalidate_cache()`

---

### 10. Denial-of-Service on Escrow Endpoints

**Vector:** An attacker floods escrow endpoints to prevent legitimate operations from processing.

**Severity:** Medium

**Mitigation:**
- Connection limit: 50 concurrent connections per IP
- Request body size limit: 1 MB
- Tiered rate limiting with escalating restrictions
- Escrow concurrency limit: 10 simultaneous operations
- Health check endpoint excluded from rate limiting for monitoring

**Code reference:** `backend/app/middleware/rate_limiter.py`, `backend/app/middleware/security.py`

---

## Security Testing Checklist

- [x] Double-spend prevention verified with concurrent duplicate transactions
- [x] Transaction age rejection verified with expired timestamps
- [x] Wallet address validation covers edge cases (too short, wrong charset)
- [x] Rate limiting triggers on rapid payout requests
- [x] Brute force lockout activates after threshold failures
- [x] Security headers present on all responses
- [x] Input sanitization blocks XSS and SQL injection in payout fields
- [x] Concurrent escrow operations respect semaphore limits
- [x] Token rotation works correctly and detects reuse
- [x] Session invalidation revokes all user tokens

## Recommendations for Future Hardening

1. **On-chain verification:** Add RPC calls to verify transaction confirmation status before accepting tx_hash values
2. **Multi-sig treasury:** Require multiple admin signatures for large payouts (>100K $FNDRY)
3. **Anomaly detection:** Flag unusual payout patterns (amount spikes, frequency changes)
4. **Hardware security module:** Store treasury private keys in HSM for signing operations
5. **Timelock:** Implement a delay period for large payouts with admin cancellation capability
