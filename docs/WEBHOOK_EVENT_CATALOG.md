# Contributor webhook event catalog

Outbound webhooks are registered via `POST /api/webhooks/register`. Each delivery is an HTTPS `POST` with JSON body and headers:

- `Content-Type: application/json`
- `X-SolFoundry-Event`: single-event name, or `batch` for batched on-chain deliveries
- `X-SolFoundry-Signature`: `sha256=<hex>` HMAC-SHA256 of the **raw** JSON body using the subscriber secret

## Bounty lifecycle (immediate delivery)

One JSON object per request (`delivery_mode` is omitted).

| Event | Description |
|-------|-------------|
| `bounty.claimed` | A bounty was claimed. |
| `review.started` | Automated review began. |
| `review.passed` | Review passed. |
| `review.failed` | Review failed. |
| `bounty.paid` | Payout completed. |

### Schema (single event)

```json
{
  "event": "bounty.claimed",
  "bounty_id": "<uuid-or-string>",
  "timestamp": "2026-03-23T12:00:00Z",
  "data": { }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `event` | string | yes | One of the lifecycle events above. |
| `bounty_id` | string | no | Empty string when not applicable. |
| `timestamp` | string | yes | ISO-8601 UTC. |
| `data` | object | yes | Event-specific payload from the API. |
| `transaction_signature` | string | no | Present for on-chain-correlated bounty events. |
| `slot` | integer | no | Solana slot when applicable. |

## On-chain events (batched, 5-second window)

Indexer integrations (Helius, Shyft, or custom workers) call:

`POST /api/webhooks/internal/chain-events`

Header: `X-Chain-Indexer-Key: <CHAIN_WEBHOOK_INDEXER_SECRET>`

Accepted event types:

| Event | Description |
|-------|-------------|
| `escrow.locked` | Escrow funds locked on-chain. |
| `escrow.released` | Escrow released to recipient. |
| `reputation.updated` | Reputation changed on-chain or mirrored from chain. |
| `stake.deposited` | Stake deposited. |
| `stake.withdrawn` | Stake withdrawn. |

Events are **queued** and delivered in **batches** every **5 seconds** to reduce HTTP volume. Subscribers receive:

| Header | Value |
|--------|--------|
| `X-SolFoundry-Event` | `batch` |

### Schema (batch envelope)

```json
{
  "delivery_mode": "batch",
  "batch_id": "<uuid>",
  "window_seconds": 5,
  "timestamp": "2026-03-23T12:00:05Z",
  "events": [
    {
      "event": "escrow.locked",
      "bounty_id": "",
      "timestamp": "2026-03-23T12:00:04Z",
      "transaction_signature": "<base58-signature>",
      "slot": 123456789,
      "data": {
        "accounts": { }
      }
    }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `delivery_mode` | `"batch"` | yes | Constant. |
| `batch_id` | string | yes | Shared id for all events in this HTTP delivery. |
| `window_seconds` | integer | yes | Batch window size (5). |
| `timestamp` | string | yes | Time the batch was sealed (UTC). |
| `events` | array | yes | Each element matches the single-event shape, including `transaction_signature` and `slot` when provided by the indexer. |

### Indexer request body (`/chain-events`)

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `event` | string | yes | One of the five on-chain types. |
| `transaction_signature` | string | yes | 32–128 chars (base58 tx id). |
| `slot` | integer | yes | `>= 0`. |
| `block_time` | string | no | ISO-8601 UTC; defaults to ingest time. |
| `accounts` | object | no | Account pubkey → parsed fields (indexer-defined). |
| `bounty_id` | string | no | Correlation id when known. |
| `extra` | object | no | Merged into `data` alongside `accounts`. |
| `notify_user_id` | string | no | Internal user UUID; if set, only that user’s webhooks receive the batch. If omitted, all active webhooks are notified. |

## Testing

- `POST /api/webhooks/test` (authenticated) sends an immediate `webhook.test` event to every active endpoint for the caller.

## Dashboard

- `GET /api/webhooks/delivery-stats` returns 7-day attempt totals, failure rate, last endpoint status, and recent rows (each HTTP try, including retries).
