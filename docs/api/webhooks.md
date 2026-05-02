

# Bounty Event Webhooks

This guide explains how external applications can listen for events from SolFoundry's bounty system using webhooks.

## Overview

SolFoundry's bounty system supports webhooks for the following events:

- `bounty.created` - When a new bounty is created
- `claim.submitted` - When a bounty claim is submitted
- `payout.merged` - When a payout transaction is merged

## Setup

To receive webhook notifications:

1. **Register your webhook URL** with the SolFoundry API by making a POST request to:
   ```
   POST /api/webhooks
   ```

   Example request body:
   ```json
   {
     "url": "https://your-application.com/webhook-endpoint",
     "events": ["bounty.created", "claim.submitted", "payout.merged"]
   }
   ```

2. **Verify your webhook endpoint** by responding with a 200 OK status when first contacted.

## Event Payload Structure

All webhook events include a common payload structure with event-specific data:

```json
{
  "event": "bounty.created|claim.submitted|payout.merged",
  "data": {
    // Event-specific data
  },
  "timestamp": "2026-05-02T12:34:56Z",
  "transaction": "5xk...",
  "signature": "your-verification-signature"
}
```

## Event Details

### bounty.created

Triggered when a new bounty is created.

**Payload structure:**
```json
{
  "event": "bounty.created",
  "data": {
    "bountyId": "bounty_12345",
    "title": "Build a Solana NFT Collection",
    "description": "Create a collection of 1000 unique NFTs on Solana",
    "reward": {
      "amount": 1000,
      "token": "SOL"
    },
    "skills": ["Solidity", "Smart Contracts", "NFT"],
    "status": "open",
    "createdBy": "user_67890",
    "createdAt": "2026-05-01T10:00:00Z",
    "endDate": "2026-06-30T23:59:59Z",
    "tags": ["solana", "nft", "smart-contracts"]
  }
}
```

### claim.submitted

Triggered when a bounty claim is submitted.

**Payload structure:**
```json
{
  "event": "claim.submitted",
  "data": {
    "claimId": "claim_54321",
    "bountyId": "bounty_12345",
    "submittedBy": "user_98765",
    "submittedAt": "2026-05-05T14:30:00Z",
    "status": "pending",
    "description": "Implementation of the NFT collection with all required features",
    "proof": "ipfs://QmX...",
    "files": [
      {
        "name": "contract.sol",
        "url": "https://example.com/contract.sol",
        "size": 12345
      }
    ]
  }
}
```

### payout.merged

Triggered when a payout transaction is merged.

**Payload structure:**
```json
{
  "event": "payout.merged",
  "data": {
    "payoutId": "payout_98765",
    "claimId": "claim_54321",
    "bountyId": "bounty_12345",
    "amount": 1000,
    "token": "SOL",
    "transactionSignature": "5xk...",
    "status": "completed",
    "mergedAt": "2026-05-06T16:15:00Z",
    "recipient": "user_98765",
    "payer": "user_67890"
  }
}
```

## Security

1. **Verify webhook signatures** using the provided signature field
2. **Use HTTPS** for all webhook endpoints
3. **Implement idempotency** - handle duplicate events gracefully
4. **Set appropriate timeouts** - respond within 10 seconds to avoid retries

## Testing

To test your webhook setup:

1. Create a test bounty using the API
2. Submit a test claim
3. Verify you receive all expected events

## Troubleshooting

- **Missing events?** Check your registered events list
- **Duplicate events?** Implement idempotency handling
- **Signature verification fails?** Double-check your secret key
- **Connection issues?** Verify your endpoint is reachable

## Best Practices

1. **Process events asynchronously** - don't block your main application
2. **Store received events** - for replay and audit purposes
3. **Monitor webhook performance** - ensure timely processing
4. **Implement retry logic** - for transient failures
5. **Keep your endpoint available** - 24/7 uptime recommended

