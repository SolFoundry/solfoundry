# Webhooks

GitHub webhook integration for automated bounty management.

## Overview

SolFoundry uses GitHub webhooks to automate:

- Bounty creation from labeled issues
- PR tracking and matching
- Status updates on bounty lifecycle
- Automatic payouts on merge

## Webhook Endpoint

```
POST https://api.solfoundry.org/api/webhooks/github
```

## Configuration

### In GitHub Repository

1. Go to Settings > Webhooks
2. Add webhook URL: `https://api.solfoundry.org/api/webhooks/github`
3. Set Content type: `application/json`
4. Choose events: `pull_request`, `issues`
5. Set Secret: Your webhook secret

### Webhook Secret

Set the `GITHUB_WEBHOOK_SECRET` environment variable:

```bash
export GITHUB_WEBHOOK_SECRET="your-secret-here"
```

## Supported Events

### pull_request

Processes pull request events for bounty matching.

| Action | Description |
|--------|-------------|
| `opened` | New PR submitted |
| `synchronize` | PR updated with new commits |
| `closed` | PR merged or closed |
| `reopened` | PR reopened |

### issues

Processes issue events for bounty creation.

| Action | Description |
|--------|-------------|
| `opened` | Issue created (auto-bounty if labeled) |
| `labeled` | Label added (create bounty on `bounty` label) |
| `unlabeled` | Label removed |
| `closed` | Issue closed |

### ping

Tests webhook configuration.

## Event Processing

### PR Matching

PRs are matched to bounties via the PR body:

```markdown
Closes #123

This PR implements the wallet connection component.

Wallet: ABC123...
```

1. Parse `Closes #N` to find bounty issue
2. Extract wallet address for payout
3. Match to bounty in database
4. Update bounty status

### Auto-Bounty Creation

Issues with `bounty` label are automatically converted to bounties:

1. Detect `bounty` label on issue
2. Parse labels for tier and category:
   - `bounty-tier-1`, `bounty-tier-2`, `bounty-tier-3`
   - `frontend`, `backend`, `smart-contract`, etc.
3. Extract reward from body or calculate from tier
4. Create bounty in database

## Payload Examples

### pull_request.opened

```json
{
  "action": "opened",
  "number": 42,
  "pull_request": {
    "number": 42,
    "title": "Implement wallet connection component",
    "body": "Closes #123\n\n## Changes\n- Added wallet connection\n- Added disconnect button\n\nWallet: ABC123...",
    "state": "open",
    "user": {
      "login": "developer",
      "id": 12345
    },
    "head": {
      "ref": "feature/wallet-connection",
      "sha": "abc123def456"
    },
    "base": {
      "ref": "main"
    }
  },
  "repository": {
    "id": 67890,
    "name": "solfoundry",
    "full_name": "SolFoundry/solfoundry",
    "owner": {
      "login": "SolFoundry"
    }
  },
  "sender": {
    "login": "developer"
  }
}
```

### issues.labeled

```json
{
  "action": "labeled",
  "number": 123,
  "issue": {
    "number": 123,
    "title": "Implement wallet connection component",
    "body": "Create a React component for Solana wallet connection...",
    "labels": [
      {"name": "bounty"},
      {"name": "bounty-tier-1"},
      {"name": "frontend"}
    ],
    "state": "open",
    "user": {
      "login": "project-maintainer"
    }
  },
  "label": {
    "name": "bounty"
  },
  "repository": {
    "full_name": "SolFoundry/solfoundry"
  }
}
```

## Response Format

### Success

```json
{
  "status": "processed",
  "event": "pull_request",
  "bounty_id": "550e8400-e29b-41d4-a716-446655440000",
  "action": "opened"
}
```

### Ping Response

```json
{
  "msg": "pong"
}
```

### Unhandled Event

```json
{
  "status": "accepted",
  "event": "push",
  "handled": false
}
```

### Error

```json
{
  "error": "Invalid signature"
}
```

## Security

### Signature Verification

All webhooks must include a valid HMAC-SHA256 signature:

```http
X-Hub-Signature-256: sha256=abc123...
```

The signature is computed using:

```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"sha256={expected}", signature)
```

### Verification Process

1. Receive webhook payload
2. Extract `X-Hub-Signature-256` header
3. Compute HMAC-SHA256 of payload with secret
4. Compare signatures (constant-time comparison)
5. Reject if mismatch (401 Unauthorized)

## Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-GitHub-Event` | Yes | Event type |
| `X-Hub-Signature-256` | Yes | HMAC signature |
| `X-GitHub-Delivery` | No | Unique delivery ID |

## Response Codes

| Code | Description |
|------|-------------|
| 200 | Event processed successfully |
| 202 | Event accepted but not handled |
| 400 | Invalid JSON payload |
| 401 | Invalid signature |
| 503 | Webhook secret not configured |

## Testing Webhooks

### Using GitHub's Test Delivery

1. Go to repository Settings > Webhooks
2. Click on your webhook
3. Scroll to "Recent Deliveries"
4. Click "Redeliver" to test

### Using curl

```bash
# Generate signature
SECRET="your-webhook-secret"
PAYLOAD='{"action":"opened","number":1,"pull_request":{"number":1,"body":"Closes #1"},"repository":{"full_name":"test/repo"}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

# Send webhook
curl -X POST https://api.solfoundry.org/api/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

### Local Testing with ngrok

```bash
# Start local server
uvicorn app.main:app --reload

# Expose via ngrok
ngrok http 8000

# Use ngrok URL in GitHub webhook settings
# https://abc123.ngrok.io/api/webhooks/github
```

## Idempotency

Webhooks may be delivered multiple times. The `X-GitHub-Delivery` header provides a unique ID for each delivery.

### Handling Duplicate Deliveries

```python
processed_deliveries = set()

async def process_webhook(delivery_id: str, payload: dict):
    if delivery_id in processed_deliveries:
        return {"status": "duplicate", "handled": False}
    
    # Process webhook
    result = await process_payload(payload)
    
    processed_deliveries.add(delivery_id)
    return result
```

## Best Practices

### 1. Respond Quickly

Return a response within 10 seconds. For long processing:

```python
@router.post("/github")
async def receive_webhook(request: Request):
    # Validate signature
    verify_signature(request)
    
    # Queue for processing
    await queue_webhook(request.json())
    
    # Return immediately
    return {"status": "queued"}
```

### 2. Handle Failures

Implement retry logic for failed processing:

```python
async def process_with_retry(payload, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await process(payload)
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)
```

### 3. Log Everything

```python
import logging

logger = logging.getLogger(__name__)

@router.post("/github")
async def receive_webhook(request: Request):
    delivery_id = request.headers.get("X-GitHub-Delivery")
    event_type = request.headers.get("X-GitHub-Event")
    
    logger.info(f"Received {event_type} event (delivery={delivery_id})")
    
    # Process...
    
    logger.info(f"Processed {event_type} event (delivery={delivery_id})")
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check webhook secret configuration |
| 400 Bad Request | Validate JSON payload format |
| 404 Not Found | Verify webhook URL |
| Timeout | Process asynchronously |

### Debug Mode

Enable debug logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Testing Locally

Use a tool like `smee.io` or `ngrok` to receive webhooks locally:

```bash
# Using smee
npx smee-client -u https://smee.io/your-channel -t http://localhost:8000/api/webhooks/github
```