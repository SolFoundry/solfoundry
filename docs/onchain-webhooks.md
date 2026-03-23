# On-Chain Event Webhooks

SolFoundry can deliver real-time notifications to your HTTPS endpoint whenever
key on-chain events occur: escrow locks/releases, reputation changes, and
staking activity.

## Supported Event Types

| Event | Description |
|---|---|
| `escrow.locked` | A bounty escrow has been funded and locked on-chain |
| `escrow.released` | An escrow payout has been released to the winner |
| `reputation.updated` | A contributor's on-chain reputation score changed |
| `stake.deposited` | $FNDRY tokens deposited into a staking account |
| `stake.withdrawn` | $FNDRY tokens withdrawn from a staking account |

The full event catalog with payload field descriptions is available at:

```
GET /api/onchain-webhooks/catalog
```

---

## Quick Start

### 1. Register a Webhook

```bash
curl -X POST https://api.solfoundry.dev/api/onchain-webhooks/register \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourapp.com/webhooks/solfoundry",
    "secret": "your-hmac-secret-at-least-16-chars",
    "event_types": ["escrow.locked", "escrow.released"]
  }'
```

Omit `event_types` to subscribe to all event types.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://yourapp.com/webhooks/solfoundry",
  "active": true,
  "event_filter": "escrow.locked,escrow.released",
  "created_at": "2024-03-09T12:00:00Z",
  "failure_count": 0,
  "total_deliveries": 0,
  "success_deliveries": 0
}
```

### 2. Verify the Signature

Every delivery includes an `X-SolFoundry-Signature` header containing
an HMAC-SHA256 signature over the raw request body.

**Python example:**

```python
import hashlib
import hmac

def verify_signature(body: bytes, header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header)
```

**Node.js example:**

```js
const crypto = require("crypto");

function verifySignature(body, header, secret) {
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
}
```

Always verify the signature before processing a webhook. Reject requests where
the header is missing or the digest doesn't match.

---

## Delivery Format

Events are **batched** into 5-second windows and delivered in a single HTTP
POST per batch. This reduces call volume during high-activity periods.

### Request headers

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-SolFoundry-Event` | `batch` |
| `X-SolFoundry-Signature` | `sha256=<hex>` |
| `X-SolFoundry-Event-Types` | Comma-separated event types in this batch |
| `User-Agent` | `SolFoundry-OnChainWebhooks/1.0` |

### Batch envelope

```json
{
  "batch_id": "c47b3e8f-1234-4abc-b567-89ef01234567",
  "batch_size": 2,
  "window_start": "2024-03-09T12:00:00Z",
  "window_end": "2024-03-09T12:00:05Z",
  "events": [
    {
      "event": "escrow.locked",
      "tx_signature": "5j7s8K2mXyz...",
      "slot": 285491234,
      "block_time": 1710000000,
      "timestamp": "2024-03-09T12:00:01Z",
      "data": {
        "escrow_id": "550e8400-...",
        "bounty_id": "123e4567-...",
        "creator_wallet": "3xRT...Wallet",
        "amount_lamports": 275000000000
      }
    }
  ]
}
```

Every event carries:

- **`tx_signature`** — Base58 Solana transaction signature for on-chain verification
- **`slot`** — Slot at which the transaction was confirmed
- **`block_time`** — Unix timestamp of the confirming block
- **`timestamp`** — ISO-8601 delivery timestamp (UTC)
- **`data`** — Event-specific fields (see catalog below)

---

## Event Catalog

### `escrow.locked`

Fired when a bounty creator funds an escrow and locks $FNDRY tokens on-chain.

```json
{
  "event": "escrow.locked",
  "tx_signature": "5j7s8K2mXyz...",
  "slot": 285491234,
  "block_time": 1710000000,
  "timestamp": "2024-03-09T12:00:01Z",
  "data": {
    "escrow_id": "550e8400-e29b-41d4-a716-446655440000",
    "bounty_id": "123e4567-e89b-12d3-a456-426614174000",
    "creator_wallet": "3xRT...Wallet",
    "amount_lamports": 275000000000
  }
}
```

### `escrow.released`

Fired when the escrow payout is transferred to the winning contributor.

