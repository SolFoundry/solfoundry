# Troubleshooting

## Common Errors

### `AuthenticationError: 401 Unauthorized`

**Cause:** Missing or expired JWT token.

**Fix:**
```bash
# Set the token
export SOLFOUNDRY_TOKEN=eyJhbGc...

# Or pass it in code
const client = SolFoundry.create({ baseUrl, authToken: 'eyJhbGc...' });
```

---

### `NotFoundError: 404 Not Found`

**Cause:** The bounty, contributor, or escrow ID does not exist.

**Fix:** Verify the ID is correct. Use `solfoundry bounties --json | jq '.[].id'` to list valid IDs.

---

### `RateLimitError: 429 Too Many Requests`

**Cause:** Exceeded the API rate limit (60 req/min per IP for public endpoints).

**Fix:** The SDK automatically retries rate-limited requests with backoff. If you need higher limits, use an authenticated token or reduce your `maxRequestsPerSecond`:

```typescript
const client = SolFoundry.create({
  baseUrl,
  maxRequestsPerSecond: 2,  // slow down client-side
});
```

---

### `NetworkError: fetch failed`

**Cause:** DNS resolution failure, network timeout, or the server is down.

**Fix:**
1. Check `SOLFOUNDRY_BASE_URL` is correct
2. Verify your network connection
3. Try `curl https://api.solfoundry.io/health`

---

### `RetryExhaustedError`

**Cause:** All retry attempts failed (default: 3 retries).

**Fix:** Check the underlying error (`.cause`) and resolve it first. Increase retries only as a last resort:

```typescript
const client = SolFoundry.create({ baseUrl, maxRetries: 5 });
```

---

### `Invalid transaction signature format` (CLI verify)

**Cause:** The `<tx-hash>` passed to `solfoundry verify` is not a valid Solana transaction signature.

**Fix:** Solana signatures are 87–88 characters of base58. Double-check you copied the full signature from the block explorer.

---

## Still stuck?

Open an issue at [github.com/SolFoundry/solfoundry/issues](https://github.com/SolFoundry/solfoundry/issues).