```json
{
  "event": "escrow.released",
  "tx_signature": "7kL9mN3pQrs...",
  "slot": 285501234,
  "block_time": 1710003600,
  "timestamp": "2024-03-09T13:00:01Z",
  "data": {
    "escrow_id": "550e8400-e29b-41d4-a716-446655440000",
    "bounty_id": "123e4567-e89b-12d3-a456-426614174000",
    "winner_wallet": "HZV6YPdTeJPjPujWjzsFLLKja91K2Ze78XeY8MeFhfK8",
    "amount_lamports": 275000000000
  }
}
```

### `reputation.updated`

Fired when a contributor's on-chain reputation is recalculated after a
completed or rejected bounty.

```json
{
  "event": "reputation.updated",
  "tx_signature": "9nP0qR4sTuv...",
  "slot": 285511234,
  "block_time": 1710007200,
  "timestamp": "2024-03-09T14:00:01Z",
  "data": {
    "contributor_id": "abc12345-e89b-12d3-a456-426614174000",
    "wallet": "3xRT...Wallet",
    "old_score": 42.5,
    "new_score": 45.1,
    "delta": 2.6,
    "tier": "T2"
  }
}
```

### `stake.deposited`

Fired when a contributor deposits $FNDRY tokens into a staking account.

```json
{
  "event": "stake.deposited",
  "tx_signature": "BqV1wX5yZab...",
  "slot": 285521234,
  "block_time": 1710010800,
  "timestamp": "2024-03-09T15:00:01Z",
  "data": {
    "wallet": "3xRT...Wallet",
    "amount_lamports": 50000000000,
    "stake_account": "StakeAcc...pubkey"
  }
}
```

### `stake.withdrawn`

Fired when a contributor withdraws $FNDRY tokens from a staking account.

```json
{
  "event": "stake.withdrawn",
  "tx_signature": "CrW2xY6zAbc...",
  "slot": 285531234,
  "block_time": 1710014400,
  "timestamp": "2024-03-09T16:00:01Z",
  "data": {
    "wallet": "3xRT...Wallet",
    "amount_lamports": 50000000000,
    "stake_account": "StakeAcc...pubkey"
  }
}
```

---

## Retries

Failed deliveries (non-2xx response or network error) are retried with
exponential backoff:

| Attempt | Delay before retry |
|---|---|
| 1 (initial) | — |
| 2 | 2 seconds |
| 3 | 4 seconds |

After 3 failed attempts the batch is dropped and the `failure_count` on
your subscription increments.

---

## Dashboard

Monitor delivery health via the dashboard endpoint:

```bash
GET /api/onchain-webhooks/{subscription_id}/dashboard
```

Returns:

```json
{
  "subscription_id": "550e8400-...",
  "total_deliveries": 150,
  "success_deliveries": 147,
  "failure_count": 3,
  "success_rate": 0.98,
  "last_delivery_at": "2024-03-09T16:00:01Z",
  "last_delivery_status": "success",
  "recent_logs": [
    {
      "id": "...",
      "batch_id": "...",
      "event_type": "escrow.locked",
      "tx_signature": "5j7s...",
      "attempt": 1,
      "status_code": 200,
      "success": true,
      "latency_ms": 245,
      "attempted_at": "2024-03-09T16:00:01Z"
    }
  ]
}
```

---

## Testing Your Endpoint

Use the test endpoint to verify your integration without waiting for a real
on-chain event:

```bash
curl -X POST https://api.solfoundry.dev/api/onchain-webhooks/{id}/test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "escrow.locked"}'
```

Test payloads have `data.test: true` so you can distinguish them in your handler.

---

## Managing Subscriptions

### List all subscriptions

```bash
GET /api/onchain-webhooks
```

### Delete a subscription

```bash
DELETE /api/onchain-webhooks/{subscription_id}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HELIUS_API_KEY` | — | Helius API key for enhanced transaction indexing |
| `SHYFT_API_KEY` | — | Shyft API key (alternative indexer) |
| `SOLFOUNDRY_PROGRAM_IDS` | `C2TvY8...` | Comma-separated program pubkeys to watch |
| `WEBHOOK_BATCH_WINDOW_SECONDS` | `5` | Batch accumulation window in seconds |
| `WEBHOOK_INDEXER_POLL_SECONDS` | `10` | How often to poll the indexer for new transactions |
